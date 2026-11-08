// Service worker: shows push notifications and opens the app when one is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Private photos come through short-lived signed links (the ?token= changes). Cache them by path
// instead, so each photo is downloaded once per phone.
const PHOTO_CACHE = 'photos-v1';
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || !url.pathname.startsWith('/storage/v1/object/sign/photos/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(PHOTO_CACHE);
    const key = url.origin + url.pathname;
    const hit = await cache.match(key);
    if (hit) return hit;
    const res = await fetch(event.request);
    if (res.ok) await cache.put(key, res.clone());
    return res;
  })());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text push */ }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Sprout 🌱', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'sprout',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find((c) => c.url.startsWith(self.location.origin));
    if (open) {
      try {
        await open.focus();
        if (open.url !== url) await open.navigate(url);
        return;
      } catch {
        // Older Safari can't focus/navigate an existing window; opening one still works.
      }
    }
    return self.clients.openWindow(url);
  })());
});
