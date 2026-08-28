/**
 * Giới thiệu — why this exists, and what it refuses to do.
 *
 * This page used to live inside the app, one card per topic, reached from the
 * launcher. Two things were wrong with that. It was a page you read once and
 * never again, taking up a permanent slot next to a chess board; and it was
 * written in cards, which is a shape for *scanning* — and none of this is
 * scannable. It is an argument, and an argument wants paragraphs.
 *
 * ## A note on the author's story
 *
 * Every sentence below is checkable against this repository — offline play, no
 * account, no tracking, an engine that gets no extra help. What it deliberately
 * does *not* contain is biography: where the author learned chess, who taught
 * them, what they do for a living. Those are facts about a real person, and
 * inventing them to make a nicer page would be a lie printed under their name.
 * They are the author's to write, and the text is right here to edit.
 */

import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import { Author } from './Author'
import { Banner } from '../components/Banner'
import { PieceIcon, PIECE_ORDER } from '../components/PieceIcon'
import { engineVersion, loadEngineWasm } from '../engine/wasm'
import { REPO, SIBLINGS, UMINI } from './copy'
import { Section, SectionHead } from './ui'
import { useMeta } from './useMeta'

export function AboutPage() {
  const [version, setVersion] = useState('…')

  useMeta(
    'Vì sao có ứng dụng này',
    'Một bàn cờ mở ra là chơi được, không hỏi bạn là ai: không tài khoản, không theo dõi, không máy chủ nào để tắt đi. Mã nguồn mở theo giấy phép MIT.'
  )

  useEffect(() => {
    void loadEngineWasm()
      .then(() => setVersion(engineVersion()))
      .catch(() => setVersion('—'))
  }, [])

  return (
    <>
      <div className="site-hero border-b border-border">
        <div className="site-wrap py-12 min-[700px]:py-16">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight min-[700px]:text-[2.4rem]">
            Vì sao có ứng dụng này
          </h1>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-dim">
            Một bàn cờ mở ra là chơi được, không hỏi bạn là ai.
          </p>

          {/* The full set, as a signature. */}
          <div className="mt-8 flex flex-wrap gap-1.5">
            {PIECE_ORDER.map((kind) => (
              <PieceIcon key={`r-${kind}`} kind={kind} side="r" size={32} />
            ))}
            {PIECE_ORDER.map((kind) => (
              <PieceIcon key={`b-${kind}`} kind={kind} side="b" size={32} />
            ))}
          </div>
        </div>
      </div>

      <Section>
        <div className="grid items-start gap-8 min-[880px]:grid-cols-[1fr_360px]">
          <div className="site-prose">
            <p>
              Cờ tướng là trò chơi của quán nước đầu ngõ, của cái bàn gỗ mòn lõm và đám người
              đứng xem nói to hơn cả người đang đánh. Nó không cần máy chủ, không cần tài khoản,
              không cần ai cho phép mới được chơi.
            </p>
            <p>
              Phần lớn ứng dụng cờ tướng bây giờ thì cần cả ba. Mở lên là đòi đăng nhập, mất
              mạng là ngồi nhìn, và cái máy thì đánh yếu nhưng lại hay được ưu ái — thêm quân,
              đổi luật, hoặc nhìn trộm nước của bạn.
            </p>
            <p>
              Ứng dụng này làm ngược lại: mở ra là chơi, không hỏi bạn là ai, và cái máy đánh
              đàng hoàng bằng đúng luật như bạn.
            </p>

            <h2>Cái máy không được ưu ái gì</h2>
            <p>
              Nó nhìn đúng bàn cờ bạn nhìn, đi đúng bộ luật bạn đi, và thắng bằng cách nghĩ
              nhanh hơn chứ không bằng cách được phép nhiều hơn. Ở mức siêu khó nó nghĩ khoảng
              năm giây mỗi nước và tính trước hàng chục nước; ở mức dễ nó đi hụt, đúng kiểu
              người mới, chứ không phải cố tình thả cho bạn thắng theo một kịch bản.
            </p>
            <p>
              Sau mỗi ván, nó ghi lại những nước đã dẫn nó tới chỗ thua và lần sau tránh đi.
              Cuốn sổ ấy nằm trong máy bạn — nó không tải về gì và không gửi đi đâu.
            </p>

            <h2>Dữ liệu của bạn ở lại máy bạn</h2>
            <p>
              Không tài khoản, không đăng nhập, không đo đếm, không gửi thống kê đi đâu cả. Ván
              cờ, lịch sử và cài đặt nằm trong máy bạn. Chỉ khi bạn tự bấm chia sẻ thì mới có
              một ván rời khỏi máy, dưới dạng một tệp bạn cầm trong tay.
            </p>
            <p>
              Không có máy chủ nào đứng sau, nên cũng không có máy chủ nào để tắt đi. Bản đã tải
              về vẫn chơi được sau nhiều năm, kể cả khi trang này biến mất.
            </p>

            <h2>Ai đứng sau</h2>
            <p>
              Ứng dụng này được phát hành trên{' '}
              <a href={UMINI.home} target="_blank" rel="noopener noreferrer">
                Umini
              </a>{' '}
              — không phải một công ty, chỉ là chỗ để chung mấy cái app nhỏ do một người làm,
              cái nào cũng sinh ra từ một việc có thật phải làm đi làm lại mỗi ngày. Bàn cờ này
              sinh ra vì muốn đánh một ván mà không phải ngồi xem quảng cáo.
            </p>
            <p>
              Chuyện đầy đủ nằm ở{' '}
              <a href={UMINI.story} target="_blank" rel="noopener noreferrer">
                Chuyện đằng sau
              </a>
              , và người ngồi làm thì ở{' '}
              <a href={UMINI.author} target="_blank" rel="noopener noreferrer">
                trang tác giả
              </a>
              .
            </p>

            <h2>Mã nguồn mở</h2>
            <p>
              Toàn bộ mã nguồn công khai theo giấy phép MIT. Câu "máy không nhìn trộm" ở trên là
              một câu có thể kiểm chứng chứ không phải một lời hứa: luật cờ và engine nằm trong{' '}
              <a href={REPO} target="_blank" rel="noopener noreferrer">
                kho mã nguồn
              </a>
              , và bộ luật ấy được kiểm bằng phép đếm đầy đủ tới độ sâu năm — 133.312.995 thế cờ,
              khớp chính xác.
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <Banner
              src="/banner/vi-sao.webp"
              alt="Bàn cờ nghìn năm tuổi, đối thủ của ngày mai"
              ratio="16 / 9"
              maxWidth="max-w-full"
            />
            <Banner
              src="/banner/binh-luan-vien.webp"
              alt="Có người ngồi cạnh, bình từng nước cho bạn nghe"
              ratio="4 / 3"
              maxWidth="max-w-full"
            />
          </div>
        </div>
      </Section>

      <Section tint>
        <SectionHead
          title="Cùng nhà"
          lead="Ba cái còn lại trên Umini, làm theo đúng bốn điều ở trên: tiếng Việt, chạy được khi mất sóng, không quảng cáo, không tính tiền."
          link={{ to: '/', label: 'Về trang chủ' }}
        />
        <div className="grid gap-3 min-[620px]:grid-cols-3">
          {SIBLINGS.map((app) => (
            <a
              key={app.name}
              href={app.to}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col rounded-2xl border border-border bg-bg p-4 no-underline transition-colors hover:bg-surface-2"
            >
              <span className="flex items-start gap-1.5 text-[0.98rem] leading-snug font-semibold text-ink">
                {app.name}
                <ArrowUpRight
                  size={15}
                  className="mt-0.5 shrink-0 text-ink-dim transition-colors group-hover:text-ink"
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-dim">
                {app.blurb}
              </span>
            </a>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead title="Bản đang chạy" />
        <dl className="grid gap-0 border-t border-border">
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3">
            <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">Engine</dt>
            <dd className="min-w-0 flex-1 text-[0.95rem]">{version}</dd>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3">
            <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">Giấy phép</dt>
            <dd className="min-w-0 flex-1 text-[0.95rem]">
              <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
                MIT
              </a>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3">
            <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">Làm bởi</dt>
            <dd className="min-w-0 flex-1 text-[0.95rem]">
              <Author className="px-0" />
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3">
            <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">Phát hành trên</dt>
            <dd className="min-w-0 flex-1 text-[0.95rem]">
              <a href={UMINI.listing} target="_blank" rel="noopener noreferrer">
                umini.app
              </a>
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-ink-dim">
          Chi tiết bản dựng và nút kiểm tra cập nhật nằm trong{' '}
          <Link to="/settings">Cài đặt</Link>.
        </p>
      </Section>
    </>
  )
}
