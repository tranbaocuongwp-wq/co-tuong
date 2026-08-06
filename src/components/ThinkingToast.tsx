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
/**
 * The opponent muttering to itself while it thinks.
 *
 * Written in its own voice rather than as a status line, because that is what
 * the pill actually is: the player is watching someone opposite them decide,
 * and "Đang tính…" tells them nothing they had not already worked out from the
 * fact that nothing has moved.
 *
 * These are display-only, never spoken, so there is no recording cost and the
 * pool can be as wide as it likes. The commentator has his own voice and says
 * different kinds of things; this one is the opponent, and the opponent is
 * allowed to be gruff.
 */
const MUTTERS = {
  neutral: [
    'Có nên ăn con đó không nhỉ…',
    'Hừm. Nước này không đơn giản.',
    'Để xem… ba đường, đường nào cũng gai.',
    'Đi thế này thì hắn phản đòn mất…',
    'Chậc. Khó đây.',
    'Con Xe kia đứng chướng mắt thật.',
    'Nếu ta ăn thì hắn chiếu. Nếu không ăn thì hắn cũng chiếu.',
    'Cứ từ từ… vội là hỏng.',
    'Thế cờ này quen quen…',
    'Đi đâu bây giờ…',
    'Ừ thì… cũng được. Mà chưa chắc.',
    'Hắn định gì đây?',
  ],
  ahead: [
    'Được rồi. Cứ thế mà siết.',
    'Chỉ cần không hớ là xong.',
    'Còn mỗi việc kết thúc cho gọn.',
    'Đừng tham. Đi chắc thôi.',
    'Hắn hết bài rồi thì phải.',
  ],
  behind: [
    'Rắc rối rồi đây…',
    'Phải tìm cái gì đó, không thì thua.',
    'Hừ. Nước vừa rồi ta hớ.',
    'Còn một chỗ rối… hy vọng hắn không thấy.',
    'Thôi, liều vậy.',
  ],
  mate: ['Xong. Thấy đường rồi.', 'Ba nước nữa là hết chuyện.', 'Không cần tính thêm.'],
  trapped: ['Chết thật…', 'Đường nào cũng chết.', 'Đỡ được nước này thì đỡ, mà đỡ kiểu gì…'],
}

/** How often the mutter changes while a long think runs. */
function muttersFor(progress: SearchInfo | null): string[] {
  if (!progress) return MUTTERS.neutral
  if (progress.mateIn !== null && progress.mateIn !== undefined) {
    return progress.mateIn > 0 ? MUTTERS.mate : MUTTERS.trapped
  }
  if (progress.score > 250) return MUTTERS.ahead
  if (progress.score < -250) return MUTTERS.behind
  return MUTTERS.neutral
}

export function ThinkingToast({ visible, progress, label }: ThinkingToastProps) {
  const [line, setLine] = useState<{ id: string; text: string } | null>(null)
  const recentRef = useRef<string[]>([])
  /*
   * The search keeps reporting while a think runs, and re-running the effect on
   * every report would restart the timer and stop the line ever changing. A ref
   * lets the mood follow the search without the effect depending on it.
   */
  const progressRef = useRef(progress)
  progressRef.current = progress

  useEffect(() => {
    if (!visible || label) {
      setLine(null)
      return
    }

    const next = () => {
      setLine((current) => {
        const pool = muttersFor(progressRef.current)
        const fresh = pool.filter((m) => !recentRef.current.includes(m))
        const from = fresh.length > 0 ? fresh : pool
        const chosen = from[Math.floor(Math.random() * from.length)]
        if (!chosen) return current
        recentRef.current = [chosen, ...recentRef.current].slice(0, MEMORY)
        return { id: chosen, text: chosen }
      })
    }

    next()
    const timer = setInterval(next, ROTATE_MS)
    return () => clearInterval(timer)
  }, [visible, label])

  if (!visible) return null

  return (
    <div className="toast-layer" aria-live="polite">
      <div className="toast toast--busy">
        <span className="toast__glow" aria-hidden="true" />
        <span className="toast__body">
          <span className="toast__dot" aria-hidden="true" />
          <span className="toast__text" key={line?.id ?? label}>
            {label ?? line?.text ?? 'Hừm…'}
          </span>
        </span>
      </div>
    </div>
  )
}
