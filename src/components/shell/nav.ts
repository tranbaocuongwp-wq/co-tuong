/**
 * Where you can go, written down once.
 *
 * This list existed three times with three different answers. The top bar
 * (`App.tsx`) offered six destinations; the launcher's tiles offered four and
 * called none of them the same thing; the game drawer offered a third set of
 * four. Adding a screen meant remembering all three, and nobody ever did — which
 * is why "Chơi" appeared in the bar but never in the drawer, and why Giới thiệu
 * was reachable from the launcher but not from a game.
 *
 * One array, and every navigation surface renders from it. What differs between
 * surfaces is now only *which subset* and *how it looks*, which is a rendering
 * decision rather than a duplicated fact.
 */

import {
  History,
  Home,
  Info,
  Play,
  ScrollText,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

export interface Destination {
  to: string
  /** The word on the tile, the rail and the drawer. Short by design. */
  label: string
  icon: LucideIcon
  /** react-router's exact matching, needed only for `/`. */
  end?: boolean
  /**
   * Whether the primary navigation shows it.
   *
   * Giới thiệu is reachable from the launcher and from Settings, but it does not
   * earn a permanent slot next to the board — a rail with seven icons is a rail
   * nobody reads.
   */
  primary: boolean
}

export const DESTINATIONS: Destination[] = [
  { to: '/', label: 'Trang chủ', icon: Home, end: true, primary: true },
  { to: '/play', label: 'Chơi', icon: Play, primary: true },
  { to: '/profile', label: 'Hồ sơ', icon: UserRound, primary: true },
  { to: '/history', label: 'Lịch sử', icon: History, primary: true },
  { to: '/settings', label: 'Cài đặt', icon: Settings, primary: true },
  { to: '/about', label: 'Giới thiệu', icon: Info, primary: false },
  { to: '/changelog', label: 'Có gì mới', icon: ScrollText, primary: false },
]

/** The five that fit on a rail or a bottom bar. */
export const PRIMARY: Destination[] = DESTINATIONS.filter((d) => d.primary)

/** Everything except the launcher itself — what the launcher's own tiles show. */
export const FROM_LAUNCHER: Destination[] = DESTINATIONS.filter((d) => d.to !== '/')

/** What to call the current screen, for a bar too narrow to show the whole nav. */
export function titleOf(pathname: string): string {
  if (pathname.startsWith('/review')) return 'Xem lại'
  return DESTINATIONS.find((d) => d.to === pathname && d.to !== '/')?.label ?? ''
}
