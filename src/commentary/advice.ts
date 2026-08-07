/**
 * The commentator thinking out loud about what he would play.
 *
 * A pundit who only describes what happened is half a pundit. The other half is
 * "if it were me, I'd play this, and here is why" — said while the player is
 * still deciding, which is the only moment it is worth anything.
 *
 * Three parts, spoken in a row: an opening remark, a sentence describing the
 * move, and a reason. The reason is never invented — it is whatever the engine
 * reported about that move when it ranked it, so the commentator cannot promise
 * something the board does not offer.
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

/**
 * Builds a pool from plain sentences.
 *
 * Same trick as the reaction script next door: the delivery is data, so adding
 * a line is adding a line rather than adding a line plus remembering to tag it.
 */
function pool(prefix: string, entries: [text: string, open: string, turn: string][]): Line[] {
  return entries.map(([text, open, turn], i) => {
    const key = `${prefix}-${String(i + 1).padStart(2, '0')}`
    const cut = text.indexOf('. ')
    const speech =
      cut < 0
        ? `${open} ${text}`
        : `${open} ${text.slice(0, cut + 1)} ${turn} ${text.slice(cut + 2)}`
    return { key, text, speech, id: lineId(key, speech) }
  })
}

function choose(lines: Line[], recent: readonly string[] = []): Line {
  const fresh = lines.filter((l) => !recent.includes(l.id))
  const from = fresh.length > 0 ? fresh : lines
  return from[Math.floor(Math.random() * from.length)]
}

/** Opening remarks. Said before the move, so the listener knows an opinion is coming. */
const LEADS = pool('adv', [
  ['Nếu là lão phu thì lão phu đi thế này. Chư vị cứ nghe rồi tự quyết.', '[trầm ngâm]', '[ấm áp]'],
  ['Chỗ này có một nước đáng cân nhắc. Lão phu chỉ ra, còn đi hay không là chuyện khác.', '[thì thầm]', '[nhấn mạnh]'],
  ['Lão phu vừa nhìn ra một đường khá hay. Không chắc là hay nhất, nhưng chắc là đáng thử.', '[hào hứng]', '[điềm tĩnh]'],
  ['Thế cờ này mà lão phu cầm quân thì lão phu chọn nước sau đây.', '[điềm tĩnh]', '[dõng dạc]'],
  ['Nhìn kỹ mà xem, còn một lối chưa ai để ý tới.', '[thì thầm]', '[ranh mãnh]'],
  ['Có một nước ở đây mà lão phu ngứa tay lắm rồi. Nói ra cho nhẹ người.', '[cười nhẹ]', '[hào hứng]'],
  ['Đứng ngoài thì bao giờ cũng dễ nói. Nhưng lão phu thấy thế này.', '[cười khẩy]', '[điềm tĩnh]'],
  ['Lão phu mạn phép góp một câu. Thế cờ đang mở ra đúng một chỗ, và chỗ ấy nằm đây.', '[trang trọng]', '[nhấn mạnh]'],
  ['Chưa vội đi. Có một nước đáng nhìn thêm một nhịp nữa.', '[cảnh báo]', '[trầm ngâm]'],
  ['Nếu hỏi lão phu thì lão phu đặt tay vào quân này. Lý do thì ngay sau đây.', '[dõng dạc]', '[điềm tĩnh]'],
])

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
    `Nước ấy nhặt gọn ${PIECE[kind]} bên kia, mà không phải trả lại gì.`,
    `[dõng dạc] Nước ấy nhặt gọn ${PIECE[kind]} bên kia... [nhấn mạnh] mà không phải trả lại gì.`
  )
  THREAT[kind] = make(
    `advthr-${kind}`,
    `Đi rồi thì ${PIECE[kind]} bên kia hết đường xoay, gỡ cách nào cũng mất một nhịp.`,
    `[ranh mãnh] Đi rồi thì ${PIECE[kind]} bên kia hết đường xoay... [nhấn mạnh] gỡ cách nào cũng mất một nhịp.`
  )
}

const CHECK = pool('advchk', [
  [
    'Nước ấy chiếu tướng ngay. Đối phương phải bỏ hết việc đang làm mà lo gỡ trước đã.',
    '[hào hùng]',
    '[nghiêm giọng]',
  ],
  [
    'Chiếu luôn. Cái lợi không nằm ở chỗ ăn được gì, mà ở chỗ nó cướp trắng của người ta một lượt.',
    '[dõng dạc]',
    '[nhấn mạnh]',
  ],
  [
    'Đi vào là chiếu. Thế cờ sau đó sẽ do mình đặt chứ không phải theo ý đối phương nữa.',
    '[phấn khích]',
    '[điềm tĩnh]',
  ],
])

const HOLD = pool('advhold', [
  ['Không ăn được gì cả, nhưng giữ thế cho chắc. Cờ tướng nhiều lúc thắng bằng những nước như thế.', '[điềm tĩnh]', '[trầm ngâm]'],
  ['Nước này chẳng có gì hoa mỹ. Được cái là đi xong thì chẳng hở chỗ nào.', '[chậm rãi]', '[nhấn mạnh]'],
  ['Chưa vội ăn ai. Cứ đứng cho vững rồi tính tiếp, vội một nhịp là hỏng cả thế.', '[trầm ngâm]', '[cảnh báo]'],
  ['Đây là nước dọn đường. Chưa thấy lợi ngay, nhưng mấy nước nữa mới thấy nó đáng.', '[thì thầm]', '[ranh mãnh]'],
])

const HOPELESS = pool('advstuck', [
  ['Nói thật, thế này thì đi đâu cũng khó. Đành chọn nước đỡ đau nhất vậy.', '[trầm giọng]', '[chậm rãi]'],
  ['Lão phu tìm mãi mà chẳng ra nước nào tử tế. Đến nước này thì chỉ còn cách kéo dài thêm.', '[trầm giọng]', '[nghiêm giọng]'],
  ['Thế cờ đã hỏng rồi, nói gì cũng bằng thừa. Cứ đi cho hết ván, biết đâu bên kia lại lơ là.', '[chậm rãi]', '[ấm áp]'],
])

/** Centipawns past which no advice is really advice any more. */
const STUCK = -900

/** A remark to open with, avoiding anything in `recent`. */
export function adviceLead(recent: readonly string[]): Line {
  return choose(LEADS, recent)
}

/**
 * Why that move, in one line.
 *
 * Ordered by what a listener would care about most, and only one is said —
 * reading a list of consequences at someone is not commentary.
 */
export function adviceReason(hint: HintInfo): Line {
  if (hint.score <= STUCK) return choose(HOPELESS)
  if (hint.captured) return CAPTURE[hint.captured] ?? choose(HOLD)
  if (hint.givesCheck) return choose(CHECK)
  if (hint.threats.length > 0) return THREAT[hint.threats[0]] ?? choose(HOLD)
  return choose(HOLD)
}

/** Every advice line, for pre-generating the audio. */
export function allAdviceLines(): Line[] {
  return [
    ...LEADS,
    ...Object.values(CAPTURE),
    ...Object.values(THREAT),
    ...CHECK,
    ...HOLD,
    ...HOPELESS,
  ].filter((l): l is Line => !!l)
}
