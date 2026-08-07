/**
 * What the position looks like, drawn rather than written.
 *
 * Held sideways there is a whole column beside the board doing nothing, and the
 * first thing a watcher wants to know is who is winning. A bar answers that in a
 * glance where a number does not: nobody knows what "+180 centipawns" means, and
 * everybody knows what a bar three quarters full means.
 *
 * ## Where the numbers come from
 *
 * The win bar is the engine's own assessment, and nothing else here is. Every
 * radar axis is **counted off the board in front of the player** — which pieces
 * are alive, which side of the river they stand on, how close they are to the
 * other palace. That is a deliberate limit: a chart is a claim, and a claim the
 * player cannot check by looking at the board is a claim they have to take on
 * trust. These they can check.
 *
 * It also means nothing here is estimated or smoothed. In particular there is no
 * guess at "how many moves are left", because that is not something the engine
 * knows and inventing it would make the rest untrustworthy too. When it *does*
 * know, because it has found a forced mate, that is shown exactly.
 */

import { memo, useMemo } from 'react'

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
 * Rough worth of each piece.
 *
 * The engine's own evaluation is far more subtle than this; these are the
 * numbers a club player counts on their fingers, which is the right scale for
 * something meant to be read at a glance.
 */
const VALUE: Record<string, number> = { r: 9, c: 4.5, h: 4, e: 2, a: 2, p: 1, k: 0 }

/** Everything one side starts with, by the same reckoning. Used to scale the axes. */
const FULL_ARMY = 2 * 9 + 2 * 4.5 + 2 * 4 + 2 * 2 + 2 * 2 + 5 * 1

/**
 * Row 0 is Black's back rank and row 9 is Red's, so the river runs between rows
 * 4 and 5. Everything below depends on that, so it is stated once here rather
 * than re-derived with a magic number at each use.
 */
function inEnemyHalf(p: Piece): boolean {
  return p.side === 'r' ? p.row <= 4 : p.row >= 5
}

/** The enemy palace with one square of approach around it. */
function nearEnemyPalace(p: Piece): boolean {
  const files = p.col >= 2 && p.col <= 6
  return p.side === 'r' ? files && p.row <= 3 : files && p.row >= 6
}

/** The same box around one's *own* palace, for measuring who is being besieged. */
function nearOwnPalace(p: Piece, side: Side): boolean {
  const files = p.col >= 2 && p.col <= 6
  return side === 'r' ? files && p.row >= 6 : files && p.row <= 3
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x))
}

function sum(pieces: Piece[], keep: (p: Piece) => boolean): number {
  return pieces.reduce((total, p) => (keep(p) ? total + (VALUE[p.kind] ?? 0) : total), 0)
}

interface Axis {
  label: string
  /** What it counts, in one clause. Read out under the chart. */
  note: string
  red: number
  black: number
}

/**
 * Six readings of the position, each in 0..1 for both sides.
 *
 * Scaled against a fixed reference rather than against each other, so both
 * outlines carry information. Scaling them against each other would make one
 * polygon the exact inverse of the other, which looks like two measurements and
 * is really one.
 */
function axesOf(pieces: Piece[]): Axis[] {
  const of = (side: Side) => pieces.filter((p) => p.side === side)
  const red = of('r')
  const black = of('b')

  /** How much enemy weight is camped around a side's own palace. */
  const siege = (side: Side) =>
    clamp01(sum(pieces, (p) => p.side !== side && nearOwnPalace(p, side)) / 9)

  const guards = (side: Side) =>
    of(side).filter((p) => p.kind === 'a' || p.kind === 'e').length / 4

  const strike = (list: Piece[]) =>
    clamp01(
      list.reduce(
        (n, p) => n + (p.kind === 'r' ? 3 : p.kind === 'c' || p.kind === 'h' ? 2 : 0),
        0
      ) / 14
    )

  return [
    {
      label: 'Lực lượng',
      note: 'tổng giá trị quân còn trên bàn',
      red: clamp01(sum(red, () => true) / FULL_ARMY),
      black: clamp01(sum(black, () => true) / FULL_ARMY),
    },
    {
      label: 'Chiếm đóng',
      note: 'quân đã sang phần đất bên kia sông',
      red: clamp01(sum(red, inEnemyHalf) / 15),
      black: clamp01(sum(black, inEnemyHalf) / 15),
    },
    {
      label: 'Áp sát cung',
      note: 'quân đứng quanh cung đối phương',
      red: clamp01(sum(red, nearEnemyPalace) / 9),
      black: clamp01(sum(black, nearEnemyPalace) / 9),
    },
    {
      label: 'Chủ lực',
      note: 'số Xe, Pháo, Mã còn sống',
      red: strike(red),
      black: strike(black),
    },
    {
      label: 'An toàn Tướng',
      note: 'Sĩ Tượng còn lại, trừ đi sức ép quanh cung nhà',
      red: clamp01(guards('r') * (1 - siege('r'))),
      black: clamp01(guards('b') * (1 - siege('b'))),
    },
    {
      label: 'Trung lộ',
      note: 'quân đứng trên ba đường giữa',
      red: clamp01(sum(red, (p) => p.col >= 3 && p.col <= 5) / 12),
      black: clamp01(sum(black, (p) => p.col >= 3 && p.col <= 5) / 12),
    },
  ]
}

