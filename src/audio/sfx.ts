/**
 * Game sound effects.
 *
 * Recorded samples in `public/sfx/`, generated once and committed with the app
 * so a piece still lands with a sound when there is no network — the same
 * reason the rest of the game works offline.
 *
 * The synthesised versions below remain as a fallback for the case where a
 * sample fails to load or decode. Keeping them costs nothing, and a silent
 * board is a worse failure than a slightly electronic one.
 *
 * Samples are decoded into buffers rather than played through `<audio>`, so
 * two sounds close together overlap cleanly instead of cutting each other off.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * so the context is created lazily on the first sound and resumed if suspended.
 */

let ctx: AudioContext | null = null
let enabled = true

/** Master level. Deliberately modest: a chess app should not startle anyone. */
const MASTER_GAIN = 0.32

/** Per-sample level, trimming the generated files to a comfortable balance. */
const SAMPLE_GAIN: Record<SampleId, number> = {
  move: 0.9,
  capture: 1,
  select: 0.55,
  check: 0.8,
  win: 0.85,
  loss: 0.85,
  draw: 0.8,
  // The animal calls carry further than wood, so they sit lower.
  'cap-r': 0.95,
  'cap-c': 0.9,
  'cap-h': 0.75,
  'cap-e': 0.7,
  'cap-a': 0.9,
  'cap-p': 0.9,
}

export type SampleId =
  | 'move'
  | 'capture'
  | 'select'
  | 'check'
  | 'win'
  | 'loss'
  | 'draw'
  | CaptureSampleId

/**
 * A capture sound named after the piece that was taken.
 *
 * A Horse falling whinnies and an Elephant trumpets, so the ear knows what came
 * off the board without the player having to look. The King is absent: it is
 * never actually captured, the game ends first.
 */
export type CaptureSampleId = 'cap-r' | 'cap-c' | 'cap-h' | 'cap-e' | 'cap-a' | 'cap-p'

/** The engine's letters for piece kinds, as far as this module cares. */
export type VictimKind = 'r' | 'c' | 'h' | 'e' | 'a' | 'p' | 'k'

/** Decoded samples, and the in-flight loads that will become them. */
const buffers = new Map<SampleId, AudioBuffer>()
const loading = new Map<SampleId, Promise<void>>()

function sampleUrl(id: SampleId): string {
  // Relative to the document, matching Vite's `base: './'` and the Tauri
  // custom protocol.
  return new URL(`sfx/${id}.mp3`, document.baseURI).href
}

async function load(c: AudioContext, id: SampleId): Promise<void> {
  if (buffers.has(id)) return
  const existing = loading.get(id)
  if (existing) return existing

  const job = (async () => {
    try {
      const res = await fetch(sampleUrl(id))
      if (!res.ok) return
      buffers.set(id, await c.decodeAudioData(await res.arrayBuffer()))
    } catch {
      // Leave it absent; `play` falls back to synthesis.
    } finally {
      loading.delete(id)
    }
  })()
  loading.set(id, job)
  return job
}

/**
 * Play a sample if it is ready, and report whether it was.
 *
 * Never waits for a download: a sound arriving after the move it belongs to is
 * worse than no sound, so a cold sample falls back to synthesis this once and
 * loads in the background for next time.
 */
function playSample(id: SampleId): boolean {
  const c = audio()
  if (!c) return true // Sound is off; treat as handled.

  const buffer = buffers.get(id)
  if (!buffer) {
    void load(c, id)
    return false
  }

  const src = c.createBufferSource()
  src.buffer = buffer
  const amp = c.createGain()
  amp.gain.value = SAMPLE_GAIN[id] * MASTER_GAIN
  src.connect(amp).connect(c.destination)
  src.start()
  return true
}

/**
 * Fetch and decode every sample.
 *
 * Called on the first interaction, which is both when the audio context can
 * legally start and well before the first move needs a sound.
 */
