/**
 * Shared shapes for everything that crosses the engine boundary.
 *
 * The native (Tauri) and WebAssembly search paths deliberately return the same
 * fields, so the rest of the app never branches on which one is running.
 */

export type Side = 'r' | 'b'
export type PieceKind = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p'

export interface Piece {
  row: number // 0 = Black's back rank, 9 = Red's
  col: number // 0 = file a
  side: Side
  kind: PieceKind
  glyph: string
}

export interface MoveInfo {
  fromRow: number
  fromCol: number
  toRow: number
  toCol: number
  iccs: string
  /** Traditional Vietnamese notation, e.g. "Pháo 2 bình 5". */
  text: string
  capture: boolean
}

export type GameStatus = 'playing' | 'redWin' | 'blackWin' | 'draw'

export type EndReason =
  | ''
  | 'checkmate'
  | 'stalemate'
  | 'repetition'
  | 'perpetualCheck'
  | 'perpetualChase'
  | 'sixtyMove'
  | 'insufficientMaterial'
  | 'resign'
  | 'timeout'

export interface StatusInfo {
  status: GameStatus
  reason: EndReason
  sideToMove: Side
  inCheck: boolean
  legalMoveCount: number
  moveNumber: number
  halfmove: number
}

export interface SearchInfo {
  iccs: string
  /** Present from the WebAssembly path; the native path fills it in client-side. */
  text?: string
  score: number
  depth: number
  nodes: number
  timeMs: number
  pv: string[]
  fromBook: boolean
  fromExperience: boolean
  /** Plies to mate when the score is a forced mate, else null. */
  mateIn: number | null
  /** The clock ran out mid-iteration; that iteration's work was discarded. */
  stoppedEarly: boolean
  /** Which stopping condition fired. */
  stopReason: StopReason
  /**
   * How many times the best move changed while thinking.
   *
   * The honest counterweight to a depth number. "Depth 18" says nothing about
   * whether the engine was still changing its mind at depth 18 or had been sure
   * since depth 9, and those are exactly the two cases worth telling apart.
   */
  bestChanges: number
  /** The budget it aimed at after any extension, as opposed to the ceiling. */
  softMs: number
}

/**
 * Why the search stopped. Mirrors `StopReason` in the engine.
 *
 * `easy` is the one worth surfacing: it means the engine settled on its move and
 * stopped rather than running the clock down, which is the difference between an
 * opponent that is thinking and one that is stalling.
 */
export type StopReason =
  | 'depth'
  | 'soft'
  | 'hard'
  | 'mate'
  | 'easy'
  | 'forced'
  | 'cancelled'
  | 'book'

/**
 * One option offered by the hint, with everything needed to explain it.
 *
 * The score alone is not an explanation. What makes a move worth playing is
 * usually something concrete — it takes a piece, it gives check, it lines
 * something up — so those come back with it and the interface says *why*
 * instead of quoting a number.
 */
export interface HintInfo {
  iccs: string
  /** Traditional Vietnamese notation, e.g. "Pháo 2 bình 5". */
  text: string
  /** Centipawns from the player's point of view, after the expected reply. */
  score: number
  /** Kind taken, or null. */
  captured: PieceKind | null
  givesCheck: boolean
  /** Enemy kinds this move would then threaten, best first. */
  threats: PieceKind[]
  /**
   * Where those threatened pieces stand, in the same order as `threats`.
   *
   * What the board preview highlights. The kind alone cannot be pointed at:
   * with two Cannons on the board only one of them is usually in danger.
   */
  threatSquares: { row: number; col: number }[]
  /** The reply the engine expects, in notation. Empty if the move ends it. */
  reply: string
}

export interface SearchOptions {
  maxDepth?: number
  movetimeMs?: number
  randomnessCp?: number
  seed?: number
  useBook?: boolean
  useExperience?: boolean
  /**
   * The budget to aim at, in milliseconds. Omit to let the engine take its own
   * share of `movetimeMs`.
   */
  softMs?: number
  /**
   * Off spends `movetimeMs` the way the engine did before adaptive timing
   * existed. Only for bisecting a regression; nothing in the app sets it.
   */
  adaptive?: boolean
}

