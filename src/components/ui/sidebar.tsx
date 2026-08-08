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
  bar:
    'fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch justify-around ' +
    'border-t border-border bg-surface ' +
    'pb-[calc(env(safe-area-inset-bottom)+var(--browser-chrome))]',
  rail: 'flex w-16 shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface p-2',
  expanded: 'flex w-60 shrink-0 flex-col items-stretch gap-1 border-r border-border bg-surface p-3',
}

const ITEM: Record<SidebarShape, string> = {
  bar:
    'flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.68rem] ' +
    'text-ink-dim no-underline transition-colors ' +
    'aria-[current=page]:text-accent',
  rail:
    'flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-[0.68rem] ' +
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
          // The rail shows an icon and a word too small to read at a glance, so
          // the accessible name comes from the attribute rather than the glyph.
          aria-label={label}
        >
          <Icon size={shape === 'expanded' ? 18 : 20} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
