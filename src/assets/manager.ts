/**
 * Working out what is already on this device, and fetching what is not.
 *
 * Modelled directly on `src/audio/pack.ts`, which has solved this problem for
 * the voice pack for months and got the important things right. Every one of its
 * decisions is kept:
 *
 * * **The cache is the state.** Nothing is written down about what has been
 *   downloaded — the answer is "what is in Cache Storage", which cannot go out
 *   of sync with reality and makes resuming an interrupted download the same
 *   call as starting one.
 * * **Six at a time, over a shared queue.** Enough to keep a connection busy,
 *   few enough not to starve the page.
 * * **Give up after eight consecutive network failures**, counted across all six
 *   workers rather than per worker, so a genuinely dead connection is noticed in
 *   eight attempts instead of forty-eight.
 * * **`AbortSignal` is the entire pause mechanism.** There is nothing to save and
 *   nothing to restore.
 *
 * What is different: this one has a manifest with byte counts, so a truncated
 * download can be caught. Subresource integrity would be the textbook answer and
 * is close to pointless here — same-origin assets already carry a content hash
 * in their filename, and SRI breaks the moment a CDN re-encodes anything. A
 * download cut short on a train is a failure that actually happens, and
 * comparing `content-length` catches it for nothing.
 */

import {
  assetsIn,
  fetchAssetManifest,
  type AssetCategory,
  type AssetEntry,
  type AssetManifest,
} from './manifest'

/** Parallel fetches. Same figure the voice pack settled on. */
const CONCURRENCY = 6

/**
 * Consecutive network failures before the job stops itself.
 *
 * Shared across all workers on purpose: a connection that has dropped will fail
 * every request, and counting per worker would take six times as long to notice.
 */
const GIVE_UP_AFTER = 8

export interface AssetStatus {
  /** Files already on the device. */
  have: number
  total: number
  /** Bytes held, from the manifest rather than by measuring the cache. */
  bytes: number
  /** Total bytes if everything were held. */
  totalBytes: number
}

export interface AssetProgress {
  done: number
  total: number
  /** Downloaded during this run. */
  fetched: number
  /** Already present when the run started. */
  already: number
  /** Answered by the server with a refusal, or arrived truncated. Not retried. */
  missing: number
}

export type AssetStop = 'done' | 'paused' | 'offline'

export interface AssetResult extends AssetProgress {
  stopped: AssetStop
}

function hasCaches(): boolean {
  return typeof caches !== 'undefined'
}

/** Resolve an entry's URL the same way the browser would from the page. */
function requestFor(entry: AssetEntry): Request {
  return new Request(new URL(entry.url, document.baseURI).toString())
}

/**
 * What is held, per category.
 *
 * Re-derived from the cache every time rather than remembered. It costs a
 * `cache.match` per file — cheap, since only headers are read — and it can never
 * claim something is present that has been evicted.
 */
export async function assetStatus(
  categories: AssetCategory[],
  manifest?: AssetManifest | null
): Promise<AssetStatus | null> {
  if (!hasCaches()) return null
  const m = manifest ?? (await fetchAssetManifest())
  if (!m) return null

  const wanted = assetsIn(m, categories)
  let have = 0
  let bytes = 0
  await Promise.all(
    wanted.map(async (entry) => {
      const name = m.caches[entry.category]
      if (!name) return
      try {
        const cache = await caches.open(name)
        if (await cache.match(requestFor(entry))) {
          have += 1
          bytes += entry.bytes
        }
      } catch {
        // A cache that cannot be opened simply holds nothing.
      }
    })
  )
  return {
    have,
    total: wanted.length,
    bytes,
    totalBytes: wanted.reduce((sum, a) => sum + a.bytes, 0),
  }
}

/**
 * Download whatever is missing.
 *
 * Safe to call when everything is already present: it finds every file in the
 * cache and returns immediately, which is what makes it usable as a "make sure"
 * rather than as a "download".
 */
export async function ensureAssets(
  categories: AssetCategory[],
  onProgress?: (p: AssetProgress) => void,
  signal?: AbortSignal
): Promise<AssetResult> {
  if (!hasCaches()) throw new Error('Trình duyệt này không lưu được tệp ngoại tuyến.')
  const loaded = await fetchAssetManifest()
  if (!loaded) throw new Error('Chưa hỏi được máy chủ danh sách tệp.')
  // Bound to a fresh const so the workers below see it as non-null; TypeScript
  // will not carry the narrowing across the closure boundary on its own.
  const manifest: AssetManifest = loaded

  const queue = assetsIn(manifest, categories).slice()
  const state: AssetProgress = {
    done: 0,
    total: queue.length,
    fetched: 0,
    already: 0,
    missing: 0,
  }
  let stopped: AssetStop = 'done'
  let consecutiveFailures = 0

  async function worker(): Promise<void> {
    for (;;) {
      if (signal?.aborted) {
        stopped = 'paused'
        return
      }
      if (consecutiveFailures >= GIVE_UP_AFTER) {
        stopped = 'offline'
        return
      }
      const entry = queue.shift()
      if (!entry) return

      const cacheName = manifest.caches[entry.category]
      try {
        const cache = await caches.open(cacheName)
        const request = requestFor(entry)
        if (await cache.match(request)) {
          state.already += 1
          consecutiveFailures = 0
        } else {
          const res = await fetch(request, { signal, cache: 'reload' })
          if (!res.ok) {
            // The server answered, so retrying will get the same answer.
            state.missing += 1
          } else {
            const length = Number(res.headers.get('content-length') ?? 0)
            // A response shorter than the manifest says is a cut connection
            // wearing a 200. Caching it would make the app broken *offline*,
            // which is the one state nobody can fix from the app.
            if (length > 0 && entry.bytes > 0 && length !== entry.bytes) {
              state.missing += 1
              consecutiveFailures += 1
            } else {
              await cache.put(request, res)
              state.fetched += 1
              consecutiveFailures = 0
            }
          }
        }
      } catch {
        if (signal?.aborted) {
          stopped = 'paused'
          return
        }
        // Never reached the server. Put it back and let a later pass try it.
        queue.push(entry)
        consecutiveFailures += 1
        continue
      } finally {
        state.done = state.fetched + state.already + state.missing
        onProgress?.({ ...state })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  return { ...state, stopped }
}

/** Forget a whole category. Used by the update path, never for `voice`. */
export async function clearCategory(category: AssetCategory): Promise<void> {
  if (!hasCaches()) return
  const manifest = await fetchAssetManifest()
  const name = manifest?.caches[category]
  if (name) await caches.delete(name)
}
