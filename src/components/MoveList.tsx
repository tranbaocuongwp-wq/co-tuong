/**
 * The score sheet, in traditional Vietnamese notation.
 *
 * Rendered as numbered pairs (Red then Black) the way a printed game record
 * reads, rather than as a flat list of coordinates.
 */

import { useEffect, useRef } from 'react'

export interface MoveListProps {
  moves: string[]
  /** Scroll the newest move into view as the game goes on. */
  autoScroll?: boolean
  /** Highlight one ply, used by the review screen. */
  activeIndex?: number
  onSelect?: (index: number) => void
}

export function MoveList({ moves, autoScroll = true, activeIndex, onSelect }: MoveListProps) {
  const endRef = useRef<HTMLDivElement>(null)

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

  const rows: { no: number; red?: string; black?: string; redIdx: number }[] = []
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ no: i / 2 + 1, red: moves[i], black: moves[i + 1], redIdx: i })
  }

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
    </div>
  )
}
