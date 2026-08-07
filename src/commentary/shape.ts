/**
 * Naming the shape on the board, not just the piece that moved.
 *
 * Everything in `facts.ts` is about one piece: it advanced, it took something,
 * it is aiming at something. That is accurate and it is also how a beginner
 * talks. What a strong player says instead is *"Đỏ pháo đầu, Đen bình phong mã"*
 * — four words that describe eleven pieces at once, and that tell you what the
 * next ten moves are going to be about.
 *
 * So this reads the whole army rather than the last move: which cannons went
 * where, whether the horses came out as a screen, whether the two Chariots have
 * both crossed, what material is left when the board thins out. Each is a
 * standing description of the position, so it can be said at any point rather
 * than only in the instant it is completed.
 *
 * ## Everything here is checkable
 *
 * A name is a claim, and a wrong name is worse than no name — a commentator who
 * says "bình phong mã" at a position that is not one teaches the listener
 * something false. So every shape below is a condition on where pieces actually
 * stand, written so a reader can check it against the board, and nothing fires
 * on a maybe. Where two shapes overlap the more specific one wins.
 *
 * Vietnamese naming follows the standard vocabulary (pháo đầu, bình phong mã,
 * phản công mã, thuận/nghịch pháo, sĩ giác pháo, quá cung pháo, uyên ương pháo,
 * tiên nhân chỉ lộ, pháo tuần hà, song xe quá hà) and the usual endgame material
 * names (Xe Tốt, Mã Pháo, Xe Pháo Tốt…).
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

export type ShapeName =
  /** Cannon on the central file, aimed down the middle. The classic attack. */
  | 'centralCannon'
  /** Both horses out to the screen squares, guarding the central pawn. */
  | 'screenHorses'
  /** Screen horses *plus* one's own central cannon — the counter-attacking set-up. */
  | 'counterHorses'
  /** Cannon parked at the advisor's corner. Solid, patient. */
  | 'cornerCannon'
  /** Cannon walked across the palace to the far side. */
  | 'palaceCannon'
  /** The two cannons sitting side by side, working as a pair. */
  | 'mandarinCannons'
  /** Two cannons stacked on one file, the back one loading the front. */
  | 'stackedCannons'
  /** A cannon along the river, blocking the crossing. */
  | 'riverCannon'
  /** Chariot and cannon on one file, aimed at the palace. */
  | 'battery'
  /** Both Chariots over the river. */
  | 'bothRooksOver'
  /** A pawn pushed before anything else has developed. */
  | 'pawnFirst'
  /** The palace has lost its guards. */
  | 'barePalace'

/** What both sides are doing, when the pairing itself has a name. */
export type MatchupName = 'sameCannon' | 'crossCannon' | 'cannonVsScreen' | 'cannonVsCounter'

/** Which pieces are left when the board has thinned out. */
export type EndgameName = 'rookPawn' | 'horseCannon' | 'rookCannonPawn' | 'horsePawn' | 'cannonPawn' | 'lone'

const SIDE: Record<SideLetter, string> = { r: 'Đỏ', b: 'Đen' }

const SIDES: SideLetter[] = ['r', 'b']
const SHAPES: ShapeName[] = [
  'centralCannon',
  'screenHorses',
  'counterHorses',
  'cornerCannon',
  'palaceCannon',
  'mandarinCannons',
  'stackedCannons',
  'riverCannon',
  'battery',
  'bothRooksOver',
  'pawnFirst',
  'barePalace',
]
const MATCHUPS: MatchupName[] = ['sameCannon', 'crossCannon', 'cannonVsScreen', 'cannonVsCounter']
const ENDGAMES: EndgameName[] = ['rookPawn', 'horseCannon', 'rookCannonPawn', 'horsePawn', 'cannonPawn', 'lone']

/** Row 0 is Black's back rank, row 9 is Red's. Every geometry test below reads from that. */
function homeRow(side: SideLetter): number {
  return side === 'r' ? 9 : 0
}

/** Where the cannons and the developed horses live: one rank in from home. */
function secondRow(side: SideLetter): number {
  return side === 'r' ? 7 : 2
}

/** The rank on one's own bank of the river. */
function riverRow(side: SideLetter): number {
  return side === 'r' ? 5 : 4
}

