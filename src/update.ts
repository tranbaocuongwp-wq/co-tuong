/**
 * Over-the-air updates for the web build.
 *
 * Two things can change independently, and the difference matters to the
 * player:
 *
 * * **giao diện (app)** — a small, instant reload.
 * * **lõi engine (core)** — the WebAssembly binary, the largest download, and
 *   the part that actually changes how the computer plays.
 *
 * The critical constraint is that an update must never cost someone the game
 * they are in. Nothing reloads on its own while a game is live: the update is
 * applied at a safe moment, and because every move is autosaved, the player
 * comes back to the main menu with "Chơi tiếp" waiting for them.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export interface VersionManifest {
  app: string
  core: string
  builtAt: string
}

export type UpdateKind = 'app' | 'core'

export interface UpdateState {
  available: boolean
  /** `core` whenever the engine binary changed, even if the app changed too. */
  kind: UpdateKind
  /** Applies the update: reloads onto the new build. */
  apply: () => void
}

/** How often to look for a new build. */
const POLL_MS = 15 * 60 * 1000

async function fetchManifest(): Promise<VersionManifest | null> {
  try {
    // `no-store` matters twice over: the HTTP cache and the service worker must
    // both be bypassed, or the check would keep reading the version it shipped
    // with and never see a thing.
    const url = new URL('version.json', document.baseURI)
    url.searchParams.set('t', String(Date.now()))
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as VersionManifest
    return typeof data?.app === 'string' && typeof data?.core === 'string' ? data : null
  } catch {
    // Offline is the normal case for this app; it simply means no update today.
    return null
  }
}

/**
 * Watches for a new deployment.
 *
 * Inert inside Tauri, which ships its own installer and updates through the
 * operating system rather than over the network.
 */
export function useAppUpdate(): UpdateState {
  const [available, setAvailable] = useState(false)
  const [kind, setKind] = useState<UpdateKind>('app')
  const baselineRef = useRef<VersionManifest | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('__TAURI_INTERNALS__' in window) return

    let cancelled = false

    const check = async () => {
      const latest = await fetchManifest()
      if (cancelled || !latest) return

      if (!baselineRef.current) {
        // First successful read is what "the running build" means.
        baselineRef.current = latest
        return
      }
      const base = baselineRef.current
      if (latest.app === base.app && latest.core === base.core) return

      setKind(latest.core !== base.core ? 'core' : 'app')
      setAvailable(true)

      // Ask the service worker to pull the new assets down now, so applying the
      // update later is a reload rather than a download.
      void navigator.serviceWorker?.getRegistration().then((reg) => reg?.update())
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    // Coming back to the tab is the moment a player is most likely to accept a
    // reload, so check then too.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  const apply = useCallback(() => {
    void (async () => {
      try {
        const reg = await navigator.serviceWorker?.getRegistration()
        // Drop the caches so the reload cannot be served the old build.
        if (reg) {
          await reg.update()
          if ('caches' in window) {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          }
        }
      } catch {
        // A failed cache purge is not worth blocking the reload over.
      }
      // Land on the main menu, where the autosaved game offers "Chơi tiếp".
      window.location.hash = '#/'
      window.location.reload()
    })()
  }, [])

  return { available, kind, apply }
}
