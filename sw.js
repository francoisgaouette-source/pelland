/* Fanion — garde l'app sur le téléphone pour qu'elle s'ouvre sans réseau. */
const V = 'fanion-v4';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(c => c.addAll(['./', './manifest.webmanifest', './icon-180.png', './icon-192.png']).catch(() => {})));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  // Le site web (dossier site/) n'est pas l'app : on ne le garde pas en cache
  if (u.origin === self.location.origin && u.pathname.includes('/site/')) return;
  // La base de données et la connexion Firebase gèrent elles-mêmes le hors ligne : on n'y touche pas
  if (/(^|\.)googleapis\.com$/.test(u.hostname) && u.hostname !== 'fonts.googleapis.com') return;
  if (/firebaseio|identitytoolkit|securetoken/.test(u.hostname)) return;
  // La page : réseau d'abord (dernière version), sinon la copie gardée
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put('./', cp)); return res; }).catch(() => caches.match('./')));
    return;
  }
  const same = u.origin === self.location.origin;
  const cdn = /gstatic\.com$|fonts\.googleapis\.com$|cdn\.jsdelivr\.net$|cdnjs\.cloudflare\.com$/.test(u.hostname);
  if (!same && !cdn) return;
  // Fichiers versionnés (?v=…) et bibliothèques : la copie gardée d'abord, sinon le réseau (et on la garde)
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => same ? caches.match(r, { ignoreSearch: true }) : undefined)));
});

// ---------- Notifications (envoyées par le serveur Fanion) ----------
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'Fanion';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '', icon: './icon-192.png', badge: './icon-192.png', tag: d.tag || undefined, renotify: !!d.tag,
    data: { url: d.url || './' }, lang: 'fr-CA'
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if (c.url.startsWith(self.registration.scope) && 'focus' in c) { c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