/**
 * Centipawns to a winning chance.
 *
 * The usual logistic curve. The constant decides how quickly a lead looks
 * decisive; 400 is the long-standing convention and reads about right — a rook
 * up shows as heavily winning without showing as certain, which is honest,
 * because it is not certain.
 */
function winChance(centipawns: number): number {
  return 1 / (1 + Math.pow(10, -centipawns / 400))
}

/** Radar geometry. A plain unit circle; the SVG viewBox does the scaling. */
const R = 46
const CENTRE = 56

function point(index: number, count: number, radius: number): [number, number] {
  // Start at twelve o'clock and go clockwise, which is how a chart like this is
  // read; the default (three o'clock, anticlockwise) puts the first axis in an
  // odd place and makes the labels harder to match up.
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2
  return [CENTRE + Math.cos(angle) * radius, CENTRE + Math.sin(angle) * radius]
}

function polygon(values: number[]): string {
  return values
    .map((v, i) => point(i, values.length, Math.max(0.04, v) * R).join(','))
    .join(' ')
}

function MatchInsightView({ info, engineSide, pieces, moveCount }: MatchInsightProps) {
  const axes = useMemo(() => axesOf(pieces), [pieces])

  const redMaterial = axes[0].red * FULL_ARMY
  const blackMaterial = axes[0].black * FULL_ARMY
  const materialShare =
    redMaterial + blackMaterial > 0 ? redMaterial / (redMaterial + blackMaterial) : 0.5

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
        <span
          className="insight__fill insight__fill--red"
          style={{ transform: `scaleX(${redChance})` }}
        />
      </div>

      <div className="insight__row">
        <span className="insight__label">Lực lượng</span>
        <span className="insight__value">
          Đỏ {redMaterial.toFixed(1)} · Đen {blackMaterial.toFixed(1)}
        </span>
      </div>
      <div className="insight__bar">
        <span
          className="insight__fill insight__fill--red"
          style={{ transform: `scaleX(${materialShare})` }}
        />
      </div>

      <figure className="radar">
        <svg viewBox="0 0 112 112" role="img" aria-label="Biểu đồ sáu mặt của thế cờ">
          {/* Rings at a quarter, a half, three quarters and full. */}
          {[0.25, 0.5, 0.75, 1].map((step) => (
            <polygon
              key={step}
              className="radar__ring"
              points={polygon(axes.map(() => step))}
            />
          ))}
          {axes.map((axis, i) => {
            const [x, y] = point(i, axes.length, R)
            return <line key={axis.label} className="radar__spoke" x1={CENTRE} y1={CENTRE} x2={x} y2={y} />
          })}
          <polygon className="radar__area radar__area--black" points={polygon(axes.map((a) => a.black))} />
          <polygon className="radar__area radar__area--red" points={polygon(axes.map((a) => a.red))} />
        </svg>
        <figcaption className="radar__legend">
          <span className="radar__key radar__key--red">Đỏ</span>
          <span className="radar__key radar__key--black">Đen</span>
        </figcaption>
      </figure>

      <ul className="axis-list">
        {axes.map((axis) => (
          <li key={axis.label} className="axis">
            <span className="axis__head">
              <span className="axis__label">{axis.label}</span>
              <span className="axis__value">
                {Math.round(axis.red * 100)} · {Math.round(axis.black * 100)}
              </span>
            </span>
            <span className="axis__track">
              <span
                className="axis__bar axis__bar--red"
                style={{ transform: `scaleX(${axis.red})` }}
              />
              <span
                className="axis__bar axis__bar--black"
                style={{ transform: `scaleX(${axis.black})` }}
              />
            </span>
            <span className="axis__note">{axis.note}</span>
          </li>
        ))}
      </ul>

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

/**
 * Held steady unless its own inputs move.
 *
 * Recomputing six readings over thirty-two pieces on every commentary line
 * is work for a picture that only changes when the board does.
 */
export const MatchInsight = memo(MatchInsightView)
