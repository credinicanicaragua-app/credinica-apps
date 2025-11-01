
// Service Worker para CrediNica PWA
// Proporciona funcionalidad offline y cache inteligente

const CACHE_NAME = 'credinica-v2';
const STATIC_CACHE = 'credinica-static-v2';
const DYNAMIC_CACHE = 'credinica-dynamic-v2';

const staticAssets = [
  '/',
  '/login',
  '/dashboard',
  '/manifest.json',
  '/CrediNica inicial.png',
  '/CrediNica.png',
  '/globals.css'
];

const apiRoutes = [
  '/api/me',
  '/api/credits',
  '/api/clients'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('CrediNica SW: Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('CrediNica SW: Caching static assets');
        return cache.addAll(staticAssets);
      })
      .then(() => self.skipWaiting())
  );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
  console.log('CrediNica SW: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
            console.log('CrediNica SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia de cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Cache first para assets estáticos
  if (staticAssets.includes(url.pathname)) {
    event.respondWith(
      caches.match(request)
        .then(response => response || fetch(request))
    );
    return;
  }

  // Network first para APIs
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Solo cachear respuestas exitosas
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE)
              .then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          // Fallback a cache si no hay red
          return caches.match(request);
        })
    );
    return;
  }

  // Cache first para páginas
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(request)
          .then(response => {
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(DYNAMIC_CACHE)
                .then(cache => cache.put(request, responseClone));
            }
            return response;
          });
      })
  );
});
