/**
 * The commentator's voice.
 *
 * Audio is fetched from the Worker, which serves it from R2. This is the one
 * part of the game that wants a network — so it is also the part that must fail
 * most quietly. Every failure path here ends in silence, never in an error the
 * player has to deal with: the words are already on screen, and the game itself
 * does not care whether anything was said.
 *
 * **Nobody gets cut off.** Two separate things used to cut the commentator off
 * mid-sentence, and both are fixed here:
 *
 * 1. An urgent line used to take the microphone from whatever was speaking.
 *    Now utterances queue and play one after another; an urgent one takes the
 *    *front of the queue* instead.
 * 2. The voice played through an `<audio>` element while the sound effects went
 *    through Web Audio. On iOS those are two competing audio sessions, so a
 *    piece landing would stop the commentator dead. Everything now goes through
 *    the one shared audio graph, scheduled as buffers — a capture and a
 *    sentence simply mix.
 *
 * The cost of queueing is lateness, handled by dropping rather than rushing:
 * idle chatter that has been waiting too long is thrown away, because a remark
 * about the opening arriving during the endgame is worse than silence.
 *
 * An utterance can be several recordings played back to back. That is how a
 * move gets read out: "Đỏ", "Pháo", "hai", "bình", "năm" are separate files,
 * joined here into one sentence. Joining is why this schedules buffers itself
 * rather than playing them one at a time — the seams have to fall inside a few
 * milliseconds, which no amount of awaiting will give you.
 *
 * Audio is fetched once and then kept. R2 holds it for everyone, Cache Storage
 * holds it for this browser across reloads, and a decoded buffer holds it for
 * this page.
 */

import type { Line } from '../commentary/lines'
import { audioContext } from './sfx'

const API = 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Named cache so the audio survives a reload without re-fetching. */
const CACHE_NAME = 'co-tuong-voice-v1'

/** Level for the voice, against the sound effects it shares a graph with. */
const VOICE_GAIN = 0.95

/**
 * Amplitude below which a sample counts as silence when trimming joins.
 *
 * Generated clips carry a little silence at each end. Left in, a five-word
 * phrase gains most of a second of dead air spread through the middle of it and
 * stops sounding like a sentence.
 */
const SILENCE = 0.012

/** Never trim a clip shorter than this, however quiet it looks. */
const MIN_CLIP = 0.12

/** A hair of overlap at each join, so words run together rather than butt. */
const JOIN_OVERLAP = 0.02

/**
 * How much an utterance outranks the others *waiting to be said*.
 *
 * This decides queue order and what gets dropped under pressure. It no longer
 * decides who gets interrupted, because nobody does.
 */
export type VoicePriority = 'idle' | 'event' | 'critical'

const RANK: Record<VoicePriority, number> = { idle: 0, event: 1, critical: 2 }

/** The breath between two utterances. Long enough to hear the seam, short enough to feel live. */
const GAP_MS = 300

/**
 * How many utterances may be waiting.
 *
 * Deep queues are how commentary drifts out of sync with the board. Three is
 * about one exchange of moves — past that, the least urgent is dropped.
 */
const MAX_QUEUE = 3

/** An idle remark this old has been overtaken by the game and is discarded unsaid. */
const STALE_MS = 15_000

/** Reading pace used to hold a caption on screen when the audio could not be had. */
const CHARS_PER_SECOND = 15
const MIN_CAPTION_MS = 1600

/**
 * Something for the commentator to say.
 *
 * One scripted line is the simple case. A move read aloud is the other: several
 * recorded words whose ids are joined into one sentence, shown on screen as one
 * caption.
 */
export interface Utterance {
  /** Stable identity, for de-duplicating the queue and for the game's record. */
  id: string
  /** The words, as shown on screen. */
  text: string
  /** Audio ids, played back to back. */
  parts: string[]
}

interface Queued {
  utterance: Utterance
  priority: VoicePriority
  queuedAt: number
  /** Insertion order, so equal priorities keep the order they happened in. */
  seq: number
}

/**
 * How much of the commentator is switched on.
 *
 * - `off` — he is not there at all.
 * - `silent` — he still decides what to say and the words still appear, but
 *   nothing is fetched and nothing is heard.
 * - `voice` — the full thing.
 *
 * `silent` exists because turning the sound off should not turn the *commentary*
 * off. On a screen with room for it the remarks go into a feed beside the board
 * instead, and a feed that only fills up when the speaker is on would be a
 * strange thing to build. Running it through this same queue rather than a
 * separate path is what makes the feed read like a broadcast: the same ordering,
 * the same "urgent goes to the front", the same discarding of stale chatter, and
 * the same pacing — lines arrive as they would have been said, not all at once.
 */
export type VoiceMode = 'off' | 'silent' | 'voice'

