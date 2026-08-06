/**
 * Service-worker registration.
 *
 * Only the web build needs one: inside Tauri the assets are already local, and
 * registering there would add a redundant cache layer over a custom protocol.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return
  if ('__TAURI_INTERNALS__' in window) return
  if (!('serviceWorker' in navigator)) return
  // A service worker needs a secure context; on plain http://<lan-ip> during
  // development there is none, and registration would throw.
  if (!window.isSecureContext) return

  window.addEventListener('load', () => {
    const url = new URL('sw.js', document.baseURI)
    navigator.serviceWorker.register(url, { scope: './' }).catch(() => {
      // Offline caching is an enhancement; the app works without it.
    })
  })
}
