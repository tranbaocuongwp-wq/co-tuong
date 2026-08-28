import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, posix, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * Identity of this build, fixed when the config is evaluated and compiled into
 * the bundle as `__BUILD_ID__`.
 *
 * The running app has to know its *own* version without asking the network. If
 * it instead adopted the first manifest it fetched as "current", a client
 * loading stale assets from the service-worker cache would record the newest
 * version as its baseline and conclude it was already up to date — leaving it
 * stuck on the old build forever.
 */
const BUILD_ID = Date.now().toString(36)

/**
 * Emit `version.json` describing the build, split into two identities.
 *
 * The app updates in two independent parts and they are not equally cheap:
 *
 * * **app** — the interface. Changes on almost every deploy, reloads instantly.
 * * **core** — the WebAssembly engine. Changes rarely, is by far the largest
 *   download, and needs the worker to re-instantiate it.
 *
 * Telling them apart lets the client say which kind of update it is instead of
 * asking the player to reload for reasons it cannot explain.
 *
 * Both identities are derived from content hashes, so rebuilding unchanged
 * sources produces the same version and clients see no update at all.
 */
/**
 * Which cache a file belongs in, and whether the game can start without it.
 *
 * The categories exist so one deploy cannot evict another's work. Under a single
 * cache name, shipping a one-line interface change threw away the 210 KB engine
 * binary as well — and, worse, the service worker's sweep also took the voice
 * pack the player had downloaded over their own data.
 */
function categorise(url: string): { category: string; required: boolean } {
  if (url.endsWith('.wasm')) return { category: 'engine', required: true }
  if (/\.(js|css|html)$/.test(url)) return { category: 'shell', required: true }
  if (url.endsWith('.webmanifest')) return { category: 'shell', required: true }
  /*
   * The website's own pictures, and they are their own category on purpose.
   *
   * The nine phone frames on the front page come to about 320 KB. As `media`
   * they would have been swept up by the background download that runs once the
   * engine is in — so every player who pressed the button and never looked at
   * the site again would still be paying for the site's screenshots on their
   * data. They are not in `skip` either: keeping them in the inventory is what
   * gives this cache a content-derived name, and without one a redeployed
   * screenshot would sit in a visitor's cache for ever under its unchanged
   * filename. Nothing downloads them ahead of time; the service worker keeps
   * whichever ones somebody actually looked at.
   */
  if (url.startsWith('shots/')) return { category: 'site', required: false }
  // Sound and pictures. The game plays without them — it falls back to
  // synthesised audio and simply omits a banner — so nothing waits on these.
  return { category: 'media', required: false }
}

/** Every file under `dir`, as forward-slashed paths relative to it. */
function walk(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, base))
    else out.push(relative(base, full).split(sep).join(posix.sep))
  }
  return out
}

