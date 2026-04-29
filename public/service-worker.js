/* eslint-disable no-restricted-globals */

// Security: Version cache name to prevent tampering
// Update this version to force cache refresh on mobile
const CACHE_NAME = 'brickx-v5-' + '2026-04-29d';
const SECURITY_VERSION = '5.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/static/js/bundle.js',
  '/static/js/main.chunk.js',
  '/static/js/0.chunk.js',
  '/manifest.json',
  '/brikx512.png',
  '/nebulamedia.png',
  '/Brikx-Title.png'
];

// Queue for offline high score sync
const SYNC_QUEUE_KEY = 'brikx-sync-queue';

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache.map(url => {
          return new Request(url, {cache: 'reload'});
        })).catch(err => {
          console.log('Cache addAll error:', err);
          // Don't fail installation if some assets fail to cache
          return Promise.resolve();
        });
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Security: Validate response integrity
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Security: Only cache safe methods
            if (event.request.method !== 'GET') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
      .catch(() => {
        // Return offline page if available
        return caches.match('/index.html');
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Push notification event
self.addEventListener('push', (event) => {
  const options = {
    icon: '/brikx512.png',
    badge: '/brikx192.png',
    vibrate: [200, 100, 200],
    tag: 'brikx-notification',
    requireInteraction: false
  };

  let title = 'BRIKX';
  let body = 'New challenge available!';

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      if (data.icon) options.icon = data.icon;
      if (data.data) options.data = data.data;
    } catch (e) {
      body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      ...options
    })
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If a window is already open, focus it
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ('focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// Background sync event for offline high score sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-high-scores') {
    event.waitUntil(syncHighScores());
  }
});

// Function to sync high scores when back online
async function syncHighScores() {
  try {
    // Get queued high scores from IndexedDB or cache
    const cache = await caches.open(CACHE_NAME);
    const queueResponse = await cache.match(SYNC_QUEUE_KEY);
    
    if (!queueResponse) {
      return; // No queued scores
    }

    const queue = await queueResponse.json();
    
    if (queue.length === 0) {
      return;
    }

    // Send all queued scores to clients for processing
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    
    for (const client of clientList) {
      client.postMessage({
        type: 'SYNC_HIGH_SCORES',
        scores: queue
      });
    }

    // Clear the queue after successful sync
    await cache.delete(SYNC_QUEUE_KEY);
    
    console.log('High scores synced successfully');
    
    // Show notification
    await self.registration.showNotification('BRIKX', {
      body: 'Your high scores have been synced!',
      icon: '/brikx512.png',
      tag: 'sync-complete'
    });

  } catch (error) {
    console.error('Failed to sync high scores:', error);
    throw error; // Will retry sync
  }
}

// Message handler for clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'QUEUE_HIGH_SCORE') {
    event.waitUntil(queueHighScore(event.data.score));
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Queue high score for later sync
async function queueHighScore(scoreData) {
  try {
    const cache = await caches.open(CACHE_NAME);
    let queue = [];
    
    const queueResponse = await cache.match(SYNC_QUEUE_KEY);
    if (queueResponse) {
      queue = await queueResponse.json();
    }
    
    queue.push({
      ...scoreData,
      timestamp: Date.now()
    });
    
    await cache.put(
      SYNC_QUEUE_KEY,
      new Response(JSON.stringify(queue), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
    
    console.log('High score queued for sync');
  } catch (error) {
    console.error('Failed to queue high score:', error);
  }
}
