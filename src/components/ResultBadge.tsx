/**
 * Won, lost, drawn — from the player's point of view.
 *
 * The history page used to head each row with "Đen thắng (chiếu bí)". That is
 * the commentator's sentence, and on this page it is the wrong one: a list of
 * *your* games should tell you how *you* did, and working that out from
 * "Đen thắng" means remembering which colour you had in a game from last
 * Tuesday. Nobody does that, so the whole list read as undifferentiated grey.
 *
 * The colours are the ones the app already uses for good and bad news, so a
 * green pill means the same thing here as it does anywhere else.
 */

import { Circle, Minus, Trophy, X } from 'lucide-react'

import type { GameRecord } from '../storage/types'
import { cn } from '../lib/utils'

export type Outcome = 'win' | 'loss' | 'draw' | 'unfinished' | 'other'

/**
 * How a stored game turned out for the human.
 *
 * `other` is a two-player game, where there is no "you" to have won: both
 * players were in the room, and the colour that won is the only true thing to
 * say about it.
 */
export function outcomeOf(game: GameRecord): Outcome {
  if (game.result === 'unfinished') return 'unfinished'
  if (game.result === 'draw') return 'draw'
  const humanIsRed = game.redPlayer === 'human'
  const humanIsBlack = game.blackPlayer === 'human'
  if (humanIsRed && humanIsBlack) return 'other'
  if (!humanIsRed && !humanIsBlack) return 'other'
  const won = (game.result === 'redWin') === humanIsRed
  return won ? 'win' : 'loss'
}

const LOOK: Record<Outcome, { label: string; icon: typeof Trophy; className: string }> = {
  win: {
    label: 'Thắng',
    icon: Trophy,
    className: 'bg-ok/15 text-ok border-ok/35',
  },
  loss: {
    label: 'Thua',
    icon: X,
    className:
      'bg-[color:var(--danger,#b3261e)]/12 text-[color:var(--danger,#b3261e)] border-[color:var(--danger,#b3261e)]/35',
  },
  draw: {
    label: 'Hoà',
    icon: Minus,
    className: 'bg-surface-2 text-ink-dim border-border',
  },
  unfinished: {
    label: 'Bỏ dở',
    icon: Circle,
    className: 'bg-surface-2 text-ink-dim border-border',
  },
  other: {
    label: 'Xong',
    icon: Circle,
    className: 'bg-surface-2 text-ink-dim border-border',
  },
}

export function ResultBadge({
  outcome,
  className,
}: {
  outcome: Outcome
  className?: string
}) {
  const look = LOOK[outcome]
  const Glyph = look.icon
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
        look.className,
        className
      )}
    >
      <Glyph size={13} strokeWidth={2.5} aria-hidden="true" />
      {look.label}
    </span>
  )
}
