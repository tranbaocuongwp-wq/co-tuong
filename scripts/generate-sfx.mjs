/**
 * Downloads the game's sound effects into `public/sfx/`.
 *
 * These are committed. They are assets of the game — a few tens of kilobytes —
 * and the board has to make a sound when a piece lands whether or not there is
 * a network. Fetching them at runtime would break that for no benefit.
 *
 *     npm run gen:sfx
 *
 * No API key here. The Worker holds it and generates a sound the first time it
 * is asked for one, then serves it from R2 — the same arrangement as the spoken
 * lines. That means the key lives in exactly one place, this script is safe to
 * run from anywhere, and a sound is only ever paid for once.
 *
 * Existing files are skipped, so a re-run costs nothing; pass --force to fetch
 * them again.
 */

import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SFX_PROMPTS } from '../src/audio/sfx-prompts.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx')
const API = process.env.COTUONG_API ?? 'https://co-tuong-api.tranbaocuongmkt.workers.dev'

const force = process.argv.includes('--force')
mkdirSync(OUT, { recursive: true })

let made = 0
let skipped = 0
let failed = 0

for (const sound of SFX_PROMPTS) {
  const file = join(OUT, `${sound.id}.mp3`)
  if (existsSync(file) && !force) {
    console.log(`  skip  ${sound.id}.mp3 (${Math.round(statSync(file).size / 1024)} KB)`)
    skipped++
    continue
  }

  process.stdout.write(`  get   ${sound.id}.mp3 … `)
  try {
    const res = await fetch(`${API}/v1/sfx/${sound.id}`)
    if (!res.ok) {
      console.log(`failed (${res.status})`)
      failed++
      continue
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    writeFileSync(file, bytes)
    console.log(`${Math.round(bytes.length / 1024)} KB`)
    made++
  } catch (e) {
    console.log(`failed (${e instanceof Error ? e.message : e})`)
    failed++
  }
}

console.log(`\n${made} downloaded, ${skipped} already present, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
