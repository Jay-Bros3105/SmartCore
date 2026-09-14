/**
 * Neo SmartCore — Service Worker (PWA + Firebase messaging background)
 *
 * - Hukokota shell (matumizi ya kila GET) kwa PWA installer/injini.
 * - Hupokea push za Firebase Messaging wakati app iko background / imefungwa
 *   na kuonesha notification ya "Neo-SmartCore" yenye icon ya SmartCore.
 */

importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBkxk_5m5J_nuDHwRl4lQwZO_n_KKkaPRQ',
  projectId: 'smartcore-6673d',
  messagingSenderId: '123226096302',
  appId: '1:123226096302:web:394ef7d0a9d3ac534e233f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    'Neo-SmartCore';
  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    '';
  const path = (payload.data && payload.data.path) || '/';
  const options = {
    body,
    icon: payload.notification && payload.notification.icon
      ? payload.notification.icon
      : '/NeoSmartCore_Icon.png',
    badge: '/NeoSmartCore_Icon.png',
    data: { url: path },
    vibrate: [120, 40, 120],
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url.split('?')[0])) {
          return client.navigate(url);
        }
      }
      return clients.openWindow(url);
    })
  );
});

const CACHE_NAME = 'neo-smartcore-shell-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  // USIIngilie Firestore streaming channels (Write/Listen RPC) — ni stream za muda
  // mrefu, haziwezi ku-cache. Kuzii-intercept kumekuwa chanzo cha "unexpected error"
  // kilichozuia Add Shop na kusoma registrations. Pia achukue googleapis nyingine zote.
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('google.firestore.v1.Firestore') ||
    url.includes('/Listen/channel') ||
    url.includes('/Write/channel') ||
    url.includes('googleapis.com') ||
    url.startsWith('https://www.gstatic.com') ||
    url.startsWith('https://securetoken.googleapis.com')
  ) {
    return;
  }
  // Usikokote HTML documents — kurudi pages zilizotumia muda mrefu.
  const isHtml =
    event.request.destination === 'document' ||
    (event.request.headers.get('Accept') || '').includes('text/html');
  if (isHtml) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok && event.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});