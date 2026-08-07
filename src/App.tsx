/**
 * The shell around every screen that is not the board.
 *
 * On a phone the old bar showed a brand plus six destinations in a sideways
 * scroller, which meant the last two were always half off the edge — a menu you
 * cannot see is not a menu, it is a hint that something is missing. And a
 * subpage does not need six ways out: someone reading Settings wants to go
 * back, and everything else is one tap further on from the launcher.
 *
 * So: a back button and the page's name on a phone, the full row from `sm` up
 * where it genuinely fits. The back button goes to the launcher rather than
 * through history, because history here can be twenty moves of a game and
 * "back" should not mean "into the middle of the last thing you did".
 */

import { ChevronLeft } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router'

const LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/play', label: 'Chơi' },
  { to: '/profile', label: 'Hồ sơ' },
  { to: '/history', label: 'Lịch sử' },
  { to: '/settings', label: 'Cài đặt' },
  { to: '/about', label: 'Giới thiệu' },
]

/** What to call the page in the bar, when the bar is too narrow for the nav. */
const TITLES: Record<string, string> = {
  '/profile': 'Hồ sơ',
  '/history': 'Lịch sử',
  '/settings': 'Cài đặt',
  '/about': 'Giới thiệu',
}

export function AppLayout() {
  const { pathname } = useLocation()
  // The playing screen carries no chrome at all: navigation lives in its
  // sheet, so the board gets the whole window.
  const bare = pathname === '/play'
  // The launcher carries its own navigation, as tiles at the foot of the page.
  // A nav bar above it would be the same four destinations listed twice, and
  // the row of small links at the very top is the last thing a launcher wants
  // competing with its title.
  const chrome = !bare && pathname !== '/'

  const title = TITLES[pathname] ?? (pathname.startsWith('/review') ? 'Xem lại' : '')

  return (
    <div className={`app${bare ? ' app--bare' : ''}`}>
      {chrome && (
        <header className="sticky top-0 z-10 border-b border-border bg-surface">
          <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center gap-1 px-2 sm:px-4">
            <NavLink
              to="/"
              className="-ml-1 flex h-11 items-center gap-0.5 rounded-xl pr-2 pl-1 text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink sm:hidden"
              aria-label="Về trang chủ"
            >
              <ChevronLeft size={22} />
              <span className="text-[0.95rem]">Trang chủ</span>
            </NavLink>

            <span className="truncate font-semibold sm:hidden">{title}</span>

            <NavLink
              to="/"
              className="hidden text-[1.05rem] font-bold tracking-wide text-accent no-underline sm:block"
            >
              Đệ Nhất Cờ Tướng
            </NavLink>

            <nav className="ml-auto hidden gap-1 sm:flex" aria-label="Điều hướng chính">
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className="rounded-full px-3 py-1.5 text-[0.92rem] text-ink-dim no-underline transition-colors hover:bg-surface-2 aria-[current=page]:bg-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-accent"
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      )}
      <main className={bare ? 'page page--bare' : 'page'}>
        <Outlet />
      </main>
    </div>
  )
}

export { LINKS }
