/**
 * The front page.
 *
 * ## What it is trying to do
 *
 * Answer, in this order, the four questions someone has in the eight seconds
 * before they leave: what is this, what does it cost, what does it look like,
 * and can I start now. The hero answers the first two in one glance — a name, a
 * line, four numbers, one filled button. The strip of screenshots answers the
 * third without asking anyone to read. Everything after that is for the person
 * who has already decided to stay.
 *
 * ## Why the sections are in this order
 *
 * Screenshots before prose, because a chess app is a picture. "Có gì mới" high
 * up, because a page that shows a release from last week is a page that says
 * somebody is still here — which is the single thing a visitor most wants to
 * know about a free offline app and the single thing nobody ever writes down.
 * The reasons before the feature list, because a list of nine features
 * persuades nobody who is not already persuaded.
 *
 * The setup card is last on purpose. It is the only interactive thing on the
 * page, and putting it at the end means the button someone presses is the one
 * they reach after reading, not the one that interrupted them.
 *
 * ## The prefetch
 *
 * `/play` is a lazy route. On a marketing page that is the right trade — a
 * visitor who came to read should not download a chess engine — but it means
 * the biggest button on the page would otherwise open a spinner. So the chunk
 * and the engine binary are fetched once the browser is idle, which is almost
 * always long before anyone has finished reading this far down.
 */

import { useEffect, useState } from 'react'
import { Check, Download, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Author } from '../components/Author'
import { Banner } from '../components/Banner'
import { Button } from '../components/ui/button'
import { RichText } from '../components/RichText'
import { RELEASES } from '../changelog'
import { DEEP, FACTS, FEATURES, PILLARS, RELEASES_URL, SHOTS, STATS } from './copy'
import { NewGameChooser } from '../components/NewGameChooser'
import { Section, SectionHead, Shots } from './ui'
import { useMeta } from './useMeta'
import type { GameRecord } from '../storage/types'

/** "9 tháng 8, 2026" — a date, not a timestamp. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

/**
 * Warm the game up while nobody is looking.
 *
 * Both halves matter and they are separate downloads: the route's JavaScript
 * chunk, and the 210 KB WebAssembly engine. Fetching only the first still
 * leaves a wait at the board.
 *
 * `requestIdleCallback` where it exists, a timeout where it does not — Safari
 * shipped the former only recently, and this must not be the thing that keeps
 * the front page's own images from loading.
 */
function usePrefetchGame(): void {
  useEffect(() => {
    let done = false
    const warm = () => {
      if (done) return
      done = true
      void import('../routes/Play').catch(() => undefined)
      void import('../engine/wasm')
        .then((m) => m.loadEngineWasm())
        .catch(() => undefined)
    }
    const idle = window.requestIdleCallback
    if (typeof idle === 'function') {
      const id = idle(warm, { timeout: 4000 })
      return () => window.cancelIdleCallback?.(id)
    }
    const id = window.setTimeout(warm, 2500)
    return () => window.clearTimeout(id)
  }, [])
}

