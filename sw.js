// Bump VERSION on EVERY update you deploy (v4 -> v5 -> v6 ...) so phones drop the old cache and fetch the new index.html.
const VERSION = 'v8';
const PREFIX = 'wattsupcit-';
const CACHE = PREFIX + VERSION;
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './step1.jpg', './step2.jpg', './step3.jpg', './step4.jpg', './step5.jpg', './step6.jpg'];
const APP_ROOT = new URL('./', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                                   // never touch POST/PUT/DELETE (uploads, API writes)
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  if (req.headers.has('range')) return;                               // video/audio range requests always go straight to the network
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // Supabase API, Storage, signed URLs, Realtime, CDNs, fonts: never intercepted or cached
  if (/\/(rest|auth|storage|realtime|functions)\/v1\//.test(url.pathname) || url.searchParams.has('token')) return; // safety net if Supabase is ever proxied same-origin

  if (req.mode === 'navigate') {                                      // pages: network-first, always revalidated, 5 s fallback to the cached copy
    const isApp = url.pathname === APP_ROOT || url.pathname === APP_ROOT + 'index.html';
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req, { cache: 'no-cache' }).then((res) => {
        if (isApp && res && res.status === 200 && res.type === 'basic') cache.put('./index.html', res.clone()).catch(() => {});
        return res;
      });
      const hit = await cache.match('./index.html');
      if (!hit) return net.catch(() => Response.error());
      event.waitUntil(net.catch(() => {}));
      return Promise.race([net, new Promise((r) => setTimeout(() => r(hit), 5000))]).catch(() => hit);
    })());
    return;
  }

  event.respondWith((async () => {                                    // other same-origin files: stale-while-revalidate
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const update = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    if (cached) { event.waitUntil(update); return cached; }
    return (await update) || Response.error();
  })());
});
