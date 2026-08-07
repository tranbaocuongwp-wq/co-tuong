/**
 * What just happened on the board, said as whole sentences.
 *
 * An earlier version read the move out of separate recorded words — "Đỏ",
 * "Pháo", "hai", "tiến", "hai" — stitched together at playback. It was
 * accurate and it sounded like a machine reading a list, because that is what
 * it was. Nobody commentates in words; they commentate in sentences, and a
 * sentence has a shape that cannot be assembled after the fact.
 *
 * So every line here is one recording of one complete sentence.
 *
 * ## Why the templates are chosen by fingerprint
 *
 * The version before this one had *one* sentence for every capture of a Chariot,
 * *one* for every threat, *one* for every check. The piece names changed and the
 * rest did not, so a player heard the same tail — "…thế trận bên Đen mỏng đi
 * trông thấy" — several times a game and quite reasonably found it maddening.
 *
 * The fix is not more recordings; it is spreading the sentences that already
 * have to exist across a wider set of phrasings. There are 84 capture lines
 * whether they say 84 different things or 3, because each (side, mover, victim)
 * needs its own recording regardless. So each combination picks its template
 * from a pool by a fingerprint of its own key: deterministic, so a given
 * combination always sounds the same and its recording stays valid, but spread
 * across the pool, so two captures in one game almost never share wording.
 *
 * Moves are the exception — the same piece really does advance over and over —
 * so those get genuine extra variants and a random pick per move.
 */

import { fingerprint, lineId } from './id'
import type { Line } from './lines'

/** The letters the engine uses for piece kinds. */
export type Kind = 'k' | 'a' | 'e' | 'h' | 'r' | 'c' | 'p'

export type SideLetter = 'r' | 'b'

/** Which way a move went, read off the notation. */
export type Action = 'advance' | 'across' | 'retreat'

/** What the engine reports about the move just played. */
export interface MoveReport {
  mover: Kind
  side: SideLetter
  captured: Kind | null
  givesCheck: boolean
  /** Enemy kinds the moved piece can now profitably take, best first. */
  threats: Kind[]
  /** The moved piece is now on the far side of the river. */
  crossedRiver: boolean
  /** The move carried the piece into the enemy palace. */
  intoPalace: boolean
  /** A named shape this move completed, or null. */
  formation: FormationName | null
}

export type FormationName = 'centralCannon' | 'stackedCannons' | 'riverCannon' | 'bothRooksOver'

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

const ALL: Kind[] = ['r', 'c', 'h', 'e', 'a', 'p', 'k']
/** Everything except the King, which is never a capture target. */
const TAKEABLE: Kind[] = ['r', 'c', 'h', 'e', 'a', 'p']
/** Pieces that can deliver check. Elephants and Advisors never leave home to do it. */
const CHECKERS: Kind[] = ['r', 'c', 'h', 'p', 'k']
const SIDES: SideLetter[] = ['r', 'b']

const ACTIONS: Action[] = ['advance', 'across', 'retreat']

function other(side: SideLetter): SideLetter {
  return side === 'r' ? 'b' : 'r'
}

function make(key: string, text: string, speech: string): Line {
  return { key, text, speech, id: lineId(key, speech) }
}

/**
 * Which phrasing this combination gets.
 *
 * Deterministic on purpose: the id of a line is a fingerprint of its words, so
 * a combination that changed template between builds would abandon a perfectly
 * good recording every time. Keyed on the combination rather than a counter so
 * neighbouring combinations — Xe ăn Pháo, Xe ăn Mã — land on different
 * templates instead of marching through the pool in order.
 */
function variant<T>(pool: T[], key: string): T {
  return pool[parseInt(fingerprint(key), 36) % pool.length]
}

/**
 * How each piece is described moving, four phrasings per direction.
 *
 * Written per piece rather than shared, because the whole point is that a
 * Chariot does not move the way a Pawn does and should not be described as if
 * it did. `{s}` is the side that moved, `{o}` the other.
 *
 * Four rather than two because this is the line a player hears most: a forty
 * move game is forty of these, and with two phrasings each the second hearing
 * arrives within a minute.
 */
