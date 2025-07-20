const CACHE_NAME = 'coderverse-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/coderverse.png',
  '/icons/icon-512x512.png',
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
        console.log('Service Worker: Cache failed', error);
      })
  );
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
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        if (response) {
          console.log('Service Worker: Serving from cache:', event.request.url);
          return response;
        }
        
        console.log('Service Worker: Fetching from network:', event.request.url);
        return fetch(event.request).then((response) => {
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
            });
          
          return response;
        });
      })
      .catch(() => {
        // If both cache and network fail, return offline page
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
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
  return new Promise((resolve) => {
    console.log('Service Worker: Performing background sync');
    // Add your sync logic here
    resolve();
  });
}

// Push notifications (optional)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    console.log('Service Worker: Push notification received', data);
    
    const options = {
      body: data.body || 'New notification from CoderVerse',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: data.primaryKey || '1'
      },
      actions: [
        {
          action: 'explore',
          title: 'Open App',
          icon: '/icons/icon-192x192.png'
        },
        {
          action: 'close',
          title: 'Close',
          icon: '/icons/icon-192x192.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'CoderVerse', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked', event);
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.openWindow('/')
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
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