export function primeSounds(): void {
  const c = audio()
  if (!c) return
  for (const id of Object.keys(SAMPLE_GAIN) as SampleId[]) void load(c, id)
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

/**
 * The one audio context in the app.
 *
 * Shared with the commentary rather than kept private. An earlier version had
 * the voice play through an `<audio>` element while the effects went through
 * Web Audio, and on iOS those are two competing audio sessions: a piece landing
 * would cut the commentator off mid-sentence. One graph, one session, nothing
 * interrupts anything.
 *
 * Deliberately does *not* consult the sound-effects switch. Sharing the graph
 * must not mean sharing the preference: turning the effects off silenced the
 * commentator too, which is not what that switch says it does.
 */
export function audioContext(): AudioContext | null {
  return context()
}

function audio(): AudioContext | null {
  if (!enabled) return null
  return context()
}

/**
 * Create the context, or return the one already made.
 *
 * Browsers refuse to start audio until the page has been interacted with, and
 * on iOS a context created before that point stays suspended — resuming it
 * later only works from inside a real gesture, which is what `unlock` below is
 * for. Everything here tolerates a suspended context; nothing assumes sound.
 */
function context(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (
          window as unknown as {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
      listenForGesture()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

let listening = false
let silentLoop: HTMLAudioElement | null = null

/**
 * A one-sample silent WAV, as a blob URL.
 *
 * Built rather than embedded: forty-six bytes of header is clearer written out
 * than pasted in as base64 nobody can read.
 */
function silentClip(): string {
  const bytes = new Uint8Array(46)
  const view = new DataView(bytes.buffer)
  const ascii = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) bytes[at + i] = text.charCodeAt(i)
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 38, true) // file size after this field
  ascii(8, 'WAVEfmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, 8000, true) // sample rate
  view.setUint32(28, 16000, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, 2, true) // one 16-bit sample of silence
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
}

/**
 * Ask iOS to treat this as media playback rather than ambient sound.
 *
 * Web Audio lands in the "ambient" audio session, which the hardware mute
 * switch on the side of an iPhone silences outright. That is fine for a page
 * that beeps and wrong for a game with a commentator — and it is invisible from
 * a desktop, where there is no such switch. Installed as a PWA it is worse
 * still: there is no browser chrome left to hint that the phone, not the app,
 * is the thing that muted it.
 *
 * `navigator.audioSession` says so directly on iOS 16.4 and later. Before that,
 * the only lever is an HTMLMediaElement: while one is playing, WebKit picks the
 * playback category, and a silent loop is the cheapest way to hold one open.
 *
 * Must run inside a gesture, like the resume it sits next to.
 */
function claimPlaybackSession(): void {
  const nav = navigator as Navigator & { audioSession?: { type: string } }
  if (nav.audioSession) {
    try {
      nav.audioSession.type = 'playback'
      return
    } catch {
      // Read-only on this build; fall through to the media element.
    }
  }

  if (silentLoop) return
  try {
    const el = new Audio(silentClip())
    el.loop = true
    el.volume = 0
    // Never take over the lock screen or interrupt the player's music.
    el.setAttribute('playsinline', '')
    silentLoop = el
    void el.play().catch(() => {
      silentLoop = null
    })
  } catch {
    // No media element available; the mute switch wins and the game is silent
    // but otherwise unaffected.
  }
}

/**
 * Resume the context on the player's first touch.
 *
 * This has to run *inside* the gesture handler — a resume started from a timer
 * or a promise that a gesture happened to kick off does not count on iOS. It is
 * registered once, on every kind of first contact a player might make.
 */
function listenForGesture(): void {
  if (listening || typeof window === 'undefined') return
  listening = true
  const wake = () => {
    claimPlaybackSession()
    if (ctx && ctx.state !== 'running') void ctx.resume()
    if (ctx?.state === 'running') {
      for (const type of ['pointerdown', 'touchend', 'keydown']) {
        window.removeEventListener(type, wake)
      }
    }
  }
  for (const type of ['pointerdown', 'touchend', 'keydown']) {
    window.addEventListener(type, wake)
  }

  /*
   * Coming back from the background leaves the context suspended.
   *
   * An installed PWA is switched away from and back to constantly, and without
   * this the game returns to the board in silence with nothing on screen to
   * explain it.
   */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx?.state === 'suspended') {
      void ctx.resume()
    }
  })
}

/**
 * A short burst of filtered noise — the body of a wooden knock.
 *
 * A piece landing on a board is mostly broadband transient, which a pure tone
 * cannot imitate; noise through a band-pass is what makes it read as "wood"
 * rather than "beep".
 */