/** What a device measured itself at. See `engine/src/bench.rs`. */
export interface Calibration {
  /** Nodes per second. */
  nps: number
  /** How deep it reached in the measuring budget. For display only. */
  depth: number
  ms: number
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'master'

/**
 * Difficulty is expressed as search limits rather than as a single "level"
 * number, so each step is a concrete, explainable change in how the engine
 * thinks rather than an opaque dial.
 *
 * ## The whole ladder moved up
 *
 * It used to start at depth 2 with 120 centipawns of noise thrown in, which is
 * not "easy", it is a player who hangs pieces for no reason. Nobody enjoys
 * beating that, and it made the first three rungs feel like a different, worse
 * game rather than a gentler one. So the bottom rung is now exactly what the
 * top rung used to be — full strength, five seconds a move, opening book and
 * experience — and every level above it is more time.
 *
 * ## What more time actually buys, measured
 *
 * On a real middlegame, on a desktop:
 *
 * | budget | depth reached |
 * |--------|---------------|
 * |  5s    | 16 plies      |
 * | 10s    | 17            |
 * | 20s    | 18            |
 * | 40s    | ~19           |
 *
 * Roughly one extra ply per doubling, which is what search behaves like once
 * the cheap wins are gone.
 *
 * ## Why each level is a depth *and* a time, not just a time
 *
 * A budget on its own says "think for forty seconds" whatever the position is,
 * so a forced recapture and a knife-edge middlegame cost the player exactly the
 * same wait. It also means the level describes a *wait* rather than an
 * opponent: the same forty seconds reaches three plies deeper on a laptop than
 * on a phone, so "Siêu khó" was quietly a different player on every device.
 *
 * Naming a depth fixes both. The search stops at whichever comes first, so:
 *
 * * **A simple position finishes early** — the target is reached and the engine
 *   stops, on any device. Most endgame moves now answer in well under a second.
 * * **A fast machine finishes early** — same strength, less waiting.
 * * **A slow machine is protected** — the time cap still ends it, exactly as
 *   before. Nothing gets worse on a phone; it simply stops being the only case
 *   the numbers were tuned for.
 *
 * The targets are set so a desktop usually reaches them inside the cap and a
 * phone usually does not, which is the honest division: the cap is what a
 * slower device falls back to, not what everyone waits for.
 */
export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { label: string; blurb: string; options: SearchOptions }
> = {
  easy: {
    label: 'Dễ',
    blurb: 'Nhìn trước 16 nước — đúng bằng mức Siêu khó của bản trước. Thấp nhất, và không hiền.',
    options: {
      maxDepth: 16,
      movetimeMs: 6_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  medium: {
    label: 'Vừa',
    blurb: 'Nhìn trước 18 nước. Sâu hơn Dễ hai tầng, và hai tầng là đủ để thấy khác.',
    options: {
      maxDepth: 18,
      movetimeMs: 15_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  hard: {
    label: 'Khó',
    blurb: 'Nhìn trước 20 nước. Đến đây thì hầu như không còn nước hớ nào lọt qua.',
    options: {
      maxDepth: 20,
      movetimeMs: 30_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  master: {
    label: 'Siêu khó',
    blurb: 'Nhìn trước 22 nước, tối đa 45 giây. Nó sẽ không bỏ sót gì cả.',
    options: {
      maxDepth: 22,
      movetimeMs: 45_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'master']

/** Human-readable Vietnamese for a finished game. */
export function describeResult(status: GameStatus, reason: EndReason): string {
  const why: Record<string, string> = {
    checkmate: 'chiếu bí',
    stalemate: 'hết nước đi',
    repetition: 'lặp nước',
    perpetualCheck: 'chiếu liên hoàn',
    perpetualChase: 'đuổi bắt liên hoàn',
    sixtyMove: '60 nước không ăn quân',
    insufficientMaterial: 'không đủ quân chiếu hết',
    resign: 'xin thua',
    timeout: 'hết giờ',
  }
  const tail = reason && why[reason] ? ` (${why[reason]})` : ''
  switch (status) {
    case 'redWin':
      return `Đỏ thắng${tail}`
    case 'blackWin':
      return `Đen thắng${tail}`
    case 'draw':
      return `Hòa${tail}`
    default:
      return 'Đang chơi'
  }
}