const MOVE_TEXT: Record<Kind, Record<Action, string[]>> = {
  r: {
    advance: [
      'Xe {s} lừ lừ tiến lên, cả một tuyến mở ra trước mặt.',
      'Xe {s} dấn tới, đi tới đâu là quân {o} phải dạt tới đó.',
      'Xe {s} chồm lên một nhịp, tuyến này từ giờ coi như của nó.',
      'Xe {s} đẩy thẳng lên, chẳng buồn giấu giếm gì cả.',
    ],
    across: [
      'Xe {s} băng ngang, đổi tuyến để dò chỗ hở bên {o}.',
      'Xe {s} rời cột, chuyển sang cánh khác tìm việc.',
      'Xe {s} bình sang bên, đứng chỗ mới cho thoáng đường.',
      'Xe {s} lướt ngang một đường, đổi hẳn hướng ngắm.',
    ],
    retreat: [
      'Xe {s} lui về, thu quân giữ lấy tuyến sau.',
      'Xe {s} rút lại một bước, chưa vội.',
      'Xe {s} thoái xuống hàng dưới, lấy chỗ mà xoay.',
      'Xe {s} kéo về, giữ nhà trước đã.',
    ],
  },
  c: {
    advance: [
      'Pháo {s} dâng lên, chỉ chờ có ngòi là nổ.',
      'Pháo {s} tiến một bước, tầm ngắm vươn sâu vào đất {o}.',
      'Pháo {s} nhích tới, im ắng mà khó chịu.',
      'Pháo {s} lên cao, tìm chỗ đặt nòng cho vừa tầm.',
    ],
    across: [
      'Pháo {s} băng ngang, đổi hướng ngắm sang cánh khác.',
      'Pháo {s} chuyển cột, kiếm một cái ngòi cho vừa ý.',
      'Pháo {s} bình sang bên, nòng vừa quay là cả tuyến ấy phải dè chừng.',
      'Pháo {s} dời chỗ, nhắm sang một mục tiêu mới.',
    ],
    retreat: [
      'Pháo {s} thoái về, lấy khoảng cách cho đủ đà.',
      'Pháo {s} lùi lại, dọn chỗ chứ không phải sợ.',
      'Pháo {s} rút xuống, để dành nòng cho lúc khác.',
      'Pháo {s} về sau một nhịp, đứng xa mà bắn cũng được.',
    ],
  },
  h: {
    advance: [
      'Mã {s} phi lên, vó ngựa nhắm thẳng trận địa {o}.',
      'Mã {s} nhảy tới, chân đã đặt vào đất người.',
      'Mã {s} vọt lên một bước, tám hướng đều đang được tính.',
      'Mã {s} tiến, mà Mã tiến thì bao giờ cũng kèm một lời doạ.',
    ],
    across: [
      'Mã {s} vòng sang bên, đi đường vòng mà tới đích.',
      'Mã {s} đảo cánh, tìm chỗ đứng lợi hơn.',
      'Mã {s} nhảy chéo sang, đổi cả góc nhìn.',
      'Mã {s} chuyển hướng, kiểu đi lắt léo rất khó canh.',
    ],
    retreat: [
      'Mã {s} lui về, tránh chỗ bị chặn chân.',
      'Mã {s} quay lại giữ nhà, chưa tới lúc xông.',
      'Mã {s} thoái một bước, gỡ chân cho thoáng.',
      'Mã {s} rút về, đứng chỗ cũ mà rình.',
    ],
  },
  e: {
    advance: [
      'Tượng {s} bước chéo lên, mắt tượng vẫn còn thông.',
      'Tượng {s} dời sang, che thêm một hướng.',
      'Tượng {s} nhích lên phía trước, đỡ hộ một đường.',
      'Tượng {s} bay lên một nhịp, bịt trước chỗ sắp hở.',
    ],
    across: [
      'Tượng {s} chuyển chỗ, vá lại chỗ vừa hở.',
      'Tượng {s} bay sang cánh kia, giữ cho kín.',
      'Tượng {s} đổi chân, che lấy hướng khác.',
      'Tượng {s} dịch sang, chắp lại hàng phòng thủ.',
    ],
    retreat: [
      'Tượng {s} lui về giữ nhà, đúng phận của nó.',
      'Tượng {s} về lại, khép cửa cho chắc.',
      'Tượng {s} thoái xuống, ôm lấy sân sau.',
      'Tượng {s} rút về chỗ cũ — nó không đi xa được, mà cũng chẳng cần đi xa.',
    ],
  },
  a: {
    advance: [
      'Sĩ {s} nhích lên, kê thêm một lớp cho Tướng.',
      'Sĩ {s} dời một bước, đỡ cho cung cấm.',
      'Sĩ {s} bước chéo lên, đứng chắn trước mặt chủ.',
      'Sĩ {s} tiến trong cung, chỉnh lại thế đứng.',
    ],
    across: [
      'Sĩ {s} đổi chỗ trong cung, sửa lại thế thủ.',
      'Sĩ {s} bước chéo, bịt lại một khe.',
      'Sĩ {s} dịch sang bên, che hướng vừa lộ.',
      'Sĩ {s} chuyển góc, giữ cho cung khỏi trống.',
    ],
    retreat: [
      'Sĩ {s} lui về sát Tướng, không rời nửa bước.',
      'Sĩ {s} rút lại, ôm lấy chủ tướng.',
      'Sĩ {s} thoái về đáy cung, đứng chỗ chắc nhất.',
      'Sĩ {s} về chỗ cũ, làm cái đệm cho Tướng.',
    ],
  },
  p: {
    advance: [
      'Tốt {s} thúc lên một bước, đi rồi là không có đường lui.',
      'Tốt {s} nhích tới, chậm mà chắc.',
      'Tốt {s} bước lên — con quân bé nhất mà lì nhất bàn cờ.',
      'Tốt {s} tiến thêm một ô, mỗi ô là một bước gần cung {o} hơn.',
    ],
    across: [
      'Tốt {s} bình ngang, đã qua sông nên đi được cả bề ngang.',
      'Tốt {s} rẽ sang bên, nhắm một mục tiêu mới.',
      'Tốt {s} dịch ngang một ô, đứng chắn đúng chỗ khó chịu.',
      'Tốt {s} sang ngang — tới đây thì nó không còn là quân vặt nữa.',
    ],
    retreat: [
      'Tốt {s} lùi lại — chuyện chưa từng có trên bàn cờ này.',
      'Tốt {s} thoái bước. Lạ thật, luật cờ đâu cho phép.',
      'Tốt {s} lui? Con Tốt vốn không biết đường lùi mà.',
      'Tốt {s} đi ngược. Hẳn là lão phu nhìn nhầm.',
    ],
  },
  k: {
    advance: [
      'Tướng {s} rời ngai bước lên — phải là lúc gấp lắm.',
      'Tướng {s} tự mình tiến một bước, chuyện hiếm thấy.',
      'Tướng {s} nhích lên trong cung, đích thân ra mặt.',
      'Tướng {s} bước tới. Đến chủ soái cũng phải xắn tay thì biết thế cờ căng cỡ nào.',
    ],
    across: [
      'Tướng {s} dịch ngang, né khỏi tầm ngắm.',
      'Tướng {s} bước sang bên, tìm chỗ đứng an toàn hơn.',
      'Tướng {s} lách sang một ô, tránh cái đường đang bị soi.',
      'Tướng {s} đổi chỗ trong cung — chỉ vậy thôi mà cả thế cờ đổi theo.',
    ],
    retreat: [
      'Tướng {s} lui về đáy cung, co lại cho kín.',
      'Tướng {s} rút về chỗ cũ, an toàn là trên hết.',
      'Tướng {s} thoái xuống, nấp sau lớp Sĩ Tượng.',
      'Tướng {s} về hàng cuối, tránh xa mấy đường đang mở.',
    ],
  },
}

