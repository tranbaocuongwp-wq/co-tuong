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

    /*
     * Three listeners for one question.
     *
     * `change` on the MediaQueryList is the correct signal and does the work on
     * a real device. The other two are a safety net, added after an afternoon
     * spent chasing a layout that appeared not to react to rotation at all —
     * which turned out to be the test harness resizing the viewport without
     * dispatching any event, since a `resize` fired by hand fixed it instantly.
     *
     * They stay because rotating a tablet is the exact case this app has to get
     * right, the failure is silent when it happens, and the cost is one boolean
     * comparison per event against a state setter that bails when nothing
     * changed.
     */
    list.addEventListener('change', update)
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      list.removeEventListener('change', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [query])

  return matches
}
