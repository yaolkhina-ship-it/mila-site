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

  /* у Системы <base href="/guide/">: ссылки вида "#/..." увели бы на /guide/, поэтому адрес страницы пишется целиком */
  var H = location.pathname + location.search;

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
  var trends = $$('.tr-pg').map(function (p) {
    var h = $('.ins-h', p);
    return { slug: p.id.replace('p_trend_', ''), name: h ? h.firstChild.textContent.trim() : '', isNew: !!$('.tr-new', p),
      looks: $$('.tr-look', p).map(function (d) { return ((d.getAttribute('onclick') || '').match(/'([^']+)'/) || [])[1]; }).filter(function (id) { return looks[id]; }) };
  });
  trends.forEach(function (t) { t.looks.forEach(function (id) { looks[id].trends.push(t); }); });
  var DROPS = { oct: { name: 'Октябрьский дроп', ids: drops.oct }, sep: { name: 'Дроп сентября', ids: drops.sep } };
  var navText = {}; $$('#p4 [onclick*="scrollToEl"]').forEach(function (el) {
    var m = (el.getAttribute('onclick').match(/'([^']+)'/) || [])[1], sub = el.classList.contains('tone-item') || el.classList.contains('cat-chip');
    if (m && (sub || !navText[m])) navText[m] = ($('.ni-t, .ni-new-t', el) || el).textContent.replace(/[→→]/g, '').trim();
  });
  var PAGES = [['p1', 'Обо мне'], ['p2', 'О Системе'], ['p3', 'Как пользоваться'], ['p_rule_proportions', 'Правило пропорций'],
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
    se: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/></svg>'
  };
  var tab = document.createElement('nav'); tab.className = 'a-tab'; tab.setAttribute('aria-label', 'Разделы Системы');
  tab.innerHTML = '<a href="' + H + '#/" data-t="home">' + I.home + 'Главная</a><a href="' + H + '#/colors" data-t="colors">' + I.col + 'Цвета</a>' +
    '<a href="' + H + '#/trends" data-t="trends">' + I.tr + 'Тренды</a><a href="' + H + '#/search" data-t="search">' + I.se + 'Поиск</a>' +
    '<a href="' + H + '#/mine" data-t="mine">' + I.me + 'Мои<span class="badge" hidden></span></a>';
  document.body.appendChild(tab);
  var sheet = document.createElement('div'); sheet.className = 'a-sheet'; sheet.setAttribute('role', 'dialog');
  document.body.appendChild(sheet);

  /* ── Кусочки разметки ── */
  var top = function (back, lbl) {
    return '<div class="a-top">' + (back ? '<a class="a-back" href="' + (back.charAt(0) === '#' ? H + back : back) + '">‹ Назад</a>' : '<span class="a-lbl">Mila Ushakova</span>') +
      '<span class="a-lbl">' + esc(lbl || 'Система') + '</span></div>';
  };
  var cell = function (id, ctx) {
    var L = looks[id]; if (!L) return '';
    return '<a class="a-cell" href="' + H + '#' + ctx + '/look/' + id + '"><div class="im"><img loading="lazy" src="' + esc(L.img) + '" alt="">' +
      (L.pal ? '<img class="pal" loading="lazy" src="' + esc(L.pal) + '" alt="">' : '') + (favs().indexOf(id) >= 0 ? '<span class="fav">♥</span>' : '') +
      '</div><span>' + esc(L.name) + (L.isNew ? ' <em>· новинка</em>' : '') + '</span></a>';
  };
  var grid = function (ids, ctx) { return '<div class="a-grid">' + ids.map(function (id) { return cell(id, ctx); }).join('') + '</div>'; };
  var plural = function (n, a, b, c) { var m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c); };
  var obr = function (n) { return plural(n, 'образ', 'образа', 'образов'); };

  /* ── Экраны ── */
  var V = {};
  V.home = function () {
    var d = DROPS.oct, first = looks[d.ids[0]], last = looks[LS.get('app_last', '')];
    var h = top('', 'Система цветовых сочетаний');
    if (first) h += '<a class="a-hero" href="' + H + '#/drop/oct"><img src="' + esc(first.pal || first.img) + '" alt=""><div class="ov"><div><div class="a-lbl" style="color:var(--gold)">Новый дроп · октябрь</div><div class="t">' + obr(d.ids.length) + '</div></div><span class="a-pill">Смотреть</span></div></a>';
    if (last) h += '<a class="a-cont" href="' + H + '#/look/' + last.id + '"><img src="' + esc(last.img) + '" alt=""><div style="flex:1"><div class="a-lbl">Продолжить</div><div style="font-size:15px;margin-top:3px">образ ' + esc(last.name) + '</div></div><span style="color:var(--gold2)">›</span></a>';
    h += '<div class="a-sec"><b>Цвета</b><a href="' + H + '#/colors">все</a></div><div class="a-sw">' + colors.map(function (c, i) {
      return '<a href="' + H + '#/color/' + i + '"><i style="background:' + (SW[c.name] || '#999') + '"></i>' + esc(c.name.replace(' и ', ' и ')) + '</a>';
    }).join('') + '</div>';
    h += '<div class="a-sec"><b>Тренды</b><a href="' + H + '#/trends">все ' + trends.length + '</a></div><div class="a-row">' + trends.map(function (t) {
      var L = looks[t.looks[0]]; return '<a class="a-tc" href="' + H + '#/trend/' + t.slug + '"><img loading="lazy" src="' + esc(L ? L.img : '') + '" alt=""><span>' + esc(t.name) + '</span></a>';
    }).join('') + '</div>';
    h += '<div class="a-sec"><b>Инструменты</b></div><div class="a-tiles">' +
      '<a class="a-tile dk" href="' + H + '#/page/p_contrast"><span class="k" style="color:var(--gold)">Разбор по фото</span><span class="t">Контраст внешности</span></a>' +
      '<a class="a-tile" href="' + H + '#/page/p_rule_proportions"><span class="k">Проверка образа</span><span class="t">Правило пропорций</span></a>' +
      '<a class="a-tile" href="' + H + '#/drop/sep"><span class="k">' + obr(DROPS.sep.ids.length) + '</span><span class="t">Дроп сентября</span></a>' +
      '<a class="a-tile" href="' + H + '#/more"><span class="k">Промо, категории</span><span class="t">Все разделы</span></a></div>';
    h += '<div class="a-sec"><b>О Системе</b></div>' +
      '<a class="a-mila" href="' + H + '#/page/p1"><img src="about-photo.jpg" alt=""><div><div class="a-lbl">Обо мне</div><div class="t">Мила Ушакова</div><div class="s">Персональный стилист и аналитик моды</div></div><span>›</span></a>' +
      '<div class="a-list a-chap">' + [['p2', 'О Системе'], ['p3', 'Как пользоваться'], ['p_bonus', 'Бонус: промокоды партнёров'], ['p6', 'Рекомендации на сезон']].map(function (r) {
        return '<a href="' + H + '#/page/' + r[0] + '"><span class="t">' + r[1] + '</span><span class="n">›</span></a>'; }).join('') +
      '<a href="' + H + '#/more"><span class="t">Промо от брендов и категории</span><span class="n">›</span></a></div>';
    return h;
  };
  V.colors = function () {
    return top('', 'Цвета') + '<h1 class="a-h">Цветовые сочетания</h1><div class="a-sub">9 цветов · ' + obr(colors.reduce(function (s, c) { return s + c.looks.length; }, 0)) + '</div>' +
      '<div class="a-list">' + colors.map(function (c, i) { return '<a href="' + H + '#/color/' + i + '"><i style="background:' + (SW[c.name] || '#999') + '"></i><span class="t">' + esc(c.name) + '</span><span class="n">' + c.looks.length + ' ›</span></a>'; }).join('') + '</div>';
  };
  V.color = function (i) {
    var c = colors[+i]; if (!c) return V.colors();
    return top('#/colors', 'Цвета') + '<h1 class="a-h">' + esc(c.name) + '</h1><div class="a-sub">' + obr(c.looks.length) + '</div>' + grid(c.looks, '/color/' + i);
  };
  V.trends = function () {
    return top('', 'Тренды') + '<h1 class="a-h">Тренды сезона</h1><div class="a-sub">' + plural(trends.length, 'тренд', 'тренда', 'трендов') + '</div>' +
      '<div class="a-list">' + trends.map(function (t) { var L = looks[t.looks[0]];
        return '<a href="' + H + '#/trend/' + t.slug + '"><img loading="lazy" src="' + esc(L ? L.img : '') + '" alt=""><span class="t"><span' + (t.isNew ? ' class="tr-new"' : '') + '>' + esc(t.name) + '</span></span><span class="n">' + t.looks.length + ' ›</span></a>'; }).join('') + '</div>';
  };
  V.trend = function (slug) {
    var t = trends.filter(function (x) { return x.slug === slug; })[0]; if (!t) return V.trends();
    return top('#/trends', 'Тренды') + '<h1 class="a-h">' + esc(t.name) + '</h1><div class="a-sub">' + obr(t.looks.length) + '</div>' + grid(t.looks, '/trend/' + slug);
  };
  V.drop = function (k) {
    var d = DROPS[k]; if (!d) return V.home();
    return top('#/', 'Дроп') + '<h1 class="a-h">' + esc(d.name) + '</h1><div class="a-sub">' + obr(d.ids.length) + '</div>' + grid(d.ids, '/drop/' + k);
  };
  V.mine = function () {
    var f = favs();
    return top('', 'Мои образы') + '<h1 class="a-h">Мои образы</h1>' + (f.length ? '<div class="a-sub">' + obr(f.length) + '</div>' + grid(f, '/mine')
      : '<div class="a-empty">Нажмите ♡ на образе, и он появится здесь.</div>');
  };
  var lastQ = '';
  V.search = function () {
    return top('', 'Поиск') + '<h1 class="a-h">Поиск</h1><label class="a-search">' + I.se.replace('<svg', '<svg width="18" height="18"') +
      '<input type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Вещь, бренд или цвет" value="' + esc(lastQ) + '"></label>' +
      '<div class="a-hint">' + ['пальто', 'юбка', 'лоферы', 'замша', 'Zara', 'COS'].map(function (w) { return '<button type="button">' + w + '</button>'; }).join('') + '</div><div id="aRes"></div>';
  };
  var searchIds = [];
  function runSearch(q) {
    lastQ = q; var box = $('#aRes'); if (!box) return;
    var w = norm(q).split(' ').filter(function (x) { return x.length > 1; }).map(function (x) { return x.length > 4 ? x.slice(0, x.length - 1) : x; });
    if (!w.length) { box.innerHTML = ''; searchIds = []; return; }
    var hits = order.map(function (id) {
      var L = looks[id], hay = [L.name].concat(L.items).concat(L.trends.map(function (t) { return t.name; })).concat(L.color != null ? [colors[L.color].name] : []);
      var ok = w.every(function (x) { return hay.some(function (s) { return norm(s).indexOf(x) >= 0; }); });
      return ok ? { id: id, why: L.items.filter(function (s) { return w.some(function (x) { return norm(s).indexOf(x) >= 0; }); }).slice(0, 2) } : null;
    }).filter(Boolean);
    searchIds = hits.map(function (h) { return h.id; });
    box.innerHTML = '<div class="a-sub" style="padding-top:16px">' + (hits.length ? 'Нашлось ' + obr(hits.length) : 'Ничего не нашлось. Попробуйте «пальто», «замша», «Zara».') + '</div>' +
      '<div class="a-list">' + hits.map(function (h) { var L = looks[h.id];
        return '<a href="' + H + '#/search/look/' + h.id + '"><img loading="lazy" src="' + esc(L.img) + '" alt=""><span class="t">Образ «' + esc(L.name) + '»<div class="a-found">' + esc(h.why.join(' · ')) + '</div></span></a>'; }).join('') + '</div>';
  }
  V.more = function () {
    var row = function (href, t, n) { return '<a href="' + (href.charAt(0) === '#' ? H + href : href) + '"><span class="t">' + esc(t) + '</span><span class="n">' + (n || '') + ' ›</span></a>'; };
    return top('#/', 'Ещё') + '<h1 class="a-h">Ещё</h1>' +
      '<div class="a-list">' + PAGES.map(function (p) { return row('#/page/' + p[0], p[1]); }).join('') + '</div>' +
      '<div class="a-sec"><b>Промо от брендов</b></div><div class="a-list">' + promos.map(function (p) { return row('#/page/' + p.id, navText[p.id] || p.id); }).join('') + '</div>' +
      '<div class="a-sec"><b>Категории</b></div><div class="a-list">' + cats.map(function (p) { return row('#/page/' + p.id, navText[p.id] || p.id); }).join('') + '</div>' +
      '<div class="a-list" style="margin-top:20px">' + row('https://t.me/MilaUshakova_ClubBot?start=support', 'Поддержка в Telegram') + row('/oferta', 'Договор оферты') + row('/privacy', 'Политика конфиденциальности') + '</div>' +
      '<div class="a-empty" style="font-size:11px">© 2026 · ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</div>';
  };
  /* страница Системы как есть (контраст, бонус, правило пропорций...) переносится в экран и возвращается обратно */
  var moved = null;
  function restorePage() { if (moved) { moved.ph.parentNode.insertBefore(moved.pg, moved.ph); moved.ph.remove(); moved = null; } }
  V.page = function (id) {
    var pg = document.getElementById(id); if (!pg) return V.home();
    return top(id.indexOf('p_promo_') === 0 || id.indexOf('p_cat_') === 0 ? '#/more' : 'back', PAGES.filter(function (p) { return p[0] === id; }).map(function (p) { return p[1]; })[0] || navText[id] || '') + '<div id="aPg"></div>';
  };

  /* ── Карточка образа ── */
  var ctxIds = [], ctxBase = '/', sheetId = null;
  function listFor(base) {
    var m = base.split('/');
    if (m[1] === 'color' && colors[+m[2]]) return colors[+m[2]].looks;
    if (m[1] === 'trend') { var t = trends.filter(function (x) { return x.slug === m[2]; })[0]; if (t) return t.looks; }
    if (m[1] === 'drop' && DROPS[m[2]]) return DROPS[m[2]].ids;
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
  var MODES = [['1', 'Полоса'], ['2', 'Две стороны'], ['3', 'Образ главный']];
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
    if (sheetId !== id) side = L.pal ? 'pal' : 'look';
    ctxIds = listFor(base); ctxBase = base; sheetId = id; LS.set('app_last', id);
    var ix = ctxIds.indexOf(id), n = ctxIds.length, fav = favs().indexOf(id) >= 0;
    var wrap = L.pg.querySelector('.look-collage-wrap').cloneNode(true), links = L.pg.querySelector('.look-links').cloneNode(true);
    var tags = (L.color != null ? '<a href="' + H + '#/color/' + L.color + '">' + esc(colors[L.color].name) + '</a>' : '') +
      L.trends.map(function (t) { return '<a href="' + H + '#/trend/' + t.slug + '">' + esc(t.name) + '</a>'; }).join('');
    var bar = '<div class="bar"><button type="button" class="x" aria-label="Закрыть">✕</button><div class="ttl"><span>' +
      (ix >= 0 ? (ix + 1) + ' из ' + n : 'образ') + '</span><b>' + esc(L.name) + '</b></div><button type="button" class="hrt' + (fav ? ' on' : '') + '" aria-label="В мои образы">' + (fav ? '♥' : '♡') + '</button></div>';
    var modes = '<div class="modes">' + MODES.map(function (m) { return '<button type="button" data-mode="' + m[0] + '"' + (m[0] === mode ? ' class="on"' : '') + '>' + m[0] + ' · ' + m[1] + '</button>'; }).join('') + '</div>';
    var nav = '<div class="nav3"><button type="button" class="p" aria-label="Предыдущий образ"' + (ix > 0 ? '' : ' disabled') + '>‹</button><div class="tags">' + tags + '</div><button type="button" class="n" aria-label="Следующий образ"' + (ix >= 0 && ix < n - 1 ? '' : ' disabled') + '>›</button></div>';
    var body = '';
    if (mode === '1') body = '<div class="m1-pal">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '<div class="sws"></div></div><div class="stage"></div><div class="items row"></div>';
    if (mode === '2') body = '<div class="seg"><button type="button" data-side="pal"' + (side === 'pal' ? ' class="on"' : '') + '>Палитра</button><button type="button" data-side="look"' + (side === 'look' ? ' class="on"' : '') + '>Образ</button></div>' +
      (side === 'pal' ? '<div class="stage pal-side">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '<button type="button" class="flip" data-side="look">Смотреть образ ›</button></div><div class="sws big"></div>' : '<div class="stage"></div><div class="items row"></div>');
    if (mode === '3') body = '<div class="stage"><button type="button" class="m3-pal" aria-label="Открыть палитру">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '</button><div class="m3-full">' + (L.pal ? '<img src="' + esc(L.pal) + '" alt="">' : '') + '</div></div>' +
      '<div class="m3-row"><div class="sws dots"></div><button type="button" class="m3-items">Вещи образа · ' + L.items.length + '</button></div><div class="drawer"><div class="dr-h"><b>Вещи образа</b><button type="button" class="dr-x" aria-label="Закрыть">✕</button></div><div class="items col"></div></div>';
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
        var bk = $('.a-back', av); if (bk && bk.getAttribute('href') === 'back') { if (!opened) { bk.textContent = 'На главную ›'; } bk.addEventListener('click', function (e) { e.preventDefault(); if (opened) history.back(); else location.hash = '#/'; }); }
      }
      if (v === 'search') {
        var inp = $('.a-search input', av);
        inp.addEventListener('input', function () { runSearch(inp.value); });
        $$('.a-hint button', av).forEach(function (b) { b.addEventListener('click', function () { inp.value = b.textContent; runSearch(b.textContent); }); });
        if (lastQ) runSearch(lastQ);
      }
      var tk = { home: 'home', colors: 'colors', color: 'colors', trends: 'trends', trend: 'trends', search: 'search', mine: 'mine' }[v] || '';
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
  route();
  if (legacy) { opened = false; scrollToEl(legacy); }
})();
