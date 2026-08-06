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

import init, { Engine, Game } from '../wasm/xiangqi_engine_wasm.js'
import wasmUrl from '../wasm/xiangqi_engine_wasm_bg.wasm?url'
import type { SearchInfo, SearchOptions } from './types'

/** 16 MB is a reasonable table for a browser tab. */
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
  | { id: number; type: 'loadExperience'; text: string }
  | { id: number; type: 'experienceText' }
  | { id: number; type: 'reset' }

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