function acrossRiver(m: Man): boolean {
  return m.side === 'r' ? m.row <= 4 : m.row >= 5
}

function of(men: Man[], side: SideLetter, kind: Kind): Man[] {
  return men.filter((m) => m.side === side && m.kind === kind)
}

/**
 * The most telling thing this side is doing, or null.
 *
 * Ordered most specific first. A position can satisfy several of these at once —
 * a central cannon *and* screen horses *and* both Chariots across — and reading
 * out all three would be a list, not a remark. The one at the top of this order
 * is the one that most narrows down what kind of game it is.
 */
export function readShape(
  pieces: readonly { row: number; col: number; side: string; kind: string }[],
  side: SideLetter,
  moveCount: number
): ShapeName | null {
  const men: Man[] = pieces.map((p) => ({
    row: p.row,
    col: p.col,
    side: p.side as SideLetter,
    kind: p.kind as Kind,
  }))

  const cannons = of(men, side, 'c')
  const horses = of(men, side, 'h')
  const rooks = of(men, side, 'r')
  const guards = of(men, side, 'a').length + of(men, side, 'e').length

  // Both Chariots over the river beats everything: it is the most committal
  // thing either side can do and there is no ambiguity about it.
  if (rooks.length === 2 && rooks.every(acrossRiver)) return 'bothRooksOver'

  // A Chariot and a Cannon lined up on one file pointed at the palace.
  const battery = rooks.some((r) =>
    cannons.some(
      (c) => c.col === r.col && c.col >= 3 && c.col <= 5 && (acrossRiver(r) || acrossRiver(c))
    )
  )
  if (battery) return 'battery'

  if (cannons.length === 2 && cannons[0].col === cannons[1].col) return 'stackedCannons'

  const central = cannons.filter((c) => c.col === 4)
  const screen =
    horses.length === 2 &&
    horses.every((h) => h.row === secondRow(side)) &&
    horses.some((h) => h.col === 2) &&
    horses.some((h) => h.col === 6)

  if (screen && central.length > 0) return 'counterHorses'
  if (screen) return 'screenHorses'
  if (central.some((c) => c.row === secondRow(side))) return 'centralCannon'
  if (central.some((c) => c.row === homeRow(side))) return 'palaceCannon'

  if (cannons.some((c) => c.row === riverRow(side) && !acrossRiver(c))) return 'riverCannon'
  if (cannons.some((c) => c.row === homeRow(side) && (c.col === 3 || c.col === 5)))
    return 'cornerCannon'
  if (
    cannons.length === 2 &&
    cannons.every((c) => c.row === secondRow(side)) &&
    Math.abs(cannons[0].col - cannons[1].col) === 1
  )
    return 'mandarinCannons'

  // A palace down to one guard or none. Ranked below the attacking shapes
  // because when a side has *both* an attack and a stripped palace, the attack
  // is the more useful thing to say.
  if (guards <= 1) return 'barePalace'

  // Only worth calling in the first few moves, when it *is* the plan rather
  // than an incidental pawn push.
  if (moveCount <= 4 && of(men, side, 'p').some((p) => p.row !== (side === 'r' ? 6 : 3))) {
    return 'pawnFirst'
  }

  return null
}

/**
 * When the pairing has a name of its own.
 *
 * Whether two central cannons are thuận or nghịch depends on which wing each one
 * came from, which is not in the position — but it is recoverable: the cannon
 * that stayed home tells you which one left. Red's cannons start on files 1 and
 * 7, and so do Black's, and because the two players count files from opposite
 * sides, "same direction" means the two came from mirrored columns.
 */
