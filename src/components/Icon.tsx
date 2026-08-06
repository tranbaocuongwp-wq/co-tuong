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
  | 'first'
  | 'prev'
  | 'play'
  | 'pause'
  | 'next'
  | 'last'
  | 'trophy'
  | 'user'
  | 'history'
  | 'settings'
  | 'info'
  | 'board'
  | 'people'
  | 'trash'
  | 'download'
  | 'upload'
  | 'speaker'
  | 'speakerOff'

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
  // Transport controls for replaying a game.
  first: (
    <>
      <path d="M18 6L9 12l9 6V6Z" />
      <path d="M6 5v14" />
    </>
  ),
  prev: <path d="M16 5L7 12l9 7V5Z" />,
  play: <path d="M7 4l13 8-13 8V4Z" />,
  pause: (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),
  next: <path d="M8 5l9 7-9 7V5Z" />,
  last: (
    <>
      <path d="M6 6l9 6-9 6V6Z" />
      <path d="M18 5v14" />
    </>
  ),
  // A cup — the leaderboard.
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5v1a3 3 0 0 0 3 3" />
      <path d="M16 6h3v1a3 3 0 0 1-3 3" />
      <path d="M12 13v4" />
      <path d="M9 20h6" />
      <path d="M10 17h4v3h-4z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  // A clock turning back — past games.
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.6v.6" />
    </>
  ),
  // The board itself — playing against the computer.
  board: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" />
      <path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17" />
    </>
  ),
  // Two figures — two players sharing a device.
  people: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M2.5 19a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3 3 0 0 1 0 5.6" />
      <path d="M17 14.2a6 6 0 0 1 4.5 4.8" />
    </>
  ),
  speaker: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="M15.5 9.2a4 4 0 0 1 0 5.6" />
      <path d="M18 6.8a7.5 7.5 0 0 1 0 10.4" />
    </>
  ),
  speakerOff: (
    <>
      <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5Z" />
      <path d="M16 10l4 4M20 10l-4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 19h16" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4" />
      <path d="M8 8l4-4 4 4" />
      <path d="M4 19h16" />
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
