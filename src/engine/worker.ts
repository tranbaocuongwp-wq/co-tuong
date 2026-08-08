/// <reference lib="webworker" />
/**
 * Search worker.
 *
 * A "siêu khó" move costs five seconds of solid computation. Running that on
 * the main thread would freeze the board, the clock and every animation, so the
 * WebAssembly engine gets its own thread here and the UI only ever awaits a
 * message.
 *
 * The engine instance is kept alive between requests on purpose: its
 * transposition table carries over from move to move, which is a large part of
 * why the second search in a game is faster than the first.
 */

import init, { Engine, Game } from '../wasm/co_tuong_engine_wasm.js'
import wasmUrl from '../wasm/co_tuong_engine_wasm_bg.wasm?url'
import type { HintInfo, SearchInfo, SearchOptions } from './types'

/**
 * 16 MB, and measured rather than guessed.
 *
 * A bigger table is the obvious way to buy strength for free, so it was tried:
 * 64 MB reached *fewer* plies than 16 MB at every budget over a second (17 vs
 * 18 at twenty-five seconds). A table that no longer fits the processor's cache
 * costs more in misses than it saves in re-searches, and this workload is
 * already deep in that territory. Leave it alone without new measurements.
 */
const TT_MB = 16

export type WorkerRequest =
  | { id: number; type: 'search'; startFen: string; moves: string; options: SearchOptions }
  | {
      id: number
      type: 'learn'
      startFen: string
      moves: string
      learner: 'r' | 'b'
      outcome: 'win' | 'loss' | 'draw'
    }
  | { id: number; type: 'hints'; startFen: string; moves: string; options: SearchOptions; count: number }
  | { id: number; type: 'loadExperience'; text: string }
  | { id: number; type: 'experienceText' }
  | { id: number; type: 'reset' }
  | { id: number; type: 'calibrate'; budgetMs: number }

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
  /** Emitted repeatedly while a search runs; never terminates the request. */
  | { id: number; progress: SearchInfo }

let enginePromise: Promise<Engine> | null = null

function getEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = init({ module_or_path: wasmUrl }).then(() => new Engine(TT_MB))
  }
  return enginePromise
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data
  try {
    const engine = await getEngine()
    let result: unknown = null

    switch (msg.type) {
      case 'search': {
        const game = Game.fromMoves(msg.startFen, msg.moves)
        const report = (info: SearchInfo) => {
          const update: WorkerResponse = { id: msg.id, progress: info }
          self.postMessage(update)
        }
        result = engine.search(game, msg.options, report) as SearchInfo
        break
      }
      case 'hints': {
        const game = Game.fromMoves(msg.startFen, msg.moves)
        result = engine.hints(game, msg.options, msg.count) as HintInfo[]
        break
      }
      case 'learn':
        result = engine.learn(msg.startFen, msg.moves, msg.learner, msg.outcome)
        break
      case 'loadExperience':
        engine.loadExperience(msg.text)
        result = engine.experienceSize()
        break
      case 'experienceText':
        result = engine.experienceText()
        break
      case 'reset':
        engine.reset()
        break
      case 'calibrate':
        result = engine.benchmark(msg.budgetMs)
        break
    }

    const reply: WorkerResponse = { id: msg.id, ok: true, result }
    self.postMessage(reply)
  } catch (error) {
    const reply: WorkerResponse = {
      id: msg.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
    self.postMessage(reply)
  }
}
