/**
 * The first launch, with something to look at.
 *
 * Until now the entire loading experience was one line of grey text on the play
 * screen — "Đang tải engine…" — and it only appeared *after* the player had
 * already tapped Start, because nothing asked for the 210 KB engine binary until
 * the board mounted. On a slow connection that is a blank screen for ten seconds
 * with no indication that anything is happening, which reads as a broken app
 * rather than a downloading one.
 *
 * So: check what is already here, and show a real bar for what is not.
 *
 * Three decisions worth keeping:
 *
 * * **It waits on the engine and nothing else.** Sound effects and banners are
 *   in the manifest too, and they are fetched quietly afterwards. Nobody should
 *   sit through a download of piece-capture noises before they can play chess.
 * * **It renders nothing at all when everything is present**, which is every
 *   launch after the first. The check costs one manifest fetch and a handful of
 *   `cache.match` calls, all of which resolve locally.
 * * **A failure is not fatal.** If the manifest cannot be reached, or the cache
 *   API is missing, it steps out of the way — the app then behaves exactly as it
 *   did before this file existed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudOff, Download } from 'lucide-react'

import { assetStatus, ensureAssets, type AssetProgress } from '../assets/manager'
import { Button } from './ui/button'

type Phase = 'checking' | 'ready' | 'running' | 'offline'

function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FirstRun({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('checking')
  const [progress, setProgress] = useState<AssetProgress | null>(null)
  const [need, setNeed] = useState(0)
  const abort = useRef<AbortController | null>(null)

  const prepare = useCallback(async () => {
    setPhase('running')
    const controller = new AbortController()
    abort.current = controller
    try {
      const result = await ensureAssets(['shell', 'engine'], setProgress, controller.signal)
      setPhase(result.stopped === 'offline' ? 'offline' : 'ready')
      // The rest is optional and nobody waits for it. No signal, no progress,
      // no error handling — if it fails the game falls back to synthesised
      // sound and simply omits a picture.
      if (result.stopped === 'done') void ensureAssets(['media']).catch(() => undefined)
    } catch {
      // No manifest, or no Cache Storage. Carry on; the browser will fetch
      // things the ordinary way.
      setPhase('ready')
    } finally {
      abort.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const status = await assetStatus(['shell', 'engine'])
      if (cancelled) return
      // Nothing to do, which is the normal case from the second launch onward.
      if (!status || status.have >= status.total) {
        setPhase('ready')
        if (status) void ensureAssets(['media']).catch(() => undefined)
        return
      }
      setNeed(status.totalBytes - status.bytes)
      void prepare()
    })()
    return () => {
      cancelled = true
      abort.current?.abort()
    }
  }, [prepare])

  if (phase === 'ready') return <>{children}</>

  const percent =
    progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="grid min-h-[100dvh] place-items-center p-6">
      <div className="w-full max-w-sm text-center">
        <span
          className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-accent text-3xl text-white"
          aria-hidden="true"
        >
          帥
        </span>
        <h1 className="mb-1 text-xl font-bold">Đệ Nhất Cờ Tướng</h1>

        {phase === 'offline' ? (
          <>
            <p className="mt-3 mb-4 flex items-start justify-center gap-1.5 text-sm text-ink-dim">
              <CloudOff size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>Mạng yếu nên chưa tải xong. Phần đã tải vẫn còn.</span>
            </p>
            <Button variant="primary" className="w-full" onClick={() => void prepare()}>
              <Download size={17} /> Thử lại
            </Button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-dim">
              Đang chuẩn bị lần đầu{need > 0 ? ` · ${megabytes(need)}` : ''}. Lần sau mở là
              chơi ngay, kể cả khi mất mạng.
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full w-full origin-left rounded-full bg-accent transition-transform duration-300"
                style={{ transform: `scaleX(${percent / 100})` }}
              />
            </div>
            <p className="mt-2 text-sm text-ink-dim tabular-nums">
              {progress ? `${progress.done}/${progress.total} tệp` : 'Đang kiểm tra…'}
            </p>
          </>
        )}
      </div>
    </div>
  )
}
