/*
 * Service worker — offline support for the web build.
 *
 * ## What changed, and why it mattered
 *
 * There used to be one cache, `co-tuong-v4`, and `activate` deleted every cache
 * whose name was not that. The voice pack lives in a cache of its own,
 * `co-tuong-voice-v1`, and is downloaded by the player over their own data —
 * megabytes of it. So every deploy that bumped the version number silently threw
 * it away. That is the bug this file was rewritten to fix, and the fix is one
 * rule: **sweep by prefix, and never touch a prefix this build does not own.**
 *
 * The precache list used to be hand-written, which meant it could only name
 * files with stable names — so the .wasm, the JavaScript and the CSS, the three
 * things actually needed to play, were left to be picked up by luck on the way
 * past. It now comes from `assets.json`, which the build generates by walking
 * its own output, so the list cannot drift from what shipped.
 *
 * ## Strategy, by what the resource is
 *
 * - Build output is content-hashed and therefore immutable: cache-first. This is
 *   what makes a second visit start instantly and what lets the game run with no
 *   network at all.
 * - The HTML entry point is network-first with a cache fallback, so a new deploy
 *   is picked up on the next online load instead of being pinned to whatever was
 *   cached first.
 * - `version.json` and `assets.json` are never cached. They are how staleness is
 *   detected; a cached copy of them is a client that can never learn it is out of
 *   date.
 *
 * The worker is a fast path, not the only path. `src/assets/manager.ts` does the
 * same job from the page, where progress can be shown and where it works before
 * this file has even activated. They agree because they read the same manifest.
 */

/** Prefixes this build owns. Anything else in Cache Storage is somebody else's. */
const OWNED = ['co-tuong-shell-', 'co-tuong-engine-', 'co-tuong-media-']

/**
 * The single cache every previous build used, by its exact name.
 *
 * Already on every existing installation, and now dead weight — a few hundred
 * kilobytes of an app nobody is running any more. Named exactly rather than by
 * prefix so the sweep can never mistake `co-tuong-voice-v1` for one of these.
 */
const LEGACY = ['co-tuong-v1', 'co-tuong-v2', 'co-tuong-v3', 'co-tuong-v4']

/** Where the inventory lives. Same file the page reads. */
const MANIFEST = './assets.json'

/** Fetch the manifest, bypassing every cache. */
async function loadManifest() {
  const res = await fetch(new Request(MANIFEST, { cache: 'reload' }))
  if (!res.ok) throw new Error(`assets.json: ${res.status}`)
  return res.json()
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const manifest = await loadManifest()
        // Only what the game cannot start without. Sound effects and banners are
        // fetched on the way past; nobody should wait on them to play chess.
        const wanted = manifest.assets.filter(
          (a) => a.required && (a.category === 'shell' || a.category === 'engine')
        )
        // One cache per category, so a deploy that only changes the interface
        // leaves the 210 KB engine binary exactly where it is.
        for (const category of ['shell', 'engine']) {
          const name = manifest.caches[category]
          if (!name) continue
          const cache = await caches.open(name)
          const urls = wanted.filter((a) => a.category === category).map((a) => a.url)
          // Individually rather than `addAll`, which is all-or-nothing: one
          // missing file used to mean nothing at all was precached.
          await Promise.all(
            urls.map((url) =>
              cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined)
            )
          )
        }
      } catch {
        // No manifest, no precache. The runtime cache below still fills up on
        // first use, which is exactly how this worked before.
      }
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      let keep = new Set()
      try {
        const manifest = await loadManifest()
        keep = new Set(Object.values(manifest.caches))
      } catch {
        // Without the manifest there is no way to tell current from stale, and
        // deleting on a guess is how the voice pack was lost. Delete nothing.
      }
      if (keep.size > 0) {
        const names = await caches.keys()
        await Promise.all(
          names
            // Only older versions of prefixes this build owns. A name that does
            // not start with one of them belongs to something else — the voice
            // pack, or a future feature — and is left alone.
            .filter(
              (n) =>
                (LEGACY.includes(n) || OWNED.some((p) => n.startsWith(p))) && !keep.has(n)
            )
            .map((n) => caches.delete(n))
        )
      }
      await self.clients.claim()
    })()
  )
})

/** The cache a runtime response should go in, or null to not store it. */
function cacheFor(pathname, manifestCaches) {
  if (pathname.endsWith('.wasm')) return manifestCaches.engine
  if (/\.(js|css|html)$/.test(pathname) || pathname.endsWith('.webmanifest')) {
    return manifestCaches.shell
  }
  return manifestCaches.media
}

/** Cached lazily; the manifest changes only when the worker is replaced. */
let manifestPromise = null
function manifestOnce() {
  if (!manifestPromise) manifestPromise = loadManifest().catch(() => null)
  return manifestPromise
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch cross-origin requests. The voice API and the promotional banners
  // are on other hosts and manage their own storage; proxying them here would
  // duplicate their caches and hide their failures.
  if (url.origin !== self.location.origin) return

  // The two files that answer "am I out of date". A cached answer to that is
  // worse than no answer.
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/assets.json')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(new Request(request, { cache: 'reload' }))
          const manifest = await manifestOnce()
          if (manifest) {
            const cache = await caches.open(manifest.caches.shell)
            void cache.put('./index.html', fresh.clone())
          }
          return fresh
        } catch {
          const cached = await caches.match('./index.html')
          return cached ?? new Response('Ngoại tuyến', { status: 503 })
        }
      })()
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok && response.type === 'basic') {
        const manifest = await manifestOnce()
        if (manifest) {
          const name = cacheFor(url.pathname, manifest.caches)
          if (name) {
            const copy = response.clone()
            void caches.open(name).then((cache) => cache.put(request, copy))
          }
        }
      }
      return response
    })()
  )
})

/*
 * The page asking what is held.
 *
 * Used by the first-run screen so it can show a real bar instead of a spinner,
 * and by Settings so "cập nhật rồi mà vẫn lỗi" has an answer that is not a guess.
 */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'status') return
  event.waitUntil(
    (async () => {
      const manifest = await manifestOnce()
      const names = manifest ? Object.values(manifest.caches) : []
      const held = {}
      for (const name of names) {
        try {
          const cache = await caches.open(name)
          held[name] = (await cache.keys()).length
        } catch {
          held[name] = 0
        }
      }
      const clients = await self.clients.matchAll()
      for (const client of clients) client.postMessage({ type: 'status', held })
    })()
  )
})
