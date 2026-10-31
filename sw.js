/* Fanion Game — garde l'app sur le téléphone pour qu'elle s'ouvre sans réseau. */
const V = 'fanion-v2';
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
