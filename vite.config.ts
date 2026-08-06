import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const here = fileURLToPath(new URL('.', import.meta.url))

// Tauri serves the frontend over a custom protocol and the web build is a plain
// static bundle on Cloudflare Pages. Both need relative asset URLs, so `base`
// stays './' and routing is hash-based (see src/router.tsx).
export default defineConfig({
  plugins: [react()],
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
