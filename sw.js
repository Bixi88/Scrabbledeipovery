// Service worker di "SCRABBLEdeipovery".
// Pre-cachea il gioco e i dizionari così funziona anche offline dal secondo avvio,
// ma dà sempre priorità alla rete: appena pubblichi un commit su GitHub, il primo
// dispositivo online lo scarica subito (niente più bisogno di alzare a mano un
// numero di versione o svuotare la cache).
const CACHE_NAME = 'scrabbledeipovery-v7-network-first';

// File da salvare subito all'installazione. dizionario.txt/dizionario2.txt sono
// opzionali: se non esistono ancora nel repo, il precache degli altri file riesce
// comunque.
const CORE_ASSETS = [
  './',
  './index.html',
  './dizionario.txt',
  './dizionario2.txt',
  './dizionariosbagliato.txt',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './badge-96.png',
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
    // cache: 'no-cache' = chiede sempre al server se il file è cambiato (salta la cache HTTP
    // di GitHub Pages, che altrimenti può servire il vecchio index.html per circa 10 minuti).
    fetch(event.request, { cache: 'no-cache' })
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

// ---------- Notifiche push ----------
// Il Worker Cloudflare manda un messaggio cifrato {title, body, gameId, tag}: qui lo
// trasformiamo in notifica. Se l'app è aperta e in primo piano non serve disturbare
// (tranne su iPhone/iPad, dove Apple pretende una notifica per ogni push ricevuto).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'SCRABBLEdeipovery';
  const options = {
    body: data.body || 'Tocca a te!',
    icon: './icon-192.png',
    // Icona piccola nella barra di stato di Android (al posto della campanella): una "S" bianca
    badge: './badge-96.png',
    tag: data.tag || 'scrabble',
    renotify: true,
    data: { gameId: data.gameId || null }
  };
  event.waitUntil((async () => {
    const isApple = /iPhone|iPad|iPod/.test(self.navigator.userAgent || '');
    if (!isApple) {
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (wins.some((c) => c.visibilityState === 'visible' && c.focused)) return;
    }
    await self.registration.showNotification(title, options);
  })());
});

// Tocco sulla notifica: porta in primo piano l'app e apre la partita giusta.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const gameId = event.notification.data && event.notification.data.gameId;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of wins) {
      if ('focus' in c) {
        await c.focus();
        if (gameId) c.postMessage({ type: 'openGame', gameId });
        return;
      }
    }
    const url = new URL('./index.html', self.registration.scope);
    if (gameId) url.searchParams.set('game', gameId);
    await self.clients.openWindow(url.href);
  })());
});
