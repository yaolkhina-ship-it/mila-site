/* Система имиджа как приложение на телефоне. Страница входа всегда из сети;
   без интернета показываем короткое сообщение вместо ошибки браузера. Ничего не кэширует. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Система имиджа</title><body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#111;color:#F4F2EE;font:300 17px/1.5 -apple-system,sans-serif;text-align:center;padding:24px"><p>Нет соединения с интернетом.<br>Система откроется, как только связь вернётся.</p></body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
