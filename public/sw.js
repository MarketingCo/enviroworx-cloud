/**
 * Enviroworx Driver — Service Worker
 * Handles static asset caching, dynamic page caching,
 * background sync for completed jobs, and offline support.
 */

const CACHE_NAME = 'enviroworx-driver-v1'
const STATIC_ASSETS = [
  '/driver',
  '/driver/page', // Next.js page
]

// Install: cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Install')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    }).catch((err) => {
      console.warn('[SW] Cache addAll failed:', err)
    })
  )
  self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate')
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Fetch: serve from cache, fall back to network, cache dynamic requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls and Supabase realtime
  if (url.pathname.startsWith('/api/') ||
      url.pathname.includes('/rest/v1/') ||
      url.pathname.includes('/realtime/') ||
      url.host.includes('supabase.co')) {
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      // Return cached version if found
      if (cached) {
        // Still fetch in background to update cache
        fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response))
          }
        }).catch(() => {})
        return cached
      }

      // Otherwise fetch from network
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        // Cache the response
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache)
        })
        return response
      }).catch(() => {
        // Offline fallback — could return a cached offline page
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      })
    })
  )
})

// Background sync for completed jobs
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-completed-jobs') {
    event.waitUntil(syncCompletedJobs())
  }
})

async function syncCompletedJobs() {
  // This will be called when connectivity is restored
  // The client (driver app) handles the actual IndexedDB flush
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETED_JOBS' })
  })
}

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