/** Tone tags per direction, so the delivery matches what is being described. */
const MOVE_TONE: Record<Action, string[]> = {
  advance: ['[dõng dạc]', '[hào hứng]', '[nhấn mạnh]', '[phấn khích]'],
  across: ['[điềm tĩnh]', '[trầm ngâm]', '[thì thầm]', '[tò mò]'],
  retreat: ['[trầm giọng]', '[chậm rãi]', '[điềm tĩnh]', '[thì thầm]'],
}

/** How hard a capture lands, by what came off the board. */
function weight(victim: Kind): 'big' | 'fair' | 'small' {
  if (victim === 'r') return 'big'
  if (victim === 'c' || victim === 'h') return 'fair'
  return 'small'
}

const CAPTURE_TEXT: Record<'big' | 'fair' | 'small', string[]> = {
  big: [
    '{s} tung {m} chém rụng {v} bên {o}! Mất cỗ xe này thì cả một cánh trống hoác, ' +
      'bên {o} từ giờ chỉ còn co về mà giữ chứ chẳng còn cửa nào để tấn.',
    'Ối! {m} {s} đoạt luôn {v} bên {o}. Cờ tướng có câu một xe địch mười quân — ' +
      'mất nó là mất đúng cái tay mạnh nhất của mình.',
    '{s} cho {m} lao vào bắt {v} bên {o}! Đòn này nặng lắm, thế trận bên {o} ' +
      'vừa mất cả xương sống lẫn nhịp tấn công.',
    '{m} {s} hạ {v} bên {o}, một cú quá hời. Từ đây bên {o} muốn làm gì cũng phải ' +
      'nghĩ tới chuyện mình đang thiếu người nặng.',
    '{v} bên {o} rời bàn dưới tay {m} {s}! Cả tuyến ấy giờ chẳng còn ai gánh, ' +
      'và những nước bên {o} tính từ nãy coi như bỏ hết.',
    '{s} dứt điểm bằng {m}, {v} bên {o} không kịp chạy. Đây là loại tổn thất mà ' +
      'đánh thêm ba mươi nước nữa cũng chưa chắc bù lại nổi.',
    'Một nhát của {m} {s} lấy đứt {v} bên {o}. Bên {o} vừa hụt mất quân chủ lực, ' +
      'thế công tắt ngóm từ đây.',
    '{m} {s} vồ gọn {v} bên {o}! Nặng đô đấy. Bên {o} bây giờ mỗi nước đi đều phải ' +
      'đi trong cái thế thiếu người.',
  ],
  fair: [
    '{s} dùng {m} hạ {v} bên {o}. Một quân tấn công vừa rời bàn, thế trận bên {o} ' +
      'mỏng hẳn đi và mọi tính toán từ nãy phải làm lại.',
    '{m} {s} bắt {v} bên {o} rất gọn. Mất con này thì bên {o} hụt đúng một mũi nhọn, ' +
      'muốn công cũng chẳng lấy gì mà công.',
    '{s} đổi được {v} bên {o} bằng {m}. Nghe thì nhẹ, nhưng bớt một quân cơ động ' +
      'là bớt luôn một nửa số đòn có thể tung ra.',
    '{v} bên {o} bị {m} {s} lấy mất. Hàng công bên {o} vừa sứt một mảng, ' +
      'mà chỗ sứt ấy khó vá lắm.',
    '{m} {s} nuốt {v} bên {o}. Quân này đi rồi thì mấy đường phối hợp bên {o} ' +
      'đang dựng dở coi như dẹp.',
    '{s} nhanh tay cho {m} ăn {v} bên {o}. Một quân linh hoạt rời bàn, ' +
      'bên {o} từ giờ đi đâu cũng thấy chật.',
    'Gọn ghẽ! {m} {s} hạ {v} bên {o} mà chẳng phải trả gì. ' +
      'Bên {o} vừa nghèo đi trông thấy.',
    '{m} {s} thu {v} bên {o} về. Cán cân vừa xê dịch, và trong cờ tướng ' +
      'xê dịch cỡ này là đủ để đổi cả cách đánh.',
  ],
  small: [
    '{s} cho {m} nhặt gọn {v} bên {o}. Quân nhỏ thôi, nhưng lấy mất một chỗ dựa — ' +
      'mà trong cờ tướng mất chỗ dựa là chuyện lớn.',
    '{m} {s} ăn {v} bên {o}. Trông thì chẳng đáng gì, ' +
      'nhưng đến tàn cuộc mới thấy thiếu.',
    '{v} bên {o} đi rồi, {m} {s} lấy được. Hàng rào quanh cung bên {o} vừa thủng ' +
      'một lỗ nhỏ, mà lỗ nhỏ thì cũng đủ cho pháo lọt.',
    '{s} vặt luôn {v} bên {o} bằng {m}. Từng tí một, kiểu này là ăn mòn dần ' +
      'chứ chẳng cần đòn to.',
    '{m} {s} dọn {v} bên {o} ra khỏi bàn. Bớt một quân giữ nhà là bớt một lớp che, ' +
      'thế thủ bên {o} mỏng thêm một tầng.',
    'Nhẹ nhàng thôi: {m} {s} lấy {v} bên {o}. Nhưng cộng dồn mấy nước như thế lại ' +
      'thì bên {o} sẽ thấy nặng.',
    '{s} thò {m} ra ăn {v} bên {o}. Nhỏ mà có võ — chỗ trống nó để lại ' +
      'đúng vào hướng hiểm.',
    '{m} {s} gạt {v} bên {o} sang một bên. Một chốt chặn vừa biến mất, ' +
      'đường vào đất {o} thoáng hơn hẳn.',
  ],
}

