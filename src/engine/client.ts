/**
 * EngineClient — one interface, two implementations.
 *
 * Inside the Tauri app the search runs as native code over IPC (roughly twice
 * the nodes per second of WebAssembly, worth about a ply of depth). In the
 * browser it runs in a Web Worker. Both speak the same shapes, so nothing above
 * this file knows or cares which is active.
 */

import type { SearchInfo, SearchOptions } from './types'
import type { WorkerRequest, WorkerResponse } from './worker'

export interface EngineClient {
  readonly kind: 'native' | 'wasm'
  search(
    startFen: string,
    moves: string,
    options: SearchOptions,
    onProgress?: (info: SearchInfo) => void
  ): Promise<SearchInfo>
  learn(
    startFen: string,
    moves: string,
    learner: 'r' | 'b',
    outcome: 'win' | 'loss' | 'draw'
  ): Promise<number>
  loadExperience(text: string): Promise<number>
  experienceText(): Promise<string>
  reset(): Promise<void>
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
