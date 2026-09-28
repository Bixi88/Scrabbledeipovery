// Service worker di "Scrabble GO".
// Pre-cachea il gioco e i dizionari così funziona anche offline dal secondo avvio,
// ma dà sempre priorità alla rete: appena pubblichi un commit su GitHub, il primo
// dispositivo online lo scarica subito (niente più bisogno di alzare a mano un
// numero di versione o svuotare la cache).
const CACHE_NAME = 'scrabble-go-v2-network-first';

// File da salvare subito all'installazione. dizionario.txt/dizionario2.txt sono
// opzionali: se non esistono ancora nel repo, il precache degli altri file riesce
// comunque.
const CORE_ASSETS = [
  './',
  './index.html',
  './dizionario.txt',
  './dizionario2.txt',
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
            // Non blocchiamo l'installazione se manca un file opzionale.
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

// Strategia: network-first. Prova sempre a scaricare l'ultima versione dalla
// rete (così ogni commit arriva subito); se non c'è rete, usa la copia salvata
// in cache come riserva offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Multiplayer: le chiamate API di Firebase (Firestore/Auth) sono connessioni continue
  // e non vanno intercettate né messe in cache. Gli script dell'SDK (gstatic) invece sì,
  // così l'app riparte anche offline.
  const host = new URL(event.request.url).hostname;
  if (/^(firestore|identitytoolkit|securetoken|firebaseinstallations)\.googleapis\.com$/.test(host)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Quando index.html scopre una nuova versione del service worker già pronta,
// le manda questo messaggio per farla subentrare subito (vedi register() in
// index.html): senza aspettare che tutte le schede vengano chiuse.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
