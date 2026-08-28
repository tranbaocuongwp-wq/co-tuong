/**
 * The four shapes every page on the site is built out of.
 *
 * A section with a hairline above it, a heading with an optional link opposite,
 * a paragraph of standfirst, and the screenshot strip. Nothing here is clever;
 * the point is that there is exactly one of each, so the guide and the front
 * page cannot end up with headings at two different sizes.
 */

import { useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '../lib/utils'
import type { Shot } from './copy'

export function Section({
  children,
  className,
  id,
  tint,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  /**
   * A section that sits on the raised surface instead of the page.
   *
   * Used once or twice per page, to break a long run of identical bands. More
   * than that and the alternation becomes the pattern, which is worse than no
   * pattern at all.
   */
  tint?: boolean
}) {
  return (
    <section id={id} className={cn('site-sec', tint && 'bg-surface', className)}>
      <div className="site-wrap">{children}</div>
    </section>
  )
}

export function SectionHead({
  title,
  lead,
  link,
}: {
  title: string
  lead?: string
  link?: { to: string; label: string }
}) {
  return (
    <div className="mb-7">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="text-[1.4rem] leading-tight font-bold tracking-tight min-[700px]:text-[1.65rem]">
          {title}
        </h2>
        {link && (
          <Link to={link.to} className="ml-auto text-sm no-underline hover:underline">
            {link.label}
          </Link>
        )}
      </div>
      {lead && <p className="mt-2 max-w-[62ch] text-[0.95rem] leading-relaxed text-ink-dim">{lead}</p>}
    </div>
  )
}

/**
 * The screenshot strip.
 *
 * Scroll on touch, buttons on desktop, and the buttons drive the same scroll
 * container the finger does — so there is no second idea of "which one is
 * showing" to get out of step with the first. `scrollBy` rather than an index
 * into the array: after a flick the strip is very often halfway between two
 * frames, and stepping from a remembered index would jump backwards.
 */
export function Shots({ shots }: { shots: Shot[] }) {
  const track = useRef<HTMLDivElement>(null)

  const nudge = useCallback((dir: -1 | 1) => {
    const el = track.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(224, el.clientWidth * 0.8), behavior: 'smooth' })
  }, [])

  return (
    <div className="relative">
      <div ref={track} className="shots-track">
        {shots.map((shot) => (
          <figure key={shot.src}>
            <img
              src={shot.src}
              alt={shot.alt}
              width={645}
              height={1398}
              loading="lazy"
              decoding="async"
            />
            <figcaption className="mt-2 text-center text-[0.8rem] text-ink-dim">
              {shot.caption}
            </figcaption>
          </figure>
        ))}
      </div>

      {/*
        Hidden below 880px, and that is not a shrug at small screens — it is the
        opposite. A finger already scrolls this better than a 40px arrow can,
        and two floating buttons over a 208px frame would cover most of the
        screenshot they exist to reveal.
      */}
      {([-1, 1] as const).map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => nudge(dir)}
          aria-label={dir < 0 ? 'Xem ảnh trước' : 'Xem ảnh sau'}
          className={cn(
            'absolute top-[38%] hidden h-10 w-10 place-items-center rounded-full border border-border',
            'bg-surface text-ink-dim shadow-[var(--shadow)] transition-colors hover:text-ink min-[880px]:grid',
            dir < 0 ? '-left-4' : '-right-4'
          )}
        >
          {dir < 0 ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      ))}
    </div>
  )
}
