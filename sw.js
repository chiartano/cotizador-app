
const CACHE_NAME = 'cotizador-v2';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon.png'
];

self.addEventListener('install', event => {
  // Obliga al SW a activarse inmediatamente
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Reclama el control de la página inmediatamente
  self.clients.claim();
});

// FETCH: ESTRATEGIA "NETWORK FIRST" (Primero Internet, luego Caché)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si hay internet y responde bien, guardamos una copia fresca en caché
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clonamos la respuesta para guardarla
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Si NO hay internet, devolvemos lo que haya en caché
        return caches.match(event.request);
      })
  );
});
