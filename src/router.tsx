/**
 * Routing.
 *
 * `createHashRouter` rather than a browser router: the app is served both from
 * Tauri's custom protocol and as static files on Cloudflare Pages, and hash
 * routes need no server-side rewrite rules in either. Deep links keep working
 * even when the page is opened straight off disk.
 */

import { createHashRouter } from 'react-router'

import { AppLayout } from './App'
import { AboutPage } from './routes/About'
import { HistoryPage } from './routes/History'
import { HomePage } from './routes/Home'
import { PlayPage } from './routes/Play'
import { ReviewPage } from './routes/Review'
import { SettingsPage } from './routes/Settings'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play', element: <PlayPage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'review/:id', element: <ReviewPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'about', element: <AboutPage /> },
    ],
  },
])
