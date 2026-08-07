/**
 * The game menu, as a sheet from the bottom.
 *
 * It used to slide in from the side and run the full height of the screen. That
 * is fine with a mouse and wrong on a phone: the top half of a large phone
 * cannot be reached by the thumb holding it, so half the controls needed a
 * second hand or a shuffle of the grip. Everything tappable now sits in the
 * bottom half, which is the only part of a phone that is genuinely comfortable.
 *
 * The six actions come first and are the only things at full size — they are
 * what the menu is opened for. The score sheet and the captured pieces are
 * reference, so they read as reference: smaller, below, and scrollable.
 *
 * Focus trapping, Escape, the scrim, and locking the page behind are all
 * handled by the Sheet primitive rather than by hand here. The hand-rolled
 * version got the first three right and the fourth subtly wrong.
 *
 * The wording avoids engine vocabulary throughout. A player wants to know the
 * computer is looking eight moves ahead; "nodes", "depth" and "centipawns" tell
 * them nothing.
 */

import { NavLink } from 'react-router'
import {
  FlipHorizontal2,
  Flag,
  Lightbulb,
  ListOrdered,
  Plus,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react'

import type { Piece, PieceKind, SearchInfo, Side } from '../engine/types'
import { Author } from './Author'
import { MoveList } from './MoveList'
import { PieceIcon } from './PieceIcon'
import { PromoBanner } from './PromoBanner'
import { Button } from './ui/button'
import { Sheet } from './ui/sheet'

export interface GameMenuProps {
  open: boolean
  onClose: () => void
  moves: string[]
  pieces: Piece[]
  info: SearchInfo | null
  difficultyLabel: string | null
  canUndo: boolean
  isOver: boolean
  busy: boolean
  /** Suggestions left in this game. */
  hintsLeft: number
  /** Take-backs left in this game. */
  undosLeft: number
  voiceOn: boolean
  onToggleVoice: () => void
  onNewGame: () => void
  onUndo: () => void
  onHint: () => void
  onFlip: () => void
  onResign: () => void
}

/** The full complement each side starts with, by piece kind. */
const FULL_SET: Record<PieceKind, number> = { k: 1, a: 2, e: 2, h: 2, r: 2, c: 2, p: 5 }

/** Pieces of `side` that are no longer on the board, most valuable first. */
function capturedFrom(pieces: Piece[], side: Side): PieceKind[] {
  const alive: Partial<Record<PieceKind, number>> = {}
  for (const p of pieces) {
    if (p.side === side) alive[p.kind] = (alive[p.kind] ?? 0) + 1
  }
  const order: PieceKind[] = ['r', 'c', 'h', 'e', 'a', 'p']
  const gone: PieceKind[] = []
  for (const kind of order) {
    const missing = FULL_SET[kind] - (alive[kind] ?? 0)
    for (let i = 0; i < missing; i++) gone.push(kind)
  }
  return gone
}

const NAV = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/profile', label: 'Hồ sơ', end: false },
  { to: '/history', label: 'Lịch sử', end: false },
  { to: '/settings', label: 'Cài đặt', end: false },
]

export function GameMenu({
  open,
  onClose,
  moves,
  pieces,
  info,
  difficultyLabel,
  canUndo,
  isOver,
  busy,
  hintsLeft,
  undosLeft,
  voiceOn,
  onToggleVoice,
  onNewGame,
  onUndo,
  onHint,
  onFlip,
  onResign,
}: GameMenuProps) {
  const redLost = capturedFrom(pieces, 'r')
  const blackLost = capturedFrom(pieces, 'b')

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title="Ván đấu"
      description="Điều khiển ván đấu, nước đi và quân đã ăn"
    >
      <div className="flex flex-col gap-4">
        {/* Two columns of thumb-sized targets, nothing else at this size. */}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="primary" onClick={onNewGame}>
            <Plus size={18} /> Ván mới
          </Button>
          <Button onClick={onUndo} disabled={!canUndo}>
            <Undo2 size={18} /> Đi lại · {undosLeft}
          </Button>
          <Button
            onClick={onHint}
            disabled={isOver || busy || hintsLeft <= 0}
            title={hintsLeft > 0 ? undefined : 'Hết gợi ý cho ván này'}
          >
            <Lightbulb size={18} /> Gợi ý · {hintsLeft}
          </Button>
          <Button onClick={onFlip}>
            <FlipHorizontal2 size={18} /> Lật bàn
          </Button>
          <Button onClick={onToggleVoice} aria-pressed={voiceOn}>
            {voiceOn ? <Volume2 size={18} /> : <VolumeX size={18} />} Bình luận
          </Button>
          <Button variant="danger" onClick={onResign} disabled={isOver}>
            <Flag size={18} /> Chịu thua
          </Button>
        </div>

        <section className="rounded-2xl border border-border bg-surface-2/50 p-3">
          <h3 className="mb-2 text-xs font-medium tracking-wide text-ink-dim uppercase">Đã ăn</h3>
          <div className="flex flex-col gap-2">
            {(
              [
                ['Đỏ mất', 'r', redLost],
                ['Đen mất', 'b', blackLost],
              ] as const
            ).map(([label, side, lost]) => (
              <div key={side} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm text-ink-dim">{label}</span>
                <span className="flex flex-wrap gap-1">
                  {lost.length === 0 ? (
                    <span className="text-sm text-ink-dim">—</span>
                  ) : (
                    lost.map((kind, i) => (
                      <PieceIcon key={`${kind}-${i}`} kind={kind} side={side} size={22} />
                    ))
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        {(info || difficultyLabel) && (
          <p className="text-sm text-ink-dim">
            {difficultyLabel && <>Mức {difficultyLabel}</>}
            {info && (
              <>
                {difficultyLabel && ' · '}
                {info.fromBook ? 'nước vừa rồi theo bài bản' : `nghĩ trước ${info.depth} nước`}
              </>
            )}
          </p>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-dim uppercase">
            <ListOrdered size={14} /> Nước đi
          </h3>
          <MoveList moves={moves} limit={5} />
        </section>

        <nav className="grid grid-cols-4 gap-1.5" aria-label="Đi tới">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className="grid min-h-11 place-items-center rounded-xl border border-border text-xs text-ink-dim transition-colors hover:bg-surface-2 hover:text-ink"
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/*
          The drawer, and deliberately not the board.

          A banner beside a live game would be something to look past on every
          single move. Down here it only appears when the player has already
          stopped playing to open the menu, and it is the last thing in a panel
          they scrolled to the bottom of.
        */}
        <PromoBanner />

        <div className="flex justify-center pb-1">
          <Author />
        </div>
      </div>
    </Sheet>
  )
}
