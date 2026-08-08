/**
 * The route element every screen hangs off.
 *
 * All it does now is put `<Outlet/>` inside `AppShell`. The top bar, the
 * per-page title, the mobile back chevron and the duplicated link list that used
 * to live here have moved into the shell, where there is one arrangement instead
 * of three — see `components/shell/AppShell.tsx` for why that mattered.
 */

import { Outlet } from 'react-router'

import { AppShell } from './components/shell/AppShell'

export function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}