function knock(
  c: AudioContext,
  at: number,
  { freq, decay, gain, q = 3 }: { freq: number; decay: number; gain: number; q?: number }
): void {
  const frames = Math.floor(c.sampleRate * decay)
  const buffer = c.createBuffer(1, Math.max(1, frames), c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    // Exponentially decaying white noise.
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.5)
  }

  const src = c.createBufferSource()
  src.buffer = buffer

  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = freq
  filter.Q.value = q

  const amp = c.createGain()
  amp.gain.setValueAtTime(gain * MASTER_GAIN, at)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay)

  src.connect(filter).connect(amp).connect(c.destination)
  src.start(at)
  src.stop(at + decay)
}

/** A pitched tone with a soft attack, for bells and chords. */
function tone(
  c: AudioContext,
  at: number,
  {
    freq,
    decay,
    gain,
    type = 'sine',
  }: { freq: number; decay: number; gain: number; type?: OscillatorType }
): void {
  const osc = c.createOscillator()
  osc.type = type
  osc.frequency.value = freq

  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, at)
  amp.gain.exponentialRampToValueAtTime(gain * MASTER_GAIN, at + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, at + decay)

  osc.connect(amp).connect(c.destination)
  osc.start(at)
  osc.stop(at + decay + 0.02)
}

/** Picking a piece up: a light tick, quieter than a move. */
export function playSelect(): void {
  if (playSample('select')) return
  const c = audio()
  if (!c) return
  knock(c, c.currentTime, { freq: 1700, decay: 0.05, gain: 0.35, q: 4 })
}

/** A quiet move: wood on wood. */
export function playMove(): void {
  if (playSample('move')) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  knock(c, t, { freq: 900, decay: 0.09, gain: 1, q: 2.2 })
  // A little low body under the click gives it weight.
  tone(c, t, { freq: 180, decay: 0.08, gain: 0.35, type: 'triangle' })
}

/**
 * A capture: heavier, with the two pieces meeting.
 *
 * `victim` chooses the sound of whatever came off the board. Without it, or
 * before that sample has loaded, the generic capture stands in — a Horse with
 * no whinny is still better than a Horse with no sound.
 */
export function playCapture(victim?: VictimKind): void {
  if (victim && victim !== 'k' && playSample(`cap-${victim}` as CaptureSampleId)) return
  if (playSample('capture')) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  knock(c, t, { freq: 520, decay: 0.16, gain: 1.25, q: 1.4 })
  tone(c, t, { freq: 120, decay: 0.16, gain: 0.5, type: 'triangle' })
  // A second, softer knock a hair later reads as the captured piece leaving.
  knock(c, t + 0.045, { freq: 1100, decay: 0.09, gain: 0.5, q: 3 })
}

/** Check: a bright gong, the one sound that should cut through. */
export function playCheck(): void {
  if (playSample('check')) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // Slightly detuned partials are what make a struck-metal timbre.
  tone(c, t, { freq: 880, decay: 0.9, gain: 0.5 })
  tone(c, t, { freq: 1319, decay: 0.75, gain: 0.3 })
  tone(c, t, { freq: 1760, decay: 0.5, gain: 0.18 })
  knock(c, t, { freq: 2600, decay: 0.12, gain: 0.5, q: 1.5 })
}

/** Checkmate or resignation, from the winner's point of view. */
export function playGameEnd(result: 'win' | 'loss' | 'draw'): void {
  if (playSample(result)) return
  const c = audio()
  if (!c) return
  const t = c.currentTime
  // Rising for a win, falling for a loss, flat for a draw.
  const motif =
    result === 'win' ? [523, 659, 784] : result === 'loss' ? [523, 415, 349] : [523, 523, 523]
  motif.forEach((freq, i) => {
    tone(c, t + i * 0.16, { freq, decay: 0.5, gain: 0.45, type: 'sine' })
  })
}

/** An attempted move that is not allowed. */
export function playIllegal(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  tone(c, t, { freq: 220, decay: 0.14, gain: 0.4, type: 'square' })
}

/**
 * Pick the right sound for a move that was just played.
 *
 * Check outranks capture: a capture that also gives check is, to the player,
 * primarily a check.
 */
export function playMoveOutcome(outcome: {
  capture: boolean
  check: boolean
  ended: boolean
  result?: 'win' | 'loss' | 'draw'
  /** Which kind was taken, so the capture can sound like that piece. */
  victim?: VictimKind
}): void {
  if (outcome.ended) {
    playGameEnd(outcome.result ?? 'draw')
    return
  }
  if (outcome.check) {
    playCheck()
    return
  }
  if (outcome.capture) {
    playCapture(outcome.victim)
    return
  }
  playMove()
}
