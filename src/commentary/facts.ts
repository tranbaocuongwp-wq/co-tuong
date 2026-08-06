/**
 * What just happened on the board, said as whole sentences.
 *
 * An earlier version read the move out of separate recorded words — "Đỏ",
 * "Pháo", "hai", "tiến", "hai" — stitched together at playback. It was
 * accurate and it sounded like a machine reading a list, because that is what
 * it was. Nobody commentates in words; they commentate in sentences, and a
 * sentence has a shape that cannot be assembled after the fact.
 *
 * So every line here is one recording of one complete sentence. That costs more
 * files, and it is the entire difference between a scoreboard and a person.
 *
 * The lines are generated from templates rather than hand-written one by one,
 * because there are hundreds and a hand-written set would drift in voice
 * halfway through. The variety comes from the board instead: which piece moved,
 * which way, what it took, whether it crossed the river or reached the palace
 * door, and what it is now aiming at. Every one of those is something the
 * engine actually reported, so the commentator can never describe a board that
 * is not there.
 */

import { lineId } from './id'
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
 * How each piece is described moving, one phrasing per direction.
 *
 * Written per piece rather than shared, because the whole point is that a
 * Chariot does not move the way a Pawn does and should not be described as if
 * it did. `{s}` is the side that moved, `{o}` the other.
 */
const MOVE_TEXT: Record<Kind, Record<Action, [string, string]>> = {
  r: {
    advance: [
      'Xe {s} lừ lừ tiến lên, cả một tuyến đường mở ra trước mặt.',
      'Xe {s} dấn tới, đi tới đâu là {o} phải dạt tới đó.',
    ],
    across: [
      'Xe {s} băng ngang, đổi tuyến để tìm chỗ hở bên {o}.',
      'Xe {s} rời cột, chuyển sang cánh khác dò đường.',
    ],
    retreat: [
      'Xe {s} lui về, thu quân giữ lấy tuyến sau.',
      'Xe {s} rút lại một bước, chưa vội đổi.',
    ],
  },
  c: {
    advance: [
      'Pháo {s} dâng lên, chỉ chờ có ngòi là nổ.',
      'Pháo {s} tiến một bước, tầm ngắm vươn sâu vào đất {o}.',
    ],
    across: [
      'Pháo {s} băng ngang, đổi hướng ngắm sang cánh khác.',
      'Pháo {s} chuyển cột, tìm một cái ngòi cho vừa tầm.',
    ],
    retreat: [
      'Pháo {s} thoái về, lấy khoảng cách cho đủ đà.',
      'Pháo {s} lùi lại, dọn chỗ chứ không phải sợ.',
    ],
  },
  h: {
    advance: [
      'Mã {s} phi lên, vó ngựa nhắm thẳng trận địa {o}.',
      'Mã {s} nhảy tới, chân đã đặt vào đất người.',
    ],
    across: [
      'Mã {s} vòng sang bên, đi đường vòng mà tới đích.',
      'Mã {s} đảo cánh, tìm một chỗ đứng lợi hơn.',
    ],
    retreat: [
      'Mã {s} lui về, tránh chỗ bị chặn chân.',
      'Mã {s} quay lại giữ nhà, chưa tới lúc xông.',
    ],
  },
  e: {
    advance: [
      'Tượng {s} bước chéo lên, mắt tượng vẫn còn thông.',
      'Tượng {s} dời sang, che thêm một hướng.',
    ],
    across: [
      'Tượng {s} chuyển chỗ, vá lại chỗ vừa hở.',
      'Tượng {s} bay sang cánh kia, giữ cho kín.',
    ],
    retreat: [
      'Tượng {s} lui về giữ nhà, đúng phận của nó.',
      'Tượng {s} về lại, khép cửa cho chắc.',
    ],
  },
  a: {
    advance: [
      'Sĩ {s} nhích lên, kê thêm một lớp cho Tướng.',
      'Sĩ {s} dời một bước, đỡ cho cung cấm.',
    ],
    across: [
      'Sĩ {s} đổi chỗ trong cung, chỉnh lại thế thủ.',
      'Sĩ {s} bước chéo, bịt lại một khe.',
    ],
    retreat: [
      'Sĩ {s} lui về sát Tướng, không rời nửa bước.',
      'Sĩ {s} rút lại, ôm lấy chủ tướng.',
    ],
  },
  p: {
    advance: [
      'Tốt {s} thúc lên một bước, đi rồi là không có đường lui.',
      'Tốt {s} nhích tới, chậm mà chắc.',
    ],
    across: [
      'Tốt {s} bình ngang, đã qua sông nên đi được cả bề ngang.',
      'Tốt {s} rẽ sang bên, nhắm một mục tiêu mới.',
    ],
    retreat: [
      'Tốt {s} lùi lại, chuyện chưa từng có trên bàn cờ này.',
      'Tốt {s} thoái bước, kỳ lạ thật.',
    ],
  },
  k: {
    advance: [
      'Tướng {s} rời ngai bước lên, phải là lúc gấp lắm.',
      'Tướng {s} tự mình tiến một bước.',
    ],
    across: [
      'Tướng {s} dịch ngang, né khỏi tầm ngắm.',
      'Tướng {s} bước sang bên, tìm chỗ đứng an toàn hơn.',
    ],
    retreat: [
      'Tướng {s} lui về đáy cung, co lại cho kín.',
      'Tướng {s} rút về chỗ cũ.',
    ],
  },
}

