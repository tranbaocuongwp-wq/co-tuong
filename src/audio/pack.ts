/**
 * Pulling the whole commentary down for offline use.
 *
 * Ordinarily each line arrives the first time it is needed and stays in Cache
 * Storage after that, which is fine on a phone with signal. It is not fine on a
 * train, in a lift, or anywhere else people actually play — the first time each
 * situation comes up the commentator is simply silent, and the player has no
 * way to know it was only a download away.
 *
 * So this fetches the lot in one go, on request. It is a few megabytes and
 * every byte of it is already generated; nothing here costs an API call.
 *
 * Deliberately explicit rather than automatic. Downloading several megabytes
 * unasked is exactly the kind of thing an app should not do on someone else's
 * data plan.
 */

const API = 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Same cache the player uses, so a warmed line is a line already in hand. */
const CACHE_NAME = 'co-tuong-voice-v1'

/** How many to fetch at once. Enough to be quick, gentle enough to be polite. */
const CONCURRENCY = 6

export interface PackProgress {
  done: number
  total: number
}

export interface PackResult {
  fetched: number
  already: number
  failed: number
  total: number
}

/**
 * Fetch every line into the cache.
 *
 * Reports progress as it goes, because a several-megabyte download with no
 * feedback is indistinguishable from one that has hung.
 */
export async function downloadVoicePack(
  onProgress?: (p: PackProgress) => void
): Promise<PackResult> {
  if (!('caches' in globalThis)) {
    throw new Error('Trình duyệt này không giữ được bản tải về.')
  }

  // The manifest is edge-cached for an hour, which is right for players and
  // wrong here: it would hand back the previous script's list.
  const listRes = await fetch(`${API}/v1/lines?t=${Date.now()}`)
  if (!listRes.ok) throw new Error('Không lấy được danh sách lời thoại.')
  const { ids } = (await listRes.json()) as { ids: string[] }

  const cache = await caches.open(CACHE_NAME)
  const queue = [...ids]
  let done = 0
  let fetched = 0
  let already = 0
  let failed = 0

  async function worker(): Promise<void> {
    for (;;) {
      const id = queue.shift()
      if (!id) return
      const request = `${API}/v1/line/${id}`
      try {
        if (await cache.match(request)) {
          already++
        } else {
          const res = await fetch(request)
          if (res.ok) {
            await cache.put(request, res)
            fetched++
          } else {
            // A line with no recording yet. The rest of the pack is still
            // worth having, so this is counted and passed over.
            failed++
          }
        }
      } catch {
        failed++
      } finally {
        done++
        onProgress?.({ done, total: ids.length })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { fetched, already, failed, total: ids.length }
}

/** How much of the pack is already in hand, as a fraction. */
export async function packCoverage(): Promise<{ have: number; total: number } | null> {
  if (!('caches' in globalThis)) return null
  try {
    const listRes = await fetch(`${API}/v1/lines?t=${Date.now()}`)
    if (!listRes.ok) return null
    const { ids } = (await listRes.json()) as { ids: string[] }
    const cache = await caches.open(CACHE_NAME)
    const found = await Promise.all(ids.map((id) => cache.match(`${API}/v1/line/${id}`)))
    return { have: found.filter(Boolean).length, total: ids.length }
  } catch {
    return null
  }
}
