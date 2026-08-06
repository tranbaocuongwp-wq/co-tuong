/**
 * The handful of icons the interface needs, drawn inline.
 *
 * Inline SVG rather than an icon font or emoji: it inherits `currentColor` so
 * it themes correctly in dark mode, it renders identically on every platform
 * (emoji do not), and it costs no extra download.
 */

import type { ReactNode } from 'react'

export type IconName =
  | 'new'
  | 'undo'
  | 'hint'
  | 'flip'
  | 'resign'
  | 'close'
  | 'menu'
  | 'captured'
  | 'moves'
  | 'engine'

const PATHS: Record<IconName, ReactNode> = {
  // Circular arrow — start again.
  new: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 5v6h-6" />
    </>
  ),
  // Arrow curving back — take the move back.
  undo: (
    <>
      <path d="M4 12h11a4 4 0 0 1 0 8h-3" />
      <path d="M8 8l-4 4 4 4" />
    </>
  ),
  // Lightbulb — a suggestion.
  hint: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
    </>
  ),
  // Two arrows swapping — turn the board around.
  flip: (
    <>
      <path d="M7 4v13" />
      <path d="M4 14l3 3 3-3" />
      <path d="M17 20V7" />
      <path d="M20 10l-3-3-3 3" />
    </>
  ),
  // Flag — concede.
  resign: (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h11l-1.5 3.5L16 12H5" />
    </>
  ),
  close: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  // Cross-swords, for pieces taken.
  captured: (
    <>
      <path d="M4 4l10 10" />
      <path d="M20 4L10 14" />
      <path d="M6 20l3-3" />
      <path d="M18 20l-3-3" />
    </>
  ),
  // Ruled lines — the score sheet.
  moves: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </>
  ),
  // A chip — the computer.
  engine: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 4v3" />
      <path d="M14 4v3" />
      <path d="M10 17v3" />
      <path d="M14 17v3" />
      <path d="M4 10h3" />
      <path d="M4 14h3" />
      <path d="M17 10h3" />
      <path d="M17 14h3" />
    </>
  ),
}

export interface IconProps {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18 }: IconProps) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
