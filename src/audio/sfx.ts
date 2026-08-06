/**
 * Game sound effects, synthesised rather than downloaded.
 *
 * Every sound here is generated with the Web Audio API. That is a deliberate
 * choice over shipping audio files: it costs no download at all, it works with
 * no network — which is the whole point of this app — and it sidesteps sample
 * licensing entirely. These are short percussive sounds, exactly the kind
 * synthesis does well.
 *
 * Browsers refuse to start audio until the user has interacted with the page,
 * so the context is created lazily on the first sound and resumed if suspended.
 */

let ctx: AudioContext | null = null
let enabled = true

/** Master level. Deliberately modest: a chess app should not startle anyone. */
const MASTER_GAIN = 0.32

export function setSoundEnabled(on: boolean): void {
  enabled = on
}

function audio(): AudioContext | null {
  if (!enabled) return null
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as {
        webkitAudioContext?: typeof AudioContext
      }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
    }
    // Safari and Chrome start the context suspended until a gesture.
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
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
  const c = audio()
  if (!c) return
  knock(c, c.currentTime, { freq: 1700, decay: 0.05, gain: 0.35, q: 4 })
}

/** A quiet move: wood on wood. */
export function playMove(): void {
  const c = audio()
  if (!c) return
  const t = c.currentTime
  knock(c, t, { freq: 900, decay: 0.09, gain: 1, q: 2.2 })
  // A little low body under the click gives it weight.
  tone(c, t, { freq: 180, decay: 0.08, gain: 0.35, type: 'triangle' })
}

/** A capture: heavier, with the two pieces meeting. */
export function playCapture(): void {
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
    playCapture()
    return
  }
  playMove()
}
