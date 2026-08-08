/**
 * The inventory of what this build shipped.
 *
 * Generated at build time by walking `dist/` — see `versionManifest()` in
 * `vite.config.ts`. Walking the output rather than reading rollup's bundle
 * object is the only way to see everything: `public/` is copied verbatim by
 * Vite and never appears in the bundle at all, so the sound effects, the
 * banners, the icons and the web manifest would all be missing from a list
 * built the obvious way.
 *
 * Read by two things that must agree: the service worker, which precaches from
 * it, and `manager.ts`, which downloads from it and reports progress. They open
 * the same cache names because the names live here rather than in two
 * hand-edited constants — the previous arrangement had exactly that, and they
 * drifted.
 */

/** Which cache a file belongs in. */
export type AssetCategory = 'shell' | 'engine' | 'media' | 'voice'

export interface AssetEntry {
  url: string
  bytes: number
  category: AssetCategory
  /** Whether the game can start without it. Only `shell` and `engine` are. */
  required: boolean
}

export interface AssetManifest {
  app: string
  core: string
  builtAt: string
  /** Cache name per category. Independently versioned, deliberately. */
  caches: Record<AssetCategory, string>
  assets: AssetEntry[]
}

/**
 * Fetch it, bypassing every cache.
 *
 * The same `no-store` plus cache-buster that `update.ts` uses, and for the same
 * reason: this is the file that says whether the cached files are stale, so a
 * cached copy of it is a client that can never find out.
 */
export async function fetchAssetManifest(): Promise<AssetManifest | null> {
  try {
    const url = new URL('assets.json', document.baseURI)
    url.searchParams.set('t', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<AssetManifest>
    if (!Array.isArray(data.assets) || !data.caches) return null
    return data as AssetManifest
  } catch {
    // Offline, or a build without a manifest. Every caller treats null as "carry
    // on without it" rather than as an error, because the game does not need it.
    return null
  }
}

/** Everything in the given categories. */
export function assetsIn(
  manifest: AssetManifest,
  categories: AssetCategory[]
): AssetEntry[] {
  return manifest.assets.filter((a) => categories.includes(a.category))
}
