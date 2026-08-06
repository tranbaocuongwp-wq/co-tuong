/**
 * Content-addressed ids for spoken lines.
 *
 * The audio for a line lives in R2 under its id. If a line's wording changed
 * while its id stayed the same, R2 would keep serving the old recording
 * forever — the text on screen and the voice in the speaker would disagree, and
 * nothing would ever surface the mismatch.
 *
 * So the id carries a fingerprint of the words. Rewrite a line and its id moves
 * with it: the new wording has no recording yet, gets generated once, and the
 * old file is simply orphaned. That also makes "only generate what is missing"
 * fall out for free, because a line that did not change keeps its id and its
 * recording.
 *
 * FNV-1a, not a cryptographic hash. Nothing here is a security boundary — it
 * only has to change when the text changes, and it has to give the same answer
 * in the browser, in the Worker and in the generation script, with no crypto
 * API and nothing async.
 */

/** Length of the fingerprint in the id. Short enough to read, wide enough to not collide. */
const DIGITS = 7

export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    // The FNV prime, by shifts: a plain multiply overflows into floats.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36).padStart(DIGITS, '0').slice(-DIGITS)
}

/**
 * The id a line is stored under.
 *
 * `key` names the line for humans reading the script; the fingerprint is what
 * makes it point at one exact recording.
 */
export function lineId(key: string, spoken: string): string {
  return `${key}-${fingerprint(spoken)}`
}
