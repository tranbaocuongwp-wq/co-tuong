/**
 * The board.
 *
 * Geometry note: Xiangqi pieces sit on the *intersections*, not inside the
 * squares, so the grid is 9x10 points rather than 8x9 cells. Everything is laid
 * out in board units (one unit = one point spacing) inside an SVG viewBox, and
 * the pieces are HTML on top positioned in percentages of the same box. That
 * keeps the whole thing resolution-independent: it scales from a phone to a
 * desktop window with no breakpoints.
 */

import { useMemo, useState } from 'react'

import type { MoveInfo, Piece, Side } from '../engine/types'
import type { LastMove } from '../game/useGame'
import { usePieceLayout } from '../game/usePieceLayout'

/** Half-unit margin so edge pieces are not clipped by the board border. */
const PAD = 0.6
const COLS = 9
const ROWS = 10
const VIEW_W = (COLS - 1) + PAD * 2
const VIEW_H = (ROWS - 1) + PAD * 2

export interface BoardProps {
  pieces: Piece[]
  legalMoves: MoveInfo[]
  sideToMove: Side
  /** Which side the human may move; null means both (local two-player). */
  controllable: Side | null
  onMove: (iccs: string) => void
  lastMove: LastMove | null
  flipped: boolean
  inCheck: boolean
  disabled: boolean
  /** Highlighted suggestion from the Hint button. */
  hint: { fromRow: number; fromCol: number; toRow: number; toCol: number } | null
}

interface Point {
  row: number
  col: number
}

function samePoint(a: Point | null, b: Point | null): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col
}

