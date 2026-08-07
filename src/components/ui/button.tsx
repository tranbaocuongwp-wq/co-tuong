/**
 * The button, in the shadcn idiom: variants as data, styling by utility.
 *
 * Written into the repo rather than pulled from a package, which is how shadcn
 * is meant to be used — the component is yours, so the variants below are the
 * ones this app actually needs rather than a generic set with three that never
 * get used.
 *
 * Sizes are set with a mobile thumb in mind. `default` is 44px tall, which is
 * the smallest target Apple and Google both consider reliably tappable; `lg` is
 * the full-width commit button at the bottom of a screen.
 */

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap ' +
    'transition-colors select-none cursor-pointer ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
    'disabled:pointer-events-none disabled:opacity-45 ' +
    '[&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-white hover:brightness-110 active:brightness-95',
        outline: 'border border-border bg-surface text-ink hover:bg-surface-2',
        ghost: 'text-ink hover:bg-surface-2',
        danger: 'border border-border bg-surface text-[color:var(--danger,#b3261e)] hover:bg-surface-2',
      },
      size: {
        default: 'h-11 px-4 text-[0.95rem]',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-14 px-6 text-base font-semibold',
        icon: 'h-11 w-11 p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Render as the child element — for wrapping a router `<Link>`. */
  asChild?: boolean
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(button({ variant, size }), className)} {...props} />
}

export { button as buttonVariants }
