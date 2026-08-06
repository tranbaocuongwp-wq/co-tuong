import { NavLink, Outlet, useLocation } from 'react-router'

const LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/play', label: 'Chơi' },
  { to: '/history', label: 'Lịch sử' },
  { to: '/settings', label: 'Cài đặt' },
  { to: '/about', label: 'Giới thiệu' },
]

export function AppLayout() {
  const { pathname } = useLocation()
  // The playing screen carries no chrome at all: navigation lives in its
  // drawer, so the board gets the whole window.
  const bare = pathname === '/play'

  return (
    <div className={`app${bare ? ' app--bare' : ''}`}>
      {!bare && (
        <header className="topbar">
          <NavLink to="/" className="topbar__brand">
            Đệ Nhất Cờ Tướng
          </NavLink>
          <nav className="topbar__nav" aria-label="Điều hướng chính">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className="topbar__link">
                {l.label}
              </NavLink>
            ))}
          </nav>
        </header>
      )}
      <main className={bare ? 'page page--bare' : 'page'}>
        <Outlet />
      </main>
    </div>
  )
}

export { LINKS }
