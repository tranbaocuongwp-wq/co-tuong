/**
 * One frame for the whole app: navigation, a main area, and a side column.
 *
 * The screen it replaces was three unrelated arrangements pretending to be one
 * app. Subpages had a top bar with six links. The launcher had no bar at all and
 * its own grid of tiles. The board had neither, and hid everything in a drawer.
 * Each was defensible alone; together they meant the app looked like a different
 * program depending on where you were standing in it.
 *
 * ## The shape, by how much room there is
 *
 * | size     | width      | navigation            | side column |
 * |----------|------------|-----------------------|-------------|
 * | compact  | ≤ 699px    | bar across the bottom | none — screens keep using the drawer they already had |
 * | medium   | 700–1023px | rail, 64px            | 288px, and only in landscape |
 * | expanded | ≥ 1024px   | rail with labels, 240px | 320px, always |
 *
 * Two axes rather than one, because width alone gets the board wrong. A phone
 * turned sideways is 812px wide and 375px tall: wide enough for two columns by
 * any width rule, and far too short to put anything under the board.
 *
 * Navigation lives at the bottom on a phone for the same reason the sheet does:
 * the top third of a large phone cannot be reached by the thumb holding it.
 *
 * ## What this file does *not* do
 *
 * It does not lay out the board. `.stage` already solves that in both
 * orientations, with about six fixed bugs written into its comments, and the
 * play screen keeps it — the shell only decides how much room it gets. See
 * `.shell__stage` in `styles.css` for the one thing that had to change.
 */

import { useLocation } from 'react-router'

import { COMPACT, EXPANDED } from './breakpoints'
import { PRIMARY, titleOf } from './nav'
import { ShellProvider, useShell } from './ShellContext'
import { Sidebar } from '../ui/sidebar'
import { useMediaQuery } from '../../useMediaQuery'

function ShellBody({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const compact = useMediaQuery(COMPACT)
  const expanded = useMediaQuery(EXPANDED)
  const { panel, hasColumn } = useShell()

  // The board wants every pixel of height it can get and supplies its own
  // status bar, so it never gets the shell's header.
  const playing = pathname === '/play'

  // Whether there is room is decided in `ShellContext`, so screens and shell
  // cannot disagree about it. All that is left here is whether anyone filled it.
  const sideColumn = panel !== null && hasColumn

  const title = titleOf(pathname)

  /*
   * Two things this picks, and both matter.
   *
   * Direction: the bottom bar is `fixed`, so it takes no space of its own — the
   * spacer below has to sit in a *vertical* flow to reserve its height, and on a
   * horizontal one it would become a column instead. Without it the last row of
   * every scrolling page sits under the bar, which on Settings meant the delete
   * buttons could not be reached.
   *
   * Height: the play screen gets a fixed `100dvh` rather than a minimum, because
   * `.shell__stage` uses `container-type: size` to bound the board — and a
   * container whose own height comes from its contents cannot answer the
   * question the board is asking it. Every other screen keeps a minimum and
   * scrolls, which is what a long Settings page needs.
   */
  const OUTER = {
    compactPlay: 'flex h-[100dvh] w-full flex-col overflow-hidden',
    compactPage: 'flex min-h-[100dvh] w-full flex-col',
    widePlay: 'flex h-[100dvh] w-full overflow-hidden',
    widePage: 'flex min-h-[100dvh] w-full',
  }
  const outer = compact
    ? playing
      ? OUTER.compactPlay
      : OUTER.compactPage
    : playing
      ? OUTER.widePlay
      : OUTER.widePage

  return (
    <div className={outer}>
      {!compact && (
        <Sidebar shape={expanded ? 'expanded' : 'rail'} items={PRIMARY} />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!playing && title && (
          <header className="flex h-14 shrink-0 items-center border-b border-border px-4">
            <h1 className="truncate text-lg font-semibold">{title}</h1>
          </header>
        )}

        <div className="flex min-h-0 flex-1">
          <main
            className={
              playing
                ? 'shell__main shell__stage min-w-0 flex-1'
                : 'shell__main min-w-0 flex-1 overflow-y-auto p-4'
            }
          >
            {children}
          </main>

          {sideColumn && (
            <aside
              className={
                expanded
                  ? 'flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-3'
                  : 'flex w-72 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border p-3'
              }
              aria-label={panel.title ?? 'Bảng bên'}
            >
              {panel.title && (
                <h2 className="text-xs font-medium tracking-wide text-ink-dim uppercase">
                  {panel.title}
                </h2>
              )}
              {panel.node}
            </aside>
          )}
        </div>
      </div>

      {/*
        Bottom bar, and the spacer under it.

        The bar is fixed, so without something occupying its height the last row
        of every scrolling page sits underneath it — which on Settings meant the
        delete buttons could not be reached.
      */}
      {compact && (
        <>
          <div className="h-14 shrink-0" aria-hidden="true" />
          <Sidebar shape="bar" items={PRIMARY} />
        </>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ShellBody>{children}</ShellBody>
    </ShellProvider>
  )
}