const CAPTURE_TONE: Record<'big' | 'fair' | 'small', string> = {
  big: '[phấn khích]',
  fair: '[dõng dạc]',
  small: '[điềm tĩnh]',
}

const THREAT_TEXT: string[] = [
  '{m} {s} vừa chĩa thẳng vào {v} bên {o}. Nước sau không gỡ là mất quân, ' +
    'mà gỡ thì thế trận phải xô lệch — đằng nào bên {o} cũng phải trả giá.',
  '{m} {s} nhắm sẵn {v} bên {o} rồi đấy. Bên {o} còn đúng một nhịp để tìm đường, ' +
    'quá nhịp ấy thì đành chịu.',
  'Coi chừng, {v} bên {o} đang nằm trong tầm {m} {s}. Chạy thì hở chỗ khác, ' +
    'đứng yên thì mất — thế cờ đang bắt bên {o} chọn cái ít đau hơn.',
  '{m} {s} vừa đặt {v} bên {o} vào thế khó. Cái khó không nằm ở con quân ấy, ' +
    'mà ở chỗ cứu nó thì phải rút quân đang giữ chỗ hiểm về.',
  'Đòn này ngắm {v} bên {o}: {m} {s} đứng đúng chỗ mà chẳng ai cản nổi. ' +
    'Bên {o} phải mất một nước để dọn, và một nước lúc này là đắt.',
  '{m} {s} treo lơ lửng trên đầu {v} bên {o}. Chưa ăn ngay, nhưng cứ để đấy ' +
    'là bên {o} không dám đụng đến quân nào khác.',
  'Bên {o} có chuyện với {v} rồi: {m} {s} đã vào tầm. Trong cờ tướng, ' +
    'bị doạ mà phải lùi thì coi như mất trắng một lượt.',
  '{m} {s} vừa khoá đường sống của {v} bên {o}. Gỡ được thì gỡ, ' +
    'mà gỡ xong thế trận cũng không còn như cũ nữa.',
  'Cái {v} bên {o} kia đang bị {m} {s} soi. Đây mới là chỗ khó chịu — ' +
    'nó chưa mất, nhưng nó đã không còn tự do.',
  '{m} {s} nhòm sang {v} bên {o}. Một lời hăm doạ đặt đúng lúc, ' +
    'và bên {o} bây giờ phải đi theo ý người khác.',
]

