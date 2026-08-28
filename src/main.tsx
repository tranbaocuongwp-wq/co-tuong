import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { IS_TAURI } from './platform'
import { router } from './router'
import { registerServiceWorker } from './pwa'
import './styles.css'

/*
 * Links from the hash era, sent where they were going.
 *
 * Everything used to live behind `#/`, so the links people saved, bookmarked
 * and posted look like `co-tuong.pages.dev/#/play`. A fragment never reaches
 * the server, so `public/_redirects` cannot see one — this is the only place
 * that can.
 *
 * Before the router reads the address, not after: `history.replaceState` here
 * leaves no entry behind, so Back still goes wherever the visitor came from
 * rather than bouncing between the two spellings of the same page.
 */
function unhash(): void {
  if (IS_TAURI) return
  const hash = window.location.hash
  if (!hash.startsWith('#/')) return
  const path = hash.slice(1)
  const moved: Record<string, string> = {
    '/about': '/gioi-thieu',
    '/changelog': '/co-gi-moi',
  }
  const target = moved[path.split('?')[0]] ?? path
  window.history.replaceState(null, '', target + window.location.search)
}

unhash()

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)

registerServiceWorker()

/*
 * Start fetching the engine now — but only if this load is headed for the game.
 *
 * Nothing asked for the 210 KB binary until `Play.tsx` rendered, so the
 * download began *after* the player had already tapped Start, which is the one
 * moment they are least willing to wait. Hoisting it here fixed that.
 *
 * The condition is new, and it is the front page's doing. Someone who opened
 * `/` came to read about a chess app, not to download one, and spending their
 * data on an engine they may never run is exactly the kind of thing a landing
 * page should not do. The front page prefetches it on idle instead, once the
 * page it came for is on screen — see `site/Landing.tsx`.
 *
 * Errors are swallowed on purpose: `useGame` catches the same failure and has
 * somewhere to show it. An unhandled rejection at module scope would only add
 * noise to the console.
 */
const APP_PATHS = ['/play', '/profile', '/history', '/review', '/settings']
const here = window.location.pathname
// The desktop app opens on the board, whatever the address says, so it always
// wants the engine.
if (IS_TAURI || APP_PATHS.some((p) => here === p || here.startsWith(`${p}/`))) {
  // Dynamic, so the WebAssembly glue is not in the entry bundle either. A
  // static import here put it in front of every visitor, including the ones
  // this condition exists to spare.
  void import('./engine/wasm')
    .then((m) => m.loadEngineWasm())
    .catch(() => undefined)
}
