/**
 * The route element every *playing* screen hangs off.
 *
 * `<Outlet/>` inside `AppShell`, inside `FirstRun`. The pages you read — the
 * front page, the guide, the release notes — hang off `SiteLayout` instead;
 * see `router.tsx` for why the product is split in two.
 *
 * ## Why `FirstRun` moved down here
 *
 * It used to wrap the entire router, so the very first thing a visitor saw was
 * a progress bar downloading a 210 KB chess engine — before they had been told
 * what the app was, let alone asked to play. That was correct when the app's
 * front door was the launcher, and wrong the moment the front door became a
 * page about the app.
 *
 * Down here it guards exactly what it is for: the screens that cannot function
 * without the engine. Someone reading the front page never sees it, and by the
 * time they press the button the engine is usually already there — the landing
 * page prefetches it once the browser goes idle.
 */

import { Outlet } from 'react-router'

import { AppShell } from './components/shell/AppShell'
import { FirstRun } from './components/FirstRun'

export function AppLayout() {
  return (
    <FirstRun>
      <AppShell>
        <Outlet />
      </AppShell>
    </FirstRun>
  )
}