let mode: VoiceMode = 'off'
let seq = 0
let queue: Queued[] = []
let running = false
let playing: AudioBufferSourceNode[] = []
let listener: ((utterance: Utterance | null) => void) | null = null

/** Decoded audio, and the in-flight loads that will become it. */
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<void>>()

/** Whether the commentator is running at all, aloud or not. */
function live(): boolean {
  return mode !== 'off'
}

export function setVoiceMode(next: VoiceMode): void {
  if (mode === next) return
  const wasLive = live()
  mode = next
  // Going quiet must stop what is already in the air; going from silent to
  // spoken (or back) must not throw away a queue that is still relevant.
  if (!live() && wasLive) stopVoice()
  if (mode === 'silent') {
    for (const src of playing) {
      try {
        src.stop()
      } catch {
        // Already finished.
      }
    }
    playing = []
  }
}

export function setVoiceEnabled(on: boolean): void {
  setVoiceMode(on ? 'voice' : 'off')
}

export function isVoiceEnabled(): boolean {
  return live()
}

/**
 * Whether anything is being said or waiting to be said.
 *
 * The filler that keeps the broadcast alive during a long think asks this
 * before it speaks, so it fills actual silences rather than piling onto a queue
 * that is already talking.
 */
export function isVoiceBusy(): boolean {
  return running || queue.length > 0
}

/**
 * Watch what is being said, as it is said.
 *
 * The caption is driven from here rather than from the code that decides what
 * to say, so the words on screen belong to the voice the player is hearing
 * right now — not to something still three deep in the queue.
 */
export function onVoiceLine(fn: (utterance: Utterance | null) => void): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

function emit(utterance: Utterance | null): void {
  listener?.(utterance)
}

