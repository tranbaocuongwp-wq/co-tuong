/*
 * Service worker — offline support for the web build.
 *
 * Strategy is split by what the resource is, because one strategy cannot serve
 * both cases well:
 *
 *   - Build output (JS, CSS, .wasm) is content-hashed and therefore immutable,
 *     so it is cache-first. This is what makes a second visit start instantly
 *     and what lets the game run with no network at all.
 *   - The HTML entry point is network-first with a cache fallback, so a new
 *     deploy is picked up on the next online load instead of being pinned to
 *     whatever was cached first.
 *
 * The engine's .wasm is ~170 KB and is required before a single move can be
 * played, so getting it into the cache is the whole point of the exercise.
 */

const CACHE = 'co-tuong-v1'

/* Stable-named files worth having before the first offline load. */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // `reload` bypasses the HTTP cache so a stale copy is not baked in.
      .then((cache) =>
        cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))
      )
      // A missing shell file must not abort installation; runtime caching will
      // pick it up on first use.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  // Never touch cross-origin requests; the app makes none, and proxying them
  // would only add a way to get things wrong.
  if (url.origin !== self.location.origin) return

  // The version manifest is how the app notices a new deployment. Serving it
  // from cache would pin it to the build it shipped with and updates would
  // never be detected at all.
  if (url.pathname.endsWith('/version.json')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put('./index.html', copy))
          return response
        })
        .catch(() =>
          caches
            .match('./index.html')
            .then((cached) => cached ?? new Response('Ngoại tuyến', { status: 503 }))
        )
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Only cache successful, non-opaque responses.
        if (response.ok && response.type === 'basic') {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
    })
  )
})
