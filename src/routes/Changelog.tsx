/**
 * Every release, newest first.
 *
 * A version number on its own answers nothing. "0.6.0" tells a player neither
 * what they have nor what they gained by updating, and the number in Settings
 * was until now the only thing this app ever said about its own history.
 *
 * The list is grouped into three, because those are the three questions someone
 * actually has: what is new, what got better, and what was broken. A release
 * with nothing in a group simply does not show that group — an empty "Đã sửa"
 * is worse than none, since it invites the reader to wonder what is being
 * omitted.
 *
 * The newest release is open; the rest are folded. Someone arriving here has
 * just updated and wants to know about *this* one; the history is for the
 * curious, and folding it keeps the page to one screen.
 */

import { Check, Plus, Wrench } from 'lucide-react'

import { RELEASES, type Release } from '../changelog'
import { Badge } from '../components/ui/badge'
import { Card } from '../components/ui/card'

/** "8 tháng 8, 2026" — a date, not a timestamp. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`
}

function Group({
  title,
  icon,
  items,
}: {
  title: string
  icon: React.ReactNode
  items?: string[]
}) {
  if (!items || items.length === 0) return null
  return (
    <section className="mt-3">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-dim uppercase">
        {icon} {title}
      </h3>
      <ul className="grid list-none gap-1.5 p-0 text-sm">
        {items.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-dim" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Entry({ release, latest }: { release: Release; latest: boolean }) {
  const body = (
    <>
      <Group title="Mới" icon={<Plus size={14} />} items={release.added} />
      <Group title="Tốt hơn" icon={<Check size={14} />} items={release.improved} />
      <Group title="Đã sửa" icon={<Wrench size={14} />} items={release.fixed} />
    </>
  )

  return (
    <Card>
      <div className="flex flex-wrap items-baseline gap-2">
        <strong className="text-base">Bản {release.version}</strong>
        {latest && <Badge tone="accent">Mới nhất</Badge>}
        <span className="ml-auto text-sm text-ink-dim">{when(release.date)}</span>
      </div>
      <p className="mt-1 text-sm text-ink-dim">{release.headline}</p>

      {latest ? (
        body
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-ink-dim">Xem chi tiết</summary>
          {body}
        </details>
      )}
    </Card>
  )
}

export function ChangelogPage() {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-3 min-[700px]:max-w-[900px] min-[700px]:grid-cols-2 min-[700px]:gap-4 min-[1024px]:max-w-[1200px]">
      <p className="text-sm text-ink-dim min-[700px]:col-span-2">
        Mỗi lần ứng dụng có gì mới, nó được ghi lại ở đây.
      </p>

      {RELEASES.map((release, i) => (
        <Entry key={release.version} release={release} latest={i === 0} />
      ))}
    </div>
  )
}
