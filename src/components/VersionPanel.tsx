/**
 * Exactly which build is running, and whether it is the newest one.
 *
 * The About page used to say "Phiên bản 0.3.0" and stop there. That is the
 * release number, which is the one fact that does *not* settle an argument: two
 * people can both be on 0.3.0 and be running different code, because the app
 * updates over the air in two independent parts and a browser can hold either
 * of them stale.
 *
 * So this shows all of it side by side:
 *
 * * **Phiên bản** — the release, from the engine binary itself.
 * * **Bản giao diện** — the app build id compiled into this bundle.
 * * **Bản lõi cờ** — the hashed filename of the very .wasm this page imported.
 * * **Đang chạy dưới dạng** — installed app, installed web app, or a tab, which
 *   is what decides how an update reaches them at all.
 *
 * And then the part that actually answers the question: what the server has
 * right now, compared against those. "Đang là bản mới nhất" is a claim worth
 * making only when it has been checked, so there is a button to check.
 *
 * All of it degrades to something honest offline: the running identities are
 * local facts and always available, and the comparison simply says it could not
 * reach the server rather than guessing.
 */

import { useCallback, useEffect, useState } from 'react'

import { fetchManifest, platform, runningVersion, type VersionManifest } from '../update'
import { Icon } from './Icon'

export interface VersionPanelProps {
  /** The release number, from the engine. */
  release: string
}

const PLATFORM_LABEL: Record<ReturnType<typeof platform>, string> = {
  desktop: 'Ứng dụng máy tính',
  pwa: 'Ứng dụng đã cài (PWA)',
  browser: 'Trình duyệt',
}

const PLATFORM_NOTE: Record<ReturnType<typeof platform>, string> = {
  desktop: 'Cập nhật qua bộ cài, không qua mạng.',
  pwa: 'Bản cài giữ sẵn tệp để chạy ngoại tuyến, nên đôi khi chậm hơn máy chủ một nhịp.',
  browser: 'Lấy thẳng từ máy chủ mỗi lần mở.',
}

/** "14:22 · 07/08/2026" — a build time nobody has to decode. */
function when(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const two = (n: number) => String(n).padStart(2, '0')
  return `${two(d.getHours())}:${two(d.getMinutes())} · ${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}`
}

type Check = 'idle' | 'checking' | 'offline' | 'fresh' | 'stale'

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
    <div className="card">
      <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Bản này</h2>

      <dl className="ver">
        <div className="ver__row">
          <dt className="ver__label">Phiên bản</dt>
          <dd className="ver__value">{release}</dd>
        </div>
        <div className="ver__row">
          <dt className="ver__label">Bản giao diện</dt>
          <dd className="ver__value ver__mono">
            {here.app}
            {server && server.app !== here.app && (
              <span className="ver__newer"> (mới: {server.app})</span>
            )}
          </dd>
        </div>
        <div className="ver__row">
          <dt className="ver__label">Bản lõi cờ</dt>
          <dd className="ver__value ver__mono">
            {here.core}
            {server && server.core !== here.core && (
              <span className="ver__newer"> (mới: {server.core})</span>
            )}
          </dd>
        </div>
        <div className="ver__row">
          <dt className="ver__label">Đang chạy dưới dạng</dt>
          <dd className="ver__value">{PLATFORM_LABEL[where]}</dd>
        </div>
        {server && (
          <div className="ver__row">
            <dt className="ver__label">Máy chủ dựng lúc</dt>
            <dd className="ver__value">{when(server.builtAt)}</dd>
          </div>
        )}
      </dl>

      <p className="ver__note muted">{PLATFORM_NOTE[where]}</p>

      <div className={`ver__state${stale ? ' ver__state--stale' : ''}`}>
        {check === 'checking' && 'Đang kiểm tra…'}
        {check === 'offline' && 'Không hỏi được máy chủ. Ván cờ vẫn chạy bình thường.'}
        {check === 'fresh' && 'Đang là bản mới nhất.'}
        {stale && (
          <>
            Máy chủ đã có bản mới hơn
            {server && server.core !== here.core ? ' — gồm cả lõi cờ.' : '.'}
          </>
        )}
      </div>

      <div className="btn-row">
        <button type="button" className="btn" onClick={() => void compare()}>
          <Icon name="engine" size={16} /> Kiểm tra lại
        </button>
        {stale && (
          <button
            type="button"
            className="btn btn--primary"
            // A plain reload is the whole update: every asset carries a content
            // hash, so nothing stale can survive one.
            onClick={() => window.location.reload()}
          >
            <Icon name="download" size={16} /> Cập nhật ngay
          </button>
        )}
      </div>
    </div>
  )
}
