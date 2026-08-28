/**
 * Warms every commentary line into R2, by asking the Worker for each one.
 *
 * The Worker generates a line the first time it is requested, which costs a
 * couple of seconds. Doing that lazily would mean the first player to reach any
 * given situation hears silence while it renders. Running this once after
 * adding lines moves that cost off the players entirely.
 *
 *     npm run gen:voice
 *
 * No API key here: the key lives in the Worker. This script only makes ordinary
 * GET requests, so it is safe to run from anywhere.
 */

const API = process.env.COTUONG_API ?? 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

/** Requests in flight at once. Enough to be quick, gentle enough to not trip limits. */
const CONCURRENCY = 3

// The manifest is edge-cached for an hour, which is right for players and
// wrong here: right after a deploy this script would warm the *previous*
// script's ids and leave every new line missing.
const listRes = await fetch(`${API}/v1/lines?bust=${Date.now()}`, { cache: 'no-store' })
if (!listRes.ok) {
  console.error(`Could not read the line list: ${listRes.status} ${listRes.statusText}`)
  process.exit(1)
}
const { ids } = await listRes.json()
console.log(`${ids.length} lines to warm at ${API}\n`)

let done = 0
let generated = 0
let cached = 0
let failed = 0

async function warm(id) {
  const started = Date.now()
  try {
    const res = await fetch(`${API}/v1/line/${id}`)
    const ms = Date.now() - started
    if (!res.ok) {
      failed++
      console.log(`  fail  ${id}  ${res.status}`)
      return
    }
    const bytes = (await res.arrayBuffer()).byteLength
    /*
     * The Worker says which it was; this used to guess from the clock.
     *
     * "Under 400ms means it came from R2" was wrong often enough to matter: on
     * the run that uncovered the camelCase bug it claimed 169 lines generated
     * when 51 were, because a hundred ordinary R2 reads took half a second on a
     * home connection. This number is the only thing anyone reads to know
     * whether a run cost money, so it should not be a guess.
     *
     * The `?? ms >= 400` keeps the old guess as a fallback, for the window
     * between deploying this script and deploying the Worker that answers it.
     */
    const source = res.headers.get('x-cotuong-source')
    const wasCached = source ? source === 'r2' : ms < 400
    if (wasCached) cached++
    else generated++
    console.log(
      `  ${wasCached ? 'have' : 'made'}  ${id.padEnd(10)} ${String(Math.round(bytes / 1024)).padStart(3)} KB  ${ms} ms`
    )
  } catch (e) {
    failed++
    console.log(`  fail  ${id}  ${e instanceof Error ? e.message : e}`)
  } finally {
    done++
  }
}

const queue = [...ids]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const id = queue.shift()
      if (id) await warm(id)
    }
  })
)

console.log(`\n${generated} generated, ${cached} already stored, ${failed} failed (${done} total)`)
process.exit(failed > 0 ? 1 : 0)
