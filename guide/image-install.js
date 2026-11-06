/* Система имиджа: как поставить её на экран телефона.
   Общие шаги для страницы входа (/vhod) и меню внутри Системы, чтобы инструкция везде совпадала.
   ImgInstall.mode: 'app' (уже открыта со значка), 'desktop', 'ios', 'android'.
   ImgInstall.html(): разметка шагов (классы .ii-*; оформление у каждой страницы своё).
   ImgInstall.bind(root): кнопки «Скопировать ссылку» и «Установить» (Android). */
(function () {
  var ua = navigator.userAgent || '';
  var app = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var LINK = 'https://www.milaushakova.com/vhod';
  var mode = app ? 'app' : ios ? 'ios' : android ? 'android' : 'desktop';

  var I = {
    share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5.5v9.5h13V11H17"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    app: '<img src="/guide/image-icon-180.png" alt="">'
  };

  // signedIn: человек уже вошёл в браузере (меню внутри Системы)
  function plan(signedIn) {
    var steps = [], key = '', inapp = false;
    var appStep = ['app', 'Найдите на экране значок <b>«Имидж»</b>, откройте его и войдите по почте.', 'Код придёт на почту, как обычно.'];
    if (mode === 'ios') {
      var other = /CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS|GSA\//.test(ua);
      inapp = !other && (!/Safari\//.test(ua) || /Instagram|FBAN|FBAV|Telegram|VKClient|Line\//.test(ua) || window.navigator.standalone === undefined);
      if (inapp) steps.push(['compass', 'Откройте эту страницу в <b>Safari</b>: нажмите <b>⋯</b> или значок компаса в углу экрана и выберите <b>«Открыть в Safari»</b>.', 'Сейчас страница открыта внутри Telegram, Instagram или почты, оттуда поставить её на экран нельзя.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку для Safari</button>']);
      if (other) steps.push(['share', 'Нажмите значок <b>«Поделиться»</b> в адресной строке, вверху или внизу экрана.', 'Если такого пункта дальше нет, откройте страницу в Safari.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку для Safari</button>']);
      else steps.push(['share', 'Нажмите значок <b>«Поделиться»</b> внизу экрана: квадрат со стрелкой вверх.', 'В новых iPhone он спрятан за кнопкой <b>⋯</b> рядом с адресом.']);
      steps.push(['plus', 'Пролистайте вниз и выберите <b>«На экран „Домой“»</b>.', 'Если строки не видно, нажмите <b>«Ещё»</b> в конце списка.']);
      steps.push(['ok', 'Нажмите <b>«Добавить»</b> в правом верхнем углу.', 'Если есть переключатель «Открывать как веб-приложение», оставьте его включённым.']);
      steps.push(appStep);
      key = signedIn
        ? '<b>Важно:</b> в значке нужно войти ещё раз, по той же почте. iPhone не переносит вход из Safari в приложение. Дальше Система будет открываться сразу.'
        : '<b>Важно:</b> входите уже из значка на экране. iPhone не переносит вход из Safari в приложение, и его пришлось бы повторить.';
    } else if (mode === 'android') {
      inapp = /; wv\)|Instagram|FBAN|FBAV|FB_IAB|Telegram|VKAndroidApp|OKApp/.test(ua);
      if (inapp) steps.push(['dots', 'Откройте эту страницу в <b>Chrome</b>: нажмите <b>⋮</b> в углу экрана и выберите <b>«Открыть в браузере»</b>.', 'Сейчас страница открыта внутри приложения, оттуда поставить её на экран нельзя.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку</button>']);
      if (/SamsungBrowser/.test(ua)) {
        steps.push(['menu', 'Нажмите <b>≡</b> внизу экрана.', '']);
        steps.push(['plus', 'Выберите <b>«Добавить страницу на»</b>, затем <b>«Главный экран»</b>.', '']);
      } else {
        steps.push(['dots', 'Нажмите <b>⋮</b> в правом верхнем углу браузера.', 'В Яндекс Браузере это <b>⋮</b> или <b>≡</b> рядом с адресом.']);
        steps.push(['plus', 'Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.', 'Название пункта зависит от браузера.']);
      }
      steps.push(['ok', 'Подтвердите: <b>«Установить»</b> или <b>«Добавить»</b>.', '']);
      steps.push(appStep);
      key = 'Значок появится на экране телефона рядом с другими приложениями.' + (signedIn ? ' Вход сохранится.' : ' Войти можно уже в нём.');
    }
    return { steps: steps, key: key, inapp: inapp };
  }

  function html(signedIn) {
    var p = plan(signedIn);
    return '<button type="button" class="ii-install" data-ii-install hidden>Установить на телефон</button>' +
      '<ol class="ii-steps">' + p.steps.map(function (s, i) {
        return '<li><span class="ii-n">' + (i + 1) + '</span><span class="ii-t">' + s[1] + (s[2] ? '<small>' + s[2] + '</small>' : '') + '</span><span class="ii-ico' + (s[0] === 'app' ? ' ii-app' : '') + '">' + I[s[0]] + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="ii-key">' + p.key + '</div>' +
      '<div class="ii-done" data-ii-done hidden>Готово. Значок «Имидж» уже на экране телефона.</div>';
  }

  // Android Chrome: установка одной кнопкой, когда браузер это позволяет
  var deferred = null, roots = [];
  function sync() { roots.forEach(function (r) { Array.prototype.forEach.call(r.querySelectorAll('[data-ii-install]'), function (b) { b.hidden = !deferred; }); }); }
  window.addEventListener('beforeinstallprompt', function (e) { if (mode !== 'android') return; e.preventDefault(); deferred = e; sync(); });
  window.addEventListener('appinstalled', function () {
    deferred = null; sync();
    roots.forEach(function (r) { Array.prototype.forEach.call(r.querySelectorAll('[data-ii-done]'), function (d) { d.hidden = false; }); });
  });

  function bind(root) {
    if (roots.indexOf(root) < 0) roots.push(root);
    Array.prototype.forEach.call(root.querySelectorAll('[data-ii-copy]'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var done = function () { b.textContent = 'Ссылка скопирована'; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(LINK).then(done, function () { prompt('Скопируйте ссылку', LINK); });
        else prompt('Скопируйте ссылку', LINK);
      };
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-ii-install]'), function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function () { deferred = null; sync(); });
      };
    });
    sync();
  }

  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/image-sw.js', { scope: '/vhod' }).catch(function () {});

  window.ImgInstall = { mode: mode, html: html, bind: bind };
})();