const CHECK_TEXT: string[] = [
  '{m} {s} chiếu Tướng! Bên {o} không được đi nước nào khác ngoài gỡ chiếu — ' +
    'mất một nhịp ở đây là mất luôn thế chủ động.',
  'Chiếu! {m} {s} ép thẳng vào cung {o}. Mọi kế hoạch bên {o} đang dựng dở ' +
    'phải gác lại hết.',
  '{m} {s} đâm một nhát vào giữa cung {o}, chiếu Tướng. Bên {o} giờ còn ba lối — ' +
    'chạy, che, hoặc ăn — mà lối nào cũng tốn.',
  'Tướng {o} bị {m} {s} gọi tên! Đây là lúc bên {o} phải trả lời ngay, ' +
    'không được phép nghĩ chuyện gì khác.',
  '{m} {s} chiếu tướng, dứt khoát. Cái lợi của nước chiếu không nằm ở chỗ ăn được gì, ' +
    'mà ở chỗ nó cướp trắng một lượt của đối phương.',
  'Chiếu! {m} {s} thò vào tận nơi. Bên {o} mà gỡ không khéo ' +
    'thì gỡ xong lại dính tiếp nước sau.',
  '{m} {s} nện thẳng vào Tướng {o}. Cung cấm bên {o} vừa bị chọc thủng, ' +
    'và chỗ thủng ấy còn để lại dấu.',
  'Nghe rõ chưa — {m} {s} chiếu! Bên {o} buộc phải bỏ hết mọi ý đồ ' +
    'để lo cái đã.',
]