/** Tone tags per direction, so the delivery matches what is being described. */
const MOVE_TONE: Record<Action, [string, string]> = {
  advance: ['[dõng dạc]', '[hào hứng]'],
  across: ['[điềm tĩnh]', '[trầm ngâm]'],
  retreat: ['[trầm giọng]', '[chậm rãi]'],
}

/** How hard a capture lands, by what came off the board. */
function weight(victim: Kind): 'big' | 'fair' | 'small' {
  if (victim === 'r') return 'big'
  if (victim === 'c' || victim === 'h') return 'fair'
  return 'small'
}

const CAPTURE_TEXT: Record<'big' | 'fair' | 'small', string> = {
  big:
    '{s} tung {m} chém rụng {v} bên {o}! Mất con chủ lực này thì cả cánh ấy trống hoác, ' +
    'bên {o} từ giờ phải co về mà thủ chứ không còn cửa nào để tấn.',
  fair:
    '{s} dùng {m} hạ {v} bên {o}. Một quân tấn công đã rời bàn, thế trận bên {o} ' +
    'mỏng đi trông thấy và mọi tính toán từ nãy phải làm lại từ đầu.',
  small:
    '{s} cho {m} nhặt gọn {v} bên {o}. Quân nhỏ thôi, nhưng lấy đi một chỗ dựa, ' +
    'và trong cờ tướng mất chỗ dựa là chuyện lớn.',
}

const CAPTURE_TONE: Record<'big' | 'fair' | 'small', string> = {
  big: '[phấn khích]',
  fair: '[dõng dạc]',
  small: '[điềm tĩnh]',
}

