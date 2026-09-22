const CACHE_NAME = 'camp-ops-04915b7215';

// Tutte le risorse sono locali (stesso dominio): il precache è affidabile.
// Nessuna dipendenza da CDN esterni -> l'app funziona offline al 100%.
const ASSETS = [
  './',
  './index.html',
  './App.js',
  './firebase-config.js',
  './sync-merge.js',
  './pdf-ricordo.js',
  './conti.js',
  './presenze.js',
  './allarmi.js',
  './lingue.js',
  './auth.js',
  './stanza.js',
  './menu-spesa.js',
  './magazzino-foto.js',
  './firebase-sync.js',
  './manifest.json',
  './logo.png',
  './bandy.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/tailwind.js',
  './vendor/fonts.css',
  './vendor/fonts/special-elite-latin-400-normal.woff2',
  './vendor/fonts/special-elite-latin-ext-400-normal.woff2',
  './vendor/fonts/courier-prime-latin-400-normal.woff2',
  './vendor/fonts/courier-prime-latin-700-normal.woff2'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Non intercettare le richieste esterne (es. Firebase/Firestore): passano
  // direttamente alla rete, senza cache, senza interferenze.
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Runtime caching di eventuali richieste non previste.
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline e non in cache: per le navigazioni serviamo l'app.
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