const RIVER_TEXT: string[] = [
  '{m} {s} đã qua sông. Đi rồi thì không có đường lui, từ đây chỉ có tiến — ' +
    'và mỗi bước tiến là một mối lo mới cho bên {o}.',
  '{m} {s} bước qua Sở Hà Hán Giới. Sang tới bờ bên kia là đổi thân phận, ' +
    'con quân này từ giờ nguy hiểm hơn hẳn.',
  '{m} {s} vượt sông rồi! Bên {o} vừa có thêm một cái gai ' +
    'cắm ngay trong đất nhà mình.',
  '{m} {s} sang sông, và không quay lại nữa. Bên {o} sẽ phải cắt người ra trông nó, ' +
    'mà cắt người ra thì chỗ khác lại hở.',
  'Qua sông! {m} {s} đặt chân sang phần đất bên {o}. Cái ranh giới ấy vừa bị xoá, ' +
    'trận đánh chuyển hẳn sang sân người ta.',
  '{m} {s} lội qua sông. Nhìn thì một bước nhỏ, nhưng từ nay bên {o} ' +
    'không còn được yên trong nhà mình nữa.',
  '{m} {s} đã ở bên kia sông. Cổ nhân bảo tốt qua hà bằng nửa con xe — ' +
    'bên {o} nên nhớ câu ấy.',
  '{m} {s} tiến qua sông, dứt khoát không hối. Bên {o} bây giờ phải tính cả chuyện ' +
    'phòng thủ ngay trong sân nhà.',
]

const PALACE_TEXT: string[] = [
  '{m} {s} đã đặt chân vào cung bên {o}! Tới nước này thì Tướng {o} không còn chỗ nào ' +
    'là an toàn, mọi nước đi đều phải ngó về nhà.',
  '{m} {s} chui thẳng vào cung cấm bên {o}. Đây là chỗ không ai muốn thấy quân địch đứng, ' +
    'mà nó đang đứng đấy.',
  'Vào cung rồi! {m} {s} lọt qua cửa, Tướng {o} phải tự lo lấy thân.',
  '{m} {s} áp sát tận cung {o}. Ba ô vuông bé tí ấy giờ chật lắm, ' +
    'mà chật trong cờ tướng là chết.',
  '{m} {s} đã vào tới sân trong bên {o}. Từ đây một nước chiếu cũng đủ thành sát cục, ' +
    'bên {o} không được sai thêm nữa.',
  'Cung cấm bên {o} vừa có khách: {m} {s}. Tướng {o} bây giờ đi đâu cũng vướng.',
  '{m} {s} bước qua cửa cung {o}. Sĩ Tượng bên {o} có mấy con, ' +
    'mà giờ con nào cũng phải làm việc gấp đôi.',
  '{m} {s} đứng ngay trong cung {o} rồi. Đến nước này thì phòng thủ ' +
    'không còn là chuyện tính toán nữa, là chuyện sống còn.',
]

function fill(template: string, side: SideLetter, mover?: Kind, victim?: Kind): string {
  return template
    .replaceAll('{s}', SIDE[side])
    .replaceAll('{o}', SIDE[other(side)])
    .replaceAll('{m}', mover ? PIECE[mover] : '')
    .replaceAll('{v}', victim ? PIECE[victim] : '')
}

/**
 * Splits a two-sentence line into two tagged halves for the voice.
 *
 * The whole reason for the performance tags is that a flat reading of a long
 * sentence sounds like a announcement board. Tagging the observation and the
 * verdict differently is what makes it sound like someone who has an opinion.
 */
function twoTone(text: string, first: string, second: string): string {
  const cut = text.indexOf('. ')
  if (cut < 0) return `${first} ${text}`
  return `${first} ${text.slice(0, cut + 1)} ${second} ${text.slice(cut + 2)}`
}

