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

import { useCallback, useEffect, useState } from 'react'

import wasmUrl from './wasm/xiangqi_engine_wasm_bg.wasm?url'

/** Injected by Vite at build time; see `vite.config.ts`. */
declare const __BUILD_ID__: string

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
  /**
   * False once this tab has already reloaded for an update, so the interface
   * stops applying it automatically and just offers the button.
   */
  canAutoApply: boolean
  /** Applies the update: reloads onto the new build. */
  apply: () => void
}

/** How often to look for a new build. */
const POLL_MS = 15 * 60 * 1000

/**
 * Marks that this tab has already reloaded for an update.
 *
 * Without it a single failure to pick up the new assets — a stale HTTP cache, a
 * service worker that has not yet handed over — turns auto-update into an
 * infinite reload loop, because the freshly loaded page still reports the old
 * version and immediately decides it needs updating again. One automatic
 * attempt per tab; after that the player is offered a button and left alone.
 */
const APPLIED_KEY = 'co-tuong.update-applied'

function alreadyTried(): boolean {
  try {
    return sessionStorage.getItem(APPLIED_KEY) !== null
  } catch {
    return false
  }
}

function markTried(): void {
  try {
    sessionStorage.setItem(APPLIED_KEY, '1')
  } catch {
    /* private browsing can refuse writes; the guard is best-effort */
  }
}

/**
 * What this build actually is.
 *
 * `app` is compiled in. `core` is read off the hashed filename of the very
 * WebAssembly binary this bundle imports, so it describes the engine that is
 * really running rather than the one the server currently offers.
 */
/**
 * Last path segment of a URL or filename.
 *
 * Applied to *both* sides of the comparison. The build records a bare filename
 * while the runtime holds a fully-qualified URL, and comparing those directly
 * made the app believe the engine had changed on every single check — a
 * permanent "there is an update" banner that no amount of updating cleared.
 */
function basename(value: string): string {
  const clean = value.split(/[?#]/)[0]
  return clean.slice(clean.lastIndexOf('/') + 1) || clean
}

function runningVersion(): { app: string; core: string } {
  const app = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'
  const core = basename(wasmUrl)
  const version = { app, core }
  // Left on `window` deliberately: when someone reports "it keeps asking me to
  // update", this is the first thing worth looking at.
  ;(window as unknown as { __coTuongVersion?: unknown }).__coTuongVersion = {
    ...version,
    wasmUrl,
  }
  return version
}

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('__TAURI_INTERNALS__' in window) return

    let cancelled = false

    const running = runningVersion()

    const check = async () => {
      const latest = await fetchManifest()
      if (cancelled || !latest) return
      const latestCore = basename(latest.core)
      if (latest.app === running.app && latestCore === running.core) return

      setKind(latestCore !== running.core ? 'core' : 'app')
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
    markTried()
    void (async () => {
      try {
        // Every cache has to go, and the old worker with it: leaving the worker
        // registered lets it answer the very next navigation from the copy we
        // are trying to replace.
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
        const regs = (await navigator.serviceWorker?.getRegistrations()) ?? []
        await Promise.all(regs.map((r) => r.unregister()))
      } catch {
        // A failed purge is not worth blocking the reload over.
      }
      // Land on the main menu, where the autosaved game offers "Chơi tiếp".
      window.location.hash = '#/'
      window.location.reload()
    })()
  }, [])

  return { available, kind, canAutoApply: !alreadyTried(), apply }
}