function fill(template: string, side: SideLetter, mover?: Kind, victim?: Kind): string {
  return template
    .replaceAll('{s}', SIDE[side])
    .replaceAll('{o}', SIDE[other(side)])
    .replaceAll('{m}', mover ? PIECE[mover] : '')
    .replaceAll('{v}', victim ? PIECE[victim] : '')
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
      const text = fill(CAPTURE_TEXT[w], side, mover, victim)
      CAPTURES[`${side}-${mover}-${victim}`] = make(
        `cap-${side}-${mover}-${victim}`,
        text,
        `${CAPTURE_TONE[w]} ${text}`
      )
    }

    for (const victim of TAKEABLE) {
      const text = fill(
        '{m} {s} vừa chĩa thẳng vào {v} bên {o}. Nước sau mà không gỡ là mất quân, ' +
          'mà gỡ thì thế trận phải xô lệch — đằng nào bên {o} cũng phải trả giá.',
        side,
        mover,
        victim
      )
      THREATS[`${side}-${mover}-${victim}`] = make(
        `thr-${side}-${mover}-${victim}`,
        text,
        `[thì thầm] ${text.split('.')[0]}. [cảnh báo] ${text.split('.').slice(1).join('.').trim()}`
      )
    }
  }

  for (const mover of CHECKERS) {
    const text =
      mover === 'k'
        ? fill(
            '{s} để lộ mặt Tướng, chiếu thẳng sang cung {o}! Cả bàn cờ dừng lại, ' +
              'bên {o} phải bỏ hết mọi ý đồ mà lo gỡ cái đã.',
            side
          )
        : fill(
            '{m} {s} chiếu Tướng! Bên {o} không được đi nước nào khác ngoài gỡ chiếu — ' +
              'mất một nhịp ở đây là mất cả thế chủ động.',
            side,
            mover
          )
    CHECKS[`${side}-${mover}`] = make(`chk-${side}-${mover}`, text, `[hào hùng] ${text}`)
  }

  for (const mover of ALL) {
    const river = fill(
      '{m} {s} đã qua sông. Đi rồi là không có đường lui, từ đây chỉ có tiến — ' +
        'và mỗi bước tiến là một mối lo mới cho bên {o}.',
      side,
      mover
    )
    RIVER[`${side}-${mover}`] = make(`riv-${side}-${mover}`, river, `[nhấn mạnh] ${river}`)

    const palace = fill(
      '{m} {s} đã đặt chân vào cung bên {o}! Tới nước này thì Tướng {o} không còn ' +
        'chỗ nào là an toàn nữa, mọi nước đi đều phải ngó về nhà.',
      side,
      mover
    )
    PALACE[`${side}-${mover}`] = make(`pal-${side}-${mover}`, palace, `[hào hùng] ${palace}`)
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
const FORMATION_TEXT: Record<FormationName, string> = {
  centralCannon:
    '{s} lên pháo đầu! Khẩu pháo ngắm thẳng vào Tướng {o} qua trung lộ. ' +
    'Đây là thế mở màn kinh điển nhất của cờ tướng, và cũng hung hãn nhất: ' +
    'bên {o} phải trả lời ngay, chậm một nhịp là trung lộ vỡ.',
  stackedCannons:
    '{s} dựng thế trùng pháo! Hai khẩu pháo chồng lên nhau cùng một đường, ' +
    'khẩu sau làm ngòi cho khẩu trước. Đây là một trong những thế sát mạnh nhất trên bàn cờ — ' +
    'Tướng {o} mà còn đứng đó thì khó thọ.',
  riverCannon:
    '{s} đưa pháo tuần hà. Khẩu pháo chạy dọc bờ sông, vừa ngăn quân {o} qua sông ' +
    'vừa sẵn sàng chuyển hướng bất cứ lúc nào. Thế này khó chịu lắm, nó không doạ gì ngay ' +
    'nhưng bó chân người ta.',
  bothRooksOver:
    'Song xe {s} đã cùng qua sông! Hai cỗ xe cùng lúc đè xuống trận địa {o}. ' +
    'Cờ tướng có câu một xe địch mười quân, giờ có hai — bên {o} không thể giữ được ' +
    'khắp mọi hướng.',
}

const FORMATION: Record<string, Line> = {}

for (const side of SIDES) {
  for (const name of Object.keys(FORMATION_TEXT) as FormationName[]) {
    const text = fill(FORMATION_TEXT[name], side)
    FORMATION[`${side}-${name}`] = make(`frm-${side}-${name}`, text, `[hào hùng] ${text}`)
  }
}

export function formationLine(side: SideLetter, name: FormationName): Line | null {
  return FORMATION[`${side}-${name}`] ?? null
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

/** How the move itself is described. Two phrasings, so a repeat is not identical. */
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
    ...Object.values(FORMATION),
  ]
}
