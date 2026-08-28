/**
 * Hướng dẫn — the page someone opens when the board is already in front of them
 * and a piece will not go where they told it to.
 *
 * ## Two audiences, and the order they are served in
 *
 * Someone who has never played needs the pieces explained. Someone who has
 * played at the quán nước for thirty years needs none of that and is here for
 * exactly one thing: which of the several regional readings of the repetition
 * rule this app enforces. So the app's own controls come first, the pieces
 * second, and the rules that differ between houses last and in full — because
 * that last section is the only one on this page that could lose somebody a
 * game they thought they had drawn.
 *
 * The piece table is a table because it is a lookup, not a read. Nobody works
 * through it top to bottom; they scan for the one glyph that just refused to
 * move.
 */

import { Link } from 'react-router'

import { PieceIcon, PIECE_ORDER } from '../components/PieceIcon'
import { Section, SectionHead } from './ui'
import { useMeta } from './useMeta'

/** How each piece moves, in the words a person at a board would use. */
const PIECES: { kind: (typeof PIECE_ORDER)[number]; name: string; how: string }[] = [
  {
    kind: 'k',
    name: 'Tướng · Soái',
    how: 'Đi từng ô một, ngang hoặc dọc, và không được ra khỏi cung — cái ô vuông chín điểm có gạch chéo. Hai Tướng không được nhìn thẳng mặt nhau qua một cột trống.',
  },
  {
    kind: 'a',
    name: 'Sĩ',
    how: 'Đi chéo một ô, cũng chỉ quanh quẩn trong cung. Hai con, và chúng chỉ để che cho Tướng.',
  },
  {
    kind: 'e',
    name: 'Tượng · Tịnh',
    how: 'Đi chéo đúng hai ô, không bao giờ qua sông. Nếu điểm chéo giữa đường có quân đứng thì bị cản — gọi là "chân tượng".',
  },
  {
    kind: 'h',
    name: 'Mã',
    how: 'Đi một ô thẳng rồi một ô chéo. Nếu ô thẳng đầu tiên ấy có quân đứng thì Mã bị cản, không nhảy qua được — đây là chỗ người mới hay tưởng máy sai.',
  },
  {
    kind: 'r',
    name: 'Xe',
    how: 'Đi thẳng bao xa cũng được, ngang hoặc dọc, miễn là đường trống. Quân mạnh nhất trên bàn.',
  },
  {
    kind: 'c',
    name: 'Pháo',
    how: 'Đi như Xe khi không ăn quân. Nhưng muốn ăn thì phải có đúng một quân nằm chắn giữa — quân ấy gọi là ngòi, và ngòi là của bên nào cũng được.',
  },
  {
    kind: 'p',
    name: 'Tốt · Binh',
    how: 'Chưa qua sông thì chỉ tiến từng ô. Qua sông rồi thì tiến hoặc đi ngang, nhưng không bao giờ lùi.',
  },
]

/** What ends a game, and how. */
const ENDINGS: { title: string; body: string }[] = [
  {
    title: 'Chiếu bí — thắng',
    body: 'Tướng đối phương đang bị doạ ăn, và họ không còn nước nào gỡ được. Đây là cách thắng thường gặp nhất.',
  },
  {
    title: 'Hết nước đi — cũng thua',
    body: 'Đến lượt mà không còn nước hợp lệ nào để đi thì bên ấy thua. Khác cờ vua: ở cờ vua đó là hoà.',
  },
  {
    title: 'Chiếu đuổi liên hoàn — bên ép thua',
    body: 'Chiếu mãi một thế, hoặc đuổi mãi một quân, để bắt đối phương phải lặp lại. Lặp tới lần thứ năm thì bên ép liên tục bị xử thua, không phải hoà.',
  },
  {
    title: 'Sáu mươi nước không ai ăn quân — hoà',
    body: 'Hai bên đi qua đi lại mà không quân nào rời bàn cờ thì ván được xử hoà.',
  },
  {
    title: 'Không đủ quân để chiếu bí — hoà',
    body: 'Khi cả hai bên đều không còn đủ lực để kết thúc ván, tiếp tục cũng không đi tới đâu.',
  },
]