export function readMatchup(
  pieces: readonly { row: number; col: number; side: string; kind: string }[]
): MatchupName | null {
  const men: Man[] = pieces.map((p) => ({
    row: p.row,
    col: p.col,
    side: p.side as SideLetter,
    kind: p.kind as Kind,
  }))

  const redCentral = of(men, 'r', 'c').some((c) => c.col === 4 && c.row === 7)
  const blackCentral = of(men, 'b', 'c').some((c) => c.col === 4 && c.row === 2)

  if (redCentral && blackCentral) {
    const redHome = of(men, 'r', 'c').find((c) => c.row === 7 && (c.col === 1 || c.col === 7))
    const blackHome = of(men, 'b', 'c').find((c) => c.row === 2 && (c.col === 1 || c.col === 7))
    if (!redHome || !blackHome) return 'sameCannon'
    // Mirrored home columns means both cannons came from the same file *by each
    // player's own numbering*, which is what "thuận" means.
    return redHome.col !== blackHome.col ? 'sameCannon' : 'crossCannon'
  }

  const screen = (side: SideLetter) => {
    const horses = of(men, side, 'h')
    return (
      horses.length === 2 &&
      horses.every((h) => h.row === secondRow(side)) &&
      horses.some((h) => h.col === 2) &&
      horses.some((h) => h.col === 6)
    )
  }

  if (redCentral && screen('b')) {
    return of(men, 'b', 'c').some((c) => c.col === 4) ? 'cannonVsCounter' : 'cannonVsScreen'
  }
  if (blackCentral && screen('r')) {
    return of(men, 'r', 'c').some((c) => c.col === 4) ? 'cannonVsCounter' : 'cannonVsScreen'
  }
  return null
}

/** Below this many pieces the material combination is worth naming outright. */
const THIN_BOARD = 12

/**
 * What a side has left, when that alone is the story.
 *
 * Endgames are studied and taught by exactly this: not by the position but by
 * the pieces. "Xe Tốt" or "Mã Pháo" tells a player which book chapter they are
 * in, which is more useful than any description of the squares.
 */
export function readEndgame(
  pieces: readonly { row: number; col: number; side: string; kind: string }[],
  side: SideLetter
): EndgameName | null {
  if (pieces.length > THIN_BOARD) return null
  const mine = pieces.filter((p) => p.side === side && p.kind !== 'k' && p.kind !== 'a' && p.kind !== 'e')
  const has = (k: string) => mine.some((p) => p.kind === k)
  const kinds = new Set(mine.map((p) => p.kind))

  if (mine.length === 0) return 'lone'
  if (kinds.size === 3 && has('r') && has('c') && has('p')) return 'rookCannonPawn'
  if (kinds.size === 2 && has('r') && has('p')) return 'rookPawn'
  if (kinds.size === 2 && has('h') && has('c')) return 'horseCannon'
  if (kinds.size === 2 && has('h') && has('p')) return 'horsePawn'
  if (kinds.size === 2 && has('c') && has('p')) return 'cannonPawn'
  return null
}

/* -- what each one means, said out loud ------------------------------------ */

