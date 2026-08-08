/**
 * A picture with a shape, and a width it is not allowed to exceed.
 *
 * There were three of these written separately — one inside `About.tsx` with
 * three hard-coded ratios, the hero on the launcher, and `PromoBanner`. They
 * agreed on nothing except by accident, and only one of them had thought about
 * what happens on a wide screen.
 *
 * ## Why a maximum width rather than a wider crop
 *
 * Because there is only one crop of each picture. The hero is 2.5:1 and the
 * promotional images are 16:9, and nothing can turn one into the other without
 * either cutting words off the ends or stretching faces. So on a desktop these
 * are *capped* instead of filled to the pane: a 16:9 banner spanning 1280px
 * stands 720px tall and eats the entire launcher, which is not a banner, it is a
 * wall.
 *
 * ## What is kept from `PromoBanner`, because it was measured
 *
 * * `aspect-ratio` set from the first frame, so nothing on the page moves when
 *   the image lands.
 * * `fetchPriority="low"`, so a decoration never competes with the engine binary
 *   the game cannot start without.
 * * No fade-in. The first version faded from transparent on load and the
 *   transition was measured stalling at zero — a loaded, laid-out, permanently
 *   invisible banner. A decoration that can fail closed is worse than none.
 * * On error it removes itself rather than leaving a broken-image icon.
 */

import { useState } from 'react'

import { cn } from '../lib/utils'

export interface BannerProps {
  src: string
  alt: string
  /** CSS `aspect-ratio`, e.g. `'2.5'` or `'16 / 9'`. */
  ratio: string
  /**
   * Widest it may be drawn, as a whole Tailwind literal.
   *
   * A literal rather than a number because `check-ui.mjs` cannot see through an
   * interpolated class, and a class it cannot see is a class it cannot check.
   */
  maxWidth?: string
  /** The one above the fold. Everything else waits. */
  priority?: boolean
  className?: string
}

export function Banner({
  src,
  alt,
  ratio,
  maxWidth = 'max-w-[720px]',
  priority = false,
  className,
}: BannerProps) {
  const [failed, setFailed] = useState(false)
  if (failed) return null

  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      fetchPriority={priority ? 'auto' : 'low'}
      onError={() => setFailed(true)}
      className={cn('w-full rounded-xl', maxWidth, className)}
      style={{ aspectRatio: ratio }}
    />
  )
}
