// Deliberately minimal: this app's data goes through Firestore's own
// offline persistence already, so this worker never caches or intercepts
// Firebase/Identity Toolkit requests. It exists to satisfy the browser's
// PWA installability check (a registered service worker with a fetch
// handler), and to cache the built static shell for faster reloads.

const SHELL_CACHE = 'live-count-shell-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only same-origin, same-scope GET requests for the static shell.
  // Everything else (Firestore, Identity Toolkit, cross-origin) passes
  // through untouched.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