export function GuidePage() {
  useMeta(
    'Hướng dẫn',
    'Cách dùng ứng dụng, cách đi từng quân cờ tướng, luật kết thúc ván, và cách đọc biên bản tiếng Việt.'
  )

  return (
    <>
      <div className="site-hero border-b border-border">
        <div className="site-wrap py-12 min-[700px]:py-16">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight min-[700px]:text-[2.4rem]">
            Hướng dẫn
          </h1>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-dim">
            Cách dùng ứng dụng, cách đi từng quân, và những luật mà mỗi nơi hiểu một khác.
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------- the app itself */}
      <Section>
        <SectionHead
          title="Ba thứ đáng biết trước"
          lead="Còn lại thì cứ mở bàn cờ ra là hiểu."
        />
        <div className="grid gap-3 min-[700px]:grid-cols-3">
          {[
            {
              t: 'Chạm quân, rồi chạm ô',
              b: 'Chạm một quân của mình thì mọi ô nó đi được sẽ sáng lên. Chạm lại chính nó để bỏ chọn.',
            },
            {
              t: 'Mọi thứ khác nằm trong nút menu',
              b: 'Ván mới, đi lại, gợi ý, lật bàn, tắt tiếng, xem biên bản và quân đã ăn — tất cả ở một chỗ, cạnh bàn cờ.',
            },
            {
              t: 'Không phải bấm lưu',
              b: 'Đóng ứng dụng giữa ván rồi mở lại vẫn đúng thế cờ đó. Ván xong thì tự vào Lịch sử.',
            },
          ].map((item) => (
            <div key={item.t} className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-[0.98rem] leading-snug font-semibold">{item.t}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-dim">{item.b}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------- pieces */}
      <Section tint id="quan-co">
        <SectionHead
          title="Bảy loại quân"
          lead="Mỗi bên mười sáu quân. Đỏ đi trước."
        />
        <div className="flex flex-col gap-3">
          {PIECES.map((piece) => (
            <div
              key={piece.kind}
              className="flex items-start gap-4 rounded-2xl border border-border bg-bg p-4"
            >
              <span className="flex shrink-0 gap-1.5 pt-0.5">
                <PieceIcon kind={piece.kind} side="r" size={38} />
                <PieceIcon kind={piece.kind} side="b" size={38} />
              </span>
              <div className="min-w-0">
                <h3 className="text-[1rem] font-semibold">{piece.name}</h3>
                <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-dim">{piece.how}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- ending */}
      <Section id="luat">
        <SectionHead
          title="Ván kết thúc thế nào"
          lead="Ứng dụng dùng đủ bộ luật, không cắt bớt cho dễ làm — kể cả những điều mà nhiều ứng dụng khác bỏ qua."
        />
        <div className="grid gap-x-8 gap-y-6 min-[700px]:grid-cols-2">
          {ENDINGS.map((rule) => (
            <div key={rule.title}>
              <h3 className="text-[1rem] font-semibold">{rule.title}</h3>
              <p className="mt-1 text-[0.92rem] leading-relaxed text-ink-dim">{rule.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-[62ch] text-[0.92rem] leading-relaxed text-ink-dim">
          Luật chiếu đuổi có nhiều cách hiểu tuỳ nơi. Nếu bạn quen một cách khác, đổi được
          trong <Link to="/settings">Cài đặt</Link>.
        </p>
      </Section>

      {/* ------------------------------------------------------------- reading */}
      <Section tint>
        <SectionHead
          title="Đọc biên bản"
          lead='Ứng dụng ghi nước đi bằng tiếng Việt, đúng như cách người ta xướng ở quán cờ.'
        />
        <div className="site-prose text-[0.95rem]">
          <p>
            Mỗi nước gồm ba phần: <strong>tên quân</strong>, <strong>cột nó đang đứng</strong>,
            và <strong>nó làm gì</strong>. Cột được đếm từ phía mình nhìn ra, từ phải sang trái.
          </p>
          <ul>
            <li>
              <strong>Pháo 2 bình 5</strong> — con Pháo ở cột 2 đi ngang sang cột 5.
            </li>
            <li>
              <strong>Mã 8 tiến 7</strong> — con Mã ở cột 8 tiến lên, đến cột 7.
            </li>
            <li>
              <strong>Xe 9 thoái 1</strong> — con Xe ở cột 9 lùi xuống một ô.
            </li>
          </ul>
          <p>
            <em>Bình</em> là đi ngang, <em>tiến</em> là đi lên, <em>thoái</em> là lùi xuống. Khi
            xem lại một ván, biên bản chạy bên cạnh bàn cờ và bấm vào dòng nào thì bàn cờ nhảy
            tới đúng nước đó.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------- closing */}
      <Section>
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-ink-dim">Đọc đủ rồi thì mở bàn cờ ra.</p>
          <Link
            to="/play"
            className="ml-auto inline-flex h-12 items-center gap-2 rounded-2xl bg-accent px-6 font-semibold text-white no-underline transition-[filter] hover:brightness-110"
          >
            Chơi ngay
          </Link>
        </div>
      </Section>
    </>
  )
}