const MOVES: Record<string, Line[]> = {}
const CAPTURES: Record<string, Line> = {}
const CHECKS: Record<string, Line> = {}
const THREATS: Record<string, Line> = {}
const RIVER: Record<string, Line> = {}
const PALACE: Record<string, Line> = {}

for (const side of SIDES) {
  for (const mover of ALL) {
    for (const action of ACTIONS) {
      MOVES[`${side}-${mover}-${action}`] = MOVE_TEXT[mover][action].map((template, i) => {
        const text = fill(template, side)
        return make(`mv-${side}-${mover}-${action}-${i}`, text, `${MOVE_TONE[action][i]} ${text}`)
      })
    }

    for (const victim of TAKEABLE) {
      const w = weight(victim)
      const key = `${side}-${mover}-${victim}`
      const text = fill(variant(CAPTURE_TEXT[w], `cap:${key}`), side, mover, victim)
      CAPTURES[key] = make(
        `cap-${key}`,
        text,
        twoTone(text, CAPTURE_TONE[w], w === 'small' ? '[trầm ngâm]' : '[nhấn mạnh]')
      )

      const threat = fill(variant(THREAT_TEXT, `thr:${key}`), side, mover, victim)
      THREATS[key] = make(`thr-${key}`, threat, twoTone(threat, '[thì thầm]', '[cảnh báo]'))
    }
  }

  for (const mover of CHECKERS) {
    const text =
      mover === 'k'
        ? fill(
            '{s} để lộ mặt Tướng, chiếu thẳng sang cung {o}! Cả bàn cờ khựng lại, ' +
              'bên {o} phải bỏ hết mọi ý đồ mà lo gỡ cái đã.',
            side
          )
        : fill(variant(CHECK_TEXT, `chk:${side}-${mover}`), side, mover)
    CHECKS[`${side}-${mover}`] = make(
      `chk-${side}-${mover}`,
      text,
      twoTone(text, '[hào hùng]', '[nghiêm giọng]')
    )
  }

  for (const mover of ALL) {
    const river = fill(variant(RIVER_TEXT, `riv:${side}-${mover}`), side, mover)
    RIVER[`${side}-${mover}`] = make(
      `riv-${side}-${mover}`,
      river,
      twoTone(river, '[nhấn mạnh]', '[trầm ngâm]')
    )

    const palace = fill(variant(PALACE_TEXT, `pal:${side}-${mover}`), side, mover)
    PALACE[`${side}-${mover}`] = make(
      `pal-${side}-${mover}`,
      palace,
      twoTone(palace, '[hào hùng]', '[căng thẳng]')
    )
  }
}

/**
 * Which way the move went, read off the engine's own notation.
 *
 * The notation is the one place that already knows: "bình" is across, "tiến"
 * forward, "thoái" back. Working it out again from coordinates would be a
 * second implementation of something already decided.
 */
export function actionOf(notation: string): Action {
  if (notation.includes(' bình ')) return 'across'
  if (notation.includes(' thoái ')) return 'retreat'
  return 'advance'
}

/**
 * Named shapes, with what each one means for the position.
 *
 * This is the layer a real commentator reaches for first: nobody says "the
 * cannon went to the middle file", they say "pháo đầu" and everyone knows what
 * is coming. Each line names the shape and then says what it does, because the
 * name alone only helps people who already knew.
 */
