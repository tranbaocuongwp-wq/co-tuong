/**
 * Generates the game's sound effects once, into `public/sfx/`.
 *
 * These are committed. They are assets of the game — a few tens of kilobytes —
 * and the app has to make a sound when a piece lands whether or not there is a
 * network. Fetching them at runtime would break that for no benefit.
 *
 * Run only when the sounds change:
 *
 *     ELEVENLABS_API_KEY=... npm run gen:sfx
 *
 * The key is never written to a file and never committed. Existing files are
 * skipped, so a re-run costs nothing; pass --force to regenerate.
 */

import { mkdirSync, existsSync, writeFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx')
const API = 'https://api.elevenlabs.io/v1/sound-generation'

/**
 * The prompts.
 *
 * Written as physical descriptions rather than moods: the model produces a far
 * more usable sample from "wooden disc on a wooden board" than from "a nice
 * move sound". Durations are deliberately short — these play on every move, and
 * anything with a tail becomes irritating by the tenth repetition.
 */
const SOUNDS = [
  {
    id: 'move',
    seconds: 0.6,
    prompt:
      'A single crisp wooden click: a small polished wood disc placed firmly ' +
      'on a hardwood board. Dry, close-miked, no reverb, no music. One hit only.',
  },
  {
    id: 'capture',
    seconds: 0.9,
    prompt:
      'A wooden chess piece knocked aside by another and landing: one solid ' +
      'low wooden thud immediately followed by a lighter wooden clatter. ' +
      'Dry, close-miked, no reverb, no music.',
  },
  {
    id: 'select',
    // The API's floor is 0.5s; the tick itself is far shorter and the tail is
    // silence, which costs nothing.
    seconds: 0.5,
    prompt:
      'A very short, light wooden tick: a fingernail tapping a small wood ' +
      'disc. Quiet, dry, no reverb, no music. One tick only.',
  },
  {
    id: 'check',
    seconds: 1.6,
    prompt:
      'A single small bronze gong struck once, bright and metallic with a ' +
      'short shimmering decay. Traditional Chinese percussion. No music, no ' +
      'other instruments.',
  },
  {
    id: 'win',
    seconds: 2.2,
    prompt:
      'A short triumphant flourish on a traditional Chinese gong and small ' +
      'cymbal, rising and confident. Two seconds, ending cleanly.',
  },
  {
    id: 'loss',
    seconds: 2.2,
    prompt:
      'A single deep, sombre bronze gong struck once and allowed to fade. ' +
      'Low and final. No music.',
  },
  {
    id: 'draw',
    seconds: 1.8,
    prompt:
      'A soft neutral wood block struck twice, evenly, unhurried. Dry, no ' +
      'reverb, no music.',
  },
]

const key = process.env.ELEVENLABS_API_KEY
if (!key) {
  console.error('ELEVENLABS_API_KEY is not set.\n')
  console.error('  ELEVENLABS_API_KEY=... npm run gen:sfx\n')
  console.error('The key must never be written to a file in this repository.')
  process.exit(1)
}

const force = process.argv.includes('--force')
mkdirSync(OUT, { recursive: true })

let made = 0
let skipped = 0

for (const sound of SOUNDS) {
  const file = join(OUT, `${sound.id}.mp3`)
  if (existsSync(file) && !force) {
    console.log(`  skip  ${sound.id}.mp3 (${Math.round(statSync(file).size / 1024)} KB)`)
    skipped++
    continue
  }

  process.stdout.write(`  make  ${sound.id}.mp3 … `)
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: sound.prompt,
      duration_seconds: sound.seconds,
      // Follow the prompt closely; these are specific physical sounds, not
      // creative interpretations.
      prompt_influence: 0.75,
    }),
  })

  if (!res.ok) {
    console.error(`\n\nFailed on "${sound.id}": ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }

  const bytes = Buffer.from(await res.arrayBuffer())
  writeFileSync(file, bytes)
  console.log(`${Math.round(bytes.length / 1024)} KB`)
  made++
}

console.log(`\n${made} generated, ${skipped} already present → public/sfx/`)
if (made > 0) console.log('Commit these: the game must make a sound with no network.')
