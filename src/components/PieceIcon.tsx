/**
 * A chess piece as a token, at any size, anywhere.
 *
 * The board draws its own pieces — it has to, because it positions them by
 * percentage inside a container query and animates them across the grid. This
 * is for everywhere *else*: the hint dialog naming a Chariot, the insight panel
 * counting Cannons, the move list, a legend. All of those said "Xe" and "Pháo"
 * in words, which is correct and slower to read than the piece itself.
 *
 * Two things it gets right that a plain glyph does not:
 *
 * **The two sides look different.** Red and Black are drawn with their own
 * character (帥 vs 將, 車 vs 俥 and so on) and their own colour, exactly as on a
 * real set, so a token is never ambiguous about whose piece it is.
 *
 * **It is a disc, not a letter.** A bare CJK character next to Vietnamese text
 * reads as foreign punctuation; inside a bordered disc it reads as a chess
 * piece, which is what it is.
 */

import type { PieceKind, Side } from '../engine/types'
import { cn } from '../lib/utils'

/**
 * The traditional pair of characters for each piece.
 *
 * Red and Black genuinely use different characters for the same piece in a
 * standard set — this is not decoration, it is how a player tells the two
 * armies apart at a glance on a wooden board.
 */
const GLYPH: Record<PieceKind, { r: string; b: string }> = {
  k: { r: '帥', b: '將' },
  a: { r: '仕', b: '士' },
  e: { r: '相', b: '象' },
  h: { r: '傌', b: '馬' },
  r: { r: '俥', b: '車' },
  c: { r: '炮', b: '砲' },
  p: { r: '兵', b: '卒' },
}

/** What to call it out loud, and for anyone using a screen reader. */
export const PIECE_NAME: Record<PieceKind, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  e: 'Tượng',
  h: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
}

export interface PieceIconProps {
  kind: PieceKind
  side: Side
  /** Diameter in pixels. */
  size?: number
  /** Show the Vietnamese name beside the disc. */
  withName?: boolean
  className?: string
}

export function PieceIcon({ kind, side, size = 22, withName, className }: PieceIconProps) {
  const name = PIECE_NAME[kind]
  const disc = (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-full border font-semibold leading-none',
        side === 'r'
          ? 'border-red-piece/45 bg-red-piece/12 text-red-piece'
          : 'border-black-piece/40 bg-black-piece/10 text-black-piece'
      )}
      style={{ width: size, height: size, fontSize: size * 0.62 }}
      aria-hidden="true"
    >
      {GLYPH[kind][side]}
    </span>
  )

  if (!withName) {
    return (
      <span className={cn('inline-flex', className)} role="img" aria-label={name}>
        {disc}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {disc}
      <span>{name}</span>
    </span>
  )
}

/** Every piece of one colour, for a legend or a captured-pieces row. */
export const PIECE_ORDER: PieceKind[] = ['k', 'r', 'c', 'h', 'e', 'a', 'p']
