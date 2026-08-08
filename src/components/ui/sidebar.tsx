/**
 * The primary navigation, in whichever shape the screen has room for.
 *
 * Not shadcn's `sidebar`, which is seven hundred lines and solves problems this
 * app does not have — collapsible groups, nested menus, keyboard shortcuts for a
 * tree. What is needed here is one flat list of five destinations rendered three
 * ways, and the three ways are decided by the shell, not by this file.
 *
 * | shape      | where             | why |
 * |------------|-------------------|-----|
 * | `bar`      | bottom, on a phone | the top of a large phone cannot be reached by the thumb holding it |
 * | `rail`     | left, 64px         | a tablet has a spare column but not a spare 240 of them |
 * | `expanded` | left, 240px        | a desktop has room for words, and words are faster to read than icons |
 *
 * Every class is a whole literal, selected from a lookup table. `check-ui.mjs`
 * skips any class fragment containing `$` or `{`, so an interpolated one is a
 * class the build guard cannot see — and the guard exists because a silently
 * unstyled class is exactly the bug it was written after.
 */

import { NavLink } from 'react-router'

import type { Destination } from '../shell/nav'
import { cn } from '../../lib/utils'

export type SidebarShape = 'bar' | 'rail' | 'expanded'

const CONTAINER: Record<SidebarShape, string> = {
  /*
   * In the flow, not fixed, and that is the whole of the iOS fix.
   *
   * A `position: fixed; bottom: 0` element is placed against the *layout*
   * viewport, and in Safari on iOS the layout viewport extends underneath the
   * browser's own toolbar. So the bar sat below the visible area with the last
   * rows of every page hidden behind it — measured on an iPhone, where the
   * "Tải tiếp" button in Settings could not be reached at all.
   *
   * `--browser-chrome` was an attempt to pad around that. Padding cannot move
   * something that is anchored to the wrong box. Putting the bar in normal flow
   * inside a shell that is exactly `100dvh` tall means the visible viewport is
   * the box, which is the one that was wanted all along.
   */
  /*
   * Flush with the bottom of the shell, and nothing more.
   *
   * There was a `--browser-chrome` pad here for one build — `100lvh - 100dvh`,
   * the height of Safari's toolbar — on the theory that the tap targets were
   * sitting inside the strip iOS reserves for its own gestures. It was a guess,
   * it was wrong, and it showed: on an iPhone the bar grew by the toolbar's
   * whole height and left a band of empty page below the icons.
   *
   * The variable exists for elements positioned against the *layout* viewport.
   * This bar is in normal flow inside a shell that is exactly `100dvh` tall, and
   * `100dvh` already excludes the toolbar — so there is nothing to compensate
   * for. Only the home-indicator inset is real, and only on the phones that have
   * one.
   *
   * What the navigation actually needed was the two fixes next door: the hint
   * dialog was locking the body while previewing, and its panel was sitting on
   * top of this bar. Both are measured; this was not.
   */
  bar:
    'flex h-14 shrink-0 items-stretch justify-around border-t border-border bg-surface ' +
    'pb-[env(safe-area-inset-bottom)]',
  rail: 'flex w-16 shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface p-2',
  expanded: 'flex w-60 shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface p-3',
}

const ITEM: Record<SidebarShape, string> = {
  bar:
    'flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.68rem] ' +
    'text-ink-dim no-underline transition-colors ' +
    'aria-[current=page]:text-accent',
  rail:
    'grid h-11 place-items-center rounded-xl ' +
    'text-ink-dim no-underline transition-colors hover:bg-surface-2 hover:text-ink ' +
    'aria-[current=page]:bg-accent-soft aria-[current=page]:text-accent',
  expanded:
    'flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] ' +
    'text-ink-dim no-underline transition-colors hover:bg-surface-2 hover:text-ink ' +
    'aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent',
}

export interface SidebarProps {
  shape: SidebarShape
  items: Destination[]
  /** Closes the drawer the bar lives in, when it lives in one. */
  onNavigate?: () => void
  className?: string
}

export function Sidebar({ shape, items, onNavigate, className }: SidebarProps) {
  return (
    <nav className={cn(CONTAINER[shape], className)} aria-label="Điều hướng chính">
      {shape === 'expanded' && (
        <NavLink
          to="/"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2 px-1 no-underline"
        >
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-lg text-white"
            aria-hidden="true"
          >
            帥
          </span>
          <span className="truncate font-bold text-ink">Đệ Nhất Cờ Tướng</span>
        </NavLink>
      )}

      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={ITEM[shape]}
          title={label}
          // The rail shows an icon and a word too small to read at a glance, so
          // the accessible name comes from the attribute rather than the glyph.
          aria-label={label}
        >
          <Icon size={shape === 'expanded' ? 18 : 20} aria-hidden="true" />
          {/*
            The rail is icons and nothing else.
            
            It carried a 0.68rem label under each one, which at that size is not
            a word — it is a grey smudge that makes the rail wider and the icon
            smaller without being readable. A folded rail is a deliberate choice
            to trade names for space; printing the names anyway gives up the
            space and keeps none of the benefit. The name is still there for
            anyone who needs it, in `aria-label` and in the tooltip.
          */}
          {shape !== 'rail' && label}
        </NavLink>
      ))}
    </nav>
  )
}