function versionManifest(): Plugin {
  return {
    name: 'co-tuong-version-manifest',
    apply: 'build',
    writeBundle(options, bundle) {
      const names = Object.keys(bundle).sort()

      // The engine's identity is the hash Vite gave its .wasm, which is the
      // hash of the binary itself — so it changes only when the engine really
      // changed, and the client can read it straight off the URL it imported.
      // The bare filename, which already carries Vite's content hash. The
      // client compares the same string, so there is no pattern to get wrong.
      const wasmName = names.find((n) => n.endsWith('.wasm')) ?? ''
      const core = wasmName.split('/').pop() ?? 'unknown'
      const app = BUILD_ID

      const outDir = options.dir ?? join(here, 'dist')
      const builtAt = new Date().toISOString()

      // `version.json` keeps its exact shape. Clients already deployed in the
      // wild read it to decide whether to update, and breaking it means they
      // never update again — including to the build that would have fixed it.
      writeFileSync(
        join(outDir, 'version.json'),
        JSON.stringify({ app, core, builtAt }, null, 2)
      )

      /*
       * And a full inventory, which `version.json` cannot become without
       * breaking those clients.
       *
       * Built by walking the output directory rather than by reading rollup's
       * bundle object, and that is not a shortcut: everything in `public/` —
       * the sound effects, the banners, the icons, the web manifest — is copied
       * by Vite and never appears in `bundle` at all. Walking `dist` is the only
       * way to describe what actually shipped, and it gives true byte counts for
       * free.
       */
      // Server instructions and crawler files. None of them is an asset the app
      // ever fetches, and precaching a `sitemap.xml` is nobody's idea of
      // offline support.
      const skip = new Set([
        'version.json',
        'assets.json',
        'sw.js',
        '_headers',
        '_redirects',
        'robots.txt',
        'sitemap.xml',
      ])
      const files = walk(outDir)
        .filter((f) => !skip.has(f))
        .sort()

      const assets = files.map((f) => ({
        url: `./${f}`,
        bytes: statSync(join(outDir, f)).size,
        ...categorise(f),
      }))

      // The media cache is keyed on what is in it, so redeploying an unchanged
      // sound effect does not make anyone download it twice.
      const mediaHash = createHash('sha256')
      for (const a of assets.filter((x) => x.category === 'media')) {
        mediaHash.update(a.url).update(String(a.bytes))
      }
      const siteHash = createHash('sha256')
      for (const a of assets.filter((x) => x.category === 'site')) {
        siteHash.update(a.url).update(String(a.bytes))
      }
      // Non-greedy: `^.*-` would run to the *last* dash and throw away half the
      // hash, since Vite's hashes may contain one themselves.
      const coreHash = core.replace(/^[^-]*-/, '').replace(/\.\w+$/, '') || 'unknown'

      writeFileSync(
        join(outDir, 'assets.json'),
        JSON.stringify(
          {
            app,
            core,
            builtAt,
            caches: {
              shell: `co-tuong-shell-${app}`,
              engine: `co-tuong-engine-${coreHash}`,
              media: `co-tuong-media-${mediaHash.digest('hex').slice(0, 8)}`,
              site: `co-tuong-site-${siteHash.digest('hex').slice(0, 8)}`,
              // Not this build's to name, and never this build's to delete. The
              // voice pack is downloaded by the player, over their own data, and
              // it is measured in megabytes.
              voice: 'co-tuong-voice-v1',
            },
            assets,
          },
          null,
          2
        )
      )
    },
  }
}

/*
 * Absolute asset URLs, and a `<base href="/">` in index.html to match.
 *
 * This used to be `'./'`, which was right while every screen lived behind a
 * hash — the document URL never left `/`, so "relative to the document" and
 * "relative to the root" were the same place. The marketing pages needed real
 * paths (`/huong-dan`, `/play`, `/review/<id>`), and the moment the document
 * URL has a path segment in it, a relative asset URL resolves against that
 * segment: `/review/abc` would have looked for `/review/assets/index.js`.
 *
 * Absolute is correct for both targets. Cloudflare Pages serves from the origin
 * root, and Tauri v2 serves `frontendDist` from the root of its custom protocol
 * — which is what the stock Tauri template assumes.
 */
export default defineConfig({
  plugins: [react(), tailwindcss(), versionManifest()],
  base: '/',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    target: 'es2022',
    // Never inline .wasm — it must stay a separate file so the browser can
    // stream-compile it and so the worker can fetch it by URL.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Rust build artifacts churn constantly and would thrash the dev server.
      //
      // These are anchored to the project root on purpose. A bare `**/engine/**`
      // also matches `src/engine/`, which silently stops Vite from watching the
      // frontend's own engine bindings — edits there appear to do nothing.
      ignored: [
        `${here}src-tauri/**`,
        `${here}target/**`,
        `${here}engine/**`,
        `${here}engine-wasm/**`,
      ],
    },
  },
  // wasm-pack output is generated, not authored — don't let Vite pre-bundle it.
  optimizeDeps: {
    exclude: ['./src/wasm/co_tuong_engine_wasm.js'],
  },
})
