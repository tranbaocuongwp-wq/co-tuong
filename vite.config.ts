import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

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

      // Vite already content-hashes every filename, so hashing the file list
      // captures any change to any asset.
      const app = createHash('sha256').update(names.join('|')).digest('hex').slice(0, 12)

      // The engine's identity is the hash Vite gave its .wasm, which is the
      // hash of the binary itself.
      const wasmName = names.find((n) => n.endsWith('.wasm')) ?? ''
      const core =
        wasmName.match(/-([A-Za-z0-9_-]{8,})\.wasm$/)?.[1] ??
        createHash('sha256').update(wasmName).digest('hex').slice(0, 12)

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
  plugins: [react(), versionManifest()],
  base: './',
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
    exclude: ['./src/wasm/xiangqi_engine_wasm.js'],
  },
})
