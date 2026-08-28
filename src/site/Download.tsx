/**
 * Cài về máy.
 *
 * ## Why the browser is listed first, and not as a consolation
 *
 * Because it is the honest answer: the web build is the whole game, engine and
 * all, and on a phone "cài đặt" means adding it to the home screen from that
 * same page. Sites that bury "just open it" under three installer buttons are
 * describing a demo; this is not one.
 *
 * ## Why the install steps are spelt out per platform
 *
 * A progressive web app has no install button of its own on iOS, and the one
 * Android and desktop Chrome offer appears somewhere different in each. "Thêm
 * vào màn hình chính" is three taps that nobody finds by accident, and an app
 * that is only ever run in a browser tab loses its own icon, its full screen,
 * and — the part that actually matters here — the reliable offline start.
 *
 * ## What is deliberately not promised
 *
 * No file sizes, no "available on the App Store", no download counter. The
 * desktop builds come from a GitHub release whose contents change with each
 * version, so the page links to the release and lets it speak for itself rather
 * than naming a `.dmg` that may not be there.
 */

import { Apple, Download, Globe, Play, Smartphone } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '../components/ui/button'
import { RELEASES_URL, REPO } from './copy'
import { Section, SectionHead } from './ui'
import { useMeta } from './useMeta'

/** Adding to the home screen, per place it is different. */
const INSTALL: { title: string; icon: typeof Apple; steps: string[] }[] = [
  {
    title: 'iPhone và iPad',
    icon: Apple,
    steps: [
      'Mở trang này bằng Safari — các trình duyệt khác trên iPhone không cài được.',
      'Bấm nút Chia sẻ ở thanh dưới.',
      'Kéo xuống, chọn "Thêm vào MH chính".',
    ],
  },
  {
    title: 'Android',
    icon: Smartphone,
    steps: [
      'Mở trang này bằng Chrome.',
      'Bấm dấu ba chấm ở góc trên bên phải.',
      'Chọn "Cài đặt ứng dụng" hoặc "Thêm vào màn hình chính".',
    ],
  },
  {
    title: 'Máy tính',
    icon: Globe,
    steps: [
      'Mở bằng Chrome hoặc Edge.',
      'Bấm biểu tượng cài đặt ở cuối thanh địa chỉ.',
      'Hoặc tải bản cài riêng ở dưới — mở nhanh hơn và không cần trình duyệt.',
    ],
  },
]

export function DownloadPage() {
  useMeta(
    'Cài về máy',
    'Chơi thẳng trên trình duyệt, thêm vào màn hình chính trên iPhone và Android, hoặc tải bản cài cho macOS, Windows và Linux.'
  )

  return (
    <>
      <div className="site-hero border-b border-border">
        <div className="site-wrap py-12 min-[700px]:py-16">
          <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight min-[700px]:text-[2.4rem]">
            Cài về máy
          </h1>
          <p className="mt-3 max-w-[58ch] text-lg text-ink-dim">
            Mở bằng trình duyệt là chơi được ngay. Cài về thì có biểu tượng riêng, mở nhanh hơn,
            và chắc chắn chơi được khi không có mạng.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button asChild variant="primary" size="lg" className="rounded-2xl">
              <Link to="/play">
                <Play size={19} fill="currentColor" /> Chơi trên trình duyệt
              </Link>
            </Button>
            <Button asChild size="lg" className="rounded-2xl">
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                <Download size={18} /> Bản cài cho máy tính
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Section>
        <SectionHead
          title="Thêm vào màn hình chính"
          lead="Không qua kho ứng dụng nào cả — trình duyệt tự cài, và không xin quyền gì."
        />
        <div className="grid gap-3 min-[820px]:grid-cols-3">
          {INSTALL.map((how) => {
            const Icon = how.icon
            return (
              <div key={how.title} className="rounded-2xl border border-border bg-surface p-5">
                <h3 className="flex items-center gap-2 text-[1rem] font-semibold">
                  <Icon size={18} className="text-ink-dim" aria-hidden="true" /> {how.title}
                </h3>
                <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-5 text-[0.9rem] leading-relaxed text-ink-dim">
                  {how.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      </Section>

      <Section tint>
        <SectionHead
          title="Bản cài cho máy tính"
          lead="macOS, Windows và Linux. Mỗi bản phát hành đều kèm tệp cài ở trang phát hành trên GitHub."
        />
        <div className="site-prose text-[0.95rem]">
          <p>
            Bản máy tính chạy cùng một engine, nhưng biên dịch thẳng cho máy chứ không qua trình
            duyệt — nên nó nghĩ sâu hơn trong cùng số giây. Dữ liệu vẫn nằm trong máy bạn.
          </p>
          <p>
            Máy không có bản cài sẵn thì vẫn chơi được bằng trình duyệt, không thiếu tính năng
            nào. Muốn tự dựng lấy thì mã nguồn và hướng dẫn nằm ở{' '}
            <a href={REPO} target="_blank" rel="noopener noreferrer">
              kho mã nguồn
            </a>
            .
          </p>
        </div>
        <div className="mt-6">
          <Button asChild variant="primary">
            <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
              <Download size={17} /> Xem bản phát hành mới nhất
            </a>
          </Button>
        </div>
      </Section>

      <Section>
        <SectionHead title="Cập nhật" />
        <div className="site-prose text-[0.95rem]">
          <p>
            Bản web tự cập nhật: lần sau mở ra là đã có bản mới, và nó{' '}
            <strong>không bao giờ cắt ngang một ván đang chơi</strong> — bản mới chỉ được áp dụng
            khi bạn đang không đánh dở.
          </p>
          <p>
            Bản máy tính thì tải bộ cài mới rồi cài đè lên bản cũ; lịch sử ván đấu vẫn nguyên.
          </p>
          <p>
            Muốn biết lần này có gì mới thì xem <Link to="/co-gi-moi">Có gì mới</Link>.
          </p>
        </div>
      </Section>
    </>
  )
}
