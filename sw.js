/* Black Pearl service worker: precache everything, then work fully offline. */
const CACHE = 'blackpearl-v1';
const FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/assets.js",
  "js/audio.js",
  "js/game.js",
  "js/store.js",
  "js/ui.js",
  "images/barrel.webp",
  "images/bird_flock.webp",
  "images/cloud_a.webp",
  "images/cloud_b.webp",
  "images/coin.webp",
  "images/coral.webp",
  "images/heart.webp",
  "images/hills_mid.webp",
  "images/kraken.webp",
  "images/lily_pad.webp",
  "images/monkey.webp",
  "images/moon.webp",
  "images/mountains_far.webp",
  "images/pearl.webp",
  "images/sky_day.webp",
  "images/sky_dusk.webp",
  "images/sky_night.webp",
  "images/stars.webp",
  "images/sun.webp",
  "images/tentacle.webp",
  "images/trees_bank.webp",
  "images/water_tile.webp",
  "images/wreck_rust.webp",
  "images/wreck_teal.webp",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-32.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png"
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
