/**
 * Reading a few moves ahead, out loud.
 *
 * Everything else the commentator says is about the move that was just played.
 * That is honest but shallow, and it is what makes commentary feel like a
 * caption track: it never tells you anything you could not have seen. What a
 * real pundit does — the thing worth listening for — is point at something that
 * has not happened yet: *play this and in three moves that Chariot walks into
 * the middle file and the game turns over.*
 *
 * ## Where this comes from, and why it is not made up
 *
 * The engine already computes exactly that. Every search returns its principal
 * variation: the line it believes both sides will actually play. This module
 * walks that line forward over a copy of the board and finds the first thing in
 * it worth mentioning — a real capture, a real check, a real break into the
 * palace — and says how many moves away it is.
 *
 * So the prediction is the engine's, not an invention. If it is wrong, it is
 * wrong the same way the engine's own move choice is wrong, which is the only
 * kind of wrong worth being. Nothing here guesses.
 *
 * Replaying is safe without any rules knowledge: the engine only ever returns
 * legal moves, so moving the piece and removing whatever it lands on is enough.
 * Re-implementing move legality here would be a second rulebook to keep in step
 * with the first, which is how the two end up disagreeing.
 */

import type { Kind, SideLetter } from './facts'
import { fingerprint, lineId } from './id'
import type { Line } from './lines'

interface Man {
  row: number
  col: number
  side: SideLetter
  kind: Kind
}

