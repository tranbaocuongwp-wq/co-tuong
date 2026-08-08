/**
 * A small pill carrying one fact.
 *
 * These existed already, four times over, written by hand: the "Chiếu!" warning
 * in the status bar, the hint and undo counters in the game menu, the result
 * chip in the history list. Each had its own padding, its own radius and its own
 * idea of how red is red — which is what happens to a thing that is never named.
 *
 * Tones rather than colours, so callers say what a badge *means* and this file
 * decides what that looks like.
 */

import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const badge = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.78rem] font-medium ' +
    'whitespace-nowrap [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        /** Neutral: a count, a label, a difficulty. */
        muted: 'bg-surface-2 text-ink-dim',
        /** This side is the app's own accent — the player, or the current turn. */
        accent: 'bg-accent-soft text-accent',
        /** Something happened that must not be missed. Check, mainly. */
        alert: 'bg-[color:var(--danger,#b3261e)] text-white',
        /** It went well. */
        good: 'bg-[color:var(--ok,#4a9d6a)] text-white',
      },
    },
    defaultVariants: { tone: 'muted' },
  }
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />
}
