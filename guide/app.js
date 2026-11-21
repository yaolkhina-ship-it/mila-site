/* Система как приложение (превью 10.2026).
   Вместо ленты из 150 страниц: главная, цвета, тренды, дропы и поиск открываются сетками,
   образ — карточкой поверх сетки (палитра + образ + вещи), свайп к соседнему образу.
   Данные берутся из страниц Системы на этой же странице, ничего не дублируется. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var norm = function (s) { return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('sys_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('sys_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var lang = 'ru';
  try {
    var qLang = /[?&]lang=(en|ru)/.exec(location.search);
    var savedLang = localStorage.getItem('mu_lang') || localStorage.getItem('img_lang');
    lang = (qLang && qLang[1]) || (savedLang === 'en' ? 'en' : 'ru');
    localStorage.setItem('mu_lang', lang);
    localStorage.setItem('img_lang', lang);
  } catch (e) {}
  window.ImgInstallLang = lang;
  document.documentElement.lang = lang;
  function t(ru, en) { return lang === 'en' ? en : ru; }
  var CN = { 'Красный': 'Red', 'Розовый': 'Pink', 'Оранжевый': 'Orange', 'Жёлтый': 'Yellow', 'Зелёный': 'Green', 'Синий': 'Blue', 'Фиолетовый': 'Violet', 'Бежевый и коричневый': 'Beige and brown', 'Серый и чёрный': 'Grey and black' };
  function cn(name) { return (lang === 'en' && CN[name]) || name; }
  var PN = { 'Мила Ушакова': 'Mila Ushakova', 'О Системе': 'About the system', 'Как пользоваться': 'How to use it', 'Правило пропорций': 'The proportion rule', 'Контраст внешности': 'Contrast of appearance', 'Бонус: промокоды': 'Bonus: codes', 'Рекомендации на сезон': 'Notes for the season' };
  function pn(name) { return (lang === 'en' && PN[name]) || name; }
  function langUi() {
    return '<span class="lng"><button type="button" data-lang="ru"' + (lang === 'ru' ? ' class="on"' : '') + '>RU</button><i>·</i><button type="button" data-lang="en"' + (lang === 'en' ? ' class="on"' : '') + '>EN</button></span>';
  }

  /* у Системы <base href="/guide/">: ссылки вида "#/..." увели бы на /guide/, поэтому адрес страницы пишется целиком */
  var H = location.pathname + location.search;
  var CLUB = 'https://t.me/MilaUshakova_ClubBot?start=club', CONTACT = 'https://t.me/YanaOlkhina';

  /* ── Данные из страниц ── */
  var pages = $$('.app > .pg[id]');
  var visible = function (p) { return p.style.display !== 'none' && !p.hasAttribute('hidden'); };
  var SW = { 'Красный': '#b8322a', 'Розовый': '#e9b3c2', 'Оранжевый': '#d9661f', 'Жёлтый': '#e6c341', 'Зелёный': '#4d6b34',
    'Синий': '#2a4a93', 'Фиолетовый': '#5b3f6e', 'Бежевый и коричневый': '#a07a55', 'Серый и чёрный': '#3a3a3a' };
  var colors = $$('#p4 .tone-index:not(.tr-index) .tone-item').filter(function (el) { return /p_pal_/.test(el.getAttribute('onclick') || ''); })
    .map(function (el) { return { name: el.textContent.replace(/[→→]/g, '').trim(), start: (el.getAttribute('onclick').match(/'([^']+)'/) || [])[1], looks: [] }; });
  var startIx = {}; colors.forEach(function (c, i) { startIx[c.start] = i; });

  var looks = {}, order = [], drops = { oct: [], sep: [] }, curColor = -1, prevPal = null;
  pages.forEach(function (p) {
    if (startIx[p.id] != null) curColor = startIx[p.id];
    if (p.classList.contains('pal-pg')) { prevPal = p; return; }
    if (!p.classList.contains('look-pg') || !/^p_look/.test(p.id) || !visible(p)) { prevPal = null; return; }
    var img = $('.look-collage-wrap img', p); if (!img || !$('.look-link-chip', p)) return;
    var pal = prevPal && visible(prevPal) ? prevPal : null;
    var cnt = pal && $('.pal-pg-counter', pal), num = $('.look-num', p);
    var name = cnt ? cnt.textContent.replace(/·\s*новинка/i, '').trim() : (num ? num.textContent.replace(/^.*образ\s*/i, '').trim() : 'образ');
    var L = { id: p.id, pg: p, name: name, img: img.getAttribute('src'), pal: pal && $('.pal-full-img', pal) ? $('.pal-full-img', pal).getAttribute('src') : '',
      items: $$('.look-link-chip', p).map(function (a) { return a.textContent.trim(); }), isNew: /drop_oct/.test(p.id), color: null, trends: [] };
    looks[p.id] = L; order.push(p.id);
    if (/drop_oct/.test(p.id)) drops.oct.push(p.id);
    else if (/drop_/.test(p.id)) drops.sep.push(p.id);
    else if (curColor >= 0) { L.color = curColor; colors[curColor].looks.push(p.id); }
    prevPal = null;
  });
  /* 04.11: дропы раскладываются и по цветам, новые идут первыми. Разметка по палитрам, Мила проверяет: правьте здесь */
  var DROP_COLOR = { 'Красный': ['p_look_drop_oct9', 'p_look_drop_oct6', 'p_look_drop_oct4', 'p_look_drop_new', 'p_look_drop_10'],
    'Розовый': ['p_look_drop_oct2'], 'Оранжевый': ['p_look_drop_oct7', 'p_look_drop_oct3'], 'Жёлтый': ['p_look_drop_new3'],
    'Зелёный': ['p_look_drop_2', 'p_look_drop_4'], 'Синий': ['p_look_drop_oct8', 'p_look_drop_oct5', 'p_look_drop_new4'], 'Фиолетовый': ['p_look_drop_5'],
    'Бежевый и коричневый': ['p_look_drop_new5', 'p_look_drop_3'], 'Серый и чёрный': ['p_look_drop_oct10', 'p_look_drop_oct1', 'p_look_drop_new2', 'p_look_drop_1'] };
  colors.forEach(function (c, i) { var add = (DROP_COLOR[c.name] || []).filter(function (id) { return looks[id]; }); add.forEach(function (id) { looks[id].color = i; }); c.looks = add.concat(c.looks); });
  var trends = $$('.tr-pg').map(function (p) {
    var h = $('.ins-h', p);
    return { slug: p.id.replace('p_trend_', ''), name: h ? h.firstChild.textContent.trim() : '', isNew: !!$('.tr-new', p), cover: p.getAttribute('data-cover') || '',
      looks: $$('.tr-look', p).map(function (d) { return ((d.getAttribute('onclick') || '').match(/'([^']+)'/) || [])[1]; }).filter(function (id) { return looks[id]; }) };
  });
  trends.forEach(function (t) { t.looks.forEach(function (id) { looks[id].trends.push(t); }); if (!t.cover && looks[t.looks[0]]) t.cover = looks[t.looks[0]].img; });
  var DROPS = { oct: { name: 'Октябрьский дроп', ids: drops.oct }, sep: { name: 'Дроп сентября', ids: drops.sep } };
  var navText = {}; $$('#p4 [onclick*="scrollToEl"]').forEach(function (el) {
    var m = (el.getAttribute('onclick').match(/'([^']+)'/) || [])[1], sub = el.classList.contains('tone-item') || el.classList.contains('cat-chip');
    if (m && (sub || !navText[m])) navText[m] = ($('.ni-t, .ni-new-t', el) || el).textContent.replace(/[→→]/g, '').trim();
  });
  var PAGES = [['p1', 'Мила Ушакова'], ['p2', 'О Системе'], ['p3', 'Как пользоваться'], ['p_rule_proportions', 'Правило пропорций'],
    ['p_contrast', 'Контраст внешности'], ['p_bonus', 'Бонус: промокоды'], ['p6', 'Рекомендации на сезон']];
  var promos = $$('.pg[id^="p_promo_"]'), cats = $$('.pg[id^="p_cat_"]');
  var favs = function () { return LS.get('favs', []).filter(function (id) { return looks[id]; }); };

  /* ── Каркас ── */
  document.documentElement.classList.add('appmode');
  var ap = document.createElement('div'); ap.id = 'ap';
  ap.innerHTML = '<div id="av"></div>';
  document.body.appendChild(ap);
  var av = $('#av', ap);
  var I = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    col: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><circle cx="8.5" cy="10" r="1.4"/><circle cx="13" cy="7.8" r="1.4"/><circle cx="16.2" cy="11.5" r="1.4"/><path d="M12 21a2.5 2.5 0 0 1 0-5h1.5"/></svg>',
    tr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 18l5-6 4 3 7-9"/><path d="M15 6h5v5"/></svg>',
    look: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 6.5a1.8 1.8 0 1 1 1.8 1.8c-.9 0-1.8.6-1.8 1.5v.7"/><path d="M12 10.5l-9 6.3c-.8.6-.4 1.7.6 1.7h16.8c1 0 1.4-1.1.6-1.7z"/></svg>',
    se: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>'
  };
  var tab = document.createElement('nav'); tab.className = 'a-tab';
  function paintTab() {
    tab.setAttribute('aria-label', t('Разделы Системы', 'Sections'));
    tab.innerHTML = '<a href="' + H + '#/" data-t="home">' + I.home + t('Главная', 'Home') + '</a><a href="' + H + '#/pal/all" data-t="pal">' + I.col + t('Палитры', 'Palettes') + '</a><a href="' + H + '#/looks/all" data-t="looks">' + I.look + t('Образы', 'Looks') + '</a>' +
      '<a href="' + H + '#/trends" data-t="trends">' + I.tr + t('Тренды', 'Trends') + '</a><a href="' + H + '#/search" data-t="search">' + I.se + t('Поиск', 'Search') + '</a>' +
      '<a href="' + H + '#/mine" data-t="mine">' + I.me + t('Мои', 'Mine') + '<span class="badge" hidden></span></a>';
    badge();
  }
  paintTab();
  document.body.appendChild(tab);
  var sheet = document.createElement('div'); sheet.className = 'a-sheet'; sheet.setAttribute('role', 'dialog');
  document.body.appendChild(sheet);

  /* ── Кусочки разметки ── */
  var top = function (back, lbl) {
    return '<div class="a-top">' + (back ? '<a class="a-back" href="' + (back.charAt(0) === '#' ? H + back : back) + '">‹ ' + t('Назад', 'Back') + '</a>' : '<span class="a-lbl">Mila Ushakova</span>') +
      langUi() +
      '<span class="a-lbl">' + esc(lbl || t('Система', 'System')) + '</span></div>';
  };
  var cell = function (id, ctx) {
    var L = looks[id]; if (!L) return '';
    return '<a class="a-cell" href="' + H + '#' + ctx + '/look/' + id + '"><div class="im"><img loading="lazy" src="' + esc(L.img) + '" alt="">' +
      (L.pal ? '<img class="pal" loading="lazy" src="' + esc(L.pal) + '" alt="">' : '') + (favs().indexOf(id) >= 0 ? '<span class="fav">♥</span>' : '') +
      '</div><span>' + esc(L.name) + (L.isNew ? ' <em>· ' + t('новинка', 'new') + '</em>' : '') + '</span></a>';
  };
  var grid = function (ids, ctx) { return '<div class="a-grid">' + ids.map(function (id) { return cell(id, ctx); }).join('') + '</div>'; };
  var plural = function (n, a, b, c) { var m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
  var obr = function (n) { return lang === 'en' ? n + (n === 1 ? ' look' : ' looks') : plural(n, 'образ', 'образа', 'образов'); };

  /* ── Экраны ── */
  var V = {};
  function ctaBlock() {
    return '<div class="a-cta"><div class="a-lbl" style="color:var(--gold)">' + t('Fashion-клуб «В моём стиле»', 'Fashion club In My Style') + '</div>' +
      '<div class="t">' + t('Новые образы, разборы и встречи с Милой каждую неделю', 'New looks, reviews and meetings with Mila every week') + '</div>' +
      '<a class="a-btn gold" href="' + CLUB + '" target="_blank" rel="noopener">' + t('Стать резидентом', 'Become a resident') + '</a>' +
      (CONTACT.indexOf('__') < 0 ? '<a class="a-btn line" href="' + CONTACT + '" target="_blank" rel="noopener">' + t('Сотрудничество', 'Work together') + '</a>' : '') + '</div>';
  }
  /* «Система имиджа»: превью на главной, ведёт на страницу покупки */
  var IMG_WAIT = '/image';
  var IMG_IDEA = 'Цвет меняет образ.<br>Имидж меняет возможности.';
  function imgTeaser() {
    return '<div class="a-imgblk"><div class="a-sec"><b>' + t('Система имиджа', 'Image system') + '</b></div>' +
      '<a href="' + IMG_WAIT + '" target="_blank" rel="noopener" style="display:block;margin:0 20px"><img loading="lazy" src="business-img/cover-gallery.jpg" alt="" style="display:block;width:100%;aspect-ratio:16/10;object-fit:cover;object-position:60% 88%;border-radius:6px"></a>' +
      '<div class="a-pv-t"><p>' + (lang === 'en' ? 'Colour changes a look.<br>Image changes what is possible.' : IMG_IDEA) + '</p><p class="s">' + t('Что надеть на переговоры, собеседование или деловой ужин, чтобы впечатление работало на вашу цель. Можно оплатить в рассрочку.', 'What to wear to a negotiation, an interview or a business dinner, so the impression works for your aim. Instalments are available.') + '</p>' +
      '<a class="a-wait" href="' + IMG_WAIT + '" target="_blank" rel="noopener">' + t('Открыть Систему имиджа', 'Open the Image System') + '</a></div></div>';
  }
  /* Библиотека: лекции Милы на продажу. Новая лекция = новая строка В НАЧАЛЕ списка (первой стоит на полке). */
  var LECTURES = [
    // 29.10: «Дресс-код», 777 ₽ / 48 ч, без подзаголовка (её решение); 04.11: обложка, название и кнопка ведут на оплату Prodamus
    { t: 'Дресс-код', s: '', img: '/dresscode-og.jpg',
      price: '777 ₽', buy: 'https://payform.ru/ptcUyYC/', page: 'https://payform.ru/ptcUyYC/' },
    { t: 'Многослойность осени', s: 'Как собрать слои, чтобы образ выглядел дорого, а не громоздко', img: '/mnogosloynost-og.jpg',
      price: '777 ₽', buy: 'https://app.lava.top/products/1ed1a65b-d032-4d33-b2ff-49eea0060747', page: '/mnogosloynost' },
    // 27.10: в Системе пока только «Многослойность» (платно, её решение); «Масштаб» убран
  ];
  function lecCard(L, cls) {
    return '<div class="' + cls + '"><a href="' + L.page + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(L.img) + '" alt=""></a><div class="b">' +
      '<span class="k">' + t('Лекция · запись 48 ч', 'Lecture, 48-hour recording') + '</span><a class="h" href="' + L.page + '" target="_blank" rel="noopener">' + esc(L.t) + '</a><span class="s">' + esc(L.s) + '</span>' +
      '<div class="buy"><span class="p">' + L.price + '</span><a class="a-buy" href="' + L.buy + '" target="_blank" rel="noopener">' + t('Купить', 'Buy') + '</a></div></div></div>';
  }
  function libShelf() {
    return '<div class="a-sec"><b>' + t('Библиотека', 'Library') + '<em class="a-soon">' + t('пополняется', 'growing') + '</em></b><a href="' + H + '#/lectures">' + t('все', 'all') + '</a></div>' +
      '<div class="a-row a-lrow">' + LECTURES.map(function (L) { return lecCard(L, 'a-lec'); }).join('') + '</div>';
  }
  V.lectures = function () {
    return top('#/', t('Библиотека', 'Library')) + '<h1 class="a-h">' + t('Лекции Милы', 'Lectures by Mila') + '</h1>' +
      '<div class="a-pv-t"><p class="s">' + t('Библиотека пополняется после каждого эфира. Купленная запись приходит на почту.', 'The library grows after each live session. A purchased recording arrives by email.') + '</p></div>' +
      '<div class="a-llist">' + LECTURES.map(function (L) { return lecCard(L, 'a-lec wide'); }).join('') + '</div>' +
      '<div class="a-cta"><div class="a-lbl" style="color:var(--gold)">' + t('Fashion-клуб «В моём стиле»', 'Fashion club In My Style') + '</div>' +
      '<div class="t">' + t('Резидентам клуба все лекции открыты без оплаты', 'Club residents get every lecture without paying again') + '</div>' +
      '<a class="a-btn gold" href="' + CLUB + '" target="_blank" rel="noopener">' + t('Стать резидентом', 'Become a resident') + '</a></div>';
  };
  // плашка «сегодня добавлены» на главной: дата выпуска и сколько новых образов с палитрами; показывается 2 дня
  var NEWS = { date: '2026-10-27', n: 5 };
  function newsBar() {
    var d = new Date(NEWS.date + 'T00:00:00'), days = Math.floor((Date.now() - d) / 864e5);
    if (days < 0 || days > 1) return '';
    return '<a class="a-news" href="' + H + '#/drop/oct"><b>+' + NEWS.n + '</b><div style="flex:1"><div class="a-lbl">' + (days ? '27 октября' : 'Сегодня') + ' в Системе</div>' +
      '<div class="t">Добавлены новые образы и палитры</div></div><span>›</span></a>';
  }
  V.tools = function () {
    return top('#/', t('Инструменты', 'Tools')) + '<h1 class="a-h">' + t('Инструменты', 'Tools') + '</h1><div class="a-tiles">' +
      '<a class="a-tile dk" href="' + H + '#/page/p_contrast"><span class="k" style="color:var(--gold)">' + t('Разбор по фото', 'A reading from a photo') + '</span><span class="t">' + t('Контраст внешности', 'Contrast of appearance') + '</span></a>' +
      '<a class="a-tile" href="' + H + '#/page/p_rule_proportions"><span class="k">' + t('Проверка образа', 'Check a look') + '</span><span class="t">' + t('Правило пропорций', 'The proportion rule') + '</span></a></div>';
  };
  // 16.11: «Установите веб-приложение на iPhone / Android» (кнопки и шаги из image-install.js, data-app="color")
  function instBlock() {
    if (!window.ImgInstall || ImgInstall.mode === 'app') return '';
    window.ImgInstallLang = lang;
    return '<div class="a-sec"><b>' + t('Приложение на телефоне', 'The app on your phone') + '</b></div><div class="a-inst" data-ab-root>' + ImgInstall.badges() + '</div>';
  }
  V.home = function () {
    var h = top('', t('Система цветовых сочетаний', 'Colour system'));
    h += '<a class="a-mila" style="margin-top:14px" href="' + H + '#/page/p1"><img src="about-photo.jpg" alt=""><div><div class="t" style="margin-top:0">Мила Ушакова</div><div class="s">' + t('Персональный стилист и аналитик моды', 'Personal stylist and fashion analyst') + '</div></div><span>›</span></a>' +
      '<div class="a-list a-chap">' + [['p2', t('О Системе', 'About the system')], ['p3', t('Как пользоваться', 'How to use it')], ['p_bonus', t('Бонус: промокоды партнёров', 'Bonus: partner codes')], ['p6', t('Рекомендации на сезон', 'Notes for the season')]].map(function (r) {
        return '<a href="' + H + '#/page/' + r[0] + '"><span class="t">' + r[1] + '</span><span class="n">›</span></a>'; }).join('') +
      '<a href="' + H + '#/tools"><span class="t">' + t('Инструменты', 'Tools') + '</span><span class="n">›</span></a></div>';
    h += instBlock();
    h += newsBar();
    h += imgTeaser(); // «Система имиджа» первым блоком
    h += '<div class="a-sec"><b>' + t('Тренды', 'Trends') + (trends.some(function (tr) { return tr.isNew; }) ? '<em class="a-new">' + t('новинка', 'new') + '</em>' : '') + '</b><a href="' + H + '#/trends">' + t('все', 'all') + ' ' + trends.length + '</a></div><div class="a-row">' + trends.map(function (tr) {
      return '<a class="a-tc" href="' + H + '#/trend/' + tr.slug + '"><div class="im"><img loading="lazy" src="' + esc(tr.cover) + '" alt="">' + '</div><span>' + esc(tr.name) + '</span></a>';
    }).join('') + '</div>';
    h += libShelf(); // Библиотека лекций сразу после трендов
    h += ctaBlock();
    h += '<div class="a-empty" style="font-size:11px;line-height:1.8"><a href="' + H + '#/more" style="color:inherit">' + t('Все разделы', 'All sections') + '</a> · <a href="/oferta" style="color:inherit">' + t('Договор оферты', 'Offer') + '</a> · <a href="/privacy" style="color:inherit">' + t('Политика конфиденциальности', 'Privacy') + '</a> · <a href="https://t.me/MilaUshakova_ClubBot?start=support" target="_blank" rel="noopener" style="color:inherit">' + t('Поддержка', 'Support') + '</a><br>© 2026 · ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</div>';
    return h;
  };
  /* лента вдохновения: сначала палитра на весь экран, из неё переход к образу */
  function palList(f) {
    var ids = order.filter(function (id) { return looks[id].pal; });
    if (f === 'new') return ids.filter(function (id) { return /drop_/.test(id); });
    if (f != null && f !== '' && f !== 'all' && colors[+f]) return colors[+f].looks.filter(function (id) { return looks[id].pal; });
    return ids;
  }
  V.pal = function (f) {
    f = f || 'all';
    var chips = [['all', t('Все', 'All')], ['new', t('Новинки', 'New')]].concat(colors.map(function (c, i) { return [String(i), cn(c.name)]; }));
    return '<div class="a-top a-top-pal">' + langUi() + '</div><div class="a-feed-chips">' + chips.map(function (c) { return '<a href="' + H + '#/pal/' + c[0] + '"' + (c[0] === f ? ' class="on"' : '') + '>' + esc(c[1]) + '</a>'; }).join('') + '</div>' +
      '<div class="a-feed">' + palList(f).map(function (id) { var L = looks[id];
        return '<section class="a-slide"><img loading="lazy" src="' + esc(L.pal) + '" alt="' + t('Палитра', 'Palette') + ' ' + esc(L.name) + '">' +
          '<div class="cap"><div><div class="a-lbl" style="color:var(--gold)">' + (L.isNew ? t('Новинка · октябрь', 'New · October') : (L.color != null ? esc(cn(colors[L.color].name)) : t('Дроп сентября', 'September drop'))) + '</div><div class="t">' + esc(L.name) + '</div><div class="sws dots" data-src="' + esc(L.pal) + '"></div></div>' +
          '<a class="a-btn gold go" href="' + H + '#/pal/' + f + '/look/' + id + '">' + t('Образ', 'Look') + ' ›</a></div></section>'; }).join('') + '</div>';
  };
  /* все образы сеткой: фильтр «Все», «Новинки» и по цветам */
  function lookList(f) {
    if (f === 'new') return order.filter(function (id) { return /drop_/.test(id); });
    if (f != null && f !== '' && f !== 'all' && colors[+f]) return colors[+f].looks;
    return order;
  }
  V.looks = function (f) {
    f = f || 'all';
    var ids = lookList(f);
    var chips = [['all', t('Все', 'All')], ['new', t('Новинки', 'New')]].concat(colors.map(function (c, i) { return [String(i), cn(c.name)]; }));
    return top('', t('Образы', 'Looks')) + '<h1 class="a-h">' + t('Образы', 'Looks') + '</h1><div class="a-sub">' + obr(ids.length) + '</div>' +
      '<div class="a-chips">' + chips.map(function (c) { return '<a href="' + H + '#/looks/' + c[0] + '"' + (c[0] === f ? ' class="on"' : '') + '>' + esc(c[1]) + '</a>'; }).join('') + '</div>' +
      grid(ids, '/looks/' + f);
  };
  V.colors = function () {
    return top('', t('Цвета', 'Colours')) + '<h1 class="a-h">' + t('Цветовые сочетания', 'Colour combinations') + '</h1><div class="a-sub">' + t('9 цветов', '9 colours') + ' · ' + obr(colors.reduce(function (s, c) { return s + c.looks.length; }, 0)) + '</div>' +
      '<div class="a-list">' + colors.map(function (c, i) { return '<a href="' + H + '#/color/' + i + '"><i style="background:' + (SW[c.name] || '#999') + '"></i><span class="t">' + esc(cn(c.name)) + '</span><span class="n">' + c.looks.length + ' ›</span></a>'; }).join('') + '</div>';
  };
  V.color = function (i) {
    var c = colors[+i]; if (!c) return V.colors();
    return top('#/colors', t('Цвета', 'Colours')) + '<h1 class="a-h">' + esc(cn(c.name)) + '</h1><div class="a-sub">' + obr(c.looks.length) + '</div>' + grid(c.looks, '/color/' + i);
  };
  V.trends = function () {
    return top('', t('Тренды', 'Trends')) + '<h1 class="a-h">' + t('Тренды сезона', 'Trends of the season') + '</h1><div class="a-sub">' + (lang === 'en' ? trends.length + (trends.length === 1 ? ' trend' : ' trends') : plural(trends.length, 'тренд', 'тренда', 'трендов')) + '</div>' +
      '<div class="a-trc">' + trends.map(function (t) {
        return '<a href="' + H + '#/trend/' + t.slug + '"><img loading="lazy" src="' + esc(t.cover) + '" alt=""><div class="ov"><span class="t">' + esc(t.name) + '</span>' + (t.looks.length ? '<span class="n">' + obr(t.looks.length) + ' ›</span>' : '') + '</div></a>'; }).join('') + '</div>';
  };
  V.trend = function (slug) {
    var tr = trends.filter(function (x) { return x.slug === slug; })[0]; if (!tr) return V.trends();
    return top('#/trends', t('Тренды', 'Trends')) + (tr.cover ? '<img class="a-trcov" src="' + esc(tr.cover) + '" alt="">' : '') + '<h1 class="a-h">' + esc(tr.name) + '</h1>' +
      (tr.looks.length ? '<div class="a-sub">' + obr(tr.looks.length) + '</div>' + grid(tr.looks, '/trend/' + slug) : '');
  };
  V.drop = function (k) {
    var d = DROPS[k]; if (!d) return V.home();
    var dn = d.name === 'Октябрьский дроп' ? t(d.name, 'October drop') : t(d.name, 'September drop');
    return top('#/', t('Дроп', 'Drop')) + '<h1 class="a-h">' + esc(dn) + '</h1><div class="a-sub">' + obr(d.ids.length) + '</div>' + grid(d.ids, '/drop/' + k);
  };
  V.mine = function () {
    var f = favs();
    return top('', t('Мои образы', 'My looks')) + '<h1 class="a-h">' + t('Мои образы', 'My looks') + '</h1>' + (f.length ? '<div class="a-sub">' + obr(f.length) + '</div>' + grid(f, '/mine')
      : '<div class="a-empty">' + t('Нажмите ♡ на образе, и он появится здесь.', 'Tap the heart on a look, and it will stay here.') + '</div>');
  };
  var lastQ = '';
  V.search = function () {
    return top('', t('Поиск', 'Search')) + '<h1 class="a-h">' + t('Поиск', 'Search') + '</h1><label class="a-search">' + I.se.replace('<svg', '<svg width="18" height="18"') +
      '<input type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="' + t('Вещь, бренд или цвет', 'A piece, a brand or a colour') + '" value="' + esc(lastQ) + '"></label>' +
      '<div class="a-hint">' + ['пальто', 'юбка', 'лоферы', 'замша', 'Zara', 'COS'].map(function (w) { return '<button type="button">' + w + '</button>'; }).join('') + '</div><div id="aRes"></div>';
  };
  var searchIds = [];
  function runSearch(q) {
    lastQ = q; var box = $('#aRes'); if (!box) return;
    var w = norm(q).split(' ').filter(function (x) { return x.length > 1; }).map(function (x) { return x.length > 4 ? x.slice(0, x.length - 1) : x; });
    if (!w.length) { box.innerHTML = ''; searchIds = []; return; }
    var hits = order.map(function (id) {
      var L = looks[id], hay = [L.name].concat(L.items).concat(L.trends.map(function (tr) { return tr.name; })).concat(L.color != null ? [colors[L.color].name, cn(colors[L.color].name)] : []);
      var ok = w.every(function (x) { return hay.some(function (s) { return norm(s).indexOf(x) >= 0; }); });
      return ok ? { id: id, why: L.items.filter(function (s) { return w.some(function (x) { return norm(s).indexOf(x) >= 0; }); }).slice(0, 2) } : null;
    }).filter(Boolean);
    searchIds = hits.map(function (h) { return h.id; });
    box.innerHTML = '<div class="a-sub" style="padding-top:16px">' + (hits.length ? t('Нашлось', 'Found') + ' ' + obr(hits.length) : t('Ничего не нашлось. Попробуйте «пальто», «замша», «Zara».', 'Nothing matched. Try coat, suede or Zara.')) + '</div>' +
      '<div class="a-list">' + hits.map(function (h) { var L = looks[h.id];
        return '<a href="' + H + '#/search/look/' + h.id + '"><img loading="lazy" src="' + esc(L.img) + '" alt=""><span class="t">' + t('Образ', 'Look') + ' «' + esc(L.name) + '»<div class="a-found">' + esc(h.why.join(' · ')) + '</div></span></a>'; }).join('') + '</div>';
  }
  V.more = function () {
    var row = function (href, t, n) { return '<a href="' + (href.charAt(0) === '#' ? H + href : href) + '"><span class="t">' + esc(t) + '</span><span class="n">' + (n || '') + ' ›</span></a>'; };
    return top('#/', t('Ещё', 'More')) + '<h1 class="a-h">' + t('Ещё', 'More') + '</h1>' +
      '<div class="a-list">' + PAGES.map(function (p) { return row('#/page/' + p[0], pn(p[1])); }).join('') + '</div>' +
      ctaBlock() + instBlock() +
      '<div class="a-sec"><b>' + t('Промо от брендов', 'Brand offers') + '</b></div><div class="a-list">' + promos.map(function (p) { return row('#/page/' + p.id, navText[p.id] || p.id); }).join('') + '</div>' +
      '<div class="a-sec"><b>' + t('Категории', 'Categories') + '</b></div><div class="a-list">' + cats.map(function (p) { return row('#/page/' + p.id, navText[p.id] || p.id); }).join('') + '</div>' +
      '<div class="a-list" style="margin-top:20px">' + row('https://t.me/MilaUshakova_ClubBot?start=support', t('Поддержка в Telegram', 'Support on Telegram')) + row('/oferta', t('Договор оферты', 'Offer')) + row('/privacy', t('Политика конфиденциальности', 'Privacy')) + '</div>' +
      '<div class="a-empty" style="font-size:11px">© 2026 · ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</div>';
  };
  /* страница Системы как есть (контраст, бонус, правило пропорций...) переносится в экран и возвращается обратно */
  var moved = null;
  function restorePage() { if (moved) { moved.ph.parentNode.insertBefore(moved.pg, moved.ph); moved.ph.remove(); moved = null; } }
  V.page = function (id) {
    var pg = document.getElementById(id); if (!pg) return V.home();
    return top(id.indexOf('p_promo_') === 0 || id.indexOf('p_cat_') === 0 ? '#/more' : 'back', pn(PAGES.filter(function (p) { return p[0] === id; }).map(function (p) { return p[1]; })[0] || navText[id] || '')) + '<div id="aPg"></div>';
  };

  /* ── Карточка образа ── */
  var ctxIds = [], ctxBase = '/', sheetId = null;
  function listFor(base) {
    var m = base.split('/');
    if (m[1] === 'color' && colors[+m[2]]) return colors[+m[2]].looks;
    if (m[1] === 'trend') { var t = trends.filter(function (x) { return x.slug === m[2]; })[0]; if (t) return t.looks; }
    if (m[1] === 'drop' && DROPS[m[2]]) return DROPS[m[2]].ids;
    if (m[1] === 'pal') return palList(m[2]);
    if (m[1] === 'looks') return lookList(m[2]);
    if (m[1] === 'mine') return favs();
    if (m[1] === 'search') return searchIds.length ? searchIds : order;
    return order;
  }
  /* цвета палитры считаются с картинки прямо в браузере */
  var swCache = {};
  function swatches(src, cb) {
    if (!src) return cb([]);
    if (swCache[src]) return cb(swCache[src]);
    var im = new Image();
    im.onload = function () {
      try {
        var c = document.createElement('canvas'), N = 48; c.width = N; c.height = N;
        var x = c.getContext('2d'); x.drawImage(im, 0, 0, N, N);
        var d = x.getImageData(0, 0, N, N).data, B = {};
        for (var i = 0; i < d.length; i += 4) {
          var k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
          var o = B[k] || (B[k] = { n: 0, r: 0, g: 0, b: 0 }); o.n++; o.r += d[i]; o.g += d[i + 1]; o.b += d[i + 2];
        }
        var all = Object.keys(B).map(function (k) { var o = B[k]; return { n: o.n, r: o.r / o.n, g: o.g / o.n, b: o.b / o.n }; }).sort(function (p, q) { return q.n - p.n; });
        var out = [];
        all.forEach(function (c1) {
          if (out.length >= 5) return;
          var near = out.filter(function (c2) { return Math.abs(c1.r - c2.r) + Math.abs(c1.g - c2.g) + Math.abs(c1.b - c2.b) < 90; })[0];
          if (near) near.n += c1.n; else out.push(c1);
        });
        var tot = out.reduce(function (s1, c1) { return s1 + c1.n; }, 0);
        swCache[src] = out.map(function (c1) { return { hex: '#' + [c1.r, c1.g, c1.b].map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join(''), p: Math.round(100 * c1.n / tot) }; });
      } catch (e) { swCache[src] = []; }
      cb(swCache[src]);
    };
    im.onerror = function () { cb([]); };
    im.src = src;
  }
  var MODES = [['1', 'Полоса', 'Strip'], ['2', 'Две стороны', 'Two sides'], ['3', 'Образ главный', 'Look first']];
  var mode = '2', side = 'pal';
  function fitLook() {
    var st = $('.stage', sheet), w = st && $('.look-collage-wrap', st); if (!w) return;
    var bx = $('.a-in', st); if (bx) { bx.style.width = '100%'; bx.style.height = '100%'; }
    var W = st.clientWidth, Hh = st.clientHeight, cw = Math.min(W, Hh * 0.8);
    w.style.width = cw + 'px'; w.style.height = (cw * 1.25) + 'px';
  }
  window.addEventListener('resize', fitLook);
  function openSheet(id, base) {
    var L = looks[id]; if (!L) return closeSheet();
    if (sheetId !== id) side = L.pal && base.indexOf('/pal') !== 0 && base.indexOf('/looks') !== 0 ? 'pal' : 'look'; // из «Палитр» и «Образов» сразу образ
    ctxIds = listFor(base); ctxBase = base; sheetId = id; LS.set('app_last', id);
    var ix = ctxIds.indexOf(id), n = ctxIds.length, fav = favs().indexOf(id) >= 0;
    var wrap = L.pg.querySelector('.look-collage-wrap').cloneNode(true), links = L.pg.querySelector('.look-links').cloneNode(true);
    var tags = (L.color != null ? '<a href="' + H + '#/color/' + L.color + '">' + esc(cn(colors[L.color].name)) + '</a>' : '') +
      L.trends.map(function (tr) { return '<a href="' + H + '#/trend/' + tr.slug + '">' + esc(tr.name) + '</a>'; }).join('');
    var bar = '<div class="bar"><button type="button" class="x" aria-label="' + t('Закрыть', 'Close') + '">✕</button><div class="ttl"><span>' +
      (ix >= 0 ? (ix + 1) + ' ' + t('из', 'of') + ' ' + n : t('образ', 'look')) + '</span><b>' + esc(L.name) + '</b></div><button type="button" class="hrt' + (fav ? ' on' : '') + '" aria-label="' + t('В мои образы', 'Save to my looks') + '">' + (fav ? '♥' : '♡') + '</button></div>';
    var modes = '<div class="modes">' + MODES.map(function (m) { return '<button type="button" data-mode="' + m[0] + '"' + (m[0] === mode ? ' class="on"' : '') + '>' + m[0] + ' · ' + t(m[1], m[2]) + '</button>'; }).join('') + '</div>';
    var nav = '<div class="nav3"><button type="button" class="p" aria-label="' + t('Предыдущий образ', 'Previous look') + '"' + (ix > 0 ? '' : ' disabled') + '>‹</button><div class="tags">' + tags + '</div><button type="button" class="n" aria-label="' + t('Следующий образ', 'Next look') + '"' + (ix >= 0 && ix < n - 1 ? '' : ' disabled') + '>›</button></div>';
    var body = '';
    if (mode === '1') body = '<div class="m1-pal">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '<div class="sws"></div></div><div class="stage"></div><div class="items row"></div>';
    if (mode === '2') body = '<div class="seg"><button type="button" data-side="pal"' + (side === 'pal' ? ' class="on"' : '') + '>' + t('Палитра', 'Palette') + '</button><button type="button" data-side="look"' + (side === 'look' ? ' class="on"' : '') + '>' + t('Образ', 'Look') + '</button></div>' +
      (side === 'pal' ? '<div class="stage pal-side">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '<button type="button" class="flip" data-side="look">' + t('Смотреть образ ›', 'See the look ›') + '</button></div>' : '<div class="stage"></div><div class="items row"></div>');
    if (mode === '3') body = '<div class="stage"><button type="button" class="m3-pal" aria-label="' + t('Открыть палитру', 'Open the palette') + '">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '</button><div class="m3-full">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '</div></div>' +
      '<div class="m3-row"><div class="sws dots"></div><button type="button" class="m3-items">' + t('Вещи образа', 'Pieces in the look') + ' · ' + L.items.length + '</button></div><div class="drawer"><div class="dr-h"><b>' + t('Вещи образа', 'Pieces in the look') + '</b><button type="button" class="dr-x" aria-label="' + t('Закрыть', 'Close') + '">✕</button></div><div class="items col"></div></div>';
    sheet.innerHTML = '<div class="wrap m' + mode + '">' + bar + '<div class="sw-in">' + body + '</div>' + nav + '</div>';
    var st = $('.stage', sheet);
    /* карточка вещи из ux.js ищет вокруг точки контейнер .in: даём его, иначе нажатие на точку ничего не открывает */
    if (st && !st.classList.contains('pal-side')) { var box = document.createElement('div'); box.className = 'in a-in'; box.appendChild(wrap); st.insertBefore(box, st.firstChild); }
    var it = $('.items', sheet); if (it) it.appendChild(links);
    var sw = $('.sws', sheet);
    if (sw) swatches(L.pal, function (list) {
      sw.innerHTML = list.filter(function (c) { return c.p >= 2; }).map(function (c) { return '<i style="background:' + c.hex + (sw.classList.contains('big') ? ';flex:1' : '') + '">' + '' + '</i>'; }).join('');
    });
    sheet.classList.add('on'); document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(fitLook); setTimeout(fitLook, 60);
  }
  function closeSheet() { sheetId = null; sheet.classList.remove('on'); document.documentElement.style.overflow = ''; }
  function step(d) {
    var ix = ctxIds.indexOf(sheetId) + d; if (ix < 0 || ix >= ctxIds.length) return;
    var el = $('.sw-in', sheet); if (el) { el.style.transform = 'translateX(' + (-d * 40) + 'px)'; el.style.opacity = '0'; }
    setTimeout(function () { location.replace(H + '#' + (ctxBase === '/' ? '' : ctxBase) + '/look/' + ctxIds[ix]); }, 120);
  }
  sheet.addEventListener('click', function (e) {
    if (e.target.closest('.pal-side') && !e.target.closest('button')) { side = 'look'; openSheet(sheetId, ctxBase); return; }
    var fp = e.target.closest('.m3-full.on'); if (fp) { fp.classList.remove('on'); return; }
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.mode) { mode = b.dataset.mode; LS.set('app_card', mode); openSheet(sheetId, ctxBase); return; }
    if (b.dataset.side) { side = b.dataset.side; openSheet(sheetId, ctxBase); return; }
    if (b.classList.contains('m3-pal')) { $('.m3-full', sheet).classList.toggle('on'); return; }
    if (b.classList.contains('m3-items')) { $('.drawer', sheet).classList.add('on'); return; }
    if (b.classList.contains('dr-x')) { $('.drawer', sheet).classList.remove('on'); return; }
    if (b.classList.contains('x')) { if (backOK) history.back(); else location.replace(H + '#' + ctxBase); }
    else if (b.classList.contains('p')) step(-1);
    else if (b.classList.contains('n')) step(1);
    else if (b.classList.contains('hrt')) {
      var f = LS.get('favs', []), i = f.indexOf(sheetId);
      if (i >= 0) f.splice(i, 1); else f.unshift(sheetId);
      LS.set('favs', f); b.classList.toggle('on', i < 0); b.textContent = i < 0 ? '♥' : '♡'; badge();
    }
  });
  var tx = 0, ty = 0;
  sheet.addEventListener('touchstart', function (e) { var t = e.touches[0]; tx = t.clientX; ty = t.clientY; }, { passive: true });
  sheet.addEventListener('touchend', function (e) {
    if (e.target.closest('.look-links') || e.target.closest('.tags') || e.target.closest('.modes')) return;
    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) step(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── Маршруты ── */
  var scrolls = {}, curBase = null, opened = false, backOK = false, prevBase = null;
  function badge() { var n = favs().length, b = $('.badge', tab); b.hidden = !n; b.textContent = n; }
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
    var m = h.match(/^(.*?)\/look\/([\w-]+)$/), base = m ? (m[1] || '/') : h, lookId = m ? m[2] : null;
    if (base !== curBase) {
      if (curBase != null) scrolls[curBase] = window.pageYOffset;
      restorePage();
      var p = base.split('/'), v = p[1] || 'home';
      var fn = V[v] || V.home, html = fn(p[2]);
      av.innerHTML = html;
      if (v === 'page') {
        var pg = document.getElementById(p[2]);
        if (pg) { var ph = document.createComment('pg'); pg.parentNode.insertBefore(ph, pg); $('#aPg').appendChild(pg); moved = { pg: pg, ph: ph }; }
        var bk = $('.a-back', av); if (bk && bk.getAttribute('href') === 'back') { if (!opened) { bk.textContent = t('На главную ›', 'Home ›'); } bk.addEventListener('click', function (e) { e.preventDefault(); if (opened) history.back(); else location.hash = '#/'; }); }
      }
      document.documentElement.classList.toggle('feed', v === 'pal');
      if (v === 'pal') {
        var feed = $('.a-feed', av), seen = function () {
          $$('.sws[data-src]', feed).forEach(function (el) {
            var r = el.getBoundingClientRect(); if (r.top > window.innerHeight * 2 || r.bottom < -200) return;
            var src = el.getAttribute('data-src'); el.removeAttribute('data-src');
            swatches(src, function (list) { el.innerHTML = list.filter(function (c) { return c.p >= 2; }).map(function (c) { return '<i style="background:' + c.hex + '"></i>'; }).join(''); });
          });
        };
        feed.addEventListener('scroll', seen, { passive: true }); setTimeout(seen, 50);
        var oc = $('.a-feed-chips .on', av); if (oc) oc.scrollIntoView({ inline: 'center', block: 'nearest' });
      }
      if (v === 'search') {
        var inp = $('.a-search input', av);
        inp.addEventListener('input', function () { runSearch(inp.value); });
        $$('.a-hint button', av).forEach(function (b) { b.addEventListener('click', function () { inp.value = b.textContent; runSearch(b.textContent); }); });
        if (lastQ) runSearch(lastQ);
      }
      if (window.ImgInstall) $$('[data-ab-root]', av).forEach(function (r) { ImgInstall.bindBadges(r, false, false); });
      var tk = { home: 'home', pal: 'pal', looks: 'looks', colors: 'pal', color: 'pal', trends: 'trends', trend: 'trends', search: 'search', mine: 'mine' }[v] || '';
      $$('a', tab).forEach(function (a) { a.classList.toggle('on', a.dataset.t === tk); });
      curBase = base;
      window.scrollTo(0, scrolls[base] || 0);
    }
    if (lookId && !sheetId) backOK = opened && base === prevBase;
    if (lookId) openSheet(lookId, base); else if (sheetId) closeSheet();
    prevBase = base;
    badge();
  }
  window.addEventListener('hashchange', function () { opened = true; route(); });

  /* старые переходы Системы (кнопки внутри страниц, якоря) ведут в экраны приложения */
  window.scrollToEl = function (id) {
    if (looks[id]) { location.hash = '#' + (curBase && curBase !== '/' ? curBase : '') + '/look/' + id; return; }
    var pg = document.getElementById(id);
    if (pg && pg.classList.contains('pal-pg')) { var nx = pg.nextElementSibling; while (nx && !(nx.classList && nx.classList.contains('pg'))) nx = nx.nextElementSibling; if (nx && looks[nx.id]) { scrollToEl(nx.id); return; } }
    if (/^p_trend_/.test(id)) { location.hash = '#/trend/' + id.slice(8); return; }
    if (id === 'p4' || id === 'p0') { location.hash = '#/'; return; }
    if (pg) {
      if (moved && moved.pg.contains(pg)) { pg.scrollIntoView({ behavior: 'smooth' }); return; }
      location.hash = '#/page/' + id;
    }
  };

  /* старые ссылки вида /guide#p_look_4 из писем и бота открывают нужный экран */
  var legacy = location.hash.length > 1 && location.hash.charAt(1) !== '/' ? decodeURIComponent(location.hash.slice(1)) : '';
  if (legacy) { history.replaceState(null, '', H); LS.set('app_intro', true); }
  /* первое открытие: «Обо мне», «О Системе», «Как пользоваться» один раз, дальше сразу главная */
  if (!location.hash && !LS.get('app_intro', false)) { LS.set('app_intro', true); location.replace(H + '#/page/p2'); }
  function setLang(next) {
    if ((next !== 'ru' && next !== 'en') || next === lang) return;
    lang = next;
    try { localStorage.setItem('mu_lang', lang); localStorage.setItem('img_lang', lang); } catch (e) {}
    window.ImgInstallLang = lang;
    document.documentElement.lang = lang;
    paintTab();
    curBase = null;
    route();
  }
  ap.addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (!b) return;
    e.preventDefault();
    setLang(b.getAttribute('data-lang'));
  });
  route();
  if (legacy) { opened = false; scrollToEl(legacy); }
})();
