import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'

import { FirstRun } from './components/FirstRun'
import { loadEngineWasm } from './engine/wasm'
import { router } from './router'
import { registerServiceWorker } from './pwa'
import './styles.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root is missing from index.html')

createRoot(root).render(
  <StrictMode>
    <FirstRun>
      <RouterProvider router={router} />
    </FirstRun>
  </StrictMode>
)

registerServiceWorker()

/*
 * Start fetching the engine now rather than when the board mounts.
 *
 * Nothing asked for it until `Play.tsx` rendered, so the 210 KB download began
 * *after* the player had already tapped Start — the one moment they are least
 * willing to wait. It is memoised, so the play screen's own call joins this one
 * rather than starting a second.
 *
 * Errors are swallowed here on purpose: `useGame` catches the same failure and
 * has somewhere to show it. An unhandled rejection at module scope would only
 * add noise to the console.
 */
void loadEngineWasm().catch(() => undefined)
