const CACHE_NAME = 'coderverse-v1.0.1';
const OFFLINE_PAGE = '/offline.html';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/coderverse.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event triggered');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Service Worker: Cache failed', error);
      })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event triggered');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - enhanced caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdnjs.cloudflare.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached version if available
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          
          // For HTML pages, try to update cache in background
          if (event.request.destination === 'document') {
            // Update cache in background
            fetch(event.request)
              .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response.clone());
                  });
                }
              })
              .catch(() => {
                // Ignore network errors when updating cache
              });
          }
          
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Add to cache for future requests
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Only cache certain types of requests
                if (event.request.url.includes('api/') || 
                    event.request.destination === 'document' ||
                    event.request.destination === 'script' ||
                    event.request.destination === 'style' ||
                    event.request.destination === 'image') {
                  cache.put(event.request, responseToCache);
                }
              });
            
            return response;
          });
      })
      .catch((error) => {
        console.log('Service Worker: Fetch failed:', error);
        
        // If both cache and network fail, return offline page for navigation requests
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_PAGE).then(offlineResponse => {
            if (offlineResponse) {
              return offlineResponse;
            }
            
            // Fallback offline page if no offline.html cached
            return new Response(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>CoderVerse - Offline</title>
                  <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                             display: flex; align-items: center; justify-content: center; height: 100vh; 
                             margin: 0; background: #f3f4f6; color: #374151; text-align: center; }
                      .offline-container { max-width: 400px; padding: 2rem; }
                      .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
                      .offline-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 1rem; }
                      .offline-message { margin-bottom: 2rem; line-height: 1.6; }
                      .retry-button { background: #3B82F6; color: white; border: none; 
                                    padding: 0.75rem 1.5rem; border-radius: 0.5rem; 
                                    cursor: pointer; font-size: 1rem; }
                      .retry-button:hover { background: #2563eb; }
                  </style>
              </head>
              <body>
                  <div class="offline-container">
                      <div class="offline-icon">📱</div>
                      <h1 class="offline-title">You're Offline</h1>
                      <p class="offline-message">
                          CoderVerse needs an internet connection to work properly. 
                          Please check your connection and try again.
                      </p>
                      <button class="retry-button" onclick="window.location.reload()">
                          Try Again
                      </button>
                  </div>
              </body>
              </html>
            `, {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        }
        
        // For other requests, just fail
        throw error;
      })
  );
});

// Background sync for offline functionality
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  return new Promise((resolve) => {
    console.log('Service Worker: Performing background sync');
    
    // Sync any pending data here
    // For example, sync user progress, quiz results, etc.
    
    // Notify all clients that sync completed
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'BACKGROUND_SYNC_COMPLETE',
          timestamp: Date.now()
        });
      });
    });
    
    resolve();
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'CoderVerse',
    body: 'New content available!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: 'coderverse-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = { ...notificationData, ...data };
    } catch (e) {
      console.log('Service Worker: Could not parse push notification data');
    }
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    requireInteraction: notificationData.requireInteraction,
    vibrate: notificationData.vibrate,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: notificationData.primaryKey || '1',
      url: notificationData.url || '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/icon-192x192.png'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      }).then((clientList) => {
        // Check if the app is already open
        for (let client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus the existing window and navigate to the desired URL
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: urlToOpen
            });
            return client.focus();
          }
        }
        
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  }
  // 'close' action just closes the notification (default behavior)
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Force update cache
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(urlsToCache);
      })
    );
  }

  if (event.data && event.data.type === 'CHECK_UPDATE') {
    // Check for app updates
    event.waitUntil(
      fetch('/manifest.json')
        .then(response => response.json())
        .then(manifest => {
          event.ports[0].postMessage({
            type: 'UPDATE_CHECK_RESULT',
            hasUpdate: false, // Implement version checking logic
            manifest: manifest
          });
        })
        .catch(() => {
          event.ports[0].postMessage({
            type: 'UPDATE_CHECK_RESULT',
            hasUpdate: false,
            error: 'Could not check for updates'
          });
        })
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-sync') {
    event.waitUntil(syncContent());
  }
});

function syncContent() {
  return fetch('/api/sync')
    .then(response => response.json())
    .then(data => {
      // Handle synced content
      console.log('Service Worker: Content synced', data);
      
      // Notify clients about new content
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'CONTENT_SYNC_COMPLETE',
            data: data
          });
        });
      });
    })
    .catch(error => {
      console.log('Service Worker: Content sync failed', error);
    });
}
