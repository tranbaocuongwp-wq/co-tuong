/**
 * The phone frames on the website, made from the store screenshots.
 *
 * `store-shots.mjs` produces 1290 × 2796 PNGs, which is what Apple and Google
 * want and roughly forty times more than a 208px-wide frame on a marketing page
 * needs. Shipping those to the front page would be about 3 MB of pictures on a
 * page whose entire pitch is that it is small and works offline.
 *
 * So: one resize and one re-encode, and the whole strip comes to about 320 KB.
 * 645px wide is deliberate — twice the widest the frame is ever drawn, so it
 * still looks right on a 2× display and nothing bigger is ever downloaded.
 *
 * Run after the store shots have been rebuilt:
 *
 *   node scripts/store-shots.mjs && node scripts/site-shots.mjs
 *
 * Needs `cwebp` (`brew install webp`). The list below is the site's, not the
 * stores': `src/site/copy.ts` names the same files, and a shot added here but
 * not there simply never appears.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FROM = join(root, 'store-shots')
const TO = join(root, 'public', 'shots')

/** Which of the store shots the site uses, by their bare name. */
const WANTED = [
  '02-ban-co',
  '03-goi-y',
  '04-xem-truoc',
  '05-thang',
  '06-menu',
  '07-lich-su',
  '08-ho-so',
  '09-cai-dat',
  '11-ban-co-toi',
]

/** Twice the widest the frame is drawn on the page. */
const WIDTH = 645
const QUALITY = 78

mkdirSync(TO, { recursive: true })

let made = 0
for (const name of WANTED) {
  const from = join(FROM, `iphone-6.7__${name}.png`)
  if (!existsSync(from)) {
    console.warn(`bỏ qua ${name}: chưa có ${from}`)
    continue
  }
  execFileSync('cwebp', [
    '-quiet',
    '-q',
    String(QUALITY),
    '-resize',
    String(WIDTH),
    '0',
    from,
    '-o',
    join(TO, `${name}.webp`),
  ])
  made++
}

console.log(`Đã dựng ${made}/${WANTED.length} ảnh vào public/shots/`)
