/**
 * What the engine currently thinks, drawn rather than written.
 *
 * Held sideways there is a whole column beside the board doing nothing, and the
 * one thing a watcher always wants to know is who is winning. A bar answers
 * that in a glance where a number does not: nobody knows what "+180 centipawns"
 * means, and everybody knows what a bar three quarters full means.
 *
 * Everything here comes from the engine's own last assessment and from counting
 * the pieces on the board. Nothing is estimated or smoothed — in particular
 * there is no guess at "how many moves are left", because that is not something
 * the engine knows and inventing it would make the rest untrustworthy too. When
 * it *does* know, because it has found a forced mate, that is shown exactly.
 */

import type { Piece, SearchInfo, Side } from '../engine/types'
import { Icon } from './Icon'

export interface MatchInsightProps {
  /** The engine's last assessment, from its own side's point of view. */
  info: SearchInfo | null
  /** Which colour the engine plays, or null in a two-player game. */
  engineSide: Side | null
  pieces: Piece[]
  moveCount: number
}

/**
 * Rough worth of each piece, for the material bar.
 *
 * The engine's own evaluation is far more subtle than this; these are the
 * numbers a club player counts on their fingers, which is the right scale for
 * something meant to be read at a glance.
 */
const VALUE: Record<string, number> = { r: 9, c: 4.5, h: 4, e: 2, a: 2, p: 1, k: 0 }

/**
 * Centipawns to a winning chance.
 *
 * The usual logistic curve. The constant is what decides how quickly a lead
 * looks decisive; 400 is the long-standing convention and reads about right —
 * a rook up shows as heavily winning without showing as certain, which is
 * honest, because it is not certain.
 */
function winChance(centipawns: number): number {
  return 1 / (1 + Math.pow(10, -centipawns / 400))
}

function materialOf(pieces: Piece[], side: Side): number {
  return pieces
    .filter((p) => p.side === side)
    .reduce((sum, p) => sum + (VALUE[p.kind] ?? 0), 0)
}

export function MatchInsight({ info, engineSide, pieces, moveCount }: MatchInsightProps) {
  const red = materialOf(pieces, 'r')
  const black = materialOf(pieces, 'b')
  const materialShare = red + black > 0 ? red / (red + black) : 0.5

  // The engine scores from its own side; the bar is always Red on the left.
  const redChance =
    info && engineSide
      ? engineSide === 'r'
        ? winChance(info.score)
        : 1 - winChance(info.score)
      : 0.5

  const mate = info?.mateIn ?? null
  const seen = info?.depth ?? 0

  return (
    <section className="insight" aria-label="Nhận định thế cờ">
      <h2 className="insight__title">
        <Icon name="board" size={15} /> Cục diện
      </h2>

      <div className="insight__row">
        <span className="insight__label">Khả năng thắng</span>
        <span className="insight__value">
          Đỏ {Math.round(redChance * 100)}% · Đen {Math.round((1 - redChance) * 100)}%
        </span>
      </div>
      <div className="insight__bar">
        <span className="insight__fill insight__fill--red" style={{ width: `${redChance * 100}%` }} />
      </div>

      <div className="insight__row">
        <span className="insight__label">Lực lượng</span>
        <span className="insight__value">
          Đỏ {red.toFixed(1)} · Đen {black.toFixed(1)}
        </span>
      </div>
      <div className="insight__bar">
        <span
          className="insight__fill insight__fill--red"
          style={{ width: `${materialShare * 100}%` }}
        />
      </div>

      <div className="insight__notes">
        <span>Đã đi {moveCount} nước</span>
        {mate !== null && mate !== undefined ? (
          <strong>Có chiếu bí sau {Math.ceil(Math.abs(mate) / 2)} nước</strong>
        ) : seen > 0 ? (
          <span>Máy nhìn trước {seen} nước</span>
        ) : null}
      </div>
    </section>
  )
}
