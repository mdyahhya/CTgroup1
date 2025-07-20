const CACHE_NAME = 'coderverse-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/coderverse.png',
  '/coderverse.png',
  '/coderverse.png',
  '/coderverse.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker: Install event triggered');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activate event triggered');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.startsWith('https://cdnjs.cloudflare.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response
            const responseToCache = response.clone();
            
            // Add to cache
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              })
              .catch((error) => {
                console.error('Service Worker: Failed to cache response', error);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Service Worker: Fetch failed', error);
            // If both cache and network fail, return offline page
            if (event.request.destination === 'document') {
              return caches.match('/index.html').then((fallback) => {
                return fallback || caches.match('/');
              });
            }
            throw error;
          });
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
  // Implement background sync logic here
  return new Promise((resolve, reject) => {
    try {
      console.log('Service Worker: Performing background sync');
      // Add your sync logic here
      // For example, sync user progress, offline quiz results, etc.
      resolve();
    } catch (error) {
      console.error('Service Worker: Background sync failed', error);
      reject(error);
    }
  });
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received');
  
  let notificationData = {};
  
  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (error) {
      console.error('Service Worker: Failed to parse push data', error);
      notificationData = { title: 'CoderVerse', body: 'New notification' };
    }
  }
  
  const options = {
    body: notificationData.body || 'New notification from CoderVerse',
    icon: 'coderverse.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: notificationData.primaryKey || '1',
      url: notificationData.url || '/'
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/coderverse.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icons/icon-72x72.png'
      }
    ],
    requireInteraction: false,
    silent: false
  };
  
  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'CoderVerse', 
      options
    ).catch((error) => {
      console.error('Service Worker: Failed to show notification', error);
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not open, open new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }).catch((error) => {
        console.error('Service Worker: Failed to handle notification click', error);
      })
    );
  } else if (event.action === 'close') {
    // Just close the notification - no action needed
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }).catch((error) => {
        console.error('Service Worker: Failed to open window', error);
      })
    );
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('Service Worker: Message received', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    const port = event.ports[0];
    if (port) {
      port.postMessage({ version: CACHE_NAME });
    } else {
      // Fallback for when no port is available
      event.source.postMessage({ version: CACHE_NAME });
    }
  }
  
  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // Handle manual cache update requests
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urlsToCache);
      }).catch((error) => {
        console.error('Service Worker: Manual cache update failed', error);
      })
    );
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker: Global error', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Unhandled promise rejection', event.reason);
  event.preventDefault();
});
