/**
 * How a screen puts things into the shell's header and side column.
 *
 * ## Portals, after state made the app hang
 *
 * The first version had the screen publish a React node into context state, and
 * the shell rendered whatever was there. It deadlocked the browser.
 *
 * The loop: `useGame` returns a fresh object literal on every render, so the
 * `useCallback`s that close over it are new functions each time, so the `useMemo`
 * that built the header row produced a new element each time, so the effect that
 * published it called `setHeader`, which re-rendered the provider, which
 * re-rendered the screen, which built another new element. Measured on the play
 * screen: tapping a destination changed the URL and nothing else, and a script
 * sent into the page could not run at all for thirty seconds because the main
 * thread never came free. From the outside it looked exactly like "navigation is
 * very slow".
 *
 * A portal has no such cycle. The shell renders empty containers once; a screen
 * renders its content *into* them from its own tree. Nothing is stored, nothing
 * is published, and no amount of re-rendering inside the screen can re-render
 * the shell.
 *
 * What is left in context is `hasColumn`, which is a media query and changes
 * only when the window does.
 */

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import { EXPANDED, LANDSCAPE, MEDIUM } from './breakpoints'
import { useMediaQuery } from '../../useMediaQuery'

interface ShellState {
  /** Where a screen's header row goes. Null until the shell has mounted. */
  headerEl: HTMLElement | null
  setHeaderEl: (el: HTMLElement | null) => void
  /** Where a screen's side panel goes. */
  panelEl: HTMLElement | null
  setPanelEl: (el: HTMLElement | null) => void
  /**
   * Whether the shell has a side column at all.
   *
   * Screens need this, not just the shell: the play screen lays its readings out
   * inside the board grid when there is no column, and must not draw them twice
   * when there is.
   */
  hasColumn: boolean
}

const Ctx = createContext<ShellState | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [headerEl, setHeaderEl] = useState<HTMLElement | null>(null)
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null)
  const medium = useMediaQuery(MEDIUM)
  const expanded = useMediaQuery(EXPANDED)
  const landscape = useMediaQuery(LANDSCAPE)

  /*
   * A column only when it can be a column rather than a squeeze.
   *
   * A tablet held upright has the width for one and no height to spare, so the
   * readings stay under the board where they already work. A phone turned
   * sideways is wide enough by any width rule and far too short — which is why
   * orientation is part of the question and not an afterthought.
   */
  const hasColumn = expanded || (medium && landscape)

  const value = useMemo(
    () => ({ headerEl, setHeaderEl, panelEl, setPanelEl, hasColumn }),
    [headerEl, panelEl, hasColumn]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShell(): ShellState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShell must be used inside ShellProvider')
  return ctx
}

export function useShellColumn(): boolean {
  return useShell().hasColumn
}

/** A screen's header row, rendered into the shell's bar. */
export function ShellHeader({ children }: { children: ReactNode }) {
  const { headerEl } = useShell()
  return headerEl ? createPortal(children, headerEl) : null
}

/** A screen's side panel, rendered into the shell's column. */
export function ShellPanel({ children }: { children: ReactNode }) {
  const { panelEl } = useShell()
  return panelEl ? createPortal(children, panelEl) : null
}
