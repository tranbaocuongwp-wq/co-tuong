/**
 * Who made this.
 *
 * `rel="noreferrer"` as well as `noopener`: the target is the author's own
 * profile, and there is no reason to tell it which page the visitor came from.
 */

import { ExternalLink } from 'lucide-react'

import { cn } from '../lib/utils'

const PROFILE = 'https://www.facebook.com/share/16CUnqexGim/?mibextid=wwXIfr'

export function Author({ className }: { className?: string }) {
  return (
    <a
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-dim',
        'transition-colors hover:bg-surface-2 hover:text-ink',
        className
      )}
      href={PROFILE}
      target="_blank"
      rel="noopener noreferrer"
    >
      Trần Bảo Cường
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  )
}
