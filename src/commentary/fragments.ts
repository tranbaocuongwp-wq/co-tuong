/**
 * The pieces a move is read out of.
 *
 * A commentator worth listening to says *which move was played* — "Mã 8 tiến
 * 7", "Pháo 2 bình 5" — not "a piece moved". That is the whole difference
 * between narration and a status line, and the reason the earlier script felt
 * like it was reading the same sentence back every time.
 *
 * Every move notation the engine produces has the shape
 *
 *     <piece> <file | trước | sau> <bình | tiến | thoái> <number>
 *
 * so the entire language of moves is twenty-odd words. Recording those and
 * joining them covers all of it. The alternative — one recording per possible
 * move — is over a thousand files per side, for the same sentences.
 *
 * The words are recorded flat, with no performance tags. Tags are what make the
 * scripted lines sound like a person, and exactly what would make these join
 * badly: a word recorded with a rising inflection cannot sit in the middle of a
 * phrase. The character lives in the reaction that follows.
 */

import { lineId } from './id'
import type { Line } from './lines'

function frag(key: string, text: string): Line {
  return { key: `w-${key}`, text, id: lineId(`w-${key}`, text) }
}

/** Piece names, exactly as the engine's notation writes them. */
const PIECES = ['Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Tốt']

/** Verbs: across, forward, back. */
const VERBS = ['bình', 'tiến', 'thoái']

/** Which of two stacked like pieces is meant. */
const ORDINALS = ['trước', 'sau']

const NUMBERS = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

/** Whose move it is. Said first, so the listener knows before the piece is named. */
const SIDES = { r: 'Đỏ', b: 'Đen' } as const

const WORDS = new Map<string, Line>()

function add(key: string, text: string): void {
  WORDS.set(text, frag(key, text))
}

PIECES.forEach((name, i) => add(`p${i}`, name))
VERBS.forEach((name, i) => add(`v${i}`, name))
ORDINALS.forEach((name, i) => add(`o${i}`, name))
NUMBERS.forEach((name, i) => add(`n${i + 1}`, `${name}`))
add('sr', SIDES.r)
add('sb', SIDES.b)

/** Spoken form of a digit as it appears in notation. */
function digitWord(token: string): string | null {
  const n = Number(token)
  return Number.isInteger(n) && n >= 1 && n <= 9 ? NUMBERS[n - 1] : null
}

/**
 * Break a move notation into the recorded words that read it aloud.
 *
 * Returns null if any part of it is unrecognised, which is the honest outcome:
 * a phrase missing its verb would be read as nonsense, and saying nothing is
 * better than that.
 */
export function speakMove(notation: string, side: 'r' | 'b'): Line[] | null {
  const parts: Line[] = []

  const who = WORDS.get(SIDES[side])
  if (!who) return null
  parts.push(who)

  for (const token of notation.trim().split(/\s+/)) {
    const spoken = digitWord(token) ?? token
    const word = WORDS.get(spoken)
    if (!word) return null
    parts.push(word)
  }

  return parts.length > 1 ? parts : null
}

/** Every recorded word, for pre-generating the audio. */
export function allFragments(): Line[] {
  return [...WORDS.values()]
}
