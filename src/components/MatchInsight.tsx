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

import { memo, useMemo, type ReactNode } from 'react'

import type { Piece, SearchInfo, Side } from '../engine/types'
import { Swords } from 'lucide-react'

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

/** A labelled pair of numbers over one bar showing how they split. */
function Split({
  label,
  share,
  children,
}: {
  label: string
  share: number
  children: ReactNode
}) {
  return (
    <>
      <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[0.82rem]">
        <span className="text-ink-dim">{label}</span>
        <span>{children}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--text)_22%,transparent)]">
        <div
          className="h-full w-full origin-left rounded-full bg-red-piece transition-transform duration-500 ease-out"
          style={{ transform: `scaleX(${share})` }}
        />
      </div>
    </>
  )
}

/**
 * Sized by transform, not width.
 *
 * A width transition is a layout animation, and there are fourteen of these
 * updating after every move. `scaleX` on a full-width element draws the same
 * picture using only the compositor.
 */
function Bar({ share, colour }: { share: number; colour: string }) {
  return (
    <span
      className={`block h-[5px] w-full origin-left rounded-full transition-transform duration-300 ${colour}`}
      style={{ transform: `scaleX(${share})` }}
    />
  )
}

function Key({ colour, children }: { colour: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2 w-2 rounded-[2px]"
        style={{ background: colour }}
        aria-hidden="true"
      />
      {children}
    </span>
  )
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
    <section
      className="insight rounded-2xl border border-border bg-surface p-3"
      aria-label="Nhận định thế cờ"
    >
      <h2 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-dim uppercase">
        <Swords size={14} /> Cục diện
      </h2>

      <Split label="Khả năng thắng" share={redChance}>
        Đỏ {Math.round(redChance * 100)}% · Đen {Math.round((1 - redChance) * 100)}%
      </Split>
      <Split label="Lực lượng" share={materialShare}>
        Đỏ {redMaterial.toFixed(1)} · Đen {blackMaterial.toFixed(1)}
      </Split>

      <figure className="mt-3 mb-1 grid justify-items-center gap-1.5">
        <svg
          viewBox="0 0 112 112"
          role="img"
          aria-label="Biểu đồ sáu mặt của thế cờ"
          className="h-auto w-full max-w-[190px]"
        >
          {/* Rings at a quarter, a half, three quarters and full. */}
          {[0.25, 0.5, 0.75, 1].map((step) => (
            <polygon
              key={step}
              points={polygon(axes.map(() => step))}
              fill="none"
              stroke="var(--border)"
              strokeWidth={0.5}
            />
          ))}
          {axes.map((axis, i) => {
            const [x, y] = point(i, axes.length, R)
            return (
              <line
                key={axis.label}
                x1={CENTRE}
                y1={CENTRE}
                x2={x}
                y2={y}
                stroke="var(--border)"
                strokeWidth={0.4}
              />
            )
          })}
          <polygon
            points={polygon(axes.map((a) => a.black))}
            fill="var(--text-dim)"
            fillOpacity={0.22}
            stroke="var(--text-dim)"
            strokeWidth={1.2}
          />
          <polygon
            points={polygon(axes.map((a) => a.red))}
            fill="var(--accent)"
            fillOpacity={0.22}
            stroke="var(--accent)"
            strokeWidth={1.2}
          />
        </svg>
        <figcaption className="flex gap-3 text-[0.72rem] text-ink-dim">
          <Key colour="var(--accent)">Đỏ</Key>
          <Key colour="var(--text-dim)">Đen</Key>
        </figcaption>
      </figure>

      <ul className="mt-2 grid list-none gap-2 p-0">
        {axes.map((axis) => (
          <li key={axis.label} className="grid gap-1">
            <span className="flex justify-between gap-2 text-[0.82rem]">
              <span>{axis.label}</span>
              <span className="text-ink-dim tabular-nums">
                {Math.round(axis.red * 100)} · {Math.round(axis.black * 100)}
              </span>
            </span>
            <span className="grid gap-0.5 overflow-hidden">
              <Bar share={axis.red} colour="bg-accent" />
              <Bar share={axis.black} colour="bg-ink-dim" />
            </span>
            <span className="text-[0.72rem] text-ink-dim">{axis.note}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-border pt-2 text-[0.76rem] text-ink-dim">
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
