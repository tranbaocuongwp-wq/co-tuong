/**
 * Which build is running, and whether it is the newest one.
 *
 * The first version of this laid out five labelled rows, one of which was the
 * full hashed filename of the .wasm — `co_tuong_engine_wasm_bg-BuJ8vpnn.wasm`,
 * long enough to wrap onto two lines on a phone. Every one of those facts is
 * real and occasionally useful, but showing them all at once answers a question
 * nobody asked. The question is "am I up to date", and it has a one-word answer.
 *
 * So the card is now that answer, the release number, and a button. Everything
 * else is behind a summary the curious can open — and the .wasm is identified by
 * its hash alone, because the rest of that filename is the same for everyone and
 * carries no information.
 *
 * It still degrades honestly offline: the running identities are local facts, so
 * they are always there, and the comparison says it could not reach the server
 * rather than guessing.
 */

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Download } from 'lucide-react'

import { fetchManifest, platform, runningVersion, type VersionManifest } from '../update'
import { Button } from './ui/button'
import { Card } from './ui/card'

export interface VersionPanelProps {
  /** The release number, from the engine. */
  release: string
}

const PLATFORM_LABEL: Record<ReturnType<typeof platform>, string> = {
  desktop: 'Ứng dụng máy tính',
  pwa: 'Ứng dụng đã cài',
  browser: 'Trình duyệt',
}

/** "14:22 · 07/08" — a build time nobody has to decode. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())} · ${two(d.getDate())}/${two(d.getMonth() + 1)}`
}

/**
 * The hash out of `co_tuong_engine_wasm_bg-BuJ8vpnn.wasm`. The rest is constant.
 *
 * Non-greedy from the first dash. `^.*-` runs to the *last* one, and Vite's
 * hashes can contain a dash themselves — so it was quietly showing half of it.
 */
function short(name: string): string {
  return name.replace(/^[^-]*-/, '').replace(/\.\w+$/, '') || name
}

type Check = 'idle' | 'checking' | 'offline' | 'fresh' | 'stale'

const SAYS: Record<Check, string> = {
  idle: '',
  checking: 'Đang kiểm tra…',
  offline: 'Không hỏi được máy chủ.',
  fresh: 'Đang là bản mới nhất.',
  stale: 'Có bản mới hơn.',
}

export function VersionPanel({ release }: VersionPanelProps) {
  const here = runningVersion()
  const where = platform()

  const [server, setServer] = useState<VersionManifest | null>(null)
  const [check, setCheck] = useState<Check>('idle')

  const compare = useCallback(async () => {
    setCheck('checking')
    const manifest = await fetchManifest()
    if (!manifest) {
      setServer(null)
      setCheck('offline')
      return
    }
    setServer(manifest)
    const same = manifest.app === here.app && manifest.core === here.core
    setCheck(same ? 'fresh' : 'stale')
  }, [here.app, here.core])

  // Check once on arrival. Someone opening this page is asking the question.
  useEffect(() => {
    void compare()
  }, [compare])

  const stale = check === 'stale'

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <strong className="block leading-tight">Phiên bản {release}</strong>
          <span className={stale ? 'text-sm text-accent' : 'text-sm text-ink-dim'}>
            {SAYS[check]}
          </span>
        </div>
        {stale ? (
          <Button
            variant="primary"
            size="sm"
            // A plain reload is the whole update: every asset carries a content
            // hash, so nothing stale can survive one.
            onClick={() => window.location.reload()}
          >
            <Download size={16} /> Cập nhật
          </Button>
        ) : (
          <Button size="sm" onClick={() => void compare()} aria-label="Kiểm tra lại">
            <RefreshCw size={16} />
          </Button>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-ink-dim">Chi tiết bản dựng</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-dim">Giao diện</dt>
          <dd className="text-right font-mono">{here.app}</dd>
          <dt className="text-ink-dim">Lõi cờ</dt>
          <dd className="text-right font-mono">{short(here.core)}</dd>
          <dt className="text-ink-dim">Chạy dạng</dt>
          <dd className="text-right">{PLATFORM_LABEL[where]}</dd>
          {server && (
            <>
              <dt className="text-ink-dim">Máy chủ dựng</dt>
              <dd className="text-right">{when(server.builtAt)}</dd>
            </>
          )}
        </dl>
      </details>
    </Card>
  )
}
