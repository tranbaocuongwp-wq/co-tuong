/**
 * Pick one of a few. The launcher is made of these.
 *
 * It replaces a stack of description cards, and that is the point: the old
 * launcher explained every option in a sentence — "Bốn mức, từ dễ tới siêu
 * khó", "Cùng chơi trên một máy" — which is a paragraph of reading before you
 * can start a game you already knew you wanted. Someone opening a chess app
 * knows what "Khó" means. The words were doing the work an icon and a label do
 * better.
 *
 * Rows of equal-width targets, each at least 44px tall so it is tappable, and
 * the selection marked by fill rather than by a tick — at a glance you see
 * which one is on without reading anything at all.
 */

import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
  /** A single glyph shown instead of an icon — the two chess kings use this. */
  glyph?: string
}

export interface SegmentedProps<T extends string> {
  label: string
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={className}>
      <div className="mb-1.5 text-xs font-medium tracking-wide text-ink-dim uppercase">
        {label}
      </div>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid gap-1.5 rounded-2xl border border-border bg-surface p-1.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const on = option.value === value
          const Icon = option.icon
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex min-h-11 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2',
                'text-[0.82rem] leading-tight font-medium transition-colors',
                on ? 'bg-accent text-white' : 'text-ink-dim hover:bg-surface-2'
              )}
            >
              {option.glyph ? (
                <span className="text-lg leading-none">{option.glyph}</span>
              ) : Icon ? (
                <Icon size={18} />
              ) : null}
              <span className="text-center">{option.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
