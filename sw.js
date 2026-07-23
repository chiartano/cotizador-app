const CACHE_PREFIX = 'cotizador-';
const CACHE_NAME = 'cotizador-v7.7';
const CLIENT_PROTOCOL_VERSION = 1;
const CLIENT_ACK_TIMEOUT_MS = 2000;

const CRITICAL_ASSETS = [
  './index.html',
  './app.js',
  './aluminio.js',
  './comparador.js',
  './dashboard.js',
  './iq.js',
  './visual.js',
  './styles.css',
  './agenda/agenda.css',
  './agenda/config.js',
  './agenda/formatters.js',
  './agenda/availability.js',
  './agenda/pendingDrafts.js',
  './agenda/quoteSnapshot.js',
  './agenda/firebase.js',
  './agenda/auth.js',
  './agenda/commands.js',
  './agenda/access.js',
  './agenda/queries.js',
  './agenda/ui.js',
  './manifest.json',
  './icon.png'
];

function capabilityToken(clientId) {
  const randomPart = self.crypto?.randomUUID ? self.crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${clientId}-${randomPart}`;
}

function requestClientCapability(client) {
  return new Promise((resolve, reject) => {
    const token = capabilityToken(client.id);
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      reject(new Error(`Cliente sin ACK compatible: ${client.id}`));
    }, CLIENT_ACK_TIMEOUT_MS);

    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      channel.port1.close();
      const ack = event.data;
      const compatible = ack
        && ack.type === 'WILAN_PWA_CLIENT_CAPABILITY_ACK'
        && ack.token === token
        && ack.protocolVersion === CLIENT_PROTOCOL_VERSION
        && ack.controlledUpdate === true
        && typeof ack.bridgeVersion === 'string';
      if (compatible) resolve(ack);
      else reject(new Error(`ACK incompatible: ${client.id}`));
    };
    channel.port1.start();
    client.postMessage({
      type: 'WILAN_PWA_CLIENT_CAPABILITY_REQUEST',
      protocolVersion: CLIENT_PROTOCOL_VERSION,
      token
    }, [channel.port2]);
  });
}

async function requireCompatibleWindowClients() {
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(windowClients.map(requestClientCapability));
}

function freshRequest(asset) {
  return new Request(new URL(asset, self.registration.scope), { cache: 'reload' });
}

async function fetchCriticalAsset(asset) {
  const response = await fetch(freshRequest(asset));
  if (!response || !response.ok) throw new Error(`Recurso crítico no disponible: ${asset}`);
  return response;
}

async function installCompleteShell() {
  await caches.delete(CACHE_NAME);
  const cache = await caches.open(CACHE_NAME);
  try {
    for (const asset of CRITICAL_ASSETS) {
      const response = await fetchCriticalAsset(asset);
      await cache.put(asset, response.clone());
    }
    const verification = await Promise.all(CRITICAL_ASSETS.map(asset => cache.match(asset)));
    if (verification.some(response => !response)) throw new Error('App shell incompleto');
  } catch (error) {
    await caches.delete(CACHE_NAME);
    throw error;
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await requireCompatibleWindowClients();
    await installCompleteShell();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(cacheName => {
      if (cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME) return caches.delete(cacheName);
      return Promise.resolve(false);
    }));
    await self.clients.claim();
  })());
});

function criticalAssetKey(request) {
  const requestUrl = new URL(request.url);
  for (const asset of CRITICAL_ASSETS) {
    const assetUrl = new URL(asset, self.registration.scope);
    if (requestUrl.origin === assetUrl.origin && requestUrl.pathname === assetUrl.pathname) return asset;
  }
  return null;
}

async function cachedShellResponse(key) {
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(key);
  if (!response) throw new Error(`Recurso ausente en shell activo: ${key}`);
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(cachedShellResponse('./index.html'));
    return;
  }

  const key = criticalAssetKey(request);
  if (key) event.respondWith(cachedShellResponse(key));
});
