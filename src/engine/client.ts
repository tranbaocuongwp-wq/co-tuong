/**
 * EngineClient — one interface, two implementations.
 *
 * Inside the Tauri app the search runs as native code over IPC (roughly twice
 * the nodes per second of WebAssembly, worth about a ply of depth). In the
 * browser it runs in a Web Worker. Both speak the same shapes, so nothing above
 * this file knows or cares which is active.
 */

import type { Calibration, HintInfo, SearchInfo, SearchOptions } from './types'
import type { WorkerRequest, WorkerResponse } from './worker'

export interface EngineClient {
  readonly kind: 'native' | 'wasm'
  search(
    startFen: string,
    moves: string,
    options: SearchOptions,
    onProgress?: (info: SearchInfo) => void
  ): Promise<SearchInfo>
  /**
   * The best few moves, best first, each with the reasons behind it.
   *
   * Separate from `search` because it asks a different question: not "what
   * should I play" but "what are my options, and how much worse is each one".
   */
  hints(
    startFen: string,
    moves: string,
    options: SearchOptions,
    count: number
  ): Promise<HintInfo[]>
  learn(
    startFen: string,
    moves: string,
    learner: 'r' | 'b',
    outcome: 'win' | 'loss' | 'draw'
  ): Promise<number>
  loadExperience(text: string): Promise<number>
  experienceText(): Promise<string>
  reset(): Promise<void>
  /** Measure this machine's search rate. See `engine/src/bench.rs`. */
  calibrate(budgetMs: number): Promise<Calibration>
  /**
   * Stop the search that is running now.
   *
   * Honest about what it can do, which differs by host. On the desktop it is a
   * real mid-search cancel: the search has a thread of its own and something
   * else can still raise a flag. In a browser it is not — a worker sitting
   * inside a search never returns to its event loop to receive the message — so
   * there the only way to actually stop is to destroy the worker, which costs
   * the transposition table. Pass `hard` when that price is worth paying:
   * starting a new game, or leaving the board. For an ordinary abandoned search
   * the caller's own token already prevents a stale move from being played.
   */
  cancel(hard?: boolean): void
  dispose(): void
}

/**
 * `Omit` over a union collapses it to the keys the members share, which for
 * `WorkerRequest` is just `type`. Distributing it keeps each variant's own
 * fields intact.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type RequestBody = DistributiveOmit<WorkerRequest, 'id'>

/** True when running inside the Tauri shell rather than a plain browser. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// ---------------------------------------------------------------------------
// Worker-backed client (browser, and the fallback everywhere)
// ---------------------------------------------------------------------------

class WorkerEngineClient implements EngineClient {
  readonly kind = 'wasm' as const
  private worker: Worker
  private nextId = 1
  private pending = new Map<
    number,
    {
      resolve: (value: never) => void
      reject: (reason: Error) => void
      onProgress?: (info: SearchInfo) => void
    }
  >()

  constructor() {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.attach()
  }

  /** Wire up a worker. Called again whenever a hard cancel replaces one. */
  private attach() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data
      const entry = this.pending.get(msg.id)
      if (!entry) return
      if ('progress' in msg) {
        // Progress arrives many times per request and must not settle it.
        entry.onProgress?.(msg.progress)
        return
      }
      this.pending.delete(msg.id)
      if (msg.ok) entry.resolve(msg.result as never)
      else entry.reject(new Error(msg.error))
    }
    this.worker.onerror = (event) => {
      // A worker-level failure never resolves individual requests, so fail them
      // all rather than leaving the UI waiting forever on a dead thread.
      const error = new Error(event.message || 'engine worker failed')
      for (const [, entry] of this.pending) entry.reject(error)
      this.pending.clear()
    }
  }

  private call<T>(
    request: RequestBody,
    onProgress?: (info: SearchInfo) => void
  ): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: never) => void,
        reject,
        onProgress,
      })
      this.worker.postMessage({ ...request, id } as WorkerRequest)
    })
  }

  search(
    startFen: string,
    moves: string,
    options: SearchOptions,
    onProgress?: (info: SearchInfo) => void
  ) {
    return this.call<SearchInfo>({ type: 'search', startFen, moves, options }, onProgress)
  }

  hints(startFen: string, moves: string, options: SearchOptions, count: number) {
    return this.call<HintInfo[]>({ type: 'hints', startFen, moves, options, count })
  }

  learn(startFen: string, moves: string, learner: 'r' | 'b', outcome: 'win' | 'loss' | 'draw') {
    return this.call<number>({ type: 'learn', startFen, moves, learner, outcome })
  }

  loadExperience(text: string) {
    return this.call<number>({ type: 'loadExperience', text })
  }

  experienceText() {
    return this.call<string>({ type: 'experienceText' })
  }

  async reset() {
    await this.call<null>({ type: 'reset' })
  }

  calibrate(budgetMs: number) {
    return this.call<Calibration>({ type: 'calibrate', budgetMs })
  }

  cancel(hard = false) {
    if (!hard) return
    // The worker is inside the search and cannot hear a message, so the only
    // way out is to end it. Everything waiting on it has to be told, or those
    // promises never settle.
    const dead = new Error('engine restarted')
    for (const [, entry] of this.pending) entry.reject(dead)
    this.pending.clear()
    this.worker.terminate()
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    this.attach()
  }

  dispose() {
    this.worker.terminate()
    this.pending.clear()
  }
}

// ---------------------------------------------------------------------------
// Native client (Tauri)
// ---------------------------------------------------------------------------

class NativeEngineClient implements EngineClient {
  readonly kind = 'native' as const

  private async invoke<T>(cmd: string, args: Record<string, unknown>): Promise<T> {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }

  // The native path reports no intermediate progress: the search runs inside a
  // blocking Rust task, and streaming it would need a Tauri event channel. The
  // toast falls back to showing that the engine is working without a depth.
  search(startFen: string, moves: string, options: SearchOptions) {
    return this.invoke<SearchInfo>('engine_search', { startFen, moves, options })
  }

  hints(startFen: string, moves: string, options: SearchOptions, count: number) {
    return this.invoke<HintInfo[]>('engine_hints', { startFen, moves, options, count })
  }

  learn(startFen: string, moves: string, learner: 'r' | 'b', outcome: 'win' | 'loss' | 'draw') {
    return this.invoke<number>('engine_learn', { startFen, moves, learner, outcome })
  }

  loadExperience(text: string) {
    return this.invoke<number>('engine_load_experience', { text })
  }

  experienceText() {
    return this.invoke<string>('engine_experience_text', {})
  }

  async reset() {
    await this.invoke<void>('engine_reset', {})
  }

  calibrate(budgetMs: number) {
    return this.invoke<Calibration>('engine_benchmark', { budgetMs })
  }

  cancel() {
    // Fire and forget: the caller is abandoning this search either way, and a
    // failed cancel only means it runs to its deadline as it used to.
    void this.invoke<void>('engine_cancel', {}).catch(() => undefined)
  }

  dispose() {
    // Nothing to tear down: the engine lives in the Rust process.
  }
}

let shared: EngineClient | null = null

/** The process-wide engine client, created on first use. */
export function getEngineClient(): EngineClient {
  if (!shared) {
    shared = isTauri() ? new NativeEngineClient() : new WorkerEngineClient()
  }
  return shared
}
