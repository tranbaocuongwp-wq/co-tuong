/**
 * The score sheet, in traditional Vietnamese notation.
 *
 * Rendered as numbered pairs (Red then Black) the way a printed game record
 * reads, rather than as a flat list of coordinates.
 */

import { useEffect, useRef, useState } from 'react'

export interface MoveListProps {
  moves: string[]
  /** Scroll the newest move into view as the game goes on. */
  autoScroll?: boolean
  /** Highlight one ply, used by the review screen. */
  activeIndex?: number
  onSelect?: (index: number) => void
  /**
   * Show only the last N pairs, with a control to reveal the rest.
   *
   * The drawer wants the thread of the game, not its transcript; a sixty-move
   * game listed in full buries everything else under it.
   */
  limit?: number
}

export function MoveList({
  moves,
  autoScroll = true,
  activeIndex,
  onSelect,
  limit,
}: MoveListProps) {
  const endRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [moves.length, autoScroll])

  if (moves.length === 0) {
    return (
      <div className="movelist">
        <div className="movelist__empty">Chưa có nước đi nào.</div>
      </div>
    )
  }

  const allRows: { no: number; red?: string; black?: string; redIdx: number }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    allRows.push({ no: i / 2 + 1, red: moves[i], black: moves[i + 1], redIdx: i })
  }
  const capped = limit !== undefined && !expanded && allRows.length > limit
  const rows = capped ? allRows.slice(-limit) : allRows

  const cell = (text: string | undefined, index: number) => {
    if (!text) return <span />
    const active = activeIndex === index
    if (!onSelect) {
      return <span style={active ? { fontWeight: 700 } : undefined}>{text}</span>
    }
    return (
      <button
        type="button"
        onClick={() => onSelect(index)}
        style={{
          background: 'none',
          border: 0,
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
          fontWeight: active ? 700 : 400,
          textDecoration: active ? 'underline' : 'none',
        }}
      >
        {text}
      </button>
    )
  }

  return (
    <div className="movelist">
      {rows.map((r) => (
        <div className="movelist__row" key={r.no}>
          <span className="movelist__no">{r.no}.</span>
          {cell(r.red, r.redIdx)}
          {cell(r.black, r.redIdx + 1)}
        </div>
      ))}
      <div ref={endRef} />
      {capped && (
        <button type="button" className="movelist__more" onClick={() => setExpanded(true)}>
          Xem tất cả {allRows.length} nước
        </button>
      )}
    </div>
  )
}
