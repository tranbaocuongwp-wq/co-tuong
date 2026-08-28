/**
 * The frame around every page you read rather than play.
 *
 * A header that stays, a page, a footer with the whole map of the site in it.
 * That is the entire shape, and it is deliberately the opposite of `AppShell`:
 * the app fills the window and never scrolls sideways, a page is a column you
 * scroll to the end of and then decide something from.
 *
 * ## Why the header is not the app's rail
 *
 * The rail is for someone who is already inside — five destinations they will
 * use again and again, one tap each, always on screen. A visitor who has just
 * arrived needs the opposite: a short list of things to *read*, and one
 * unmissable way in. So the header carries four links and a button, and the
 * button is the only filled thing on the page above the fold.
 *
 * ## The menu on a phone
 *
 * A disclosure, not a drawer. Four links do not justify a full-screen overlay
 * with a scrim and a focus trap, and the play button stays visible in the bar
 * the whole time — which is the one thing a hamburger must never hide.
 */

import { useEffect, useState } from 'react'
import { Menu, Play, X } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'

import { Author } from './Author'
import { cn } from '../lib/utils'
import { REPO, SITE_NAV, SITE_FOOTER, UMINI } from './copy'

function TopLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        cn(
          'rounded-lg px-3 py-2 text-sm no-underline transition-colors',
          isActive ? 'font-medium text-ink' : 'text-ink-dim hover:text-ink'
        )
      }
    >
      {label}
    </NavLink>
  )
}

export function SiteLayout() {
  const { pathname, hash } = useLocation()
  const [open, setOpen] = useState(false)

  /*
   * Two things on every navigation, and both are things a multi-page site gets
   * for free from the browser and a single-page one has to do by hand.
   *
   * The scroll position: without this, following a link from the bottom of the
   * front page lands you at the bottom of the guide, looking at its footer.
   *
   * The menu: it is a phone-sized disclosure, and a link inside it that leaves
   * it standing means the new page arrives underneath an open menu.
   */
  useEffect(() => {
    setOpen(false)
  }, [pathname, hash])

  /*
   * ...unless the link named a section, in which case go there instead.
   *
   * A plain `scrollTo(0, 0)` on every navigation quietly breaks every `#anchor`
   * link on the site — the footer's "Luật cờ tướng" points at `/huong-dan#luat`,
   * and the router changes the address without the browser ever doing its own
   * fragment jump, so the effect above would land the reader at the top of the
   * guide instead.
   *
   * The element is looked up after paint rather than in the same tick: on a
   * lazy route the page has not rendered yet when this first runs, so the
   * anchor does not exist to scroll to. `scroll-margin-top` on the headings
   * (see `.site-prose h2` in the stylesheet) keeps the target clear of the
   * sticky header.
   */
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }
    const id = requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1))
      if (target) target.scrollIntoView()
      else window.scrollTo(0, 0)
    })
    return () => cancelAnimationFrame(id)
  }, [pathname, hash])

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="site-head">
        <div className="site-wrap flex h-16 items-center gap-2">
          <Link
            to="/"
            className="mr-auto flex items-center gap-2.5 no-underline"
            aria-label="Đệ Nhất Cờ Tướng — trang chủ"
          >
            <span
              className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-lg text-white"
              aria-hidden="true"
            >
              帥
            </span>
            {/*
              The name disappears under 400px, and the mark stays.

              At 375 there are three things competing for one row — the brand,
              the button and the menu — and the first version let the brand win
              by wrapping onto two lines, which pushed the header to 88px and
              broke "Chơi ngay" in half underneath it. The mark alone is still
              unambiguously the way home, and it is the button that must not be
              compromised.
            */}
            <span className="hidden text-[0.95rem] font-bold tracking-tight text-ink min-[400px]:block">
              Đệ Nhất Cờ Tướng
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 min-[880px]:flex" aria-label="Trang">
            {SITE_NAV.map((item) => (
              <TopLink key={item.to} {...item} />
            ))}
          </nav>

          <Link
            to="/play"
            className={
              'ml-1 inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 ' +
              'text-sm font-semibold whitespace-nowrap text-white no-underline transition-[filter] hover:brightness-110'
            }
          >
            <Play size={15} fill="currentColor" /> Chơi ngay
          </Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={open ? 'Đóng menu' : 'Mở menu'}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink-dim hover:bg-surface-2 hover:text-ink min-[880px]:hidden"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <nav
            className="site-wrap flex flex-col gap-0.5 border-t border-border py-2 min-[880px]:hidden"
            aria-label="Trang"
          >
            {SITE_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center rounded-xl px-3 no-underline transition-colors',
                    isActive ? 'bg-surface-2 font-medium text-ink' : 'text-ink-dim hover:bg-surface-2'
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="site-wrap grid grid-cols-2 gap-x-6 gap-y-8 py-12 min-[700px]:grid-cols-[1.5fr_1fr_1fr_1.1fr]">
          <div className="col-span-2 min-[700px]:col-span-1">
            <div className="flex items-center gap-2.5">
              <span
                className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-base text-white"
                aria-hidden="true"
              >
                帥
              </span>
              <b className="text-[0.95rem]">Đệ Nhất Cờ Tướng</b>
            </div>
            <p className="mt-3 max-w-[38ch] text-sm leading-relaxed text-ink-dim">
              Cờ tướng chơi được cả khi không có mạng. Không tài khoản, không quảng cáo,
              không theo dõi.
            </p>
            {/*
              Who publishes it, in the block that carries the name.

              A footer's brand column is where a reader looks to find out whose
              site they are on, and until this line was here the answer was
              nowhere on the page. It is a sentence rather than another list
              item because "một ứng dụng của Umini" is a fact about the app, not
              a destination competing with the four in the column beside it.
            */}
            <p className="mt-2 text-sm text-ink-dim">
              Một ứng dụng của{' '}
              <a
                href={UMINI.home}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium"
              >
                Umini
              </a>{' '}
              — cửa hàng ứng dụng Việt.
            </p>
            <Link
              to="/play"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-bg px-4 text-sm font-medium text-ink no-underline transition-colors hover:bg-surface-2"
            >
              <Play size={14} fill="currentColor" /> Chơi ngay
            </Link>
          </div>

          {SITE_FOOTER.map((group) => (
            <div key={group.title}>
              <h2 className="mb-2.5 text-xs font-semibold tracking-wide text-ink-dim uppercase">
                {group.title}
              </h2>
              <ul className="flex list-none flex-col gap-0.5 p-0">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center text-sm text-ink-dim no-underline hover:text-ink"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.to}
                        className="inline-flex min-h-9 items-center text-sm text-ink-dim no-underline hover:text-ink"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-border">
          <div className="site-wrap flex flex-wrap items-center gap-x-3 gap-y-1 py-5 text-sm text-ink-dim">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
            <span>Ván cờ của bạn nằm trong máy bạn</span>
            <span className="ml-auto flex items-center gap-1">
              Làm bởi <Author />
            </span>
            {/*
              Two links and no more.

              Umini is named twice already in this footer — once in the brand
              paragraph, once as a whole column — and a third mention down here
              would be the bar shouting it. The licence, on the other hand, has
              nowhere else at the bottom of a page to live.
            */}
            <a
              href={`${REPO}/blob/main/LICENSE`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-dim no-underline hover:text-ink"
            >
              Giấy phép MIT
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