/** `{s}` is the side, `{o}` the other. */
const SHAPE_TEXT: Record<ShapeName, string[]> = {
  centralCannon: [
    'Bên {s} đang giữ thế pháo đầu. Khẩu pháo ngắm thẳng trung lộ vào cung {o}, và cả ván cờ từ giờ sẽ xoay quanh chuyện bên {o} có bịt nổi con đường ấy hay không.',
    '{s} chơi pháo đầu, thế mở màn hung hãn nhất trong cờ tướng. Nó ép đối phương phải trả lời theo ý mình chứ không cho người ta thong thả bày binh.',
  ],
  screenHorses: [
    'Bên {s} lên bình phong mã. Hai con mã đứng che trước tốt đầu, mã giữ tốt, pháo giữ mã — một thế thủ rất chắc, và chắc là để chờ phản công chứ không phải để chịu trận.',
    '{s} dàn bình phong mã, thế phòng ngự kinh điển nhất để chống pháo đầu. Nó không đẹp mắt nhưng nó bền, và bên {o} sẽ phải tìm cách phá cho bằng được.',
  ],
  counterHorses: [
    'Bên {s} đi phản công mã: hai mã vẫn ra như bình phong, nhưng thêm khẩu pháo giữa. Thế này linh hoạt hơn, thủ vẫn kín mà lúc nào cũng sẵn một đòn trả.',
    '{s} chọn phản công mã. Nhìn thì giống bình phong mã, chỉ khác cái pháo ở giữa — mà chính cái khác ấy biến thế thủ thành thế chờ đánh.',
  ],
  cornerCannon: [
    'Bên {s} đặt sĩ giác pháo. Khẩu pháo nép vào góc sĩ, không doạ ai ngay nhưng đứng rất vững, và đây là lối chơi của người tính đường dài.',
    '{s} chơi sĩ giác pháo, một thế trầm. Người đi nước này không định phân thắng bại sớm, họ định đánh lâu và thắng bằng thế.',
  ],
  palaceCannon: [
    'Bên {s} đưa quá cung pháo, dắt khẩu pháo băng qua cung sang cánh kia. Nước này bày trận rộng, chuẩn bị cho một hướng tấn công mà đối phương chưa nhìn ra.',
    '{s} đi quá cung pháo. Chậm hơn pháo đầu một nhịp, nhưng đổi lại là thế trận cân đối và ít lộ ý đồ hơn hẳn.',
  ],
  mandarinCannons: [
    'Hai khẩu pháo bên {s} đứng sát nhau kiểu uyên ương pháo. Chúng che chở cho nhau, và ai định đổi một khẩu thì phải tính cả khẩu còn lại.',
    'Bên {s} dựng uyên ương pháo, hai khẩu kề vai. Thế này rất khó chịu để đối phó, vì đụng vào con nào cũng vướng con kia.',
  ],
  stackedCannons: [
    'Bên {s} chồng trùng pháo trên một đường. Khẩu sau làm ngòi cho khẩu trước, và đây là một trong những thế sát mạnh nhất trên bàn cờ.',
    'Trùng pháo bên {s}! Hai khẩu nối đuôi nhau, nổ được một phát là phát sau đã lên nòng. Bên {o} phải phá cái ngòi ấy cho bằng được.',
  ],
  riverCannon: [
    'Bên {s} để pháo tuần hà, nằm vắt ngang bờ sông. Nó chẳng doạ ai ngay, nhưng bên {o} muốn qua sông là phải nghĩ hai lần.',
    'Pháo tuần hà bên {s}. Đây là lối chơi của người kiên nhẫn: không ăn ai cả, chỉ đứng đó bó chân đối phương.',
  ],
  battery: [
    'Xe với pháo bên {s} đã lên cùng một lộ, nhắm thẳng vào cung {o}. Xe pháo phối hợp là bộ đôi đáng sợ nhất trong cờ tướng, vì chúng bổ khuyết cho nhau đúng chỗ mỗi con còn yếu.',
    'Bên {s} dựng được thế xe pháo cùng đường. Từ đây mọi nước của bên {o} đều phải tính tới cái lộ ấy, và tính tới nó thì mất tự do ở chỗ khác.',
  ],
  bothRooksOver: [
    'Song xe bên {s} đã cùng quá hà. Cờ tướng có câu một xe địch mười quân, giờ có hai — bên {o} không thể giữ nổi khắp mọi hướng.',
    'Cả hai cỗ xe bên {s} đều sang sông. Đến đây thì bên {o} hết đường thủ suông, bịt được đường này thì đường kia mở.',
  ],
  pawnFirst: [
    'Bên {s} mở màn bằng tiên nhân chỉ lộ, đẩy tốt trước khi động tới quân lớn. Nước này không nói gì cả, và chính vì không nói gì nên đối phương chẳng biết đằng nào mà lần.',
    '{s} chơi tiên nhân chỉ lộ. Một nước tốt thăm dò, để dành mọi lựa chọn lại cho mấy nước sau — kiểu chơi của người không muốn lộ bài sớm.',
  ],
  barePalace: [
    'Cung bên {s} đã thiếu sĩ tượng. Cổ nhân bảo mất sĩ thì hở sườn, mất tượng thì hở mặt — bên {o} chỉ cần đưa được pháo vào là có chuyện ngay.',
    'Bên {s} đã trống lớp sĩ tượng quanh cung. Từ đây một khẩu pháo cũng đủ làm nên chuyện, mà bên {o} thì còn cả bộ quân.',
  ],
}

