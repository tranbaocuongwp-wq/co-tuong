/**
 * A hairline between two groups of things.
 *
 * Ten lines, and it earns them by being used everywhere a dashboard has a seam:
 * between the nav sections in the rail, between the panels in the side column,
 * between an action row and the readings under it. The alternative is a `border-t`
 * hand-written at each of those places, which is how one of them ends up a
 * different colour.
 */

import { cn } from '../../lib/utils'

type Orientation = 'horizontal' | 'vertical'

/**
 * A lookup rather than a ternary on the prop.
 *
 * `check-ui.mjs` reads class strings out of the JSX, and a comparison like
 * `orientation === 'horizontal' ? …` puts the bare word `horizontal` where it
 * looks like one — so the build failed on a class nobody had written. Keeping
 * the branch out of the JSX keeps the guard able to see what is real.
 */
const LINE: Record<Orientation, string> = {
  horizontal: 'h-px w-full',
  vertical: 'h-full w-px',
}

export function Separator({
  className,
  orientation = 'horizontal',
}: {
  className?: string
  orientation?: Orientation
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn('shrink-0 bg-border', LINE[orientation], className)}
    />
  )
}
