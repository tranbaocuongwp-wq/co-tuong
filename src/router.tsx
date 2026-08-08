/**
 * Routing.
 *
 * `createHashRouter` rather than a browser router: the app is served both from
 * Tauri's custom protocol and as static files on Cloudflare Pages, and hash
 * routes need no server-side rewrite rules in either. Deep links keep working
 * even when the page is opened straight off disk.
 *
 * ## What is eager, and why the rest is not
 *
 * Every route used to be imported here, which put all seven of them plus Dexie,
 * lucide and react-router into one 640 KB bundle that had to arrive before
 * anything could be drawn. Five of them are now loaded on demand.
 *
 * Home and Play stay eager on purpose. They are the two screens someone reaches
 * within seconds of opening the app, and a lazy Play means a spinner appears
 * immediately after the largest button on the launcher — which reads as the game
 * failing to start rather than as a chunk arriving.
 */

import { createHashRouter } from 'react-router'

import { AppLayout } from './App'
import { HomePage } from './routes/Home'
import { PlayPage } from './routes/Play'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play', element: <PlayPage /> },
      {
        path: 'profile',
        lazy: async () => ({ Component: (await import('./routes/Profile')).ProfilePage }),
      },
      {
        path: 'history',
        lazy: async () => ({ Component: (await import('./routes/History')).HistoryPage }),
      },
      {
        path: 'review/:id',
        lazy: async () => ({ Component: (await import('./routes/Review')).ReviewPage }),
      },
      {
        path: 'settings',
        lazy: async () => ({ Component: (await import('./routes/Settings')).SettingsPage }),
      },
      {
        path: 'about',
        lazy: async () => ({ Component: (await import('./routes/About')).AboutPage }),
      },
    ],
  },
])