const MATCHUP_TEXT: Record<MatchupName, string[]> = {
  sameCannon: [
    'Hai bên cùng lên thuận pháo, pháo đối pháo cùng chiều. Thế này đổi quân rất nhanh và ai đi sau mà bám kịp nhịp thì lại là người có lợi.',
  ],
  crossCannon: [
    'Nghịch pháo — hai khẩu pháo đầu quay ngược hướng nhau. Đây là thế cờ dễ nổ nhất, hai bên thường lao vào đổi quân sớm và ván cờ hiếm khi hoà.',
  ],
  cannonVsScreen: [
    'Pháo đầu đối bình phong mã: thế trận kinh điển nhất của cờ tướng, đã đánh cả mấy trăm năm nay mà vẫn chưa ai kết luận được bên nào hơn. Một bên ép trung lộ, một bên chờ sơ hở mà phản.',
  ],
  cannonVsCounter: [
    'Pháo đầu gặp phản công mã. Bên thủ không định thủ suông, họ chừa sẵn khẩu pháo giữa để trả đòn — nên đây là thế cân bằng động chứ không phải một bên tấn một bên chống.',
  ],
}

const ENDGAME_TEXT: Record<EndgameName, string[]> = {
  rookPawn: [
    'Bên {s} còn Xe và Tốt. Cờ tàn Xe Tốt là dạng cơ bản nhất mà cũng nhiều bẫy nhất — con tốt qua sông có xe hộ tống thì đáng giá bằng cả một cỗ quân.',
  ],
  horseCannon: [
    'Bên {s} còn Mã và Pháo. Cặp này phối hợp rất hay ở cờ tàn: pháo cần ngòi thì mã làm ngòi, mã cần đường thì pháo dọn đường.',
  ],
  rookCannonPawn: [
    'Bên {s} còn Xe, Pháo và Tốt — bộ ba đủ để dứt điểm. Cờ tàn Xe Pháo Tốt mà đánh đúng kỹ thuật thì bên kia rất khó giữ.',
  ],
  horsePawn: [
    'Bên {s} còn Mã và Tốt. Cờ tàn Mã Tốt thắng được, nhưng phải chính xác từng nước, và con mã thì sợ nhất là bị chặn chân.',
  ],
  cannonPawn: [
    'Bên {s} còn Pháo và Tốt. Pháo không có ngòi thì chỉ là khối gỗ, nên cả thế cờ này xoay quanh chuyện tìm cho khẩu pháo một chỗ tựa.',
  ],
  lone: [
    'Bên {s} chỉ còn Tướng với lớp sĩ tượng, không còn quân nào tấn công được. Đến đây thì không còn là đánh nữa, chỉ là giữ cho khỏi thua.',
  ],
}

function variant(pool: string[], key: string): string {
  return pool[parseInt(fingerprint(key), 36) % pool.length]
}

function make(key: string, text: string, open: string, turn: string): Line {
  const cut = text.indexOf('. ')
  const speech =
    cut < 0 ? `${open} ${text}` : `${open} ${text.slice(0, cut + 1)} ${turn} ${text.slice(cut + 2)}`
  return { key, text, speech, id: lineId(key, speech) }
}

function fill(template: string, side: SideLetter): string {
  return template
    .replaceAll('{s}', SIDE[side])
    .replaceAll('{o}', SIDE[side === 'r' ? 'b' : 'r'])
}

export function shapeLine(side: SideLetter, name: ShapeName): Line {
  const key = `shp-${side}-${name}`
  return make(key, fill(variant(SHAPE_TEXT[name], key), side), '[dõng dạc]', '[nhấn mạnh]')
}

export function matchupLine(name: MatchupName): Line {
  const key = `mup-${name}`
  return make(key, MATCHUP_TEXT[name][0], '[trang trọng]', '[trầm ngâm]')
}

export function endgameLine(side: SideLetter, name: EndgameName): Line {
  const key = `egm-${side}-${name}`
  return make(key, fill(variant(ENDGAME_TEXT[name], key), side), '[chậm rãi]', '[nhấn mạnh]')
}

/** Every formation line, for pre-generating the audio. */
export function allShapeLines(): Line[] {
  const out: Line[] = []
  for (const side of SIDES) {
    for (const name of SHAPES) out.push(shapeLine(side, name))
    for (const name of ENDGAMES) out.push(endgameLine(side, name))
  }
  for (const name of MATCHUPS) out.push(matchupLine(name))
  return out
}
