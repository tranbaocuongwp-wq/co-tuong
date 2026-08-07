/**
 * Guards two things a compiler cannot.
 *
 * 1. **Every `className` used in JSX resolves to a real rule.**
 *    This exists because of a real bug: rewriting one section of the stylesheet
 *    silently dropped the rules for the move list and the review screen. The
 *    app kept building, kept type-checking, and kept rendering — just wrong.
 *    An unstyled element looks *almost* right, which is exactly why it survives
 *    review. A missing class is a hard error here.
 *
 *    Since the interface moved to Tailwind for its ordinary screens, "a real
 *    rule" means one of two things, and the check reads both: the bespoke rules
 *    hand-written in `styles.css`, and the utilities Tailwind actually emitted
 *    into the built stylesheet. Reading the built output rather than keeping a
 *    list of Tailwind's prefixes is what makes this still worth running — a
 *    misspelt utility is not a utility Tailwind recognises, so it never reaches
 *    the output, and it gets caught exactly like a missing bespoke class would.
 *
 *    That means the check needs `dist/` to be current, which is why `npm run
 *    build` now runs it *after* Vite rather than before. Run on its own with no
 *    build present it falls back to `styles.css` alone and says so.
 *
 * 2. **No emoji in the interface.** The project uses drawn icons; emoji render
 *    as another platform's artwork (bright blue play buttons on iOS) and cannot
 *    be themed.
 *
 * Run with `node scripts/check-ui.mjs`. Exits non-zero on any finding.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(root, 'src')
const STYLES = join(SRC, 'styles.css')
const DIST_ASSETS = join(root, 'dist', 'assets')

/** Generated output — not ours to police. */
const SKIP_DIRS = new Set(['wasm'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) out.push(...walk(full))
    } else if (['.tsx', '.ts'].includes(extname(entry))) {
      out.push(full)
    }
  }
  return out
}

const files = walk(SRC)

/**
 * Every stylesheet worth consulting: the hand-written one, plus whatever the
 * last build emitted (which is where the Tailwind utilities live).
 */
function stylesheets() {
  const sources = [readFileSync(STYLES, 'utf8')]
  let built = false
  try {
    for (const name of readdirSync(DIST_ASSETS)) {
      if (extname(name) === '.css') {
        sources.push(readFileSync(join(DIST_ASSETS, name), 'utf8'))
        built = true
      }
    }
  } catch {
    // No dist yet. Handled below by narrowing what is checked.
  }
  return { css: sources.join('\n'), built }
}

const { css, built } = stylesheets()

// ---------------------------------------------------------------------------
// 1. Class names
// ---------------------------------------------------------------------------

/** Every class selector the stylesheet defines. */
const defined = new Set()
for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1])

/**
 * Class names referenced from JSX.
 *
 * Covers plain `className="a b"` and the template/ternary forms used in this
 * codebase, by pulling bare words out of any `className=...` expression up to
 * the closing brace or quote. Dynamic fragments (`piece--${side}`) are skipped
 * rather than guessed at.
 */
const used = new Map() // class -> first file that used it

function record(cls, file) {
  if (!cls || used.has(cls)) return
  used.set(cls, file)
}

for (const file of files) {
  const text = readFileSync(file, 'utf8')

  // className="..." and className={`...`} / {'...'} / {cond ? '...' : '...'}
  for (const m of text.matchAll(/className=(?:"([^"]*)"|\{([^}]*(?:\{[^}]*\}[^}]*)*)\})/g)) {
    const literal = m[1]
    if (literal !== undefined) {
      for (const cls of literal.split(/\s+/)) record(cls.trim(), file)
      continue
    }
    // Inside an expression: take every quoted string and scan its words.
    for (const s of m[2].matchAll(/['"`]([^'"`]*)['"`]/g)) {
      for (const cls of s[1].split(/\s+/)) {
        const trimmed = cls.trim()
        // Skip interpolated fragments; we cannot know what they resolve to.
        if (!trimmed || trimmed.includes('$') || trimmed.includes('{')) continue
        // A className expression also contains strings that are *not* classes —
        // comparison operands like `side === 'r'`. Every real class here is at
        // least three characters, which separates them cheaply and without a
        // list of exceptions to keep up to date.
        if (trimmed.length < 3) continue
        record(trimmed, file)
      }
    }
  }
}

const missing = []
for (const [cls, file] of used) {
  if (!/^[a-z][\w-]*$/.test(cls)) continue
  /*
   * Without a build there is no way to tell a Tailwind utility from a typo, so
   * checking the whole set would be nothing but false alarms. The bespoke
   * classes are still checkable: they are the BEM-shaped ones, and they are the
   * ones the original bug destroyed.
   */
  if (!built && !cls.includes('__') && !cls.includes('--')) continue
  if (!defined.has(cls)) missing.push({ cls, file: file.replace(root + '/', '') })
}

// ---------------------------------------------------------------------------
// 2. Emoji
// ---------------------------------------------------------------------------

/**
 * Pictographic and dingbat ranges, plus the variation selector.
 *
 * CJK is deliberately absent: the pieces are 帥/將 and the board says
 * ĐỆ NHẤT CỜ TƯỚNG — those are content, not decoration.
 */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const emoji = []
for (const file of files) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const hit = line.match(EMOJI)
      if (hit) {
        emoji.push({
          file: file.replace(root + '/', ''),
          line: i + 1,
          char: hit[0],
          text: line.trim().slice(0, 70),
        })
      }
    })
}

// ---------------------------------------------------------------------------

let failed = false

if (missing.length > 0) {
  failed = true
  console.error(`\n✗ ${missing.length} class name(s) used in JSX with no rule in styles.css:\n`)
  for (const m of missing) console.error(`    .${m.cls}\n      used in ${m.file}`)
  console.error('\n  Either add the rule, or stop using the class.')
}

if (emoji.length > 0) {
  failed = true
  console.error(`\n✗ ${emoji.length} emoji in the interface — use <Icon> instead:\n`)
  for (const e of emoji) console.error(`    ${e.file}:${e.line}  ${e.char}  ${e.text}`)
}

if (!failed) {
  console.log(
  `✓ ${used.size} class names all styled, no emoji (${files.length} files)` +
    (built ? '' : ' — chưa dựng dist, chỉ kiểm lớp BEM')
)
}

process.exit(failed ? 1 : 0)
