/**
 * Routing.
 *
 * ## Two halves, two frames
 *
 * The address bar now separates the *site* from the *app*, because they are two
 * different things pretending to be one used to be the problem. Everything a
 * person reads before they decide to play — the front page, the guide, the
 * release notes — sits under `SiteLayout`: a page with a header, a footer, and
 * no game state in it at all. Everything a person does while playing sits under
 * `AppLayout`, which is the shell with the rail, the board and the side column.
 *
 * `/play` is the game. That is the whole promise of the front page's one big
 * button, and it is the address someone bookmarks.
 *
 * ## Real paths, except inside Tauri
 *
 * `createBrowserRouter` on the web. Marketing pages need addresses that can be
 * read aloud, shared and indexed, and `co-tuong.pages.dev/#/huong-dan` is none
 * of those. Cloudflare Pages serves `index.html` for any unmatched path (see
 * `public/_redirects`) so a cold load of a deep link works.
 *
 * `createHashRouter` inside Tauri, and this is not tidiness. The desktop build
 * is served by a custom protocol that resolves paths straight to files with no
 * SPA fallback of its own: the first load is always `/`, so a browser router
 * would work right up until something reloaded the webview at `/play`, and then
 * the window would go blank with no way back. A hash never leaves `/`.
 *
 * ## What is eager, and why the rest is not
 *
 * Only the front page. It is the first thing anyone sees and it must not wait
 * on a chunk; everything else is loaded when it is asked for.
 *
 * `Play` is deliberately *not* eager any more. It used to be, on the argument
 * that a spinner right after the launcher's Start button reads as the game
 * failing to start — which was right when the launcher was the entry point.
 * Now the entry point is a marketing page, and making every visitor download
 * the board, the engine client and the commentator before they have decided to
 * play is a worse trade. The front page prefetches it on idle instead, so the
 * chunk is usually already there by the time the button is pressed.
 */

import { createBrowserRouter, createHashRouter, Navigate } from 'react-router'

import { IS_TAURI } from './platform'
import { RouteError } from './routes/RouteError'
import { SiteLayout } from './site/SiteLayout'
import { LandingPage } from './site/Landing'

/**
 * What `/` is, and it is not the same thing in both builds.
 *
 * On the web it is the front page: someone who typed the address has not
 * decided anything yet and needs to be told what this is.
 *
 * In the desktop app they decided when they installed it. Opening a downloaded
 * chess program onto a page explaining why you might want a chess program — with
 * a "Cài về máy" button on it — would be absurd, so the desktop app's home is
 * the board. The site's pages are still reachable there (Settings links to
 * them); they simply are not what the window opens on.
 */
const HOME = IS_TAURI ? <Navigate to="/play" replace /> : <LandingPage />

const routes = [
  {
    /*
     * The reading half of the product.
     *
     * One error boundary for every screen, on the layout route rather than on
     * each child, so a screen that fails still leaves the header standing:
     * whatever broke, the way out of it did not.
     */
    path: '/',
    element: <SiteLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: HOME },
      {
        path: 'huong-dan',
        lazy: async () => ({ Component: (await import('./site/Guide')).GuidePage }),
      },
      {
        path: 'gioi-thieu',
        lazy: async () => ({ Component: (await import('./site/About')).AboutPage }),
      },
      {
        path: 'tai-ve',
        lazy: async () => ({ Component: (await import('./site/Download')).DownloadPage }),
      },
      {
        path: 'co-gi-moi',
        lazy: async () => ({ Component: (await import('./site/Changelog')).ChangelogPage }),
      },
      {
        path: 'co-gi-moi/:version',
        lazy: async () => ({ Component: (await import('./site/Changelog')).ReleasePage }),
      },

      /*
       * Where the old addresses used to point.
       *
       * Cloudflare rewrites these before React ever loads (`public/_redirects`),
       * so on the live site nothing reaches here. They exist for the two places
       * that never see those rules: the desktop build, and anyone still holding
       * a `#/about` link from the hash era.
       */
      { path: 'about', element: <Navigate to="/gioi-thieu" replace /> },
      { path: 'changelog', element: <Navigate to="/co-gi-moi" replace /> },
      { path: 'changelog/:version', element: <Navigate to="/co-gi-moi" replace /> },
    ],
  },
  {
    /*
     * The playing half. Same shell it always had.
     *
     * The layout itself is lazy, not just its children. `AppShell` drags in the
     * rail, the side column, the media-query hooks and `FirstRun`'s asset
     * manager, and none of that is any use to someone reading the front page —
     * eager, it was 12 KB of the entry bundle that the majority of visitors
     * never ran.
     */
    path: '/',
    lazy: async () => ({ Component: (await import('./App')).AppLayout }),
    errorElement: <RouteError />,
    children: [
      {
        path: 'play',
        lazy: async () => ({ Component: (await import('./routes/Play')).PlayPage }),
      },
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
    ],
  },
  /*
   * Anything else.
   *
   * Cloudflare hands every unmatched path to `index.html`, which means a typo in
   * the address bar arrives here rather than at a 404 page. Sending it to the
   * front page is the friendlier answer: the visitor lands somewhere that
   * explains what this is, instead of on an apology.
   */
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = IS_TAURI ? createHashRouter(routes) : createBrowserRouter(routes)
