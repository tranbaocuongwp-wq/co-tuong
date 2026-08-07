/**
 * A panel that comes up from the bottom of the screen — or a dialog in the
 * middle of it, depending on how much room there is.
 *
 * Bottom, on a phone held upright, and that is the whole point of replacing the
 * old drawer: a phone is held in one hand and the top third of a large screen
 * cannot be reached with the thumb holding it. Anything the player has to tap
 * belongs in the bottom half.
 *
 * That reasoning stops applying the moment the screen is turned. A bottom sheet
 * capped at 85% of a 375px-tall landscape window is 319px of panel with a menu
 * in it, anchored to the edge the browser's own toolbar also wants — which is
 * how the last row ends up cut off. Past 700px wide the sheet becomes a centred
 * dialog instead: same component, same contents, no thumb-reach argument to
 * honour because at that size the device is not being held in one hand.
 *
 * Built on Radix Dialog so the parts that are easy to get wrong come for free
 * and correct: focus is trapped while it is open and returned when it closes,
 * Escape and the scrim both dismiss it, the page behind stops scrolling, and
 * screen readers are told it is a dialog.
 *
 * Two details for real phones:
 *
 * * The bottom padding clears both the home indicator and whatever browser
 *   toolbar is currently sitting on the bottom of the window — see
 *   `--browser-chrome` in `styles.css`. Without the second part, iOS Safari
 *   hides the last row of the sheet behind its own address bar, and the last
 *   row of a bottom sheet is where the confirm button lives.
 * * `max-h-[85dvh]` with its own scroll, so a long menu scrolls inside the
 *   sheet instead of growing past the top of the screen. `dvh` rather than `vh`
 *   because a mobile browser's toolbar disappears and `vh` does not notice.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

/**
 * The panel's shape, exported because the hint dialog needs the same one.
 *
 * It used to be pasted into both files, and they drifted: the sheet learned to
 * become a centred dialog on a wide screen while the hint panel stayed pinned
 * to the bottom edge, which on an iPad is where its three options ran off the
 * side of the screen. One constant, one behaviour.
 */
export const sheetPanel = [
  'fixed z-50 flex w-full max-w-[560px] flex-col border border-border bg-surface',
  // Upright phone: a sheet on the bottom edge, clearing the home indicator and
  // whatever toolbar the browser is showing.
  'inset-x-0 bottom-0 mx-auto max-h-[85dvh] rounded-t-3xl',
  'pb-[calc(env(safe-area-inset-bottom)+var(--browser-chrome))]',
  'shadow-[0_-8px_40px_rgba(0,0,0,0.35)]',
  // Anything wider — tablet, desktop, or a phone turned sideways: a dialog in
  // the middle, with air on all four sides.
  'min-[700px]:inset-x-auto min-[700px]:top-1/2 min-[700px]:bottom-auto min-[700px]:left-1/2',
  'min-[700px]:max-h-[86dvh] min-[700px]:-translate-x-1/2 min-[700px]:-translate-y-1/2',
  'min-[700px]:rounded-2xl min-[700px]:pb-0',
  'min-[700px]:shadow-[0_20px_60px_rgba(0,0,0,0.45)]',
].join(' ')

/**
 * The other shape: a drawer down the side, full height.
 *
 * The game menu wants this rather than a sheet. It is a long list — moves,
 * captured pieces, readings, links — and a panel that is tall and narrow holds a
 * list without either scrolling it or covering the board, which is the one thing
 * on that screen the player still needs to see while the menu is open.
 *
 * Right-hand side, because that is the side the button that opens it lives on.
 */
export const drawerPanel = [
  'fixed top-0 right-0 bottom-0 z-50 flex w-[min(88vw,380px)] flex-col',
  'border-l border-border bg-surface',
  'pb-[calc(env(safe-area-inset-bottom)+var(--browser-chrome))]',
  'shadow-[-8px_0_40px_rgba(0,0,0,0.35)]',
].join(' ')

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Hidden from view but read out; the sheet still needs a name. */
  description?: string
  children: ReactNode
  className?: string
  /** `bottom` is a sheet (or a centred dialog when wide); `right` is a drawer. */
  side?: 'bottom' | 'right'
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  side = 'bottom',
}: SheetProps) {
  const drawer = side === 'right'
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(drawer ? drawerPanel : sheetPanel, className)}
        >
          {/* The grab handle, and only while it is a sheet — neither a dialog in
              the middle of the screen nor a drawer down the side came up from
              anywhere. */}
          {!drawer && (
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border min-[700px]:hidden" />
          )}

          <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
            <Dialog.Title className="text-base font-semibold">{title}</Dialog.Title>
            <Dialog.Close
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-dim hover:bg-surface-2"
              aria-label="Đóng"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
