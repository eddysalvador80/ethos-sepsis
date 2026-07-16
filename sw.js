// ETHOS·Sepsis — Service Worker
// Mismo patrón que ETHOS·TX (probado en la suite).
//
// Estrategia: NETWORK-FIRST para la navegación/HTML — con conexión SIEMPRE se
// sirve la versión más fresca, y la caché es solo el respaldo si no hay red.
// Esto es deliberado y es lo que hace segura a una app clínica instalada: una
// versión vieja pegada en el teléfono puntuaría un GCS 20 como "normal" en
// verde, y el usuario no tendría forma de saberlo. La app puede quedar
// desactualizada solo mientras esté sin señal; en cuanto hay red, se actualiza
// sola al abrirla. CACHE-FIRST para estáticos (íconos, manifest), que no cambian.
//
// AL PUBLICAR UNA VERSIÓN NUEVA: subir el número de CACHE (abajo). El evento
// 'activate' borra todas las cachés que no coincidan → adiós versión vieja.
const CACHE = 'ethos-sepsis-v1-2';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icono-192.png',
  './icono-512.png',
  './icono-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();               // no esperar a que se cierren las pestañas viejas
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();     // tomar el control de las pestañas ya abiertas
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');

  if (isHTML) {
    // Network-first: la versión más reciente; si no hay red, la caché.
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para estáticos: rápidos y disponibles offline.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      });
    })
  );
});
