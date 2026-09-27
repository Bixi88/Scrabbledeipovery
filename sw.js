// Service worker di "Scrabble GO · CPU".
// Pre-cachea il gioco e il dizionario così funziona anche offline dal secondo avvio.
//
// Quando aggiorni index.html o sostituisci dizionario.txt con una lista più
// grande, alza il numero di CACHE_VERSION qui sotto: forza tutti i dispositivi
// a scaricare di nuovo i file aggiornati invece di usare la vecchia copia in cache.
const CACHE_VERSION = 'v1';
const CACHE_NAME = `scrabble-go-${CACHE_VERSION}`;

// File da salvare subito all'installazione. dizionario.txt è opzionale: se non
// esiste ancora nel repo, il precache degli altri file riesce comunque.
const CORE_ASSETS = [
  './',
  './index.html',
  './dizionario.txt',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            // Non blocchiamo l'installazione se manca un file opzionale (es. dizionario.txt).
            console.warn(`[sw] impossibile pre-cacheare ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategia: cache-first con aggiornamento in background ("stale-while-revalidate").
// L'utente vede subito la versione in cache (anche offline); se c'è rete, la cache
// viene aggiornata silenziosamente per la volta successiva.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // offline: se la rete fallisce, resta la cache

      return cached || networkFetch;
    })
  );
});
