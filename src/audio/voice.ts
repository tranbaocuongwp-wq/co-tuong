/**
 * The commentator's voice.
 *
 * Lines are fetched from the Worker, which serves them from R2. This is the one
 * part of the game that wants a network — so it is also the part that must fail
 * most quietly. Every failure path here ends in silence, never in an error the
 * player has to deal with: the line is already on screen as text, and the game
 * itself does not care whether anything was said.
 *
 * **Nobody gets cut off.** Two separate things used to cut the commentator off
 * mid-sentence, and both are fixed here:
 *
 * 1. An urgent line used to take the microphone from whatever was speaking.
 *    Now lines queue and play one after another; an urgent line takes the
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
 * Audio is fetched once and then kept. R2 holds it for everyone, Cache Storage
 * holds it for this browser across reloads, and a decoded buffer holds it for
 * this page. A line is therefore generated exactly once in the lifetime of the
 * project, no matter how many people hear it or how often.
 */

import type { Line } from '../commentary/lines'
import { audioContext } from './sfx'

const API = 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Named cache so the audio survives a reload without re-fetching. */
const CACHE_NAME = 'co-tuong-voice-v1'

/** Level for the voice, against the sound effects it now shares a graph with. */
const VOICE_GAIN = 0.95

/**
 * How much a line outranks the others *waiting to be said*.
 *
 * This decides queue order and what gets dropped under pressure. It no longer
 * decides who gets interrupted, because nobody does.
 */
export type VoicePriority = 'idle' | 'event' | 'critical'

const RANK: Record<VoicePriority, number> = { idle: 0, event: 1, critical: 2 }

/** The breath between two lines. Long enough to hear the seam, short enough to feel live. */
const GAP_MS = 340

/**
 * How many lines may be waiting.
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

interface Queued {
  line: Line
  priority: VoicePriority
  queuedAt: number
  /** Insertion order, so equal priorities keep the order they happened in. */
  seq: number
}

let enabled = false
let seq = 0
let queue: Queued[] = []
let running = false
let current: AudioBufferSourceNode | null = null
let listener: ((line: Line | null) => void) | null = null

/** Decoded audio, and the in-flight loads that will become it. */
const buffers = new Map<string, AudioBuffer>()
const loading = new Map<string, Promise<void>>()

export function setVoiceEnabled(on: boolean): void {
  if (enabled === on) return
  enabled = on
  if (!on) stopVoice()
}

export function isVoiceEnabled(): boolean {
  return enabled
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
 * The caption is driven from here rather than from the code that decides on a
 * line, so the words on screen belong to the voice the player is hearing right
 * now — not to a line still three deep in the queue.
 */
export function onVoiceLine(fn: (line: Line | null) => void): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

function emit(line: Line | null): void {
  listener?.(line)
}

export function stopVoice(): void {
  queue = []
  if (current) {
    try {
      current.stop()
    } catch {
      // Already finished; stopping twice is not an error worth surfacing.
    }
    current = null
  }
  emit(null)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetch and decode one line, or resolve to nothing if it cannot be had. */
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
      // Combined with R2 on the far side, a line costs the API one call ever.
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
      // Offline, blocked, or the Worker is down. The line stays on screen as
      // text and nothing else notices.
    } finally {
      loading.delete(id)
    }
  })()
  loading.set(id, job)
  return job
}

/** Plays one buffer through to its end. Resolves on failure too — never rejects. */
function playToEnd(ctx: AudioContext, buffer: AudioBuffer): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (current === src) current = null
      resolve()
    }

    const src = ctx.createBufferSource()
    src.buffer = buffer
    const amp = ctx.createGain()
    amp.gain.value = VOICE_GAIN
    src.connect(amp).connect(ctx.destination)
    src.addEventListener('ended', finish)
    current = src
    try {
      src.start()
    } catch {
      finish()
    }
    // A stuck source must not wedge the queue: fall through a little after the
    // buffer would have finished anyway.
    setTimeout(finish, (buffer.duration + 0.5) * 1000)
  })
}

/**
 * Works the queue until it is empty, one line at a time.
 *
 * Only ever one of these is running, which is what makes the sequencing hold:
 * `speak` just adds to the queue and this loop decides when each line gets its
 * turn at the microphone.
 */
async function run(): Promise<void> {
  if (running) return
  running = true
  try {
    while (enabled && queue.length > 0) {
      const next = queue.shift()
      if (!next) break

      // Overtaken by the game while it waited. Say nothing rather than say it late.
      if (next.priority === 'idle' && Date.now() - next.queuedAt > STALE_MS) continue

      const ctx = audioContext()
      if (ctx) await load(ctx, next.line.id)
      if (!enabled) break

      // The caption goes up when the line actually starts, audio or not.
      emit(next.line)
      const buffer = ctx ? buffers.get(next.line.id) : undefined
      if (ctx && buffer) {
        await playToEnd(ctx, buffer)
      } else {
        // No audio to be had: hold the caption long enough to read instead.
        await sleep(Math.max(MIN_CAPTION_MS, (next.line.text.length / CHARS_PER_SECOND) * 1000))
      }

      if (enabled && queue.length > 0) await sleep(GAP_MS)
    }
  } finally {
    running = false
    current = null
    emit(null)
  }
}

/**
 * Put a line in the commentator's mouth, in turn.
 *
 * Returns as soon as the line is queued — it does not wait for the line to be
 * spoken, because the board must never wait on the commentary.
 */
export function speak(line: Line, priority: VoicePriority = 'event'): void {
  if (!enabled) return

  // Already waiting to be said; queueing it twice would stutter.
  if (queue.some((q) => q.line.id === line.id)) return

  queue.push({ line, priority, queuedAt: Date.now(), seq: seq++ })

  // Urgent lines move to the front of the queue — but they still wait for the
  // current line to finish. Equal priorities keep the order they happened in.
  queue.sort((a, b) => RANK[b.priority] - RANK[a.priority] || a.seq - b.seq)

  // Under pressure, drop from the back: that is the least urgent and the oldest.
  while (queue.length > MAX_QUEUE) queue.pop()

  void run()
}

/**
 * Fetch lines ahead of time.
 *
 * Called when a game starts so the opening remark is not the one that waits on
 * the network. Anything already decoded costs nothing here.
 */
export function primeVoice(lines: Line[]): void {
  if (!enabled) return
  const ctx = audioContext()
  if (!ctx) return
  for (const line of lines.slice(0, 8)) void load(ctx, line.id)
}
