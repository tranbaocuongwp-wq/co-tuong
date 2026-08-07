/**
 * Main-thread WebAssembly module — the single source of truth for the rules.
 *
 * The UI asks this module what is legal instead of reimplementing Xiangqi in
 * TypeScript. Rules answered here are instant (no worker round-trip), which is
 * what makes tapping a piece feel immediate; only the *search* is offloaded.
 */

import init, {
  Engine as WasmEngine,
  Game as WasmGame,
  startFen as wasmStartFen,
  version as wasmVersion,
} from '../wasm/co_tuong_engine_wasm.js'
import wasmUrl from '../wasm/co_tuong_engine_wasm_bg.wasm?url'

let ready: Promise<void> | null = null
let loaded = false

/** Load the module once; subsequent calls await the same promise. */
export function loadEngineWasm(): Promise<void> {
  if (!ready) {
    ready = init({ module_or_path: wasmUrl }).then(() => {
      loaded = true
    })
  }
  return ready
}

export function isEngineWasmLoaded(): boolean {
  return loaded
}

export { WasmGame, WasmEngine }
export type WasmGameType = InstanceType<typeof WasmGame>

/**
 * These two are safe to call before the module has finished loading.
 *
 * React renders components before effects run, so a component that reads the
 * version while building state would otherwise call into an uninstantiated
 * module and crash the whole route. Returning a placeholder and letting the
 * value settle after load is the behaviour callers actually want.
 */
export function startFen(): string {
  return loaded ? wasmStartFen() : ''
}

export function engineVersion(): string {
  return loaded ? wasmVersion() : 'unknown'
}
