/**
 * The moment the game ends, said properly.
 *
 * It used to be a small card below the board saying "chiếu bí". Correct, and
 * completely inadequate for the thing it is reporting: the game just ended, and
 * on a phone that card could be off the bottom of the screen entirely. A player
 * would sit there wondering why the board had stopped responding.
 *
 * So it is a panel in the middle of the screen, and it answers the three
 * questions somebody actually has at that moment, in that order: what happened,
 * can I take that back, and can I look at it again.
 *
 * The take-back matters, and it is offered on exactly one of those three
 * outcomes. Losing to a single blunder and being handed nothing but "Ván mới"
 * is what makes people put a chess app down — the game they wanted was the one
 * they were already playing — so on a loss it is right there and it is the
 * primary action. On a win it is absurd, and it used to be shown there too.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { Handshake, ListRestart, Play, Plus, Trophy, Undo2 } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '../lib/utils'
import { Button } from './ui/button'

export interface GameOverDialogProps {
  open: boolean
  /** "Chiếu bí", "Hoà cờ" … the reason, already in words. */
  headline: string
  /**
   * How it went for the player, or null in a two-player game where there is no
   * "you". Decides the tone, and nothing else.
   */
  outcome: 'win' | 'loss' | 'draw' | null
  /** Take-backs left. Zero hides the offer rather than showing a dead button. */
  undosLeft: number
  /** False when there is nothing to take back — a resignation on move one. */
  canUndo: boolean
  /** Where the replay lives, once the game has been filed. Null until then. */
  reviewHref: string | null
  onUndo: () => void
  onNewGame: () => void
  onClose: () => void
}

const LOOK: Record<
  'win' | 'loss' | 'draw',
  { title: string; note: string; icon: typeof Trophy; ring: string; tint: string }
> = {
  win: {
    title: 'Bạn thắng rồi!',
    note: 'Ván đấu khép lại đúng ý bạn.',
    icon: Trophy,
    ring: 'border-t-ok',
    tint: 'bg-ok/15 text-ok',
  },
  loss: {
    title: 'Bạn thua ván này',
    note: 'Còn lượt đi lại thì vẫn gỡ được — ván cờ chưa hẳn đã hết.',
    icon: ListRestart,
    ring: 'border-t-[color:var(--danger,#b3261e)]',
    tint: 'bg-[color:var(--danger,#b3261e)]/15 text-[color:var(--danger,#b3261e)]',
  },
  draw: {
    title: 'Hoà cờ',
    note: 'Không ai hạ được ai. Cũng là một kết quả sòng phẳng.',
    icon: Handshake,
    ring: 'border-t-ink-dim',
    tint: 'bg-surface-2 text-ink-dim',
  },
}

export function GameOverDialog({
  open,
  headline,
  outcome,
  undosLeft,
  canUndo,
  reviewHref,
  onUndo,
  onNewGame,
  onClose,
}: GameOverDialogProps) {
  const look = LOOK[outcome ?? 'draw']
  const Badge = look.icon
  /*
   * Only ever offered on a loss.
   *
   * It used to appear on any finished game, so winning produced a panel that
   * said "Bạn thắng rồi!" and then put "Đi lại nước vừa rồi" under it as the
   * brightest thing on the screen — offering to undo the move that just won.
   * The button exists for one situation, losing to a single blunder, and
   * showing it anywhere else makes it read as noise at best and as a taunt at
   * worst.
   */
  const offerUndo = outcome === 'loss' && canUndo && undosLeft > 0

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55" />
        <Dialog.Content
          className={cn(
            'fixed top-1/2 left-1/2 z-50 w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2',
            'rounded-3xl border border-border border-t-4 bg-surface p-6 text-center',
            'shadow-[0_18px_50px_rgba(0,0,0,0.45)]',
            look.ring
          )}
        >
          <span
            className={cn('mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl', look.tint)}
            aria-hidden="true"
          >
            <Badge size={26} />
          </span>

          <Dialog.Title className="text-xl font-bold">
            {outcome ? look.title : headline}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-ink-dim">{headline}</Dialog.Description>
          {outcome && <p className="mt-2 text-sm">{look.note}</p>}

          <div className="mt-5 grid gap-2">
            {offerUndo && (
              <Button variant="primary" size="lg" className="w-full" onClick={onUndo}>
                <Undo2 size={19} /> Đi lại · còn {undosLeft}
              </Button>
            )}
            {reviewHref ? (
              <Button asChild className="w-full">
                <Link to={reviewHref}>
                  <Play size={17} /> Xem lại ván này
                </Link>
              </Button>
            ) : (
              <p className="text-sm text-ink-dim">Đang lưu ván để xem lại…</p>
            )}
            <Button
              variant={offerUndo ? 'outline' : 'primary'}
              className="w-full"
              onClick={onNewGame}
            >
              <Plus size={17} /> Ván mới
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Xem lại bàn cờ
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
