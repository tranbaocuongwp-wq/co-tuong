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
  /** The move being drawn on the board, when one is. */
  const preview = previewing ? choices.find((c) => c.iccs === previewing) : undefined

  return (
    /*
     * Not modal while a move is being previewed, and that is a bug fix.
     *
     * Previewing deliberately keeps this dialog open and slides it down until
     * only its header shows, so the player can see the move drawn on the board.
     * The board is visible, the panel is out of the way, and the screen looks
     * entirely usable — but Radix, being a good modal, had put
     * `pointer-events: none` on the body. Every control outside this dialog was
     * dead: the navigation, the menu, the hint button itself. Measured on the
     * play screen, tapping any of the bottom-bar destinations did nothing at all.
     *
     * `modal={false}` releases the body and stops trapping focus, which is
     * exactly right for a panel whose whole purpose at that moment is to let you
     * interact with what is behind it.
     */
    <Dialog.Root
      open={open}
      modal={!previewing}
      onOpenChange={(next) => !next && onClose()}
    >
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
          /*
           * Previewing shrinks the panel rather than sliding it away.
           *
           * Sliding was the first attempt and it does not work: the panel is
           * 85% of the screen tall, so translating it down leaves a box that
           * still extends past the bottom edge — and the bottom bar sits inside
           * that box. Measured on a 375x812 phone, the panel occupied
           * y=580..970 with the navigation at 757, so every tap on a
           * destination landed on the panel instead. Offsetting it by the bar's
           * height moved the box without making it any shorter.
           *
           * Clamping the height was the second attempt and it looked broken:
           * `max-h-44` cut the option list mid-row, leaving half a line of text
           * with a band of white under it. A height that does not match its
           * contents always shows.
           *
           * So previewing changes the *contents* instead. The list becomes the
           * one move being previewed, and the panel is whatever height that
           * needs — see the `previewing` branch in the body below. Nothing is
           * clipped because nothing is being hidden.
           *
           * The comment lives out here rather than inside `cn()` because the
           * build's class checker reads every string in that call as a class
           * name, and a sentence makes fourteen of them.
           */
          className={cn(
            sheetPanel,
            'transition-transform duration-200',
            // Getting out of the way while a move is previewed, in whichever
            // form the panel currently has: the sheet slides down until only its
            // header shows, and the dialog drops out of the centre to sit on the
            // bottom edge at the same height. Sliding a centred dialog by its own
            // height would have left it half off the screen, because its resting
            // position is already a translate.
            previewing && 'translate-y-0 bottom-14',
            previewing &&
              'min-[700px]:top-auto min-[700px]:bottom-4 min-[700px]:translate-y-0'
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border min-[700px]:hidden" />

          <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
            <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
              <Lightbulb size={17} /> {previewing ? 'Đang xem trước' : 'Nên đi nước nào'}
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
            {/*
              Previewing shows one move, not a truncated list.
              
              The point of previewing is the board, so the panel shrinks to the
              least it can say and still be useful: which move is drawn up there,
              why, and the two things to do about it. Everything else would only
              be covering the position the player is trying to look at.
            */}
            {previewing && preview && (
              <div className="flex flex-col gap-2">
                <div className="rounded-2xl border border-ok bg-ok/10 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ok text-white">
                      <Check size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{preview.text}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-dim">
                        {reasons(preview).map(({ icon: ReasonIcon, text }) => (
                          <span key={text} className="inline-flex items-center gap-1">
                            <ReasonIcon size={12} /> {text}
                          </span>
                        ))}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-dim">{verdict(preview.score)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => onPreview(null)}>Xem phương án khác</Button>
                  <Button variant="primary" onClick={() => onPick(preview.iccs)}>
                    Đi nước này
                  </Button>
                </div>
              </div>
            )}

            {busy && <p className="py-6 text-center text-sm text-ink-dim">Đang cân nhắc…</p>}

            {!previewing && !busy && choices.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-dim">Không còn nước nào để đi.</p>
            )}

            {!previewing && hopeless && (
              <p className="mb-3 rounded-xl border border-border bg-surface-2 p-3 text-sm">
                Thế cờ đã bế tắc. Mấy nước dưới đây là đỡ nhất, chứ không gỡ được.
              </p>
            )}

            {!previewing && !busy && choices.length > 0 && (
              <p className="mb-2 text-xs text-ink-dim">Chạm để xem trước · chạm lần nữa để đi</p>
            )}

            <div className="flex flex-col gap-2">
              {!previewing &&
                !busy &&
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
