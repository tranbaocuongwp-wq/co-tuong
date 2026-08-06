/**
 * The update prompt.
 *
 * Applies itself only when doing so costs nothing: between games, or when it is
 * the player's turn and nothing is being computed. Mid-move it waits and offers
 * a button instead — reloading the page out from under someone mid-game is
 * exactly the behaviour that makes people distrust auto-update.
 */

import { useEffect, useState } from 'react'

import type { UpdateKind } from '../update'

export interface UpdateNoticeProps {
  available: boolean
  kind: UpdateKind
  /** True when reloading now would not interrupt anything. */
  safeToApply: boolean
  /** False once this tab has already reloaded once for an update. */
  canAutoApply: boolean
  onApply: () => void
}

/** Grace period before applying, so the notice is readable first. */
const AUTO_DELAY_MS = 2500

export function UpdateNotice({
  available,
  kind,
  safeToApply,
  canAutoApply,
  onApply,
}: UpdateNoticeProps) {
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!available || !safeToApply || !canAutoApply) return
    setApplying(true)
    const timer = setTimeout(onApply, AUTO_DELAY_MS)
    return () => {
      clearTimeout(timer)
      setApplying(false)
    }
  }, [available, safeToApply, canAutoApply, onApply])

  if (!available) return null

  // Plain words only: "engine core" and "bundle" mean nothing to a player.
  const what = kind === 'core' ? 'Máy chơi cờ có bản mới' : 'Có bản mới'

  return (
    <div className="update" role="status">
      <span className="update__dot" aria-hidden="true" />
      <span className="update__text">
        {applying ? <>Đang cập nhật… ván của bạn đã được lưu.</> : <>{what}.</>}
      </span>
      <button type="button" className="btn btn--primary update__btn" onClick={onApply}>
        Cập nhật
      </button>
    </div>
  )
}
