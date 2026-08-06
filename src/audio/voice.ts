/**
 * The commentator's voice.
 *
 * Lines are fetched from the Worker, which serves them from R2. This is the one
 * part of the game that wants a network — so it is also the part that must fail
 * most quietly. Every failure path here ends in silence, never in an error the
 * player has to deal with: the line is already on screen as text, and the game
 * itself does not care whether anything was said.
 *
 * **Nobody gets cut off.** An earlier version interrupted whatever was playing
 * as soon as something more important happened, which is how a machine reads
 * alerts, not how a person commentates. A real broadcast finishes the sentence,
 * takes a breath, and moves on. So lines queue and play one after another, and
 * an urgent line takes the *front of the queue* rather than the microphone.
 *
 * The cost of that is lateness, which is handled by dropping rather than
 * rushing: idle chatter that has been waiting too long is thrown away, because
 * a remark about the opening arriving during the endgame is worse than silence.
 *
 * Audio is fetched once and then kept. R2 holds it for everyone, Cache Storage
 * holds it for this browser across reloads, and a blob URL holds it for this
 * page. A line is therefore generated exactly once in the lifetime of the
 * project, no matter how many people hear it or how often.
 */

import type { Line } from '../commentary/lines'

const API = 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Named cache so the audio survives a reload without re-fetching. */
const CACHE_NAME = 'co-tuong-voice-v1'

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
 * about one exchange of moves — past that, the oldest idle remark is dropped.
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
let current: HTMLAudioElement | null = null
let listener: ((line: Line | null) => void) | null = null

/** Object URLs held for the lifetime of the page so playback can reuse them. */
const urls = new Map<string, string>()

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
    current.pause()
    current.src = ''
    current = null
  }
  emit(null)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function audioUrl(id: string): Promise<string | null> {
  const held = urls.get(id)
  if (held) return held

  try {
    const request = `${API}/v1/line/${id}`
    let response: Response | undefined

    // Cache Storage rather than the HTTP cache: it survives reloads and lets a
    // returning player hear the commentary with no network at all. Combined
    // with R2 on the far side, a given line costs the API exactly one call ever.
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

    if (!response?.ok) return null
    const url = URL.createObjectURL(await response.blob())
    urls.set(id, url)
    return url
  } catch {
    // Offline, blocked, or the Worker is down. The line stays on screen as text.
    return null
  }
}

/** Plays one file through to its end. Resolves on failure too — never rejects. */
function playToEnd(url: string): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      if (current === el) current = null
      resolve()
    }

    const el = new Audio(url)
    el.volume = 0.9
    current = el
    el.addEventListener('ended', finish)
    el.addEventListener('error', finish)

    el.play().catch(() => {
      // Autoplay refused until the player interacts, or decoding failed.
      // Silence is acceptable; the caption carries the line.
      finish()
    })
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

      const url = await audioUrl(next.line.id)
      if (!enabled) break

      // The caption goes up when the line actually starts, audio or not.
      emit(next.line)
      if (url) {
        await playToEnd(url)
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
 * the network. Anything already cached costs nothing here.
 */
export function primeVoice(lines: Line[]): void {
  if (!enabled) return
  for (const line of lines.slice(0, 8)) void audioUrl(line.id)
}
