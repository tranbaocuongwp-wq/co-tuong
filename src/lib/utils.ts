/**
 * Merging class strings, the shadcn way.
 *
 * `clsx` handles the conditionals; `tailwind-merge` handles the part people get
 * wrong — when a component's own classes and a caller's `className` both set
 * the same thing, the later one should win, and plain concatenation leaves that
 * to CSS source order, which is not what anybody means.
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
