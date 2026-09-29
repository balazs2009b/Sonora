// Sonora service worker.
// Online: mindig a legfrissebb verziót tölti le (és elmenti).
// Offline (vagy nagyon lassú netnél): a legutóbb elmentett verzióval indul.
const CACHE = 'sonora';
const APP_FILES = ['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  const cacheKey = request.mode === 'navigate' ? './' : request;

  // A hálózati kérés akkor is lefut és frissíti a tárolt verziót, ha közben a tárolt változatot adtuk vissza.
  const fromNetwork = fetch(request, { cache: 'no-cache' }).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then((cache) => cache.put(cacheKey, copy)));
    }
    return response;
  });
  event.waitUntil(fromNetwork.catch(() => undefined));

  event.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const useCache = async () => {
        const cached = await caches.match(cacheKey);
        if (cached && !settled) {
          settled = true;
          resolve(cached);
        }
        return cached;
      };
      const timer = setTimeout(useCache, NETWORK_TIMEOUT_MS);
      fromNetwork
        .then((response) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            resolve(response);
          }
        })
        .catch(async () => {
          clearTimeout(timer);
          if (!(await useCache()) && !settled) {
            settled = true;
            resolve(Response.error());
          }
        });
    }),
  );
});
