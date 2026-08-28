/**
 * Who made this.
 *
 * ## Why it points at Umini rather than at Facebook
 *
 * It used to open a Facebook profile, which answered "who is this person" with
 * a wall of posts about something else. The app is published under Umini
 * alongside three others, and `umini.app/tac-gia` is the page that actually
 * answers the question a player is asking when they tap a name at the bottom of
 * a chess app: who wrote this, and why. It also carries the ways to reach them,
 * Facebook included — so nothing is lost by not going straight there.
 *
 * `rel="noreferrer"` as well as `noopener`: the destination is the author's own
 * page, and there is no reason to tell it which screen the visitor came from.
 *
 * It lives under `site/` rather than `components/` because that is the only
 * half of the product that signs its name: the board has no byline on it, and
 * a shared component nobody shares is just a file in the wrong folder.
 */

import { ExternalLink } from 'lucide-react'

import { cn } from '../lib/utils'
import { UMINI } from './copy'

export function Author({ className }: { className?: string }) {
  return (
    <a
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-ink-dim',
        'transition-colors hover:bg-surface-2 hover:text-ink',
        className
      )}
      href={UMINI.author}
      target="_blank"
      rel="noopener noreferrer"
    >
      Trần Bảo Cường
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  )
}
