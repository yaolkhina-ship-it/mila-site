/* Система цветовых сочетаний: работа без интернета.
   Страница: сначала сеть, при обрыве из кэша. Картинки и шрифты: из кэша, иначе сеть с сохранением. */
var V = 'sys-v1', PAGE = 'sys-page', IMG = 'sys-img';
self.addEventListener('install', function (e) { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('sys-') === 0 && [PAGE, IMG, V].indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  if (!/^\/(guide|fonts)(\/|$)/.test(u.pathname)) return;
  if (/\/guide\/contrast\/mp\//.test(u.pathname)) return; // модели MediaPipe большие, грузятся по требованию
  var isPage = r.mode === 'navigate' || /\.html$/.test(u.pathname) || u.pathname === '/guide' || u.pathname === '/guide/';
  if (isPage || /\.(js|mjs|css)$/.test(u.pathname)) {
    e.respondWith(fetch(r).then(function (res) {
      if (res.ok) { var c = res.clone(); caches.open(PAGE).then(function (ca) { ca.put(r, c); }); }
      return res;
    }).catch(function () { return caches.match(r, { ignoreSearch: true }); }));
    return;
  }
  if (/\.(jpe?g|png|webp|gif|svg|woff2?)$/i.test(u.pathname)) {
    e.respondWith(caches.open(IMG).then(function (ca) {
      return ca.match(r).then(function (hit) {
        return hit || fetch(r).then(function (res) { if (res.ok) ca.put(r, res.clone()); return res; });
      });
    }));
  }
});
// по просьбе страницы докачиваем все картинки Системы заранее
self.addEventListener('message', function (e) {
  if (!e.data || e.data.type !== 'precache') return;
  caches.open(IMG).then(function (ca) {
    (e.data.urls || []).reduce(function (p, url) {
      return p.then(function () { return ca.match(url).then(function (hit) { if (!hit) return fetch(url).then(function (res) { if (res.ok) return ca.put(url, res); }).catch(function () {}); }); });
    }, Promise.resolve());
  });
});
