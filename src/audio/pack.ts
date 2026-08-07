/**
 * Pulling the commentary down for offline use, in a way that survives a bad line.
 *
 * Ordinarily each line arrives the first time it is needed and stays in Cache
 * Storage after that, which is fine on a phone with signal. It is not fine on a
 * train, in a lift, or anywhere else people actually play — the first time each
 * situation comes up the commentator is simply silent, and the player has no
 * way to know it was only a download away.
 *
 * So this fetches the lot on request. Deliberately explicit rather than
 * automatic: downloading several megabytes unasked is exactly the kind of thing
 * an app should not do on someone else's data plan.
 *
 * ## Why it is a resumable job and not a loop
 *
 * Six hundred requests over a weak connection will not all succeed, and the
 * first version treated that as a detail: it counted the failures and reported
 * a number at the end. On a train that number was "480 câu chưa có bản ghi",
 * which is both wrong and useless — the lines exist, the connection dropped.
 *
 * Now it distinguishes the two things it can be told:
 *
 * * **Not recorded yet** — the Worker answers, and says it has nothing. Nothing
 *   to retry; skip it and keep going.
 * * **Could not ask** — the request never got an answer. That is the network,
 *   and if it happens several times in a row the sensible thing is to stop
 *   rather than hammer a connection that is clearly gone.
 *
 * Resuming needs no bookkeeping at all: everything already fetched is in the
 * cache, and the job skips what is cached. Stopping and starting again picks up
 * exactly where it left off, whether it was paused deliberately, gave up on a
 * bad line, or the browser was closed a week ago.
 */

const API = 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Same cache the player uses, so a warmed line is a line already in hand. */
const CACHE_NAME = 'co-tuong-voice-v1'

/** How many to fetch at once. Enough to be quick, gentle enough to be polite. */
const CONCURRENCY = 6

/**
 * Consecutive network failures before the job stops itself.
 *
 * Not one — a single dropped request on a mobile connection is normal and
 * retrying costs nothing. Several in a row means the connection is gone, and
 * continuing would burn battery to produce six hundred more failures.
 */
const GIVE_UP_AFTER = 8

export interface PackProgress {
  done: number
  total: number
  /** Fetched successfully this run. */
  fetched: number
  /** Already in the cache when the run started. */
  already: number
  /** Answered, but there is no recording yet. */
  missing: number
}

export type PackStop = 'done' | 'paused' | 'offline'

export interface PackResult extends PackProgress {
  /** Why the job ended. `offline` means it stopped itself. */
  stopped: PackStop
}

export interface PackStatus {
  have: number
  total: number
  /** Bytes held in the cache, from the stored responses' own headers. */
  bytes: number
}

async function manifest(): Promise<string[] | null> {
  try {
    // The manifest is edge-cached for an hour, which is right for players and
    // wrong here: it would hand back the previous script's list.
    const res = await fetch(`${API}/v1/lines?t=${Date.now()}`)
    if (!res.ok) return null
    return ((await res.json()) as { ids: string[] }).ids
  } catch {
    return null
  }
}

/**
 * What is on the device already.
 *
 * Sizes come from each stored response's `content-length`, which is a header
 * read and not a body read — six hundred of those is cheap, where six hundred
 * `arrayBuffer()` calls would not be.
 */
export async function packStatus(): Promise<PackStatus | null> {
  if (!('caches' in globalThis)) return null
  const ids = await manifest()
  if (!ids) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const found = await Promise.all(ids.map((id) => cache.match(`${API}/v1/line/${id}`)))
    let bytes = 0
    let have = 0
    for (const res of found) {
      if (!res) continue
      have++
      bytes += Number(res.headers.get('content-length') ?? 0)
    }
    return { have, total: ids.length, bytes }
  } catch {
    return null
  }
}

/** Throw the whole pack away. */
export async function clearVoicePack(): Promise<void> {
  if (!('caches' in globalThis)) return
  await caches.delete(CACHE_NAME)
}

/**
 * Fetch everything not already held.
 *
 * `signal` pauses it — aborting is the whole pause mechanism, because there is
 * no state to keep. Reports progress as it goes, since a several-megabyte
 * download with no feedback is indistinguishable from one that has hung.
 */
export async function downloadVoicePack(
  onProgress?: (p: PackProgress) => void,
  signal?: AbortSignal
): Promise<PackResult> {
  if (!('caches' in globalThis)) {
    throw new Error('Trình duyệt này không giữ được bản tải về.')
  }

  const ids = await manifest()
  if (!ids) throw new Error('Không lấy được danh sách lời thoại.')

  const cache = await caches.open(CACHE_NAME)
  const queue = [...ids]
  const state: PackProgress = {
    done: 0,
    total: ids.length,
    fetched: 0,
    already: 0,
    missing: 0,
  }

  /*
   * Counted across all the workers, not per worker.
   *
   * The connection is a property of the device, so six workers each failing
   * twice is the same evidence as one worker failing twelve times.
   */
  let consecutiveNetworkFailures = 0
  let stopped: PackStop = 'done'

  async function worker(): Promise<void> {
    for (;;) {
      if (signal?.aborted) {
        stopped = 'paused'
        return
      }
      if (consecutiveNetworkFailures >= GIVE_UP_AFTER) {
        stopped = 'offline'
        return
      }

      const id = queue.shift()
      if (!id) return
      const request = `${API}/v1/line/${id}`

      try {
        if (await cache.match(request)) {
          state.already++
          consecutiveNetworkFailures = 0
        } else {
          const res = await fetch(request, { signal })
          if (res.ok) {
            await cache.put(request, res)
            state.fetched++
          } else {
            // The Worker answered and has no recording for this line yet. That
            // is not a network problem and retrying would not help.
            state.missing++
          }
          consecutiveNetworkFailures = 0
        }
      } catch {
        if (signal?.aborted) {
          stopped = 'paused'
          return
        }
        // Never reached the Worker. Put it back — a later run should try again.
        queue.push(id)
        consecutiveNetworkFailures++
        continue
      } finally {
        state.done = state.fetched + state.already + state.missing
        onProgress?.({ ...state })
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { ...state, stopped }
}
