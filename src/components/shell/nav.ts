/**
 * Where you can go from inside a game, written down once.
 *
 * This list existed three times with three different answers. The top bar
 * offered six destinations; the launcher's tiles offered four and called none
 * of them the same thing; the game drawer offered a third set of four. Adding a
 * screen meant remembering all three, and nobody ever did — which is why "Chơi"
 * appeared in the bar but never in the drawer.
 *
 * One array, and every navigation surface renders from it. What differs between
 * surfaces is now only *which subset* and *how it looks*, which is a rendering
 * decision rather than a duplicated fact.
 *
 * ## What is not here any more
 *
 * Giới thiệu and Có gì mới. They are pages on the site now (`/gioi-thieu`,
 * `/co-gi-moi`), reachable from every page's footer and from Settings, and a
 * rail beside a chess board is the wrong place to offer something read once.
 * The rail keeps the four screens that are about *your* games, plus the way
 * out.
 */

import { History, Home, Play, Settings, UserRound, type LucideIcon } from 'lucide-react'

import { IS_TAURI } from '../../platform'

export interface Destination {
  to: string
  /** The word on the rail and the drawer. Short by design. */
  label: string
  icon: LucideIcon
  /** react-router's exact matching, needed only for `/`. */
  end?: boolean
}

export const DESTINATIONS: Destination[] = [
  { to: '/play', label: 'Chơi', icon: Play },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound },
  { to: '/history', label: 'Lịch sử', icon: History },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
  /*
   * Last, and it leaves the app.
   *
   * It is the only entry that lands on a page rather than a screen, so it sits
   * at the end of the rail with the others between it and the board — nobody
   * reaches for "the way out" by accident when it is the furthest thing away.
   */
  { to: '/', label: 'Trang chủ', icon: Home, end: true },
]

/**
 * What the rail and the bottom bar actually show.
 *
 * Everything, except in the desktop app — where `/` redirects straight back to
 * the board, so a "Trang chủ" button would be a button that does nothing
 * visible. The web build keeps it, because there it is the way back out to the
 * pages about the game.
 */
export const PRIMARY: Destination[] = DESTINATIONS.filter(
  (d) => d.to !== '/' || !IS_TAURI
)

/** What to call the current screen, for a bar too narrow to show the whole nav. */
export function titleOf(pathname: string): string {
  if (pathname.startsWith('/review')) return 'Xem lại'
  // Longest match first, so a nested path still resolves to its section rather
  // than falling through to a blank header.
  const hit = DESTINATIONS.filter((d) => d.to !== '/')
    .filter((d) => pathname === d.to || pathname.startsWith(`${d.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return hit?.label ?? ''
}
