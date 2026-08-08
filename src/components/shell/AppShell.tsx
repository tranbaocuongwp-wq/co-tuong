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

import { useCallback, useEffect, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
  const { setHeaderEl, setPanelEl, hasColumn } = useShell()

  /*
   * Folded or not, and it remembers.
   *
   * A rail is 240px of permanent furniture, and on a laptop that is 240px the
   * board is not getting. Whether that trade is worth it depends on the person
   * and on what they are doing, which is exactly the kind of question the app
   * should stop guessing at and let them answer once.
   *
   * Read synchronously from `localStorage` rather than in an effect, so the
   * shell never draws itself wide and then snaps narrow a frame later.
   */
  const [folded, setFolded] = useState(() => {
    try {
      return localStorage.getItem(FOLD_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(FOLD_KEY, folded ? '1' : '0')
    } catch {
      // A browser refusing storage just forgets the preference.
    }
  }, [folded])

  const toggleFold = useCallback(() => setFolded((f) => !f), [])

  // The board wants every pixel of height it can get and supplies its own
  // status bar, so it never gets the shell's header.
  const playing = pathname === '/play'

  // Whether there is room is decided in `ShellContext`, so screens and shell
  // cannot disagree about it. Whether anything was put in is decided by CSS:
  // an empty column hides itself, so the shell needs no opinion about it.
  const sideColumn = hasColumn

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
    compact: 'flex h-[100dvh] w-full flex-col overflow-hidden',
    wide: 'flex h-[100dvh] w-full overflow-hidden',
  }
  const outer = compact ? OUTER.compact : OUTER.wide

  return (
    <div className={outer}>
      {!compact && (
        <div className="relative flex">
          <Sidebar shape={expanded && !folded ? 'expanded' : 'rail'} items={PRIMARY} />
          <button
            type="button"
            onClick={toggleFold}
            aria-label={folded ? 'Mở rộng menu' : 'Thu gọn menu'}
            className="absolute right-1 bottom-2 grid h-9 w-9 place-items-center rounded-xl text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {folded ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      )}

      {/*
        `min-h-0` is doing real work here, not decoration.
        
        A flex child refuses to shrink below its content by default, so without
        it this column grew to the height of whatever was inside — and the nav
        bar below it was pushed off the bottom of the screen. Measured on a
        375x812 phone with Settings open: the bar sat at y=1360.
      */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/*
          One header row for every screen, which is what makes the board sit at
          the top of its pane.
          
          The play screen used to carry its own status bar *inside* the layout
          that holds the board, so the board started a bar's height down the
          page and every screen had a different idea of where its top edge was.
          A screen with something to say puts it here; a screen with only a name
          gets its name.
        */}
        {/*
          One header row for every screen.
          
          The slot comes first in the DOM so CSS can hide the title when a screen
          has filled it — a following-sibling selector only looks forward, and
          this is the one arrangement that lets `:empty` do the work without any
          JavaScript deciding anything.
        */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <div ref={setHeaderEl} className="shell__slot contents" />
          <h1 className="shell__title truncate text-lg font-semibold">{title}</h1>
        </header>

        <div className="flex min-h-0 flex-1">
          <main
            className={
              playing
                ? 'shell__main shell__stage min-w-0 flex-1'
                : 'shell__main min-w-0 flex-1 overflow-y-auto p-4 min-[700px]:p-6'
            }
          >
            {children}
          </main>

          {/*
            `empty:hidden` rather than a `:empty` rule in the stylesheet.
            Tailwind's utilities sit in a later cascade layer than the app's own
            components, so `display: flex` from `flex` beat a `display: none`
            written there — the column stayed a 320px empty box on every screen
            that had nothing to put in it.

            The comment is out here because the class checker reads every string
            inside `className` as a class name.
          */}
          {sideColumn && (
            <aside
              ref={setPanelEl}
              className={
                expanded
                  ? 'shell__panel flex w-80 shrink-0 flex-col gap-2 overflow-y-auto border-l border-border p-3 empty:hidden'
                  : 'shell__panel flex w-72 shrink-0 flex-col gap-2 overflow-y-auto border-l border-border p-3 empty:hidden'
              }
              aria-label="Bảng bên"
            />
          )}
        </div>
      </div>

      {/* The bar takes its own height now, so nothing needs to be reserved. */}
      {compact && <Sidebar shape="bar" items={PRIMARY} />}
    </div>
  )
}

const FOLD_KEY = 'co-tuong.shell.folded'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider>
      <ShellBody>{children}</ShellBody>
    </ShellProvider>
  )
}