export function Board({
  pieces,
  legalMoves,
  sideToMove,
  controllable,
  onMove,
  lastMove,
  flipped,
  inCheck,
  disabled,
  hint,
}: BoardProps) {
  const [selected, setSelected] = useState<Point | null>(null)
  const { live, ghosts } = usePieceLayout(pieces, lastMove)

  // Board coordinates are absolute; flipping only changes where they are drawn.
  const toScreen = (p: Point) => ({
    row: flipped ? ROWS - 1 - p.row : p.row,
    col: flipped ? COLS - 1 - p.col : p.col,
  })

  const percent = (p: Point) => {
    const s = toScreen(p)
    return {
      left: `${((PAD + s.col) / VIEW_W) * 100}%`,
      top: `${((PAD + s.row) / VIEW_H) * 100}%`,
    }
  }

  const movesFromSelected = useMemo(
    () =>
      selected
        ? legalMoves.filter((m) => m.fromRow === selected.row && m.fromCol === selected.col)
        : [],
    [legalMoves, selected]
  )

  const movableSquares = useMemo(() => {
    const set = new Set<string>()
    for (const m of legalMoves) set.add(`${m.fromRow},${m.fromCol}`)
    return set
  }, [legalMoves])

  const pieceAt = (row: number, col: number) =>
    pieces.find((p) => p.row === row && p.col === col) ?? null

  const checkedKingPoint = useMemo(() => {
    if (!inCheck) return null
    const king = pieces.find((p) => p.kind === 'k' && p.side === sideToMove)
    return king ? { row: king.row, col: king.col } : null
  }, [inCheck, pieces, sideToMove])

  function handlePoint(row: number, col: number) {
    if (disabled) return
    const target = movesFromSelected.find((m) => m.toRow === row && m.toCol === col)
    if (target) {
      onMove(target.iccs)
      setSelected(null)
      return
    }
    const piece = pieceAt(row, col)
    // Only the side whose turn it is — and only if the human controls it — can
    // be picked up. Tapping the opponent's piece just clears the selection.
    const mayPick =
      piece &&
      piece.side === sideToMove &&
      (controllable === null || piece.side === controllable) &&
      movableSquares.has(`${row},${col}`)
    setSelected(mayPick ? { row, col } : null)
  }

  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
    for (let r = 0; r < ROWS; r++) {
      lines.push({ x1: PAD, y1: PAD + r, x2: PAD + COLS - 1, y2: PAD + r })
    }
    for (let c = 0; c < COLS; c++) {
      if (c === 0 || c === COLS - 1) {
        // The outer files run the full height; the rest stop at the river.
        lines.push({ x1: PAD + c, y1: PAD, x2: PAD + c, y2: PAD + ROWS - 1 })
      } else {
        lines.push({ x1: PAD + c, y1: PAD, x2: PAD + c, y2: PAD + 4 })
        lines.push({ x1: PAD + c, y1: PAD + 5, x2: PAD + c, y2: PAD + ROWS - 1 })
      }
    }
    // Palace diagonals, top and bottom.
    lines.push({ x1: PAD + 3, y1: PAD, x2: PAD + 5, y2: PAD + 2 })
    lines.push({ x1: PAD + 5, y1: PAD, x2: PAD + 3, y2: PAD + 2 })
    lines.push({ x1: PAD + 3, y1: PAD + 7, x2: PAD + 5, y2: PAD + 9 })
    lines.push({ x1: PAD + 5, y1: PAD + 7, x2: PAD + 3, y2: PAD + 9 })
    return lines
  }, [])

  return (
    <div className="board" role="group" aria-label="Bàn cờ tướng">
      <svg
        className="board__grid"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <rect className="board__bg" x="0" y="0" width={VIEW_W} height={VIEW_H} rx="0.25" />
        {/* strokeWidth is set here, in board units — see the note in styles.css */}
        <rect
          className="board__frame"
          x={PAD - 0.25}
          y={PAD - 0.25}
          width={COLS - 1 + 0.5}
          height={ROWS - 1 + 0.5}
          strokeWidth={0.055}
        />
        {gridLines.map((l, i) => (
          <line
            key={i}
            className="board__line"
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            strokeWidth={0.03}
          />
        ))}
        <text className="board__river" x={VIEW_W / 2} y={PAD + 4.62} textAnchor="middle">
          ĐỆ NHẤT CỜ TƯỚNG
        </text>
      </svg>

      {/* Click targets: one per intersection, so empty points are tappable. */}
      <div className="board__points">
        {Array.from({ length: ROWS }).map((_, row) =>
          Array.from({ length: COLS }).map((__, col) => {
            const move = movesFromSelected.find((m) => m.toRow === row && m.toCol === col)
            const isSelected = samePoint(selected, { row, col })
            const isLastFrom =
              lastMove && lastMove.fromRow === row && lastMove.fromCol === col
            const isLastTo = lastMove && lastMove.toRow === row && lastMove.toCol === col
            const isHintFrom = hint && hint.fromRow === row && hint.fromCol === col
            const isHintTo = hint && hint.toRow === row && hint.toCol === col
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className="board__point"
                style={percent({ row, col })}
                onClick={() => handlePoint(row, col)}
                disabled={disabled}
                aria-label={`Ô hàng ${row + 1} cột ${col + 1}`}
              >
                {(isLastFrom || isLastTo) && <span className="marker marker--last" />}
                {(isHintFrom || isHintTo) && <span className="marker marker--hint" />}
                {isSelected && <span className="marker marker--selected" />}
                {move && (
                  <span
                    className={move.capture ? 'marker marker--capture' : 'marker marker--target'}
                  />
                )}
              </button>
            )
          })
        )}
      </div>

      <div className="board__pieces">
        {/* Captured pieces render first so the taker slides in over them. */}
        {ghosts.map((p) => (
          <div
            key={`ghost-${p.id}`}
            className={`piece piece--${p.side === 'r' ? 'red' : 'black'} piece--taken`}
            style={percent({ row: p.row, col: p.col })}
            aria-hidden="true"
          >
            <span className="piece__glyph">{p.glyph}</span>
            <span className="piece__burst" />
          </div>
        ))}

        {live.map((p) => {
          const isCheckedKing = samePoint(checkedKingPoint, { row: p.row, col: p.col })
          const isSelected = samePoint(selected, { row: p.row, col: p.col })
          return (
            <div
              // Keyed by identity, not by square: this is what lets the node
              // survive a move and animate across the board.
              key={p.id}
              className={[
                'piece',
                p.side === 'r' ? 'piece--red' : 'piece--black',
                isSelected ? 'piece--selected' : '',
                isCheckedKing ? 'piece--check' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={percent({ row: p.row, col: p.col })}
              onClick={() => handlePoint(p.row, p.col)}
              role="presentation"
            >
              <span className="piece__glyph">{p.glyph}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
