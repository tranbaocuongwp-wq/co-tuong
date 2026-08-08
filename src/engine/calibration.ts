/**
 * Making a difficulty level mean the same thing on every device.
 *
 * Each level names a search depth *and* a time cap, and the comment above
 * `DIFFICULTY_PRESETS` explains the division: the depth is the strength, the cap
 * is what a slow device falls back to. That works as long as the cap is generous
 * enough for the device to reach the depth — and on a phone it often is not. So
 * "Siêu khó" on a phone has been quietly weaker than "Siêu khó" on a laptop,
 * with nothing anywhere to say so.
 *
 * The fix is to measure the machine and stretch **the cap, never the depth**. A
 * fast laptop keeps a small cap because it reaches the depth anyway; a slow
 * phone gets a larger one so it actually arrives at the depth the level
 * promised. Scaling the depth instead would do the opposite of what is wanted:
 * it would make the level mean something different on every device on purpose.
 *
 * ## Why the best of three, not the latest
 *
 * A phone that is hot, or on battery saver, or has three other tabs decoding
 * video, measures slow — and a slow measurement inflates the budget permanently.
 * The device is not slow; it was busy. Keeping the best sample means a bad
 * moment is forgotten while a genuinely slow device, which is slow every time,
 * still gets its larger cap.
 *
 * ## Why it is shown in Settings
 *
 * Because two people comparing "Siêu khó" and finding one waits twenty seconds
 * and the other sixty will conclude the app is broken. A number they can see,
 * with a button to measure again, is the difference between a feature and a
 * mystery.
 */

import { getEngineClient } from './client'
import { DIFFICULTY_PRESETS, type Calibration, type Difficulty, type SearchOptions } from './types'
import { runningVersion } from '../update'

/**
 * What this codebase's own machine measures, in nodes per second.
 *
 * Measured, not guessed — five runs of `Engine.benchmark(600)` on the WebAssembly
 * build on an Apple Silicon laptop gave 4.01, 4.12, 4.12, 4.11 and 4.04 million,
 * so 4.1 is the honest middle. A guessed constant here would be worse than no
 * calibration at all: it would scale every device against a fiction.
 *
 * Re-measure and update this if the engine's own speed changes materially.
 */
export const REFERENCE_NPS = 4_100_000

/** How long the measurement runs. Long enough to be stable, short enough to hide. */
export const MEASURE_MS = 600

/** How many samples to keep. The best of them is the one that counts. */
const SAMPLES = 3

/** Beyond this the profile is re-measured — a device can be replaced, or repaired. */
const STALE_AFTER_DAYS = 90

/** Never less than half the stated cap, never more than two and a half times it. */
const FLOOR = 0.5
const CEILING = 2.5

/**
 * And never longer than this, whatever the multiplier says.
 *
 * The relative ceiling alone is not enough, and the first run proved it: a
 * device measured at 4.4 times slower turned "Siêu khó" into a hundred and
 * thirteen seconds a move. That is not a harder opponent, it is an unusable one
 * — nobody sits through two minutes of nothing, and they will conclude the app
 * has hung rather than that it is being thorough.
 *
 * A wait has an upper bound set by patience, not by arithmetic. Past this point
 * the honest trade is a slightly shallower search, which is invisible, over a
 * wait that is not.
 *
 * On a very slow device the top two levels both land here and differ only in
 * their depth target. That is the truth of the situation rather than a flaw in
 * the rule.
 */
const MAX_CAP_MS = 60_000

export const PROFILE_KEY = 'device.profile'
/** Mirrored here as well, because presets are read during render. */
const MIRROR_KEY = 'co-tuong.device.v1'

export interface DeviceProfile {
  /** The best of `samples`, which is the figure everything is derived from. */
  nps: number
  /** Every sample kept, newest last. */
  samples: number[]
  /** Depth reached in the measuring budget. Shown, not used for maths. */
  depth: number
  /** ISO timestamp of the newest sample. */
  at: string
  /** Which engine was measured. A native profile must never be used by the web build. */
  kind: 'native' | 'wasm'
  /** The engine binary that was measured. A new core is a new measurement. */
  core: string
}

