/**
 * Three moves worth considering, and why.
 *
 * The old hint handed over one move and said nothing. That tells a player what
 * to do and teaches them nothing — and when they are losing, it quietly implies
 * a rescue exists. Three options with reasons let them compare, which is the
 * only part of a hint anyone learns from.
 *
 * Nothing here computes anything. Every reason shown is something the engine
 * reported about the actual position: what the move takes, whether it checks,
 * what it would then be threatening, and what it expects in reply.
 *
 * ## Look before you leap
 *
 * Tapping an option used to play it straight away, which made the list a menu
 * of decisions rather than a set of ideas. Now the first tap *shows* it: the
 * sheet drops out of the way, an arrow appears on the board, and the squares
 * that move would put under pressure light up. Playing it is a second,
 * deliberate tap. That is the whole point of offering three — you cannot
 * compare things you cannot look at.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { Check, Crosshair, Eye, Lightbulb, Shield, Swords, X } from 'lucide-react'

import type { HintInfo, PieceKind } from '../engine/types'
import { cn } from '../lib/utils'
import { sheetPanel } from './ui/sheet'
import { PIECE_NAME } from './PieceIcon'
import { Button } from './ui/button'

export interface HintDialogProps {
  open: boolean
  busy: boolean
  choices: HintInfo[]
  /** The option currently being shown on the board, if any. */
  previewing: string | null
  /** Show this option on the board. */
  onPreview: (iccs: string | null) => void
  /** Commit to it. */
  onPick: (iccs: string) => void
  onClose: () => void
}

/**
 * Centipawns past which the position is lost whatever is played.
 *
 * A hint that offers three moves in a hopeless position is dishonest by
 * omission: they are not three chances, they are three ways to lose. Saying so
 * is more use than pretending otherwise.
 */
const HOPELESS = -900

/** Roughly a piece down; worth warning about without calling the game over. */
const LOSING = -300

/** Why this move, as icon plus phrase. Each one is something the engine reported. */
function reasons(choice: HintInfo) {
  const out: { icon: typeof Swords; text: string }[] = []
  if (choice.captured) out.push({ icon: Swords, text: `Ăn ${PIECE_NAME[choice.captured]}` })
  if (choice.givesCheck) out.push({ icon: Crosshair, text: 'Chiếu tướng' })
  if (choice.threats.length > 0) {
    out.push({ icon: Eye, text: `Doạ ${PIECE_NAME[choice.threats[0] as PieceKind]}` })
  }
  if (out.length === 0) out.push({ icon: Shield, text: 'Giữ thế, không hở sườn' })
  return out
}

/** The assessment in words. A number of centipawns means nothing to a player. */
function verdict(score: number): string {
  if (score >= 600) return 'Thắng rõ'
  if (score >= 200) return 'Hơn quân'
  if (score >= 60) return 'Nhỉnh hơn'
  if (score > -60) return 'Cân bằng'
  if (score > LOSING) return 'Hơi kém'
  if (score > HOPELESS) return 'Đang thua'
  return 'Rất khó'
}

export function HintDialog({
  open,
  busy,
  choices,
  previewing,
  onPreview,
  onPick,
  onClose,
}: HintDialogProps) {
  const best = choices[0]
  const hopeless = !busy && choices.length > 0 && best.score <= HOPELESS

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        {/*
          While an option is being shown, the scrim fades out and stops taking
          taps, and the panel drops until only the chosen row is left. Closing
          outright would lose the comparison; staying put would hide the very
          thing it is asking the player to look at.
        */}
        <Dialog.Overlay
          className={cn(
            'fixed inset-0 z-50 bg-black/50 transition-opacity duration-200',
            previewing && 'pointer-events-none opacity-0'
          )}
        />
        <Dialog.Content
          className={cn(
            sheetPanel,
            'transition-transform duration-200',
            // Getting out of the way while a move is previewed, in whichever
            // form the panel currently has: the sheet slides down until only its
            // header shows, and the dialog drops out of the centre to sit on the
            // bottom edge at the same height. Sliding a centred dialog by its own
            // height would have left it half off the screen, because its resting
            // position is already a translate.
            previewing && 'translate-y-[calc(100%-11rem)]',
            previewing &&
              'min-[700px]:top-auto min-[700px]:bottom-4 min-[700px]:max-h-44 min-[700px]:translate-y-0'
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border min-[700px]:hidden" />

          <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
              <Lightbulb size={17} /> Nên đi nước nào
            </Dialog.Title>
            <Dialog.Close
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-dim hover:bg-surface-2"
              aria-label="Đóng"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Ba nước đáng cân nhắc, kèm lý do
          </Dialog.Description>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-4">
            {busy && <p className="py-6 text-center text-sm text-ink-dim">Đang cân nhắc…</p>}

            {!busy && choices.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-dim">Không còn nước nào để đi.</p>
            )}

            {hopeless && (
              <p className="mb-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
                Thế cờ đã bế tắc. Mấy nước dưới đây là đỡ nhất, chứ không gỡ được.
              </p>
            )}

            {!busy && choices.length > 0 && (
              <p className="mb-2 text-xs text-ink-dim">Chạm để xem trước · chạm lần nữa để đi</p>
            )}

            <div className="flex flex-col gap-2">
              {!busy &&
                choices.map((choice, i) => {
                  const shown = previewing === choice.iccs
                  return (
                    <div
                      key={choice.iccs}
                      className={cn(
                        'overflow-hidden rounded-2xl border transition-colors',
                        shown
                          ? 'border-ok bg-ok/10'
                          : i === 0
                            ? 'border-accent/50 bg-surface'
                            : 'border-border bg-surface'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onPreview(shown ? null : choice.iccs)}
                        aria-pressed={shown}
                        className="flex w-full cursor-pointer items-center gap-3 p-3 text-left"
                      >
                        <span
                          className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold',
                            shown
                              ? 'bg-ok text-white'
                              : i === 0
                                ? 'bg-accent text-white'
                                : 'bg-surface-2 text-ink-dim'
                          )}
                        >
                          {shown ? <Check size={17} /> : i + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{choice.text}</span>
                          <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-dim">
                            {reasons(choice).map(({ icon: ReasonIcon, text }) => (
                              <span key={text} className="inline-flex items-center gap-1">
                                <ReasonIcon size={12} /> {text}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-ink-dim">
                          {verdict(choice.score)}
                        </span>
                      </button>

                      {shown && (
                        <div className="px-3 pb-3">
                          <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => onPick(choice.iccs)}
                          >
                            Đi nước này
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
