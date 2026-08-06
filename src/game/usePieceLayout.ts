/**
 * Gives every piece a stable identity across moves.
 *
 * The engine hands back a fresh list of pieces after each move, with nothing
 * tying an entry to the piece it was a moment ago. Keying the DOM by square
 * therefore makes React tear down and rebuild a node on every move, so a piece
 * *jumps* to its destination — no CSS transition can fire, and a captured piece
 * simply vanishes with nothing to animate.
 *
 * Reconciling identities here fixes both: the mover keeps its DOM node and
 * slides to the new square, and the captured piece survives a moment longer as
 * a "ghost" so its death animation can play.
 */

import { useEffect, useRef, useState } from 'react'

import type { Piece } from '../engine/types'
import type { LastMove } from './useGame'

export interface RenderedPiece extends Piece {
  id: number
}

export interface PieceLayout {
  live: RenderedPiece[]
  /** Pieces taken by the move just played, kept mounted for the exit animation. */
  ghosts: RenderedPiece[]
}

/**
 * How long a move takes on screen, in milliseconds.
 *
 * The stylesheet animates the slide over the same span, and a captured piece
 * must not dissolve before the piece taking it has arrived — so the duration is
 * handed to both from here rather than written down twice.
 *
 * Purely presentational. The engine has already finished thinking and the board
 * state has already changed by the time any of this runs; nothing waits on the
 * animation, and slowing it down does not slow the computer down.
 */
export const MOVE_MS = 520

/**
 * How long the computer's moves take on screen.
 *
 * Deliberately slower than the player's own. A player who just tapped a piece
 * knows exactly what moved and where; watching the machine's reply, they do not
 * — and a move that arrives in a blink reads as the board teleporting rather
 * than as a piece being played.
 */
export const ENGINE_MOVE_MS = 900

const at = (row: number, col: number) => `${row},${col}`

export function usePieceLayout(
  pieces: Piece[],
  lastMove: LastMove | null,
  moveMs: number = MOVE_MS
): PieceLayout {
  const [live, setLive] = useState<RenderedPiece[]>([])
  const [ghosts, setGhosts] = useState<RenderedPiece[]>([])
  const previousRef = useRef<RenderedPiece[]>([])
  const nextIdRef = useRef(1)

  useEffect(() => {
    const previous = previousRef.current
    const unused = new Map<string, RenderedPiece>()
    for (const p of previous) unused.set(at(p.row, p.col), p)

    // A piece appearing from nowhere means an undo or a new game rather than a
    // move: identities are rebuilt and nothing is animated away.
    const rewind = !lastMove || pieces.length > previous.length

    const next: RenderedPiece[] = []
    const captured: RenderedPiece[] = []

    if (rewind) {
      for (const p of pieces) next.push({ ...p, id: nextIdRef.current++ })
    } else {
      // The mover carries its identity from origin to destination.
      const moverKey = at(lastMove.fromRow, lastMove.fromCol)
      const mover = unused.get(moverKey)
      if (mover) unused.delete(moverKey)

      for (const p of pieces) {
        if (mover && p.row === lastMove.toRow && p.col === lastMove.toCol) {
          next.push({ ...p, id: mover.id })
          continue
        }
        const key = at(p.row, p.col)
        const held = unused.get(key)
        if (held && held.side === p.side && held.kind === p.kind) {
          unused.delete(key)
          next.push({ ...p, id: held.id })
          continue
        }
        next.push({ ...p, id: nextIdRef.current++ })
      }

      // Anything unclaimed that stood on the destination square was taken.
      for (const leftover of unused.values()) {
        if (leftover.row === lastMove.toRow && leftover.col === lastMove.toCol) {
          captured.push(leftover)
        }
      }
    }

    previousRef.current = next
    setLive(next)
    if (captured.length > 0) setGhosts(captured)
  }, [pieces, lastMove])

  // Retire ghosts once their animation has run.
  useEffect(() => {
    if (ghosts.length === 0) return
    // The captured piece is held exactly as long as the slide takes, so it
    // dissolves under the piece arriving rather than before or after it.
    const timer = setTimeout(() => setGhosts([]), moveMs)
    return () => clearTimeout(timer)
  }, [ghosts, moveMs])

  return { live, ghosts }
}
