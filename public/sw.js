const CACHE_PREFIX = 'xiaozhou-care-v02-';
const CACHE_NAME = 'xiaozhou-care-v02-dev'; // Replaced with a content hash after build.
const APP_SHELL = new URL('./', self.location.href).toString();
const PRECACHE_PATHS = ['./', 'manifest.webmanifest', 'favicon.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-1024.png']; // Build adds all JS/CSS chunks.
const CORE_ASSETS = PRECACHE_PATHS.map((path) => new URL(path, APP_SHELL).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  // A new worker waits until existing pages close, keeping HTML and assets on one version.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(APP_SHELL)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Keep the navigation shell on the worker's version until a new worker activates.
    const key = event.request.mode === 'navigate' ? APP_SHELL : event.request;
    const cached = await cache.match(key);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) await cache.put(key, response.clone());
    return response;
  })());
});
