const CACHE_NAME = 'cotizador-v7.2';

// Archivos esenciales para que la app funcione offline.
// Estrategia: network-first → siempre intenta internet primero,
// si falla usa el caché. Eso significa que cualquier cambio en
// estos archivos se aplica automáticamente al abrir con datos.
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './app.js',
  './aluminio.js',
  './comparador.js',
  './dashboard.js',
  './iq.js',
  './visual.js',
  './icon.png',
  './icono.png'
];

self.addEventListener('install', event => {
  // Obliga al SW a activarse inmediatamente (sin esperar a que se cierren pestañas)
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usamos add individual para que la instalación no falle si algún
        // icono opcional no está presente en el servidor
        return Promise.all(
          urlsToCache.map(url => cache.add(url).catch(err => {
            console.warn('No se pudo cachear:', url, err);
          }))
        );
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            // Borra caches viejos (cotizador-v3, etc.)
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Reclama el control de la página inmediatamente
  self.clients.claim();
});

// FETCH: ESTRATEGIA "NETWORK FIRST" (Primero Internet, luego Caché).
// Esto garantiza que los usuarios siempre vean la versión más reciente
// cuando tengan conexión, y solo usen caché si están offline.
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