/** What the engine's line runs into, and how far off it is. */
export interface Foresight {
  /** The side that gets the good of it. */
  side: SideLetter
  /** Full moves from now, as a player would count them. */
  moves: 2 | 3 | 4
  event: { kind: 'capture'; victim: Kind } | { kind: 'check' } | { kind: 'palace' }
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
const COUNT: Record<2 | 3 | 4, string> = { 2: 'hai', 3: 'ba', 4: 'bốn' }

const TAKEABLE: Kind[] = ['r', 'c', 'h', 'e', 'a', 'p']
const SIDES: SideLetter[] = ['r', 'b']
const HORIZONS: (2 | 3 | 4)[] = [2, 3, 4]

/**
 * How deep to look.
 *
 * Eight plies is four moves each way. Past that the line is the engine's best
 * guess about a position neither player has thought about yet, and repeating it
 * as though it were a plan would be overselling what the number means.
 */
const HORIZON_PLIES = 8

/**
 * How early is too early to count as foresight.
 *
 * A capture on the very next ply is not a prediction, it is a threat — and
 * `facts.ts` already says that, better. This only speaks about things far
 * enough out that the player could not simply have looked.
 */
const MIN_PLY = 2

/** ICCS "h2e2": file letter a–i, then rank 0–9 counting up from Red's back rank. */
function square(text: string, at: number): { row: number; col: number } | null {
  const col = text.charCodeAt(at) - 97
  const rank = text.charCodeAt(at + 1) - 48
  if (col < 0 || col > 8 || rank < 0 || rank > 9) return null
  // Row 0 is Black's back rank in this app; ICCS rank 0 is Red's. Hence the flip.
  return { row: 9 - rank, col }
}

function other(side: SideLetter): SideLetter {
  return side === 'r' ? 'b' : 'r'
}

/** The enemy palace, with the file it opens onto. */
function inEnemyPalace(man: Man, row: number, col: number): boolean {
  if (col < 3 || col > 5) return false
  return man.side === 'r' ? row <= 2 : row >= 7
}

/** Whether a side's King is on a line that the given square attacks — cheaply. */
function facesKing(board: Man[], mover: Man, row: number, col: number): boolean {
  const king = board.find((m) => m.kind === 'k' && m.side !== mover.side)
  if (!king) return false
  // Deliberately crude: same file or rank with at most one piece between, which
  // is what a Chariot needs and roughly what a Cannon needs. Getting this exactly
  // right would mean re-implementing the rules, and this only decides whether a
  // remark is worth making, never what is legal.
  if (king.row !== row && king.col !== col) return false
  const between = board.filter((m) => {
    if (m === mover) return false
    if (king.row === row) {
      return m.row === row && (m.col - col) * (m.col - king.col) < 0
    }
    return m.col === col && (m.row - row) * (m.row - king.row) < 0
  }).length
  return mover.kind === 'c' ? between === 1 : between === 0
}

/**
 * Walks the engine's own line and reports the first thing worth mentioning.
 *
 * Ordered by what a listener would care about: losing a major piece beats a
 * check, beats somebody getting inside the palace. Only one is returned —
 * reading a whole variation at someone is not commentary, it is dictation.
 */
export function readAhead(
  pieces: readonly { row: number; col: number; side: string; kind: string }[],
  sideToMove: SideLetter,
  pv: readonly string[]
): Foresight | null {
  if (pv.length <= MIN_PLY) return null

  const board: Man[] = pieces.map((p) => ({
    row: p.row,
    col: p.col,
    side: p.side as SideLetter,
    kind: p.kind as Kind,
  }))

  let mover = sideToMove
  for (let ply = 0; ply < Math.min(pv.length, HORIZON_PLIES); ply++) {
    const iccs = pv[ply]
    if (typeof iccs !== 'string' || iccs.length < 4) break
    const from = square(iccs, 0)
    const to = square(iccs, 2)
    if (!from || !to) break

    const man = board.find((m) => m.row === from.row && m.col === from.col)
    // The line no longer matches the board. Say nothing rather than something
    // built on a position that drifted.
    if (!man || man.side !== mover) break

    const victimAt = board.findIndex((m) => m.row === to.row && m.col === to.col)
    const victim = victimAt >= 0 ? board[victimAt] : null
    const gives = facesKing(board, man, to.row, to.col)
    const breaksIn = inEnemyPalace(man, to.row, to.col)

    if (victim) board.splice(victimAt, 1)
    man.row = to.row
    man.col = to.col

    if (ply < MIN_PLY) {
      mover = other(mover)
      continue
    }

    // Counting the way a player does: two plies to a move, and the move now
    // being considered is the one after this one.
    const moves = Math.min(4, Math.max(2, Math.ceil((ply + 1) / 2))) as 2 | 3 | 4

    if (victim && victim.kind !== 'k') {
      return { side: mover, moves, event: { kind: 'capture', victim: victim.kind } }
    }
    if (gives) return { side: mover, moves, event: { kind: 'check' } }
    if (breaksIn) return { side: mover, moves, event: { kind: 'palace' } }

    mover = other(mover)
  }

  return null
}

/** Deterministic phrasing per combination — same reasoning as in `facts.ts`. */
function variant(pool: string[], key: string): string {
  return pool[parseInt(fingerprint(key), 36) % pool.length]
}

/**
 * `{s}` the side that benefits, `{o}` the other, `{n}` how many moves, `{v}`
 * what comes off the board.
 */
const CAPTURE_AHEAD = [
  'Lão phu nhìn xa hơn một chút. Cứ theo đà này thì chừng {n} nước nữa {s} sẽ lấy được {v} bên {o}, và chỗ ngã ngũ của ván cờ nằm ở đấy chứ không phải ở nước vừa rồi.',
  'Đáng chú ý là cái đuôi của thế cờ này. Nếu hai bên cứ đi như đang đi thì {n} nước nữa {v} bên {o} sẽ không giữ được, và bên {o} nên tính lại từ bây giờ.',
  'Chư vị để ý mà xem, cái bẫy chưa nằm ở đây. Khoảng {n} nước nữa mới tới lúc {s} thu {v} bên {o} về, và lúc ấy thì có muốn gỡ cũng đã muộn.',
  'Thế trận đang chạy về một chỗ. Chừng {n} nước nữa {s} ăn được {v} bên {o}, mà đường ấy thì đã mở sẵn từ mấy nước trước rồi.',
  'Nói trước một câu cho chư vị dễ theo dõi. Đi tiếp như thế này thì {n} nước nữa {v} bên {o} rơi vào tay {s}, và cán cân sẽ nghiêng hẳn từ đó.',
]

const CHECK_AHEAD = [
  'Nhìn xa hơn thì cái đáng sợ chưa tới. Chừng {n} nước nữa {s} có nước chiếu, và bên {o} sẽ phải bỏ dở tất cả những gì đang làm để lo gỡ.',
  'Đường dài còn ở phía trước. Nếu hai bên đi như thế này thì {n} nước nữa là {s} chiếu được Tướng {o}, mà mất một nhịp ở chỗ ấy là mất luôn thế trận.',
  'Lão phu thấy trước một nước chiếu. Còn chừng {n} nước nữa thôi, và bên {o} nên dọn nhà từ bây giờ chứ đừng đợi tới lúc đó.',
  'Cái hay của thế cờ này nằm ở mấy nước sau. Khoảng {n} nước nữa {s} sẽ có đòn chiếu, và bên {o} lúc ấy đang bận ở tận đầu bên kia bàn cờ.',
]

const PALACE_AHEAD = [
  'Đáng nói nhất là hướng đi của quân {s}. Chừng {n} nước nữa là nó đặt chân vào được cung bên {o}, và tới lúc ấy thì bên {o} không còn được thong thả nữa.',
  'Nhìn theo đường ấy mà xem. {n} nước nữa quân {s} vào tới cung {o}, mà cung cấm một khi đã có khách thì mọi tính toán đều phải làm lại.',
  'Thế cờ đang chảy về phía cung {o}. Khoảng {n} nước nữa {s} vào được tận nơi, và bên {o} nếu không chặn ngay từ giờ thì sau đó chặn cũng bằng thừa.',
  'Lão phu đoán trước một chuyện. Chừng {n} nước nữa quân {s} sẽ đứng ngay trong cung bên {o}, và ván cờ từ chỗ ấy trở đi là chuyện khác hẳn.',
]

function fill(template: string, f: Foresight, victim?: Kind): string {
  return template
    .replaceAll('{s}', SIDE[f.side])
    .replaceAll('{o}', SIDE[other(f.side)])
    .replaceAll('{n}', COUNT[f.moves])
    .replaceAll('{v}', victim ? PIECE[victim] : '')
}

function keyOf(f: Foresight): string {
  const what = f.event.kind === 'capture' ? `cap${f.event.victim}` : f.event.kind
  return `fore-${f.side}-${f.moves}-${what}`
}

function poolFor(f: Foresight): string[] {
  if (f.event.kind === 'capture') return CAPTURE_AHEAD
  return f.event.kind === 'check' ? CHECK_AHEAD : PALACE_AHEAD
}

function lineFor(f: Foresight): Line {
  const key = keyOf(f)
  const text = fill(variant(poolFor(f), key), f, f.event.kind === 'capture' ? f.event.victim : undefined)
  const cut = text.indexOf('. ')
  const speech =
    cut < 0
      ? `[trầm ngâm] ${text}`
      : `[trầm ngâm] ${text.slice(0, cut + 1)} [nhấn mạnh] ${text.slice(cut + 2)}`
  return { key, text, speech, id: lineId(key, speech) }
}

/** The remark for a reading, or null when there is nothing worth saying. */
export function foresightLine(f: Foresight | null): Line | null {
  return f ? lineFor(f) : null
}

/** Every foresight line, for pre-generating the audio. */
export function allForesightLines(): Line[] {
  const out: Line[] = []
  for (const side of SIDES) {
    for (const moves of HORIZONS) {
      for (const victim of TAKEABLE) {
        out.push(lineFor({ side, moves, event: { kind: 'capture', victim } }))
      }
      out.push(lineFor({ side, moves, event: { kind: 'check' } }))
      out.push(lineFor({ side, moves, event: { kind: 'palace' } }))
    }
  }
  return out
}
