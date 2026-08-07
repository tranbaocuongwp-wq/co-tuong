/**
 * Managing the offline voice pack, rather than just starting it.
 *
 * The settings page used to show one button, "Tải về máy", and nothing else. So
 * after tapping it there was no way to learn the only things anyone wants to
 * know: how much is on the device, how far along it got, and whether the thing
 * that stopped it was a bad connection or simply that some lines have no
 * recording yet. A download with no dial is a download you have to take on
 * faith, and on a phone people do not.
 *
 * Four states, and the buttons say which one you are in:
 *
 * * **idle** — a bar showing what is already held, and Tải/Tải tiếp.
 * * **running** — live percentage, and Tạm dừng.
 * * **paused** — where it stopped, and Tiếp tục.
 * * **offline** — it stopped itself after too many failed requests, says so in
 *   those words, and offers to carry on when the signal is back.
 *
 * Pausing and resuming needs no bookkeeping: what is fetched is in the cache
 * and the job skips what is cached, so "Tiếp tục" is the same call as "Tải".
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CircleCheck, CloudOff, Download, Pause, Play, Trash2, TriangleAlert } from 'lucide-react'

import {
  clearVoicePack,
  downloadVoicePack,
  packStatus,
  type PackProgress,
  type PackStatus,
} from '../audio/pack'
import { Button } from './ui/button'
import { Card, CardTitle } from './ui/card'

type Phase = 'idle' | 'running' | 'paused' | 'offline' | 'done'

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function VoicePack() {
  const [status, setStatus] = useState<PackStatus | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState<PackProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const refresh = useCallback(async () => {
    setStatus(await packStatus())
  }, [])

  useEffect(() => {
    void refresh()
    // Abort any download in flight if the page is left mid-way.
    return () => abortRef.current?.abort()
  }, [refresh])

  const run = useCallback(async () => {
    setError(null)
    setPhase('running')
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await downloadVoicePack(setProgress, controller.signal)
      setProgress(result)
      setPhase(result.stopped === 'done' ? 'done' : result.stopped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được.')
      setPhase('idle')
    } finally {
      abortRef.current = null
      void refresh()
    }
  }, [refresh])

  const pause = useCallback(() => {
    abortRef.current?.abort()
    setPhase('paused')
  }, [])

  const wipe = useCallback(async () => {
    await clearVoicePack()
    setProgress(null)
    setPhase('idle')
    await refresh()
  }, [refresh])

  /*
   * The bar always means "how much is on this device".
   *
   * It used to follow the running job instead, and the job counts lines it has
   * *decided about* — including the ones the Worker answered for with no
   * recording. So a run that gave up on a bad line reset the bar to 0/644 while
   * the device still held everything downloaded so far, which reads as "I just
   * lost my download" and is the opposite of true.
   *
   * Mid-run the count is the stored figure plus whatever this run has actually
   * fetched, which is exact and costs nothing; re-reading six hundred cache
   * entries on every progress tick would not be.
   */
  const total = status?.total ?? progress?.total ?? 0
  const held = (status?.have ?? 0) + (phase === 'running' ? (progress?.fetched ?? 0) : 0)
  const percent = total > 0 ? Math.round((held / total) * 100) : 0

  return (
    <Card>
      <CardTitle>
        <Download size={15} /> Tiếng nói ngoại tuyến
      </CardTitle>

      {status === null && phase === 'idle' && (
        <p className="mb-3 text-sm text-ink-dim">
          Chưa hỏi được máy chủ. Ván cờ vẫn chạy bình thường, chỉ là chưa biết đã tải bao nhiêu.
        </p>
      )}

      {total > 0 && (
        <>
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold tabular-nums">{percent}%</span>
            <span className="text-ink-dim tabular-nums">
              {held}/{total} câu
              {status && status.bytes > 0 ? ` · ${megabytes(status.bytes)}` : ''}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-300"
              style={{ transform: `scaleX(${percent / 100})` }}
            />
          </div>
        </>
      )}

      <p className="mt-2 mb-3 flex items-start gap-1.5 text-sm text-ink-dim">
        {phase === 'offline' && (
          <>
            <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Mạng yếu nên đã tạm dừng. Bấm Tiếp tục khi có sóng lại — không mất phần đã tải.</span>
          </>
        )}
        {phase === 'paused' && (
          <>
            <Pause size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Đã tạm dừng. Tải tiếp thì chạy từ chỗ đang dở.</span>
          </>
        )}
        {phase === 'done' && progress && progress.missing > 0 && (
          <>
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Xong phần có sẵn. Còn {progress.missing} câu chưa được thu, những câu ấy sẽ hiện
              chữ thay vì đọc.
            </span>
          </>
        )}
        {phase === 'done' && progress && progress.missing === 0 && (
          <>
            <CircleCheck size={15} className="mt-0.5 shrink-0 text-ok" aria-hidden="true" />
            <span>Đủ cả. Nghe được cả khi không có mạng.</span>
          </>
        )}
        {phase === 'running' && (
          <span>
            Đang tải… đã xét {progress?.done ?? 0}/{total} câu. Giữ màn hình mở cho tới khi xong.
          </span>
        )}
        {phase === 'idle' && total > 0 && (
          <span>
            {held === 0
              ? 'Tải sẵn lời bình để nghe được khi mất mạng. Chỉ tải một lần.'
              : 'Tải tiếp những câu còn thiếu.'}
          </span>
        )}
      </p>

      {error && <p className="mb-3 text-sm text-[color:var(--danger,#b3261e)]">{error}</p>}

      <div className="grid gap-2">
        {phase === 'running' ? (
          <Button className="w-full" onClick={pause}>
            <Pause size={17} /> Tạm dừng
          </Button>
        ) : (
          <Button variant="primary" className="w-full" onClick={() => void run()}>
            {phase === 'paused' || phase === 'offline' ? (
              <>
                <Play size={17} /> Tiếp tục
              </>
            ) : (
              <>
                <Download size={17} /> {held > 0 ? 'Tải tiếp' : 'Tải về máy'}
              </>
            )}
          </Button>
        )}

        {held > 0 && phase !== 'running' && (
          <Button variant="danger" className="w-full" onClick={() => void wipe()}>
            <Trash2 size={17} /> Xoá gói · {status ? megabytes(status.bytes) : ''}
          </Button>
        )}
      </div>
    </Card>
  )
}
