// Bump VERSION on EVERY update you deploy (v1 -> v2 -> v3 ...) so phones drop the old cache.
const VERSION = 'v3';
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
  if (req.method !== 'GET') return;                                   // never touch POST/PUT/etc.
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // never touch Supabase, fonts, CDNs

  if (req.mode === 'navigate') {                                      // pages: network-first
    event.respondWith(
      fetch(req)
        .then((res) => {
          const isApp = url.pathname === APP_ROOT || url.pathname === APP_ROOT + 'index.html';
          if (isApp && res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.open(CACHE).then((c) => c.match('./index.html')).then((r) => r || Response.error()))
    );
    return;
  }

  event.respondWith((async () => {                                    // other files: stale-while-revalidate
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
