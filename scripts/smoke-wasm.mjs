// Smoke test for the WebAssembly build.
//
// wasm-pack's `web` target expects a browser, so here we hand it the bytes
// directly. This runs in CI: it is the only check that the .wasm the browser
// will actually download behaves like the Rust tests say it should.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = join(here, '..', 'src', 'wasm')

const init = await import(join(pkg, 'co_tuong_engine_wasm.js'))
const bytes = await readFile(join(pkg, 'co_tuong_engine_wasm_bg.wasm'))
await init.default({ module_or_path: bytes })

const { Game, Engine, startFen, version } = init

let failures = 0
function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ok   ${label}`)
  } else {
    console.error(`  FAIL ${label} ${detail}`)
    failures++
  }
}

console.log(`engine version ${version()}`)

// --- rules ----------------------------------------------------------------
console.log('\nrules')
const game = new Game()
check('start FEN matches the engine constant', game.fen() === startFen())
check('44 legal opening moves', game.legalMoves().length === 44,
  `got ${game.legalMoves().length}`)

const pieces = game.pieces()
check('32 pieces on the board', pieces.length === 32, `got ${pieces.length}`)
check('pieces carry a glyph', pieces.every((p) => p.glyph.length > 0))

const status = game.play('h2e2')
check('centre cannon is accepted', status.status === 'playing')
check('side to move flips to Black', status.sideToMove === 'b')
check('move recorded in ICCS', game.movesIccs() === 'h2e2')
check('move recorded in Vietnamese', game.movesText()[0] === 'Pháo 2 bình 5',
  game.movesText()[0])

let rejected = false
try {
  game.play('a0a9') // a red rook move, but it is Black's turn
} catch {
  rejected = true
}
check('an illegal move is rejected, not applied', rejected)
check('board unchanged after the rejection', game.moveCount() === 1)

check('undo works', game.undo() === true)
check('undo restores the start position', game.fen() === startFen())
check('undo on an empty history returns false', game.undo() === false)

// --- checkmate detection --------------------------------------------------
console.log('\nendgame rules')
const mated = Game.fromFen('4k4/9/9/9/9/9/9/9/9/3RKR3 b - - 0 1')
const ms = mated.status()
check('checkmate is detected', ms.status === 'redWin', JSON.stringify(ms))
check('reason reported as checkmate', ms.reason === 'checkmate', ms.reason)

// --- search ---------------------------------------------------------------
console.log('\nsearch')
const engine = new Engine(16)

const hanging = Game.fromFen('3k5/9/9/4r4/9/9/9/9/9/4RK3 w - - 0 1')
const grab = engine.search(hanging, { maxDepth: 5, movetimeMs: 0, useBook: false })
check('takes the hanging rook', grab.iccs === 'e0e6', grab.iccs)
check('reports a depth', grab.depth >= 5, `depth ${grab.depth}`)
check('reports nodes searched', grab.nodes > 0)

const mateIn1 = Game.fromFen('4k4/9/9/9/4N4/9/9/9/9/3RKR3 w - - 0 1')
const found = engine.search(mateIn1, { maxDepth: 4, movetimeMs: 0, useBook: false })
check('finds the forced mate', found.mateIn !== undefined && found.mateIn !== null,
  JSON.stringify(found))

const opening = new Game()
const booked = engine.search(opening, { movetimeMs: 50, useBook: true })
check('opening book answers instantly', booked.fromBook === true)
check('book move is legal',
  opening.legalMoves().some((m) => m.iccs === booked.iccs))

// A timed search must respect its budget.
const timed = new Game()
const t0 = Date.now()
const r = engine.search(timed, { movetimeMs: 400, useBook: false })
const elapsed = Date.now() - t0
check('honours the time budget', elapsed < 1500, `took ${elapsed}ms`)
check('still returns a legal move',
  timed.legalMoves().some((m) => m.iccs === r.iccs))
check('reports why it stopped', typeof r.stopReason === 'string' && r.stopReason.length > 0,
  `stopReason=${r.stopReason}`)
check('reports the budget it aimed at', typeof r.softMs === 'number')
console.log(`       depth ${r.depth}, ${Math.round(r.nodes / 1000)}k nodes in ${r.timeMs}ms, ` +
  `dừng vì ${r.stopReason}`)

// --- device calibration ---------------------------------------------------
console.log('\ndevice calibration')
const cal = engine.benchmark(150)
check('measures a positive rate', cal.nps > 0, `${Math.round(cal.nps / 1000)}k n/s`)
check('completes at least one iteration', cal.depth >= 1, `depth ${cal.depth}`)
console.log(`       ${Math.round(cal.nps / 1000)}k n/s, depth ${cal.depth} in ${cal.ms}ms`)

// --- learning -------------------------------------------------------------
console.log('\nexperience book')
const learned = engine.learn(startFen(), 'h2e2 h9g7 h0g2', 'r', 'loss')
check('grades the losing side\'s moves', learned === 2, `got ${learned}`)
check('experience has records', engine.experienceSize() === 2)

const text = engine.experienceText()
const engine2 = new Engine(4)
engine2.loadExperience(text)
check('experience survives a save/load round trip',
  engine2.experienceSize() === engine.experienceSize())

let learnRejected = false
try {
  engine.learn(startFen(), 'h2e2 a0a9', 'r', 'loss')
} catch {
  learnRejected = true
}
check('refuses to learn from an illegal game', learnRejected)

console.log(
  failures === 0
    ? '\nAll WebAssembly smoke checks passed.'
    : `\n${failures} check(s) failed.`
)
process.exit(failures === 0 ? 0 : 1)
