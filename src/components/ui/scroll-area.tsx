/**
 * A box whose contents scroll instead of pushing the page around.
 *
 * Thin on purpose. `@radix-ui/react-scroll-area` replaces the browser's
 * scrollbar with a drawn one, which is a pointer affordance — and this is a game
 * played mostly with a thumb, where the native scrollbar is already the right
 * answer and costs nothing.
 *
 * The three utilities are each load-bearing:
 *
 * * `min-h-0` — a flex child refuses to shrink below its content by default, so
 *   without this the box grows instead of scrolling and pushes everything below
 *   it off the screen. This is the one people forget.
 * * `overscroll-contain` — stops a flick that reaches the end of the list from
 *   scrolling the page behind it, which on a phone feels like the panel jumped.
 * * `scrollbar-gutter: stable` — reserves the scrollbar's width whether or not
 *   it is showing, so content does not shift sideways as a list grows.
 */

import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function ScrollArea({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', className)}
      style={{ scrollbarGutter: 'stable' }}
      {...props}
    />
  )
}
