/**
 * The concrete half of the commentary: what actually just happened.
 *
 * These lines name pieces. "Đỏ dùng Xe ăn Pháo" is worth hearing; "mất một
 * quân" is not, because it fits any position and so describes none of them.
 * Every line here is built from the engine's own report of the move, so it can
 * only ever say something true about the board in front of the player.
 *
 * They are generated rather than hand-written on purpose. A fact has one
 * correct phrasing, and forty variations of "X ăn Y" would be forty chances to
 * get one of them subtly wrong. The colour and the character live in the
 * reaction lines next door, which the queue plays straight after — the
 * commentator states the move, then says what they make of it.
 *
 * The combinations are enumerated ahead of time rather than assembled at speak
 * time, because each one is a separate recording that has to exist in R2 before
 * anyone needs it.
 */

import { lineId } from './id'
import type { Line } from './lines'

/** The letters the engine uses for piece kinds. */
export type Kind = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p'

export type SideLetter = 'r' | 'b'

/** What the engine reports about the move just played. */
export interface MoveReport {
  mover: Kind
  side: SideLetter
  captured: Kind | null
  givesCheck: boolean
  /** Enemy kinds the moved piece can now profitably take, best first. */
  threats: Kind[]
}

const PIECE: Record<Kind, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  e: 'Tượng',
  h: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
}

const SIDE: Record<SideLetter, string> = { r: 'Đỏ', b: 'Đen' }

/**
 * How each piece is said to be played.
 *
 * A Chariot is not "moved", it is *loosed*; a Cannon goes off; a Horse leaps.
 * Giving each kind its own verb is most of what makes the delivery sound like a
 * storyteller rather than a move list being read aloud — and it costs nothing,
 * because these lines are generated anyway.
 */
const VERB: Record<Kind, string> = {
  r: 'tung Xe',
  c: 'nổ Pháo',
  h: 'phi Mã',
  e: 'dời Tượng',
  a: 'đẩy Sĩ',
  p: 'thúc Tốt',
  k: 'động Tướng',
}

/** How hard the blow lands, by what it took. */
const STRIKE: Record<'big' | 'fair' | 'small', string> = {
  big: 'chém rụng',
  fair: 'hạ',
  small: 'nhặt gọn',
}

function other(side: SideLetter): string {
  return SIDE[side === 'r' ? 'b' : 'r']
}

/** Everything except the King, which is never a capture target. */
const TAKEABLE: Kind[] = ['r', 'c', 'h', 'e', 'a', 'p']

/** Pieces that can deliver check. Elephants and Advisors never leave home to do it. */
const CHECKERS: Kind[] = ['r', 'c', 'h', 'p', 'k']

const ALL: Kind[] = ['r', 'c', 'h', 'e', 'a', 'p', 'k']

const SIDES: SideLetter[] = ['r', 'b']

function make(key: string, text: string, speech: string): Line {
  return { key, text, speech, id: lineId(key, speech) }
}

/**
 * How hard a capture is worth reading.
 *
 * A Rook coming off the board is the news of the game; a Pawn is a detail. The
 * delivery follows, because a commentator who shouts every capture the same way
 * stops meaning anything by it.
 */
function captureWeight(victim: Kind): 'big' | 'fair' | 'small' {
  if (victim === 'r') return 'big'
  if (victim === 'c' || victim === 'h') return 'fair'
  return 'small'
}

const CAPTURES: Record<SideLetter, Record<string, Line>> = { r: {}, b: {} }
const THREATS: Record<SideLetter, Record<string, Line>> = { r: {}, b: {} }
const CHECKS: Record<SideLetter, Record<string, Line>> = { r: {}, b: {} }

for (const side of SIDES) {
  const who = SIDE[side]

  for (const mover of ALL) {
    for (const victim of TAKEABLE) {
      const key = `cap-${side}-${mover}-${victim}`
      const weight = captureWeight(victim)
      // Both sides are named in every line: who struck, and who lost. That is
      // what makes it commentary on the game rather than cheering for a colour.
      const text = `${who} ${VERB[mover]}, ${STRIKE[weight]} ${PIECE[victim]} bên ${other(side)}.`
      const speech =
        weight === 'big'
          ? `[hào hùng] ${who} ${VERB[mover]}... [phấn khích] ${STRIKE[weight]} ${PIECE[victim]} bên ${other(side)}!`
          : weight === 'fair'
            ? `[dõng dạc] ${who} ${VERB[mover]}... [nhấn mạnh] ${STRIKE[weight]} ${PIECE[victim]} bên ${other(side)}.`
            : `[điềm tĩnh] ${who} ${VERB[mover]}, ${STRIKE[weight]} ${PIECE[victim]} bên ${other(side)}.`
      CAPTURES[side][`${mover}-${victim}`] = make(key, text, speech)
    }

    for (const victim of TAKEABLE) {
      const key = `thr-${side}-${mover}-${victim}`
      const text = `Sát khí bốc lên: ${PIECE[mover]} bên ${who} nhắm thẳng ${PIECE[victim]} bên ${other(side)}.`
      const speech = `[thì thầm] Sát khí bốc lên... [cảnh báo] ${PIECE[mover]} bên ${who} nhắm thẳng ${PIECE[victim]} bên ${other(side)}.`
      THREATS[side][`${mover}-${victim}`] = make(key, text, speech)
    }
  }

  for (const mover of CHECKERS) {
    const key = `chk-${side}-${mover}`
    const text =
      mover === 'k'
        ? `${who} lộ mặt Tướng, chiếu thẳng sang doanh trại bên ${other(side)}!`
        : `${who} ${VERB[mover]}, một tiếng chiếu vang tới Tướng bên ${other(side)}!`
    const speech =
      mover === 'k'
        ? `[ngạc nhiên] ${who} lộ mặt Tướng... [dõng dạc] chiếu thẳng sang doanh trại bên ${other(side)}!`
        : `[dõng dạc] ${who} ${VERB[mover]}... [hào hùng] một tiếng chiếu vang tới Tướng bên ${other(side)}!`
    CHECKS[side][mover] = make(key, text, speech)
  }
}

export function captureLine(side: SideLetter, mover: Kind, victim: Kind): Line | null {
  return CAPTURES[side][`${mover}-${victim}`] ?? null
}

export function threatLine(side: SideLetter, mover: Kind, victim: Kind): Line | null {
  return THREATS[side][`${mover}-${victim}`] ?? null
}

export function checkLine(side: SideLetter, mover: Kind): Line | null {
  return CHECKS[side][mover] ?? null
}

/** Every fact line, for pre-generating the audio. */
export function allFactLines(): Line[] {
  const out: Line[] = []
  for (const side of SIDES) {
    out.push(...Object.values(CAPTURES[side]))
    out.push(...Object.values(THREATS[side]))
    out.push(...Object.values(CHECKS[side]))
  }
  return out
}
