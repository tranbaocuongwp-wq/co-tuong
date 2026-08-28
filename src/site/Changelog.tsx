/**
 * Two screens: the list of releases, and one release in full.
 *
 * The first version put everything on one page with the older entries folded
 * into `<details>`. It read as a wall — four releases, thirty-odd lines, and a
 * reader who wanted one of them had to scroll past the others to find it.
 *
 * A list answers "what has happened"; a page answers "what happened in this
 * one". Splitting them means the list can stay short enough to scan — a version,
 * a date, and one sentence — and the detail can be as long as it needs without
 * anyone paying for it who did not ask.
 *
 * ## Why it moved out of the app
 *
 * Release notes are read once, by someone deciding whether to bother — which
 * makes them a page about the app rather than part of it. Out here they are
 * also linkable: `/co-gi-moi/0.7.1` is an address that can be posted, and the
 * old `#/changelog/0.7.1` was not.
 */

import { ArrowLeft, ArrowRight, Check, ChevronRight, Plus, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { RELEASES, type Release } from '../changelog'
import { RichText } from '../components/RichText'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Section, SectionHead } from './ui'
import { useMeta } from './useMeta'

/** "8 tháng 8, 2026" — a date, not a timestamp. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

/** How many separate things a release contains, for the list to show. */
function count(release: Release): number {
  return (
    (release.added?.length ?? 0) +
    (release.improved?.length ?? 0) +
    (release.fixed?.length ?? 0)
  )
}

function Hero({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="site-hero border-b border-border">
      <div className="site-wrap py-12 min-[700px]:py-16">
        <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight min-[700px]:text-[2.4rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-[58ch] text-lg text-ink-dim">{lead}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export function ChangelogPage() {
  useMeta('Có gì mới', 'Mọi bản đã phát hành của Đệ Nhất Cờ Tướng, viết cho người chơi đọc.')

  return (
    <>
      <Hero
        title="Có gì mới"
        lead="Mỗi lần ứng dụng có gì mới, nó được ghi lại ở đây — viết cho người chơi đọc, không phải cho người lập trình."
      />
      <Section>
        <div className="flex flex-col gap-2">
          {RELEASES.map((release, i) => (
            <Link
              key={release.version}
              to={`/co-gi-moi/${release.version}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 no-underline transition-colors hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-2">
                  <strong className="text-ink">Bản {release.version}</strong>
                  {i === 0 && <Badge tone="accent">Mới nhất</Badge>}
                  <span className="ml-auto text-sm text-ink-dim">{when(release.date)}</span>
                </span>
                <span className="mt-1 block text-[0.92rem] leading-relaxed text-ink-dim">
                  <RichText>{release.headline}</RichText>
                </span>
                <span className="mt-1.5 block text-[0.78rem] text-ink-dim">
                  {count(release)} thay đổi
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-ink-dim" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Section>
    </>
  )
}

// ---------------------------------------------------------------------------
// One release
// ---------------------------------------------------------------------------

function Group({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items?: string[]
}) {
  // A release with nothing in a group does not show the group. An empty
  // "Đã sửa" is worse than none: it invites the reader to wonder what is being
  // left out.
  if (!items || items.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-ink-dim uppercase">
        {icon} {title}
      </h2>
      <ul className="grid list-none gap-2.5 p-0 text-[0.95rem]">
        {items.map((line) => (
          <li key={line} className="flex gap-2.5 leading-relaxed">
            <span
              className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-ink-dim"
              aria-hidden="true"
            />
            <span>
              <RichText>{line}</RichText>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ReleasePage() {
  const { version } = useParams()
  const index = RELEASES.findIndex((r) => r.version === version)
  const release = index >= 0 ? RELEASES[index] : undefined

  /*
   * The headline carries `**đậm**` markers, which belong on the page and not in
   * a browser tab or a link preview. Stripped rather than rendered, because a
   * `<meta>` is plain text and the asterisks would ship as asterisks.
   */
  useMeta(
    release ? `Bản ${release.version}` : 'Không tìm thấy bản này',
    release?.headline.replace(/\*\*/g, '')
  )

  if (!release) {
    return (
      <Section>
        <div className="mx-auto max-w-md py-10 text-center">
          <p className="mb-5 text-ink-dim">Không có bản nào mang số {version}.</p>
          <Button asChild>
            <Link to="/co-gi-moi">
              <ArrowLeft size={17} /> Danh sách các bản
            </Link>
          </Button>
        </div>
      </Section>
    )
  }

  // Newest first in the array, so the *newer* release is the one before it.
  const newer = RELEASES[index - 1]
  const older = RELEASES[index + 1]

  return (
    <>
      <div className="site-hero border-b border-border">
        <div className="site-wrap py-10 min-[700px]:py-14">
          <Link
            to="/co-gi-moi"
            className="inline-flex min-h-11 items-center gap-1.5 text-sm no-underline hover:underline"
          >
            <ArrowLeft size={16} /> Tất cả các bản
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-3">
            <h1 className="text-[1.9rem] leading-tight font-bold tracking-tight min-[700px]:text-[2.2rem]">
              Bản {release.version}
            </h1>
            {index === 0 && <Badge tone="accent">Mới nhất</Badge>}
            <span className="ml-auto text-sm text-ink-dim">{when(release.date)}</span>
          </div>
          <p className="mt-2 max-w-[62ch] text-lg leading-snug text-ink-dim">
            <RichText>{release.headline}</RichText>
          </p>
        </div>
      </div>

      <Section>
        <div className="flex flex-col gap-9">
          <Group title="Mới" icon={<Plus size={14} />} items={release.added} />
          <Group title="Tốt hơn" icon={<Check size={14} />} items={release.improved} />
          <Group title="Đã sửa" icon={<Wrench size={14} />} items={release.fixed} />
        </div>
      </Section>

      {/*
        Both neighbours, labelled by which way they go.

        A single "bản trước" link is ambiguous in a list that runs newest-first:
        half of readers arrive from the list and half from the release before
        this one, and they disagree about which direction "trước" points.
      */}
      {(newer || older) && (
        <Section tint>
          <SectionHead title="Các bản khác" />
          <div className="grid gap-3 min-[700px]:grid-cols-2">
            {older && (
              <Link
                to={`/co-gi-moi/${older.version}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 no-underline transition-colors hover:bg-surface-2"
              >
                <ArrowLeft size={18} className="shrink-0 text-ink-dim" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-xs text-ink-dim">Bản cũ hơn</span>
                  <strong className="block truncate">Bản {older.version}</strong>
                </span>
              </Link>
            )}
            {newer && (
              <Link
                to={`/co-gi-moi/${newer.version}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-bg p-4 no-underline transition-colors hover:bg-surface-2 min-[700px]:col-start-2 min-[700px]:justify-end"
              >
                <span className="min-w-0 text-right">
                  <span className="block text-xs text-ink-dim">Bản mới hơn</span>
                  <strong className="block truncate">Bản {newer.version}</strong>
                </span>
                <ArrowRight size={18} className="shrink-0 text-ink-dim" aria-hidden="true" />
              </Link>
            )}
          </div>
        </Section>
      )}
    </>
  )
}
