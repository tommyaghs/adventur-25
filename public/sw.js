// Service Worker per PWA
const CACHE_NAME = 'adventure-25-v1';
const BASE_PATH = self.location.pathname.replace('/sw.js', '');

// Installazione del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker installato');
        // Cache delle risorse principali
        return cache.addAll([
          BASE_PATH + '/',
          BASE_PATH + '/index.html',
          BASE_PATH + '/manifest.json'
        ]).catch((err) => {
          console.log('Errore durante la cache iniziale:', err);
        });
      })
  );
  // Forza l'attivazione immediata del nuovo service worker
  self.skipWaiting();
});

// Fetch event - serve dalla cache quando offline
self.addEventListener('fetch', (event) => {
  // Ignora le richieste non GET
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - ritorna la risposta
        if (response) {
          return response;
        }
        // Network first strategy
        return fetch(event.request).then(
          (response) => {
            // Controlla se abbiamo ricevuto una risposta valida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            // Clona la risposta per la cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        ).catch(() => {
          // Se la rete fallisce e non c'è cache, ritorna una pagina offline di base
          if (event.request.destination === 'document') {
            return caches.match(BASE_PATH + '/index.html');
          }
        });
      })
  );
});

// Attivazione del service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Rimozione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prendi il controllo di tutte le pagine
      return self.clients.claim();
    })
  );
});

