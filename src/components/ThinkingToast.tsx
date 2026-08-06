/**
 * The engine's "thinking…" indicator.
 *
 * A single floating pill rather than a panel: while the engine works the player
 * is looking at the board, and a five-second wait needs reassurance more than
 * telemetry. It appears only on the engine's turn and disappears the moment the
 * move lands.
 *
 * The depth does climb inside the pill though, because a spinner alone cannot
 * distinguish "working" from "hung" — a search that has reached depth 12 is
 * visibly getting somewhere.
 */

import type { SearchInfo } from '../engine/types'

export interface ThinkingToastProps {
  /** Only ever true while the engine owns the turn. */
  visible: boolean
  /** Live progress, refreshed once per completed iteration. May be null. */
  progress: SearchInfo | null
  /** Shown instead of search progress, e.g. while fetching a hint. */
  label?: string
}

export function ThinkingToast({ visible, progress, label }: ThinkingToastProps) {
  if (!visible) return null

  return (
    <div className="toast-layer" aria-live="polite">
      <div className="toast toast--busy">
        <span className="toast__glow" aria-hidden="true" />
        <span className="toast__body">
          <span className="toast__text">
            {label ?? 'Đang nghĩ'}
            <span className="toast__dots" aria-hidden="true" />
          </span>
          {!label && progress && (
            <span className="toast__meta">
              {progress.fromBook ? 'sách khai cuộc' : detail(progress)}
            </span>
          )}
        </span>
      </div>
    </div>
  )
}

function detail(info: SearchInfo): string {
  if (info.mateIn !== null && info.mateIn !== undefined) {
    const moves = Math.ceil(Math.abs(info.mateIn) / 2)
    return info.mateIn > 0 ? `thấy chiếu hết sau ${moves} nước` : `bị chiếu hết sau ${moves} nước`
  }
  const pawns = info.score / 100
  const sign = pawns >= 0 ? '+' : ''
  return `nhìn trước ${info.depth} nước · ${sign}${pawns.toFixed(1)}`
}
