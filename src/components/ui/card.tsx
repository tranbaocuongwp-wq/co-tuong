/**
 * A surface with a border. Deliberately thin.
 *
 * shadcn ships Card with five sub-components; four of them here would only ever
 * wrap a heading in a div with a margin, so this keeps the two that earn their
 * place and lets callers write the rest.
 */

import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-2xl border border-border bg-surface p-4', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('mb-3 flex items-center gap-2 text-sm font-semibold text-ink-dim', className)}
      {...props}
    />
  )
}