export function stopVoice(): void {
  queue = []
  for (const src of playing) {
    try {
      src.stop()
    } catch {
      // Already finished; stopping twice is not an error worth surfacing.
    }
  }
  playing = []
  emit(null)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch and decode one recording, or resolve to nothing if it cannot be had. */
async function load(ctx: AudioContext, id: string): Promise<void> {
  if (buffers.has(id)) return
  const existing = loading.get(id)
  if (existing) return existing

  const job = (async () => {
    try {
      const request = `${API}/v1/line/${id}`
      let response: Response | undefined

      // Cache Storage rather than the HTTP cache: it survives reloads and lets
      // a returning player hear the commentary with no network at all.
      // Combined with R2 on the far side, a recording costs one API call ever.
      if ('caches' in globalThis) {
        const cache = await caches.open(CACHE_NAME)
        response = await cache.match(request)
        if (!response) {
          const fresh = await fetch(request)
          if (fresh.ok) {
            await cache.put(request, fresh.clone())
            response = fresh
          }
        }
      } else {
        const fresh = await fetch(request)
        if (fresh.ok) response = fresh
      }

      if (!response?.ok) return
      buffers.set(id, await ctx.decodeAudioData(await response.arrayBuffer()))
    } catch {
      // Offline, blocked, or the Worker is down. The words stay on screen and
      // nothing else notices.
    } finally {
      loading.delete(id)
    }
  })()
  loading.set(id, job)
  return job
}

/** Where the speech actually starts and ends, ignoring the silence around it. */
function speechBounds(buffer: AudioBuffer): { start: number; end: number } {
  const data = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  let first = 0
  let last = data.length - 1
  while (first < data.length && Math.abs(data[first]) < SILENCE) first++
  while (last > first && Math.abs(data[last]) < SILENCE) last--
  if (last <= first) return { start: 0, end: buffer.duration }
  const start = first / rate
  const end = last / rate
  return end - start < MIN_CLIP ? { start: 0, end: buffer.duration } : { start, end }
}

/**
 * Plays recordings back to back as one sentence.
 *
 * Scheduled ahead on the audio clock rather than played one after another from
 * JavaScript: a join has to land within a few milliseconds, and a timer or an
 * awaited promise is nowhere near that accurate.
 *
 * Resolves when the last one has finished, and on failure too — never rejects.
 */
function playSequence(ctx: AudioContext, list: AudioBuffer[]): Promise<void> {
  return new Promise((resolve) => {
    // A little lead-in, so the first word is not clipped by scheduling latency.
    let at = ctx.currentTime + 0.06
    const started: AudioBufferSourceNode[] = []

    for (const buffer of list) {
      const { start, end } = speechBounds(buffer)
      const span = end - start
      const src = ctx.createBufferSource()
      src.buffer = buffer
      const amp = ctx.createGain()
      amp.gain.value = VOICE_GAIN
      src.connect(amp).connect(ctx.destination)
      try {
        src.start(at, start, span)
      } catch {
        continue
      }
      started.push(src)
      at += Math.max(MIN_CLIP, span - JOIN_OVERLAP)
    }

    playing = started
    if (started.length === 0) {
      resolve()
      return
    }

    let done = false
    const finish = () => {
      if (done) return
      done = true
      playing = []
      resolve()
    }
    started[started.length - 1].addEventListener('ended', finish)
    // A source that never fires `ended` must not wedge the queue.
    setTimeout(finish, (at - ctx.currentTime + 0.5) * 1000)
  })
}

/**
 * Works the queue until it is empty, one utterance at a time.
 *
 * Only ever one of these is running, which is what makes the sequencing hold:
 * `speak` just adds to the queue and this loop decides when each one gets its
 * turn at the microphone.
 */
async function run(): Promise<void> {
  if (running) return
  running = true
  try {
    while (live() && queue.length > 0) {
      const next = queue.shift()
      if (!next) break

      // Overtaken by the game while it waited. Say nothing rather than say it late.
      if (next.priority === 'idle' && Date.now() - next.queuedAt > STALE_MS) continue

      /*
       * Getting the audio is entirely optional, at every step.
       *
       * The recording may not exist yet, the Worker may be down, the browser may
       * be offline, the audio context may still be waiting on a gesture. None of
       * those is an error the player should meet: if the sound can be had it
       * plays, and if it cannot the words go up on screen for as long as they
       * would have taken to say. The game itself never waits on any of this.
       */
      let ctx: AudioContext | null = null
      if (mode === 'voice') {
        const found = audioContext()
        if (found && found.state !== 'running') {
          try {
            await found.resume()
          } catch {
            // Still waiting on a gesture; the caption carries this one.
          }
        }
        ctx = found?.state === 'running' ? found : null
        if (ctx) await Promise.all(next.utterance.parts.map((id) => load(ctx as AudioContext, id)))
      }
      if (!live()) break

      // The caption goes up when the utterance actually starts, audio or not.
      emit(next.utterance)

      const list = ctx
        ? next.utterance.parts.map((id) => buffers.get(id)).filter((b): b is AudioBuffer => !!b)
        : []

      // All or nothing: half a sentence is worse than a caption on its own.
      if (ctx && list.length === next.utterance.parts.length) {
        await playSequence(ctx, list)
      } else {
        await sleep(
          Math.max(MIN_CAPTION_MS, (next.utterance.text.length / CHARS_PER_SECOND) * 1000)
        )
      }

      if (live() && queue.length > 0) await sleep(GAP_MS)
    }
  } finally {
    running = false
    playing = []
    emit(null)
  }
}

/** Queue an utterance. Returns at once; the board never waits on the commentary. */
export function say(utterance: Utterance, priority: VoicePriority = 'event'): void {
  if (!live()) return

  // Already waiting to be said; queueing it twice would stutter.
  if (queue.some((q) => q.utterance.id === utterance.id)) return

  queue.push({ utterance, priority, queuedAt: Date.now(), seq: seq++ })

  // Urgent utterances move to the front of the queue — but they still wait for
  // the current one to finish. Equal priorities keep the order they happened in.
  queue.sort((a, b) => RANK[b.priority] - RANK[a.priority] || a.seq - b.seq)

  // Under pressure, drop from the back: that is the least urgent and the oldest.
  while (queue.length > MAX_QUEUE) queue.pop()

  void run()
}

/** Queue one scripted line. */
export function speak(line: Line, priority: VoicePriority = 'event'): void {
  say({ id: line.id, text: line.text, parts: [line.id] }, priority)
}

/**
 * Queue a sentence assembled from recorded words.
 *
 * `text` is what appears on screen; the words are what is heard. They are given
 * separately because the caption reads better than a word-by-word transcript.
 */
export function speakWords(text: string, words: Line[], priority: VoicePriority = 'event'): void {
  if (words.length === 0) return
  say({ id: words.map((w) => w.id).join('+'), text, parts: words.map((w) => w.id) }, priority)
}

/**
 * Pull recordings down ahead of time.
 *
 * Network only — deliberately no decoding, because decoding needs an
 * AudioContext and this runs as the page loads, before the player has touched
 * anything. A context created at that moment starts suspended, and on iOS the
 * gesture that would have unlocked it has already gone by.
 *
 * Anything already in the cache costs nothing here.
 */
export function primeVoice(lines: Line[]): void {
  // Only when something will actually be heard. Pulling megabytes down for a
  // feed that is going to render text would be someone else's data plan spent
  // on nothing.
  if (mode !== 'voice') return
  for (const line of lines) void warm(line.id)
}

async function warm(id: string): Promise<void> {
  if (buffers.has(id) || !('caches' in globalThis)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    const request = `${API}/v1/line/${id}`
    if (await cache.match(request)) return
    const fresh = await fetch(request)
    if (fresh.ok) await cache.put(request, fresh)
  } catch {
    // Offline. The words still appear on screen.
  }
}