const FORMATION_TEXT: Record<FormationName, string[]> = {
  centralCannon: [
    '{s} lên pháo đầu! Khẩu pháo ngắm thẳng vào Tướng {o} qua trung lộ. ' +
      'Đây là thế mở màn kinh điển nhất của cờ tướng, và cũng hung hãn nhất — ' +
      'bên {o} phải trả lời ngay, chậm một nhịp là trung lộ vỡ.',
    'Pháo đầu! {s} dựng ngay khẩu pháo giữa bàn, nòng chỉ đúng vào cung {o}. ' +
      'Cả ngàn năm nay người ta vẫn mở màn bằng nước này, đơn giản vì nó buộc ' +
      'đối phương phải đi theo mình chứ không được đi theo ý họ.',
  ],
  stackedCannons: [
    '{s} dựng thế trùng pháo! Hai khẩu chồng lên nhau cùng một đường, ' +
      'khẩu sau làm ngòi cho khẩu trước. Đây là một trong những thế sát mạnh nhất ' +
      'trên bàn cờ — Tướng {o} mà còn đứng đó thì khó thọ.',
    'Trùng pháo bên {s}! Hai khẩu pháo nối đuôi nhau trên một tuyến, ' +
      'ăn nhau ở chỗ khẩu trước vừa nổ là khẩu sau đã sẵn nòng. ' +
      'Bên {o} phải phá cái ngòi ấy cho bằng được, không thì cả trung lộ sập.',
  ],
  riverCannon: [
    '{s} đưa pháo tuần hà. Khẩu pháo chạy dọc bờ sông, vừa ngăn quân {o} qua sông ' +
      'vừa sẵn sàng chuyển hướng bất cứ lúc nào. Thế này khó chịu lắm — ' +
      'nó không doạ gì ngay, nhưng nó bó chân người ta.',
    'Pháo {s} lên tuần hà, nằm vắt ngang bờ sông. Đây là kiểu chơi của người kiên nhẫn: ' +
      'không ăn ai cả, chỉ đứng đó khiến bên {o} muốn qua sông cũng phải nghĩ hai lần.',
  ],
  bothRooksOver: [
    'Song xe {s} đã cùng qua sông! Hai cỗ xe cùng lúc đè xuống trận địa {o}. ' +
      'Cờ tướng có câu một xe địch mười quân — giờ có hai, ' +
      'bên {o} không thể giữ nổi khắp mọi hướng.',
    'Cả hai Xe bên {s} đều đã sang sông. Đến đây thì bên {o} hết đường thủ suông: ' +
      'bịt được đường này thì đường kia mở, mà hai cỗ xe thì không ai đỡ nổi bằng quân lẻ.',
  ],
}

const FORMATION: Record<string, Line[]> = {}

for (const side of SIDES) {
  for (const name of Object.keys(FORMATION_TEXT) as FormationName[]) {
    FORMATION[`${side}-${name}`] = FORMATION_TEXT[name].map((template, i) => {
      const text = fill(template, side)
      return make(`frm-${side}-${name}-${i}`, text, twoTone(text, '[hào hùng]', '[nhấn mạnh]'))
    })
  }
}

export function formationLine(side: SideLetter, name: FormationName): Line | null {
  const pool = FORMATION[`${side}-${name}`]
  if (!pool || pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Which piece a notation is about, read off its first word.
 *
 * Used for advice, where the move exists only as notation and the sentence
 * describing it has to be chosen from that.
 */
export function kindOfNotation(notation: string): Kind | null {
  const first = notation.trim().split(/\s+/)[0]
  const found = (Object.keys(PIECE) as Kind[]).find((k) => PIECE[k] === first)
  return found ?? null
}

/** How the move itself is described. Four phrasings, so a repeat is a rarity. */
export function moveLines(side: SideLetter, mover: Kind, action: Action): Line[] {
  return MOVES[`${side}-${mover}-${action}`] ?? []
}

export function captureLine(side: SideLetter, mover: Kind, victim: Kind): Line | null {
  return CAPTURES[`${side}-${mover}-${victim}`] ?? null
}

export function threatLine(side: SideLetter, mover: Kind, victim: Kind): Line | null {
  return THREATS[`${side}-${mover}-${victim}`] ?? null
}

export function checkLine(side: SideLetter, mover: Kind): Line | null {
  return CHECKS[`${side}-${mover}`] ?? null
}

export function riverLine(side: SideLetter, mover: Kind): Line | null {
  return RIVER[`${side}-${mover}`] ?? null
}

export function palaceLine(side: SideLetter, mover: Kind): Line | null {
  return PALACE[`${side}-${mover}`] ?? null
}

/** Every line describing a move, for pre-generating the audio. */
export function allFactLines(): Line[] {
  return [
    ...Object.values(MOVES).flat(),
    ...Object.values(CAPTURES),
    ...Object.values(THREATS),
    ...Object.values(CHECKS),
    ...Object.values(RIVER),
    ...Object.values(PALACE),
    ...Object.values(FORMATION).flat(),
  ]
}