/** How much slower than the reference machine, as a plain multiplier. */
export function slowdown(profile: DeviceProfile): number {
  if (profile.nps <= 0) return 1
  return REFERENCE_NPS / profile.nps
}

/**
 * The preset this device should actually use.
 *
 * `maxDepth` is passed through untouched, on purpose — see the note at the top.
 */
export function scalePreset(options: SearchOptions, profile: DeviceProfile | null): SearchOptions {
  if (!profile || !options.movetimeMs) return options
  const factor = Math.min(CEILING, Math.max(FLOOR, slowdown(profile)))
  const scaled = Math.round(options.movetimeMs * factor)
  // Never stretch past what someone will sit through, and never shrink a level
  // that was already under the ceiling into being longer than it was.
  const capped = Math.min(scaled, Math.max(options.movetimeMs, MAX_CAP_MS))
  return { ...options, movetimeMs: capped }
}

/** The time cap each level ends up with on this device. For showing, not deciding. */
export function scaledCaps(profile: DeviceProfile | null): Record<Difficulty, number> {
  const out = {} as Record<Difficulty, number>
  for (const key of Object.keys(DIFFICULTY_PRESETS) as Difficulty[]) {
    out[key] = scalePreset(DIFFICULTY_PRESETS[key].options, profile).movetimeMs ?? 0
  }
  return out
}

function parse(raw: string | null): DeviceProfile | null {
  if (!raw) return null
  try {
    const p = JSON.parse(raw) as Partial<DeviceProfile>
    if (typeof p.nps !== 'number' || !(p.nps > 0)) return null
    return {
      nps: p.nps,
      samples: Array.isArray(p.samples) ? p.samples.filter((n) => typeof n === 'number') : [p.nps],
      depth: typeof p.depth === 'number' ? p.depth : 0,
      at: typeof p.at === 'string' ? p.at : new Date(0).toISOString(),
      kind: p.kind === 'native' ? 'native' : 'wasm',
      core: typeof p.core === 'string' ? p.core : '',
    }
  } catch {
    return null
  }
}

/** Read the stored profile without touching the database. Safe during render. */
export function cachedProfile(): DeviceProfile | null {
  try {
    return parse(localStorage.getItem(MIRROR_KEY))
  } catch {
    return null
  }
}

/**
 * Whether the stored profile still describes this device and this build.
 *
 * A profile measured on the WebAssembly engine says nothing about the desktop
 * one — the native build is roughly twice as fast — so a mismatch is not a stale
 * number, it is the wrong number.
 */
export function isStale(profile: DeviceProfile | null): boolean {
  if (!profile) return true
  const client = getEngineClient()
  if (profile.kind !== client.kind) return true
  const core = runningVersion().core
  if (core && profile.core && profile.core !== core) return true
  const age = Date.now() - new Date(profile.at).getTime()
  return !(age >= 0) || age > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

function store(profile: DeviceProfile): void {
  try {
    localStorage.setItem(MIRROR_KEY, JSON.stringify(profile))
  } catch {
    // A browser refusing storage measures again next time. Not worth failing over.
  }
}

/**
 * Measure this device and keep the result.
 *
 * Existing samples are kept and the best of the last three wins, so calling this
 * repeatedly makes the number better rather than noisier.
 */
export async function measureDevice(): Promise<DeviceProfile> {
  const client = getEngineClient()
  const c: Calibration = await client.calibrate(MEASURE_MS)
  const previous = cachedProfile()
  const samples = [...(previous?.samples ?? []), c.nps].slice(-SAMPLES)
  const profile: DeviceProfile = {
    nps: Math.max(...samples),
    samples,
    depth: c.depth,
    at: new Date().toISOString(),
    kind: client.kind,
    core: runningVersion().core,
  }
  store(profile)
  return profile
}

/** Measure only if there is no usable profile. Cheap, and idempotent. */
export async function ensureProfile(): Promise<DeviceProfile | null> {
  const existing = cachedProfile()
  if (!isStale(existing)) return existing
  try {
    return await measureDevice()
  } catch {
    // Never let a failed measurement stop a game from starting; the unscaled
    // presets are exactly what shipped before this file existed.
    return existing
  }
}
