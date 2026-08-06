/**
 * The commentator thinking out loud about what he would play.
 *
 * A pundit who only describes what happened is half a pundit. The other half is
 * "if it were me, I'd play this, and here is why" — said while the player is
 * still deciding, which is the only moment it is worth anything.
 *
 * Three parts, spoken in a row: an opening remark, the move itself read out of
 * the recorded words in `fragments.ts`, and a reason. The reason is never
 * invented — it is whatever the engine reported about that move when it ranked
 * it, so the commentator cannot promise something the board does not offer.
 *
 * He is still an onlooker, not a coach: he says what he would do, not what the
 * player should do, and he is wrong often enough to be worth arguing with.
 */

import type { HintInfo, PieceKind } from '../engine/types'
import { lineId } from './id'
import type { Line } from './lines'

function make(key: string, text: string, speech: string): Line {
  return { key, text, speech, id: lineId(key, speech) }
}

/** Opening remarks. Said before the move, so the listener knows an opinion is coming. */
const LEADS: Line[] = [
  make(
    'adv-01',
    'Nếu là lão phu, lão phu sẽ đi thế này.',
    '[trầm ngâm] Nếu là lão phu... [nhấn mạnh] lão phu sẽ đi thế này.'
  ),
  make(
    'adv-02',
    'Chỗ này có một nước đáng cân nhắc.',
    '[thì thầm] Chỗ này... [nhấn mạnh] có một nước đáng cân nhắc.'
  ),
  make(
    'adv-03',
    'Lão phu thấy một đường khá hay.',
    '[hào hứng] Lão phu thấy... [nhấn mạnh] một đường khá hay.'
  ),
  make(
    'adv-04',
    'Thế cờ này mà lão phu cầm quân, lão phu chọn nước sau.',
    '[điềm tĩnh] Thế cờ này mà lão phu cầm quân... [dõng dạc] lão phu chọn nước sau.'
  ),
  make(
    'adv-05',
    'Nhìn kỹ mà xem, còn một lối chưa ai để ý.',
    '[thì thầm] Nhìn kỹ mà xem... [ranh mãnh] còn một lối chưa ai để ý.'
  ),
]

const PIECE: Record<PieceKind, string> = {
  k: 'Tướng',
  a: 'Sĩ',
  e: 'Tượng',
  h: 'Mã',
  r: 'Xe',
  c: 'Pháo',
  p: 'Tốt',
}

/** Everything a move can be worth saying for, one recording each. */
const TAKEABLE: PieceKind[] = ['r', 'c', 'h', 'e', 'a', 'p']

const CAPTURE: Partial<Record<PieceKind, Line>> = {}
const THREAT: Partial<Record<PieceKind, Line>> = {}

for (const kind of TAKEABLE) {
  CAPTURE[kind] = make(
    `advcap-${kind}`,
    `Nước ấy ăn đứt ${PIECE[kind]} bên kia.`,
    `[dõng dạc] Nước ấy... [nhấn mạnh] ăn đứt ${PIECE[kind]} bên kia.`
  )
  THREAT[kind] = make(
    `advthr-${kind}`,
    `Đi rồi là ${PIECE[kind]} bên kia hết đường.`,
    `[ranh mãnh] Đi rồi là... [nhấn mạnh] ${PIECE[kind]} bên kia hết đường.`
  )
}

const CHECK = make(
  'advchk',
  'Nước ấy chiếu tướng ngay, đối phương phải gỡ trước đã.',
  '[hào hùng] Nước ấy chiếu tướng ngay... [nghiêm giọng] đối phương phải gỡ trước đã.'
)

const HOLD = make(
  'advhold',
  'Không ăn được gì, nhưng giữ thế cho chắc.',
  '[điềm tĩnh] Không ăn được gì... [nhấn mạnh] nhưng giữ thế cho chắc.'
)

const HOPELESS = make(
  'advstuck',
  'Nói thật, thế này thì đi đâu cũng khó. Chọn nước đỡ đau nhất thôi.',
  '[trầm giọng] Nói thật, thế này thì đi đâu cũng khó... [chậm rãi] chọn nước đỡ đau nhất thôi.'
)

/** Centipawns past which no advice is really advice any more. */
const STUCK = -900

/** A remark to open with, avoiding anything in `recent`. */
export function adviceLead(recent: readonly string[]): Line {
  const fresh = LEADS.filter((l) => !recent.includes(l.id))
  const pool = fresh.length > 0 ? fresh : LEADS
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Why that move, in one line.
 *
 * Ordered by what a listener would care about most, and only one is said —
 * reading a list of consequences at someone is not commentary.
 */
export function adviceReason(hint: HintInfo): Line {
  if (hint.score <= STUCK) return HOPELESS
  if (hint.captured) return CAPTURE[hint.captured] ?? HOLD
  if (hint.givesCheck) return CHECK
  if (hint.threats.length > 0) return THREAT[hint.threats[0]] ?? HOLD
  return HOLD
}

/** Every advice line, for pre-generating the audio. */
export function allAdviceLines(): Line[] {
  return [
    ...LEADS,
    ...Object.values(CAPTURE),
    ...Object.values(THREAT),
    CHECK,
    HOLD,
    HOPELESS,
  ].filter((l): l is Line => !!l)
}