export function LandingPage() {
  const navigate = useNavigate()
  const latest = RELEASES[0]
  const [resumable, setResumable] = useState<GameRecord | null>(null)

  useMeta(
    'Đệ Nhất Cờ Tướng — cờ tướng ngoại tuyến, máy đánh thật',
    'Cờ tướng chơi được cả khi không có mạng. Bốn mức khó, có bình luận viên, xem lại từng nước. Miễn phí, không tài khoản, không quảng cáo.'
  )
  usePrefetchGame()

  /*
   * Whether there is a game to go back to.
   *
   * Loaded dynamically: `../storage` pulls in Dexie, and a visitor who has
   * never played should not be paying 80 KB to be told there is nothing to
   * resume. The answer only changes what one button says, so it can arrive
   * late.
   */
  useEffect(() => {
    let cancelled = false
    void import('../storage')
      .then((m) => m.getHistoryStore())
      .then((s) => s.getInProgress())
      .then((game) => {
        if (!cancelled) setResumable(game)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  const canResume = resumable !== null && resumable.moveCount > 0

  /*
   * "Bắt đầu" means begin, so the autosave goes first.
   *
   * Without this the board resumes the half-played game instead of the one the
   * visitor just configured, and the mức khó they picked ten seconds ago is
   * silently ignored — the game already in progress keeps the one it was
   * started with.
   */
  const startFresh = () => {
    void import('../storage')
      .then((m) => m.getHistoryStore())
      .then((s) => s.saveInProgress(null))
      .catch(() => undefined)
      .finally(() => navigate('/play'))
  }

  return (
    <>
      {/* ---------------------------------------------------------------- hero */}
      <div className="site-hero border-b border-border">
        <div className="site-wrap py-12 min-[700px]:py-16">
          <div className="flex flex-col gap-6 min-[700px]:flex-row min-[700px]:items-start min-[700px]:gap-8">
            <span
              className="grid h-24 w-24 shrink-0 place-items-center rounded-[26px] bg-accent text-5xl text-white shadow-[0_10px_30px_-10px_var(--accent)]"
              aria-hidden="true"
            >
              帥
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-[2rem] leading-[1.1] font-bold tracking-tight min-[700px]:text-[2.6rem]">
                Đệ Nhất Cờ Tướng
              </h1>
              <p className="mt-2 text-lg text-ink-dim min-[700px]:text-xl">
                Cờ tướng ngoại tuyến, và cái máy đánh thật.
              </p>
              {/*
                Three separate spans rather than one line of text with dots in
                it. A single text node wraps as a unit, so on a 375px screen the
                whole "· Miễn phí trọn đời · Mã nguồn mở" dropped to the next
                line and started it with a bullet hanging in the margin.
              */}
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ink-dim">
                <Author className="px-0" />
                <span aria-hidden="true">·</span>
                <span>Miễn phí trọn đời</span>
                <span aria-hidden="true">·</span>
                <span>Mã nguồn mở</span>
              </p>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <Button
                  asChild
                  variant="primary"
                  size="lg"
                  className="rounded-2xl shadow-[0_8px_24px_-8px_var(--accent)]"
                >
                  <Link to="/play">
                    <Play size={19} fill="currentColor" />
                    {canResume ? `Chơi tiếp — ${resumable.moveCount} nước` : 'Chơi ngay'}
                  </Link>
                </Button>
                <Button asChild size="lg" className="rounded-2xl">
                  <Link to="/tai-ve">
                    <Download size={18} /> Cài về máy
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/*
            Four numbers under a hairline.

            Two columns on a phone rather than four: at 375px, four cells put
            "Trong máy" onto two lines and the row stops reading as a row.
          */}
          <dl className="mt-10 grid grid-cols-2 gap-y-6 border-t border-border pt-6 min-[700px]:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className={
                  i % 2 === 1
                    ? 'border-l border-border pl-5 min-[700px]:pl-6'
                    : 'pl-0 min-[700px]:border-l min-[700px]:border-border min-[700px]:pl-6 min-[700px]:first:border-l-0 min-[700px]:first:pl-0'
                }
              >
                <dd className="text-[1.6rem] leading-none font-bold tracking-tight">
                  {stat.value}
                </dd>
                <dt className="mt-1.5 text-[0.7rem] font-medium tracking-wider text-ink-dim uppercase">
                  {stat.label}
                </dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* ---------------------------------------------------------- what's new */}
      {latest && (
        <Section>
          <SectionHead title="Có gì mới" link={{ to: '/co-gi-moi', label: 'Lịch sử phiên bản' }} />
          <p className="flex flex-wrap items-baseline gap-x-3">
            <Link to={`/co-gi-moi/${latest.version}`} className="font-semibold no-underline hover:underline">
              Bản {latest.version}
            </Link>
            <span className="text-sm text-ink-dim">{when(latest.date)}</span>
          </p>
          <p className="mt-2 max-w-[70ch] leading-relaxed text-ink-dim">
            <RichText>{latest.headline}</RichText>
          </p>
        </Section>
      )}

      {/* -------------------------------------------------------- screenshots */}
      <Section tint>
        <SectionHead title="Xem qua một vòng" lead="Quét ngang để xem hết." />
        <Shots shots={SHOTS} />
      </Section>

      {/* ------------------------------------------------------------- pillars */}
      <Section>
        <SectionHead
          title="Sáu điều đáng để đổi"
          lead="Phần lớn ứng dụng cờ tướng bây giờ đòi đăng nhập, đòi mạng, và cái máy thì đánh yếu nhưng lại hay được ưu ái. Ứng dụng này làm ngược lại cả ba."
        />
        <div className="grid gap-x-8 gap-y-7 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
          {PILLARS.map((pillar) => (
            <div key={pillar.title}>
              <h3 className="flex items-start gap-2 text-[1.02rem] leading-snug font-semibold">
                <Check size={17} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
                {pillar.title}
              </h3>
              <p className="mt-1.5 pl-[25px] text-[0.92rem] leading-relaxed text-ink-dim">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ features */}
      <Section tint id="tinh-nang">
        <SectionHead
          title="Đủ thứ một ván cờ cần"
          lead="Làm cho người ngồi xuống đánh một ván: ít thứ phải học, không có gì phải cài đặt trước."
        />
        <div className="grid gap-3 min-[620px]:grid-cols-2 min-[980px]:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-border bg-bg p-4"
            >
              <h3 className="text-[0.98rem] leading-snug font-semibold">{feature.title}</h3>
              <p className="mt-1.5 text-[0.9rem] leading-relaxed text-ink-dim">{feature.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ----------------------------------------------------------- deep dive */}
      <Section>
        <div className="flex flex-col gap-14">
          {DEEP.map((item, i) => (
            <div
              key={item.title}
              className={
                i % 2 === 1
                  ? 'flex flex-col gap-6 min-[820px]:flex-row-reverse min-[820px]:items-center min-[820px]:gap-12'
                  : 'flex flex-col gap-6 min-[820px]:flex-row min-[820px]:items-center min-[820px]:gap-12'
              }
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.3rem] leading-tight font-bold tracking-tight min-[700px]:text-[1.5rem]">
                  {item.title}
                </h2>
                <p className="mt-3 max-w-[56ch] leading-relaxed text-ink-dim">{item.body}</p>
              </div>
              <img
                src={item.shot}
                alt={item.alt}
                width={645}
                height={1398}
                loading="lazy"
                decoding="async"
                className="w-[190px] shrink-0 self-center rounded-[20px] border border-border bg-surface shadow-[var(--shadow)] min-[820px]:w-[228px]"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- engine */}
      <Section tint id="may-choi-co">
        <SectionHead title="Máy chơi cờ" />
        <div className="grid items-center gap-8 min-[820px]:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-3 leading-relaxed text-ink-dim">
            <p>
              Mỗi nước đi, máy cân nhắc hơn <strong className="text-ink">mười hai triệu thế cờ</strong> —
              và đó là ở mức dễ nhất. Ở mức siêu khó nó nghĩ khoảng năm giây và tính trước hàng
              chục nước.
            </p>
            <p>
              Luật cờ chỉ được viết một lần, bằng Rust, và giao diện không tự cài đặt lại — nên
              thứ bạn nhìn thấy trên bàn cờ và thứ máy đang tính là cùng một thế cờ. Bộ luật ấy
              được kiểm bằng phép đếm đầy đủ tới độ sâu năm: <strong className="text-ink">133.312.995</strong>{' '}
              thế cờ, khớp chính xác.
            </p>
            <p>
              Nó chạy ngay trong máy bạn, không gửi thế cờ đi đâu để hỏi, và không có máy chủ nào
              đứng sau để tắt đi.
            </p>
          </div>
          <Banner
            src="/banner/may-choi-co.webp"
            alt="Mỗi nước đi, máy cân nhắc hơn mười hai triệu thế cờ"
            ratio="16 / 9"
            maxWidth="max-w-full"
          />
        </div>
      </Section>

      {/* --------------------------------------------------------- start a game */}
      <Section id="bat-dau">
        <SectionHead
          title="Chọn thế trận rồi vào chơi"
          lead="Đổi được bất cứ lúc nào trong ván, nên không phải nghĩ lâu ở đây."
        />
        <NewGameChooser
          onStart={startFresh}
          resume={canResume ? { moves: resumable.moveCount, onResume: () => navigate('/play') } : null}
        />
      </Section>

      {/* ------------------------------------------------------------ download */}
      <Section tint>
        <SectionHead
          title="Cài về máy"
          lead="Mở bằng trình duyệt là chơi được ngay. Cài về thì mở nhanh hơn, có biểu tượng riêng, và chơi được cả khi máy không có mạng."
          link={{ to: '/tai-ve', label: 'Hướng dẫn cài' }}
        />
        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="primary">
            <Link to="/play">
              <Play size={17} fill="currentColor" /> Chơi trên trình duyệt
            </Link>
          </Button>
          <Button asChild>
            <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
              <Download size={17} /> Bản cài cho máy tính
            </a>
          </Button>
        </div>
      </Section>

      {/* ---------------------------------------------------------------- facts */}
      <Section id="thong-tin">
        <SectionHead title="Thông tin" />
        <dl className="grid gap-0 border-t border-border">
          {latest && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3">
              <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">Phiên bản</dt>
              <dd className="min-w-0 flex-1 text-[0.95rem]">
                {latest.version} · {when(latest.date)}
              </dd>
            </div>
          )}
          {FACTS.map((fact) => (
            <div
              key={fact.term}
              className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3"
            >
              <dt className="w-[11rem] shrink-0 text-sm text-ink-dim">{fact.term}</dt>
              <dd className="min-w-0 flex-1 text-[0.95rem]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </>
  )
}
