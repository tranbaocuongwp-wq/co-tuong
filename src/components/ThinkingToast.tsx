/**
 * What the computer says while it is thinking.
 *
 * A five-second wait needs company, not telemetry. "Nghĩ trước 11 nước · đang
 * cân bằng" is honest and completely uninteresting; a needling line in
 * character makes the same wait feel like sitting across from someone. The
 * search still reports its depth and score — that just drives *which* line is
 * chosen rather than being read out.
 *
 * The line changes every few seconds so a long think does not sit on one
 * sentence, and lines rotate without immediate repeats.
 */

import { useEffect, useRef, useState } from 'react'

import type { Line, Situation } from '../commentary/lines'
import { pickLine } from '../commentary/lines'
import type { SearchInfo } from '../engine/types'

export interface ThinkingToastProps {
  /** Only ever true while the computer owns the turn. */
  visible: boolean
  /** Live search progress. Chooses the mood; never shown as numbers. */
  progress: SearchInfo | null
  /** Overrides the commentary, e.g. while fetching a hint. */
  label?: string
}

/** How long each line stays before the next one. */
const ROTATE_MS = 3600

/** How many recent lines to avoid repeating. */
const MEMORY = 6

/**
 * What the toast murmurs while the search runs.
 *
 * Only two moods, deliberately. The commentator himself now names which colour
 * stands better, out loud and from the board; having the toast say it too would
 * be two voices telling the player the same thing in different words.
 */
function moodOf(progress: SearchInfo | null): Situation {
  if (progress?.mateIn !== null && progress?.mateIn !== undefined && progress.mateIn > 0) {
    return 'foreseeMate'
  }
  return 'thinking'
}

export function ThinkingToast({ visible, progress, label }: ThinkingToastProps) {
  const [line, setLine] = useState<Line | null>(null)
  const recentRef = useRef<string[]>([])
  const mood = moodOf(progress)

  useEffect(() => {
    if (!visible || label) {
      setLine(null)
      return
    }

    const next = () => {
      setLine((current) => {
        const chosen = pickLine(mood, recentRef.current)
        if (!chosen) return current
        recentRef.current = [chosen.id, ...recentRef.current].slice(0, MEMORY)
        return chosen
      })
    }

    next()
    const timer = setInterval(next, ROTATE_MS)
    return () => clearInterval(timer)
    // `mood` is included so a turning position changes what it says mid-think.
  }, [visible, label, mood])

  if (!visible) return null

  return (
    <div className="toast-layer" aria-live="polite">
      <div className="toast toast--busy">
        <span className="toast__glow" aria-hidden="true" />
        <span className="toast__body">
          <span className="toast__dot" aria-hidden="true" />
          <span className="toast__text" key={line?.id ?? label}>
            {label ?? line?.text ?? 'Đang nghĩ…'}
          </span>
        </span>
      </div>
    </div>
  )
}
