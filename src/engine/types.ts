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
 */
export const DIFFICULTY_PRESETS: Record<
  Difficulty,
  { label: string; blurb: string; options: SearchOptions }
> = {
  easy: {
    label: 'Dễ',
    blurb: 'Nghĩ nông, thỉnh thoảng đi hớ như người mới học.',
    options: {
      maxDepth: 2,
      movetimeMs: 0,
      randomnessCp: 120,
      useBook: false,
      useExperience: false,
    },
  },
  medium: {
    label: 'Trung bình',
    blurb: 'Đi chắc tay, ít khi cho không quân.',
    options: {
      maxDepth: 5,
      movetimeMs: 0,
      randomnessCp: 25,
      useBook: true,
      useExperience: false,
    },
  },
  hard: {
    label: 'Khó',
    blurb: 'Nghĩ kỹ trước mỗi nước và trừng phạt sai lầm.',
    options: {
      maxDepth: 64,
      movetimeMs: 1_500,
      randomnessCp: 0,
      useBook: true,
      useExperience: true,
    },
  },
  master: {
    label: 'Siêu khó',
    blurb: 'Nghĩ 5 giây mỗi nước, chơi hết sức và nhớ cả ván cũ.',
    options: {
      maxDepth: 64,
      movetimeMs: 5_000,
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
