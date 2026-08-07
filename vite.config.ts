import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
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
      writeFileSync(
        join(outDir, 'version.json'),
        JSON.stringify({ app, core, builtAt: new Date().toISOString() }, null, 2)
      )
    },
  }
}

// Tauri serves the frontend over a custom protocol and the web build is a plain
// static bundle on Cloudflare Pages. Both need relative asset URLs, so `base`
// stays './' and routing is hash-based (see src/router.tsx).
export default defineConfig({
  plugins: [react(), tailwindcss(), versionManifest()],
  base: './',
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
