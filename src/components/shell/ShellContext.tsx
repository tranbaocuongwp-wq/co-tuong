/**
 * How a screen tells the shell what belongs in the side column.
 *
 * Context rather than react-router's `handle` + `useMatches`, and the reason is
 * the play screen: what goes in its side column is the commentary feed and the
 * live readings, which change on every move. A route handle is static data
 * declared where the route is defined, which cannot express that.
 *
 * A screen with nothing to put there simply never calls this, and the shell
 * renders no column at all rather than an empty one.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { EXPANDED, LANDSCAPE, MEDIUM } from './breakpoints'
import { useMediaQuery } from '../../useMediaQuery'

export interface ShellPanel {
  /** Heading above the column. Omit for a column that is all controls. */
  title?: string
  node: ReactNode
}

interface ShellState {
  panel: ShellPanel | null
  setPanel: (panel: ShellPanel | null) => void
  /**
   * What a screen puts in the shell's header instead of a plain title.
   *
   * The play screen's status row lives here rather than inside its own layout,
   * and that is what puts the board at the very top of the pane: with the bar
   * gone from the grid there is nothing above the board to push it down.
   */
  header: ReactNode | null
  setHeader: (node: ReactNode | null) => void
  /**
   * Whether the shell has a side column to put a panel in.
   *
   * Screens need this, not just the shell: the play screen lays its readings out
   * *inside* the board grid when there is no column, and must not draw them
   * twice when there is. Deciding it here rather than re-running the media
   * queries in each screen is what keeps the two answers from disagreeing.
   */
  hasColumn: boolean
}

const Ctx = createContext<ShellState | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<ShellPanel | null>(null)
  const [header, setHeader] = useState<ReactNode | null>(null)
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
    () => ({ panel, setPanel, header, setHeader, hasColumn }),
    [panel, header, hasColumn]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** Read by the shell itself. */
export function useShell(): ShellState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShell must be used inside ShellProvider')
  return ctx
}

/**
 * Publish this screen's side panel.
 *
 * Pass `null` when there is nothing to show. The panel is withdrawn on unmount,
 * so navigating away can never leave the previous screen's controls sitting
 * beside the new one.
 */
/** Publish this screen's header row. Withdrawn on unmount. */
export function useShellHeader(node: ReactNode | null): void {
  const { setHeader } = useShell()
  useEffect(() => {
    setHeader(node ?? null)
    return () => setHeader(null)
  }, [setHeader, node])
}

export function useShellColumn(): boolean {
  return useShell().hasColumn
}

export function useShellPanel(panel: ShellPanel | null): void {
  const { setPanel } = useShell()
  const node = panel?.node
  const title = panel?.title

  useEffect(() => {
    setPanel(node ? { title, node } : null)
    return () => setPanel(null)
  }, [setPanel, node, title])
}
