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
 */

import { ArrowLeft, Check, ChevronRight, Plus, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { RELEASES, type Release } from '../changelog'
import { RichText } from '../components/RichText'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'

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

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

export function ChangelogPage() {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-2 min-[700px]:max-w-[900px] min-[700px]:grid-cols-2 min-[1024px]:max-w-[1200px]">
      <p className="text-sm text-ink-dim min-[700px]:col-span-2">
        Mỗi lần ứng dụng có gì mới, nó được ghi lại ở đây.
      </p>

      {RELEASES.map((release, i) => (
        <Link
          key={release.version}
          to={`/changelog/${release.version}`}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 no-underline transition-colors hover:bg-surface-2"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-2">
              <strong className="text-ink">Bản {release.version}</strong>
              {i === 0 && <Badge tone="accent">Mới nhất</Badge>}
              <span className="ml-auto text-sm text-ink-dim">{when(release.date)}</span>
            </span>
            <span className="mt-0.5 block text-sm text-ink-dim">
              <RichText>{release.headline}</RichText>
            </span>
            <span className="mt-1 block text-[0.78rem] text-ink-dim">
              {count(release)} thay đổi
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-dim" aria-hidden="true" />
        </Link>
      ))}
    </div>
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
    <Card>
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-dim uppercase">
        {icon} {title}
      </h2>
      <ul className="grid list-none gap-2 p-0 text-sm">
        {items.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-dim" aria-hidden="true" />
            <span>
              <RichText>{line}</RichText>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function ReleasePage() {
  const { version } = useParams()
  const release = RELEASES.find((r) => r.version === version)

  if (!release) {
    return (
      <div className="mx-auto w-full max-w-md text-center">
        <p className="mb-4 text-sm text-ink-dim">Không có bản nào mang số {version}.</p>
        <Button asChild>
          <Link to="/changelog">
            <ArrowLeft size={17} /> Danh sách các bản
          </Link>
        </Button>
      </div>
    )
  }

  const newest = RELEASES[0]?.version === release.version

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 min-[700px]:max-w-[900px] min-[700px]:grid-cols-2 min-[1024px]:max-w-[1200px]">
      <div className="min-[700px]:col-span-2">
        <Link
          to="/changelog"
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-ink-dim no-underline hover:text-ink"
        >
          <ArrowLeft size={16} /> Tất cả các bản
        </Link>
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="text-xl font-bold">Bản {release.version}</h1>
          {newest && <Badge tone="accent">Mới nhất</Badge>}
          <span className="ml-auto text-sm text-ink-dim">{when(release.date)}</span>
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          <RichText>{release.headline}</RichText>
        </p>
      </div>

      <Group title="Mới" icon={<Plus size={14} />} items={release.added} />
      <Group title="Tốt hơn" icon={<Check size={14} />} items={release.improved} />
      <Group title="Đã sửa" icon={<Wrench size={14} />} items={release.fixed} />
    </div>
  )
}
