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
}

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
 * On a real middlegame, on this machine:
 *
 * | budget | depth reached |
 * |--------|---------------|
 * |  5s    | 16 plies      |
 * | 10s    | 17            |
 * | 20s    | 18            |
 * | 40s    | ~19           |
 *
 * Roughly one extra ply per doubling, which is what search behaves like once
 * the cheap wins are gone. So the gap between the rungs here is real but it is
 * not dramatic: Siêu khó is about three plies deeper than Dễ, not a different
 * species of opponent. The honest way to describe the top level is "will not
 * miss anything, and will take its time", and that is what the blurb says.
 *
 * A bigger transposition table was the other obvious lever and it was measured
 * too: 64 MB came out *worse* than 16 MB at every budget over a second, so the
 * table stays where it is. See `TT_MB` in `engine/worker.ts`.
 */
export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { label: string; blurb: string; options: SearchOptions }
> = {
  easy: {
    label: 'Dễ',
    blurb: 'Nghĩ 5 giây mỗi nước, chơi hết sức. Đây là mức thấp nhất, và nó không hiền.',
    options: {
      maxDepth: 64,
      movetimeMs: 5_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  medium: {
    label: 'Vừa',
    blurb: 'Nghĩ 10 giây mỗi nước. Sâu hơn Dễ một tầng, và một tầng là đủ để thấy khác.',
    options: {
      maxDepth: 64,
      movetimeMs: 10_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  hard: {
    label: 'Khó',
    blurb: 'Nghĩ 20 giây mỗi nước. Đến đây thì hầu như không còn nước hớ nào lọt qua.',
    options: {
      maxDepth: 64,
      movetimeMs: 20_000,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  master: {
    label: 'Siêu khó',
    blurb: 'Nghĩ 40 giây mỗi nước. Nó sẽ không bỏ sót gì cả — và bạn sẽ phải chờ.',
    options: {
      maxDepth: 64,
      movetimeMs: 40_000,
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
