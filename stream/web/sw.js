// App-shell cache for the web version, so the interface opens with no
// connection. Films are not handled here: downloads.js stores them in their
// own cache and plays them from Blob URLs. (The Fire TV wrapper serves the
// app from the APK and does not register this worker.)

const SHELL = 'gysm-shell-v2';
const FILES = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest', 'img/icon.svg',
  'js/app.js', 'js/catalog.js', 'js/config.js', 'js/downloads.js', 'js/feeds.js', 'js/focus.js',
  'js/platform.js', 'js/player.js', 'js/sources.js', 'js/store.js',
  'media/demo-bars.jpg', 'media/demo-fractal.jpg', 'media/demo-life.jpg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gysm-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first for the shell (so updates arrive), cache when offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/offline/')) return;
  if (/\.(webm|mp4)$/.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
