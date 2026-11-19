/**
 * ============================================================================
 * sw.js — Offline-First Classroom PWA Service Worker
 * ============================================================================
 * Caches:
 *  1. Core application shell (HTML, CSS, JS, manifest)
 *  2. MediaPipe Tasks Vision CDN assets (WASM + hand_landmarker.task) on first load
 *     so schools with limited or intermittent internet can run offline.
 */

const APP_CACHE = 'siam-rhythm-app-v3';
const MODEL_CACHE = 'siam-rhythm-mediapipe-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './css/style.css',
  './js/main.js',
  './js/audio.js',
  './js/vision.js',
  './js/gameEngine.js',
  './js/beatmaps.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== MODEL_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cache-First strategy for MediaPipe WASM & HandLandmarker model files
  const isMediaPipeAsset =
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('storage.googleapis.com');

  if (isMediaPipeAsset) {
    event.respondWith(
      caches.open(MODEL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && (response.ok || response.type === 'opaque')) {
          cache.put(request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Same-origin app shell: Stale-While-Revalidate for fast offline startup
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(APP_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkPromise = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              cache.put(request, res.clone());
            }
            return res;
          })
          .catch(() => cached);

        return cached || networkPromise;
      })
    );
  }
});

