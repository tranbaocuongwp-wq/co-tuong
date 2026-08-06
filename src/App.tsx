import { NavLink, Outlet } from 'react-router'

const LINKS = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/play', label: 'Chơi' },
  { to: '/history', label: 'Lịch sử' },
  { to: '/settings', label: 'Cài đặt' },
  { to: '/about', label: 'Giới thiệu' },
]

export function AppLayout() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="topbar__brand">
           Cờ Tướng
        </NavLink>
        <nav className="topbar__nav" aria-label="Điều hướng chính">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="topbar__link">
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  )
}
