/**
 * Whether a CSS media query currently matches.
 *
 * The layout itself is decided in CSS, where it belongs. This is for the cases
 * where the *content* differs rather than its arrangement — a panel that only
 * exists on a screen wide enough to hold it. Rendering it always and hiding it
 * with CSS would mean the work of keeping it up to date runs on every phone
 * that will never show it.
 *
 * Kept in sync with a listener rather than read once, so rotating a tablet is
 * enough to change the answer.
 */

import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && 'matchMedia' in window
      ? window.matchMedia(query).matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}
