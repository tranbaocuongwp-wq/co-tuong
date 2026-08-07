/**
 * A panel that comes up from the bottom of the screen.
 *
 * Bottom, not side, and that is the whole point of replacing the old drawer:
 * a phone is held in one hand and the top third of a large screen cannot be
 * reached with the thumb holding it. Anything the player has to tap belongs in
 * the bottom half.
 *
 * Built on Radix Dialog so the parts that are easy to get wrong come for free
 * and correct: focus is trapped while it is open and returned when it closes,
 * Escape and the scrim both dismiss it, the page behind stops scrolling, and
 * screen readers are told it is a dialog.
 *
 * Two details for real phones:
 *
 * * `pb-[env(safe-area-inset-bottom)]` keeps the last row clear of the home
 *   indicator, which otherwise sits on top of it.
 * * `max-h-[85dvh]` with its own scroll, so a long menu scrolls inside the
 *   sheet instead of growing past the top of the screen. `dvh` rather than `vh`
 *   because a mobile browser's toolbar disappears and `vh` does not notice.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/utils'

export interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Hidden from view but read out; the sheet still needs a name. */
  description?: string
  children: ReactNode
  className?: string
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-[560px] flex-col',
            'rounded-t-3xl border border-border bg-surface pb-[env(safe-area-inset-bottom)]',
            'shadow-[0_-8px_40px_rgba(0,0,0,0.35)]',
            className
          )}
        >
          {/* The grab handle. Purely a signal that this thing came from the bottom. */}
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />

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
