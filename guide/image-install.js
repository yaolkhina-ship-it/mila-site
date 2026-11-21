/* Система имиджа: как поставить её на экран телефона.
   Общие шаги для страницы входа (/vhod) и меню внутри Системы, чтобы инструкция везде совпадала.
   ImgInstall.mode: 'app' (уже открыта со значка), 'desktop', 'ios', 'android'.
   ImgInstall.html(): разметка шагов (классы .ii-*; оформление у каждой страницы своё).
   ImgInstall.bind(root): кнопки «Скопировать ссылку» и «Установить» (Android). */
(function () {
  // 16.11: тот же модуль ставит и Систему цвета (/guide): <script src="/guide/image-install.js" data-app="color">
  var me = document.currentScript, APP = (me && me.getAttribute('data-app')) || 'image';
  var C = APP === 'color'
    ? { name: 'Система', icon: '/guide/apple-icon.png', link: 'https://www.milaushakova.com/guide', login: false }
    : { name: 'Имидж', icon: '/guide/image-icon-180.png', link: 'https://www.milaushakova.com/vhod', login: true };
  var ua = navigator.userAgent || '';
  var app = window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var android = /Android/i.test(ua);
  var LINK = C.link;
  var mode = app ? 'app' : ios ? 'ios' : android ? 'android' : 'desktop';
  function tr(ru, en){ return window.ImgInstallLang === 'en' ? en : ru; }

  var I = {
    share: '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5.5v9.5h13V11H17"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="18.5" r="1.2" fill="currentColor"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    app: '<img src="' + C.icon + '" alt="">'
  };

  // signedIn: человек уже вошёл в браузере (меню внутри Системы)
  // m: платформа, выбранная кнопкой (иначе определённая по телефону); проверки браузера только для своей платформы
  function plan(signedIn, m) {
    m = m || mode;
    var own = m === mode;
    var steps = [], key = '', inapp = false;
    var appStep = C.login
      ? ['app', tr('Найдите на экране значок <b>«Имидж»</b>, откройте его и войдите по почте.', 'Find the <b>Image</b> icon on your screen, open it and sign in with your email.'), tr('Код придёт на почту, как обычно.', 'The code arrives by email, as usual.')]
      : ['app', 'Найдите на экране значок <b>«' + C.name + '»</b> и откройте его.', 'Система цвета откроется на весь экран, как приложение.'];
    if (m === 'ios') {
      var other = own && /CriOS|FxiOS|EdgiOS|YaBrowser|OPiOS|GSA\//.test(ua);
      inapp = own && !other && (!/Safari\//.test(ua) || /Instagram|FBAN|FBAV|Telegram|VKClient|Line\//.test(ua) || window.navigator.standalone === undefined);
      if (inapp) steps.push(['compass', tr('Откройте эту страницу в <b>Safari</b>: нажмите <b>⋯</b> или значок компаса в углу экрана и выберите <b>«Открыть в Safari»</b>.', 'Open this page in <b>Safari</b>: tap <b>⋯</b> or the compass icon in the corner and choose <b>Open in Safari</b>.'), tr('Сейчас страница открыта внутри Telegram, Instagram или почты, оттуда поставить её на экран нельзя.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку для Safari</button>', 'The page is open inside Telegram, Instagram or mail. It cannot be added to the screen from there.<button type="button" class="ii-copy" data-ii-copy>Copy the link for Safari</button>')]);
      if (other) steps.push(['share', tr('Нажмите значок <b>«Поделиться»</b> в адресной строке, вверху или внизу экрана.', 'Tap the <b>Share</b> icon in the address bar, at the top or the bottom of the screen.'), tr('Если такого пункта дальше нет, откройте страницу в Safari.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку для Safari</button>', 'If the next step is missing, open the page in Safari.<button type="button" class="ii-copy" data-ii-copy>Copy the link for Safari</button>')]);
      else steps.push(['share', tr('Нажмите значок <b>«Поделиться»</b> внизу экрана: квадрат со стрелкой вверх.', 'Tap the <b>Share</b> icon at the bottom of the screen: a square with an arrow pointing up.'), tr('В новых iPhone он спрятан за кнопкой <b>⋯</b> рядом с адресом.', 'On newer iPhones it sits behind the <b>⋯</b> button next to the address.')]);
      steps.push(['plus', tr('Пролистайте вниз и выберите <b>«На экран „Домой“»</b>.', 'Scroll down and choose <b>Add to Home Screen</b>.'), tr('Если строки не видно, нажмите <b>«Ещё»</b> в конце списка.', 'If you do not see it, tap <b>More</b> at the end of the list.')]);
      steps.push(['ok', tr('Нажмите <b>«Добавить»</b> в правом верхнем углу.', 'Tap <b>Add</b> in the top right corner.'), tr('Если есть переключатель «Открывать как веб-приложение», оставьте его включённым.', 'If there is a switch for Open as Web App, leave it on.')]);
      steps.push(appStep);
      key = !C.login ? 'Значок появится на экране «Домой» рядом с другими приложениями.' : signedIn
        ? tr('<b>Важно:</b> в значке нужно войти ещё раз, по той же почте. iPhone не переносит вход из Safari в приложение. Дальше Система будет открываться сразу.', '<b>Important:</b> sign in once more from the icon, with the same email. An iPhone does not carry the Safari sign-in into the app. After that the System opens directly.')
        : tr('<b>Важно:</b> входите уже из значка на экране. iPhone не переносит вход из Safari в приложение, и его пришлось бы повторить.', '<b>Important:</b> sign in from the icon on your screen. An iPhone does not carry the Safari sign-in into the app, so you would have to do it again.');
    } else if (m === 'android') {
      inapp = own && /; wv\)|Instagram|FBAN|FBAV|FB_IAB|Telegram|VKAndroidApp|OKApp/.test(ua);
      if (inapp) steps.push(['dots', tr('Откройте эту страницу в <b>Chrome</b>: нажмите <b>⋮</b> в углу экрана и выберите <b>«Открыть в браузере»</b>.', 'Open this page in <b>Chrome</b>: tap <b>⋮</b> in the corner and choose <b>Open in browser</b>.'), tr('Сейчас страница открыта внутри приложения, оттуда поставить её на экран нельзя.<button type="button" class="ii-copy" data-ii-copy>Скопировать ссылку</button>', 'The page is open inside another app. It cannot be added to the screen from there.<button type="button" class="ii-copy" data-ii-copy>Copy the link</button>')]);
      if (own && /SamsungBrowser/.test(ua)) {
        steps.push(['menu', tr('Нажмите <b>≡</b> внизу экрана.', 'Tap <b>≡</b> at the bottom of the screen.'), '']);
        steps.push(['plus', tr('Выберите <b>«Добавить страницу на»</b>, затем <b>«Главный экран»</b>.', 'Choose <b>Add page to</b>, then <b>Home screen</b>.'), '']);
      } else {
        steps.push(['dots', tr('Нажмите <b>⋮</b> в правом верхнем углу браузера.', 'Tap <b>⋮</b> in the top right corner of the browser.'), tr('В Яндекс Браузере это <b>⋮</b> или <b>≡</b> рядом с адресом.', 'In Yandex Browser it is <b>⋮</b> or <b>≡</b> next to the address.')]);
        steps.push(['plus', tr('Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.', 'Choose <b>Install app</b> or <b>Add to Home screen</b>.'), tr('Название пункта зависит от браузера.', 'The name of the item depends on the browser.')]);
      }
      steps.push(['ok', tr('Подтвердите: <b>«Установить»</b> или <b>«Добавить»</b>.', 'Confirm: <b>Install</b> or <b>Add</b>.'), '']);
      steps.push(appStep);
      key = tr('Значок появится на экране телефона рядом с другими приложениями.', 'The icon will appear on your phone, next to the other apps.') + (!C.login ? '' : signedIn ? tr(' Вход сохранится.', ' Your sign-in stays.') : tr(' Войти можно уже в нём.', ' You can sign in from there.'));
    }
    return { steps: steps, key: key, inapp: inapp };
  }

  function html(signedIn, m) {
    var p = plan(signedIn, m);
    return '<button type="button" class="ii-install" data-ii-install hidden>' + tr('Установить на телефон', 'Install on this phone') + '</button>' +
      '<ol class="ii-steps">' + p.steps.map(function (s, i) {
        return '<li><span class="ii-n">' + (i + 1) + '</span><span class="ii-t">' + s[1] + (s[2] ? '<small>' + s[2] + '</small>' : '') + '</span><span class="ii-ico' + (s[0] === 'app' ? ' ii-app' : '') + '">' + I[s[0]] + '</span></li>';
      }).join('') + '</ol>' +
      '<div class="ii-key">' + p.key + '</div>' +
      '<div class="ii-done" data-ii-done hidden>' + tr('Готово. Значок «' + C.name + '» уже на экране телефона.', 'Done. The ' + C.name + ' icon is on your phone.') + '</div>';
  }

  // 16.11: две кнопки «Установите веб-приложение на iPhone / Android», шаги раскрываются под ними
  var LOGO = {
    ios: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.03-2.7 2.2-4 2.3-4.07-1.26-1.83-3.2-2.08-3.9-2.11-1.66-.17-3.24.98-4.08.98-.84 0-2.14-.96-3.52-.93-1.81.03-3.48 1.05-4.41 2.67-1.88 3.26-.48 8.09 1.35 10.74.9 1.29 1.96 2.75 3.36 2.7 1.35-.05 1.86-.87 3.49-.87s2.09.87 3.51.84c1.45-.03 2.37-1.32 3.26-2.62 1.03-1.5 1.45-2.95 1.47-3.03-.03-.01-2.82-1.08-2.85-4.3zM13.7 4.67c.74-.9 1.24-2.15 1.1-3.4-1.07.04-2.36.71-3.13 1.61-.69.79-1.29 2.07-1.13 3.29 1.19.09 2.41-.61 3.16-1.5z"/></svg>',
    android: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 18a1 1 0 0 0 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1a1 1 0 0 0 1-1V8H6v10zM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8zM15.53 2.16l1.3-1.3a.5.5 0 0 0-.7-.71l-1.48 1.48A5.96 5.96 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 1 0-.7.7l1.31 1.31A5.98 5.98 0 0 0 6 7h12a5.98 5.98 0 0 0-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>'
  };
  var BCSS = '.ab-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 0}' +
    '.ab{display:flex;align-items:center;gap:8px;min-height:58px;padding:9px 10px;background:#000;color:#fff;border:1px solid rgba(255,255,255,.28);border-radius:11px;font:400 11px/1.2 -apple-system,"Helvetica Neue",Arial,sans-serif;white-space:nowrap;text-align:left !important;letter-spacing:0;text-transform:none;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.ab svg{width:24px;height:24px;flex:0 0 24px}.ab b{display:block;margin-top:2px;font-size:16px;font-weight:700;letter-spacing:0}' +
    '.ab[aria-expanded="true"]{border-color:#C9A96A;box-shadow:0 0 0 1px #C9A96A}' +
    '.ab-steps[hidden]{display:none !important}.ab-note{margin-top:16px;font-size:14px;line-height:1.45;opacity:.75}';
  function badges() {
    if (mode === 'app') return '';
    if (!document.getElementById('ab-css')) { var st = document.createElement('style'); st.id = 'ab-css'; st.textContent = BCSS; document.head.appendChild(st); }
    return '<div class="ab-row">' + ['ios', 'android'].map(function (k) {
      return '<button type="button" class="ab" data-ab="' + k + '" aria-expanded="false">' + LOGO[k] + '<span>' + tr('Установите<br>веб-приложение на', 'Add the<br>web app to') + '<b>' + (k === 'ios' ? 'iPhone' : 'Android') + '</b></span></button>';
    }).join('') + '</div><div class="ab-steps" data-ab-steps hidden></div>';
  }
  // open: раскрыть сразу шаги для своего телефона
  function bindBadges(root, signedIn, open) {
    var box = root.querySelector('[data-ab-steps]'); if (!box) return;
    var btns = root.querySelectorAll('[data-ab]'), cur = '';
    function pick(k) {
      cur = cur === k ? '' : k;
      Array.prototype.forEach.call(btns, function (b) { b.setAttribute('aria-expanded', b.getAttribute('data-ab') === cur ? 'true' : 'false'); });
      box.hidden = !cur;
      if (!cur) return;
      box.innerHTML = html(signedIn, cur) + (mode === 'desktop' ? '<p class="ab-note">' + tr('Откройте <b>' + LINK.replace('https://www.', '') + '</b> на телефоне и сделайте эти шаги там.', 'Open <b>' + LINK.replace('https://www.', '') + '</b> on your phone and follow these steps there.') + '</p>' : '');
      bind(box);
    }
    Array.prototype.forEach.call(btns, function (b) { b.onclick = function (e) { e.stopPropagation(); pick(b.getAttribute('data-ab')); }; });
    if (open && (mode === 'ios' || mode === 'android')) pick(mode);
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
        var done = function () { b.textContent = tr('Ссылка скопирована', 'Link copied'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(LINK).then(done, function () { prompt(tr('Скопируйте ссылку', 'Copy the link'), LINK); });
        else prompt(tr('Скопируйте ссылку', 'Copy the link'), LINK);
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

  if (APP === 'image' && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/image-sw.js', { scope: '/vhod' }).catch(function () {});

  window.ImgInstall = { mode: mode, html: html, bind: bind, badges: badges, bindBadges: bindBadges };
})();
