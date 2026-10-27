/* Система: функции 10.2026.
   Продолжить с места · меню-шторка с поиском · «Мои образы» · карточка вещи · прогресс и раздел ·
   гаснущие новинки · свайп между палитрами одного цвета · работа без интернета */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem('sys_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('sys_' + k, JSON.stringify(v)); } catch (e) {} }
  };
  var html = document.documentElement;
  var norm = function (s) { return (s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim(); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var pages = $$('.app > .pg[id]');
  function pageAt(y) {
    var cur = null;
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i]; if (!p.offsetHeight) continue;
      if (p.offsetTop <= y) cur = p; else break;
    }
    return cur;
  }
  function currentPage() { return pageAt(window.pageYOffset + window.innerHeight * 0.4); }

  /* ── Образы: имя, картинка, вещи ── */
  function prevPg(el) { var p = el.previousElementSibling; while (p && !(p.classList && p.classList.contains('pg'))) p = p.previousElementSibling; return p; }
  var looks = $$('.look-pg[id]').filter(function (p) { return $('.look-link-chip', p) && p.id.indexOf('p_cat_') !== 0; });
  function lookName(pg) {
    var card = $('a.gc[href="#' + pg.id + '"] .in2');
    if (card) return card.textContent.replace(/^Образ\s*/i, '').replace(/[«»]/g, '').trim();
    var pv = prevPg(pg), c = pv && pv.classList.contains('pal-pg') && $('.pal-pg-counter', pv);
    if (c) return c.textContent.replace(/·\s*новинка/i, '').trim();
    var n = $('.look-num', pg); return n ? n.textContent.replace(/^.*образ\s*/i, '').trim() : 'образ';
  }
  var lookInfo = {};
  looks.forEach(function (pg) {
    var img = $('.look-collage-wrap img', pg);
    lookInfo[pg.id] = {
      id: pg.id, name: lookName(pg), img: img ? img.getAttribute('src') : '',
      items: $$('.look-link-chip', pg).map(function (a) { return a.textContent.trim(); })
    };
  });

  /* ── Разделы из навигации ── */
  var nav = $('#p4 .in');
  var anchors = [];
  if (nav) {
    $$('[onclick*="scrollToEl"]', nav).forEach(function (el) {
      var m = el.getAttribute('onclick').match(/scrollToEl\('([^']+)'\)/); if (!m) return;
      var t = document.getElementById(m[1]); if (!t) return;
      var lvl = el.classList.contains('tone-item') || el.classList.contains('cat-chip') ? 1 : 0;
      var txt = (lvl ? el.textContent : ($('.ni-t, .ni-new-t', el) || el).textContent).replace(/[→→]/g, '').trim();
      anchors.push({ el: t, lvl: lvl, text: txt });
    });
  }
  function sectionAt(y) {
    var list = anchors.filter(function (a) { return a.el.offsetHeight; })
      .sort(function (a, b) { return a.el.offsetTop - b.el.offsetTop || a.lvl - b.lvl; });
    var l0 = '', l1 = '';
    for (var i = 0; i < list.length; i++) {
      if (list[i].el.offsetTop > y) break;
      if (list[i].lvl === 0) { l0 = list[i].text; l1 = ''; } else l1 = list[i].text;
    }
    if (!l0 && !l1) return '';
    return l1 && l1 !== l0 ? (l0 ? l0 + ' · ' + l1 : l1) : l0;
  }
  var p4 = document.getElementById('p4');
  function afterNav(y) { return p4 && y >= p4.offsetTop + p4.offsetHeight - 10; }

  /* ── Переход без записи в «Назад» (свайп палитр, продолжить) ── */
  var veil = document.getElementById('jumpVeil');
  function jump(top) {
    html.style.scrollSnapType = 'none';
    if (veil) veil.classList.add('on');
    setTimeout(function () {
      html.style.scrollBehavior = 'auto'; window.scrollTo(0, top); html.style.scrollBehavior = '';
      requestAnimationFrame(function () { if (veil) veil.classList.remove('on'); setTimeout(function () { html.style.scrollSnapType = ''; }, 200); });
    }, 140);
  }

  /* ════ 8. Прогресс и название раздела ════ */
  var prog = document.createElement('div'); prog.className = 'prog'; document.body.appendChild(prog);
  var toast = document.createElement('div'); toast.className = 'sec-toast'; document.body.appendChild(toast);
  var lastSec = null, toastT;
  function onScrollProgress() {
    var max = html.scrollHeight - window.innerHeight;
    prog.style.width = (max > 0 ? Math.min(100, window.pageYOffset / max * 100) : 0) + '%';
    var y = window.pageYOffset + window.innerHeight * 0.4;
    var sec = afterNav(window.pageYOffset) ? sectionAt(y) : '';
    if (sec !== lastSec) {
      var first = lastSec === null; lastSec = sec;
      if (sec && !first) {
        toast.textContent = sec; toast.classList.add('on');
        clearTimeout(toastT); toastT = setTimeout(function () { toast.classList.remove('on'); }, 1700);
      } else if (!sec) toast.classList.remove('on');
    }
  }

  /* ════ 10. Гаснущие новинки ════ */
  var seen = LS.get('seen', []);
  var drop = $$('.look-pg[id^="p_look_drop_oct"]');
  function plural(n) { var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? 'новый образ' : (m >= 2 && m <= 4 && (h < 12 || h > 14) ? 'новых образа' : 'новых образов'); }
  function firstUnseen() { for (var i = 0; i < drop.length; i++) if (seen.indexOf(drop[i].id) < 0) return drop[i]; return null; }
  function paintNew() {
    var left = drop.filter(function (p) { return seen.indexOf(p.id) < 0; }).length;
    drop.forEach(function (p) {
      if (seen.indexOf(p.id) < 0) return;
      var n = $('.look-num', p); if (n) n.textContent = n.textContent.replace(/^Новинка\s*·\s*/i, '');
      var pv = prevPg(p), c = pv && $('.pal-pg-counter', pv); if (c) c.textContent = c.textContent.replace(/\s*·\s*новинка/i, '');
    });
    var dNew = $('.dock .d-new');
    if (dNew) { dNew.lastChild.textContent = '+' + left; dNew.style.display = left ? '' : 'none'; }
    var badge = $('.upd-badge');
    if (badge) { badge.lastChild.textContent = ' +' + left + ' ' + plural(left) + '\n'; if (!left) badge.style.display = 'none'; }
    $$('.ni-new').forEach(function (c) {
      if (!/p_drop_oct\d/.test(c.getAttribute('onclick') || '')) return;
      var s = $('.ni-new-s', c), b = $('.ni-new-b', c);
      if (s) s.textContent = left ? left + ' ' + plural(left) : 'все образы просмотрены';
      if (b) b.style.display = left ? '' : 'none';
    });
    var target = firstUnseen(), tid = target ? prevPg(target).id : 'p_drop_oct6';
    [dNew, badge].forEach(function (el) { if (el) el.setAttribute('onclick', "scrollToEl('" + tid + "')"); });
  }
  var seenTimer = null, seenCand = null;
  function trackSeen() {
    var p = currentPage();
    if (!p || p === seenCand) return;
    seenCand = p; clearTimeout(seenTimer);
    if (lookInfo[p.id]) seenTimer = setTimeout(function () {
      if (currentPage() !== p) return;
      if (seen.indexOf(p.id) < 0) { seen.push(p.id); LS.set('seen', seen); if (/^p_look_drop_oct/.test(p.id)) paintNew(); }
    }, 1200);
  }

  /* ════ 1. Продолжить с места ════ */
  var saveT;
  function savePos() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      var p = currentPage(); if (!p || !afterNav(window.pageYOffset)) return;
      LS.set('pos', { id: p.id, dy: Math.round(window.pageYOffset - p.offsetTop), t: Date.now() });
    }, 700);
  }
  function offerResume() {
    if (location.hash) return;
    var pos = LS.get('pos', null); if (!pos) return;
    var p = document.getElementById(pos.id); if (!p || !p.offsetHeight) return;
    if (Date.now() - pos.t > 1000 * 60 * 60 * 24 * 60) return;
    var name = lookInfo[p.id] ? 'Образ «' + lookInfo[p.id].name + '»' : (sectionAt(p.offsetTop + 5) || ($('.look-title', p) || {}).textContent || 'Система');
    var r = document.createElement('div'); r.className = 'resume';
    r.innerHTML = '<div class="resume-t"><div class="resume-k">Вы остановились здесь</div><div class="resume-n">' + esc(name) + '</div></div>' +
      '<button class="resume-go" type="button">Продолжить</button><button class="resume-x" type="button" aria-label="Закрыть">&times;</button>';
    document.body.appendChild(r);
    var close = function () { r.classList.remove('on'); setTimeout(function () { r.remove(); }, 400); };
    $('.resume-go', r).onclick = function () { close(); jump(p.offsetTop + (pos.dy || 0)); };
    $('.resume-x', r).onclick = close;
    setTimeout(function () { r.classList.add('on'); }, 900);
    setTimeout(close, 14000);
  }

  /* ════ 3. Меню-шторка + 2. поиск + 7. «Мои образы» ════ */
  var favs = LS.get('favs', []);
  var sheet = document.createElement('div'); sheet.className = 'sheet'; sheet.id = 'sheet';
  sheet.innerHTML =
    '<div class="sheet-bg"></div><div class="sheet-panel" role="dialog" aria-label="Меню Системы">' +
    '<div class="sheet-grab"><i></i></div>' +
    '<div class="sheet-head"><label class="sheet-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>' +
    '<input type="text" inputmode="search" enterkeyhint="search" autocomplete="off" placeholder="Найти вещь, бренд или цвет"><button class="sheet-clear" type="button" aria-label="Очистить">&times;</button></label></div>' +
    '<div class="sheet-body"><div class="sheet-results"></div><div class="sheet-favs"></div><div class="sheet-nav"></div></div></div>';
  document.body.appendChild(sheet);
  var input = $('input', sheet), results = $('.sheet-results', sheet), favBox = $('.sheet-favs', sheet), navBox = $('.sheet-nav', sheet), body = $('.sheet-body', sheet);
  if (nav) {
    var clone = nav.cloneNode(true);
    var h = $('.nav-h', clone); if (h) h.remove();
    $$('[id]', clone).forEach(function (e) { e.removeAttribute('id'); });
    navBox.appendChild(clone);
  }
  function renderFavs() {
    favs = favs.filter(function (id) { return lookInfo[id]; });
    if (!favs.length) { favBox.innerHTML = '<div class="sheet-sec">Мои образы</div><div class="sheet-empty">Нажмите ♡ на образе, и он появится здесь.</div>'; return; }
    favBox.innerHTML = '<div class="sheet-sec">Мои образы · ' + favs.length + '</div><div class="favs">' + favs.map(function (id) {
      var l = lookInfo[id]; return '<div class="fv" data-go="' + id + '"><img loading="lazy" src="' + esc(l.img) + '" alt=""><span>' + esc(l.name) + '</span></div>';
    }).join('') + '</div>';
  }
  function stem(w) { return w.length > 5 ? w.slice(0, -2) : (w.length > 3 ? w.slice(0, -1) : w); }
  function mark(text, stems) {
    var out = esc(text);
    stems.forEach(function (s) {
      if (s.length < 2) return;
      var re = new RegExp('(' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[а-яёa-z]*)', 'ig');
      out = out.replace(re, '<b>$1</b>');
    });
    return out;
  }
  function search(q) {
    var words = norm(q).split(' ').filter(Boolean);
    if (!words.length) { results.innerHTML = ''; favBox.style.display = ''; navBox.style.display = ''; return; }
    favBox.style.display = 'none'; navBox.style.display = 'none';
    var stems = words.map(stem);
    var hit = function (txt) { txt = norm(txt); return stems.every(function (s) { return txt.indexOf(s) >= 0; }); };
    var secs = anchors.filter(function (a, i, arr) { return hit(a.text) && arr.findIndex(function (b) { return b.text === a.text; }) === i; }).slice(0, 4);
    var found = [];
    looks.forEach(function (pg) {
      var l = lookInfo[pg.id], all = l.name + ' ' + l.items.join(' ');
      if (!hit(all)) return;
      var items = l.items.filter(function (it) { var t = norm(it); return stems.some(function (s) { return t.indexOf(s) >= 0; }); });
      found.push({ l: l, items: items, score: (hit(l.name) ? 2 : 0) + items.length });
    });
    found.sort(function (a, b) { return b.score - a.score; });
    var html1 = '';
    if (secs.length) html1 += '<div class="sheet-sec">Разделы</div>' + secs.map(function (a) {
      return '<div class="sr" data-go="' + a.el.id + '"><div class="sr-ic">&#10022;</div><div><div class="sr-t">' + mark(a.text, stems) + '</div></div></div>';
    }).join('');
    html1 += '<div class="sheet-sec">Образы · ' + found.length + '</div>';
    if (!found.length) html1 += '<div class="sheet-empty">Ничего не нашлось. Попробуйте другое слово: «пальто», «Zara», «замша».</div>';
    html1 += found.slice(0, 40).map(function (f) {
      var sub = (f.items.length ? f.items : f.l.items).slice(0, 3).map(function (t) { return mark(t, stems); }).join('<br>');
      return '<div class="sr" data-go="' + f.l.id + '"><img loading="lazy" src="' + esc(f.l.img) + '" alt=""><div><div class="sr-t">Образ «' + mark(f.l.name, stems) + '»</div><div class="sr-s">' + sub + '</div></div></div>';
    }).join('');
    results.innerHTML = html1;
  }
  var qT;
  input.addEventListener('input', function () {
    $('.sheet-search', sheet).classList.toggle('has', !!input.value);
    clearTimeout(qT); qT = setTimeout(function () { search(input.value); }, 120);
  });
  $('.sheet-clear', sheet).addEventListener('click', function (e) { e.preventDefault(); input.value = ''; search(''); $('.sheet-search', sheet).classList.remove('has'); input.focus(); });
  sheet.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g) { closeSheet(); window.scrollToEl(g.getAttribute('data-go')); }
  });
  function openSheet() {
    renderFavs();
    sheet.classList.add('on'); html.style.overflow = 'hidden';
    body.scrollTop = 0;
  }
  function closeSheet() {
    if (!sheet.classList.contains('on')) return;
    sheet.classList.remove('on'); html.style.overflow = ''; input.blur();
  }
  $('.sheet-bg', sheet).addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  (function () { // свайп вниз по ручке закрывает
    var grab = $('.sheet-grab', sheet), panel = $('.sheet-panel', sheet), y0 = null;
    grab.addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; panel.style.transition = 'none'; }, { passive: true });
    grab.addEventListener('touchmove', function (e) { if (y0 == null) return; var d = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = 'translateY(' + d + 'px)'; }, { passive: true });
    grab.addEventListener('touchend', function (e) {
      var d = e.changedTouches[0].clientY - y0; y0 = null; panel.style.transition = ''; panel.style.transform = '';
      if (d > 80) closeSheet();
    });
    grab.addEventListener('click', closeSheet);
  })();
  // любая навигация закрывает шторку
  var origScroll = window.scrollToEl;
  window.scrollToEl = function (id) { closeSheet(); return origScroll(id); };
  var menuBtn = $('.dock .d-menu');
  if (menuBtn) { menuBtn.removeAttribute('onclick'); menuBtn.addEventListener('click', openSheet); }
  window.openSystemMenu = openSheet;

  // сердечко на каждом образе
  var favToast = document.createElement('div'); favToast.className = 'fav-toast'; document.body.appendChild(favToast);
  var heart = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
  looks.forEach(function (pg) {
    var wrap = $('.look-collage-wrap', pg); if (!wrap) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'fav-btn' + (favs.indexOf(pg.id) >= 0 ? ' on' : '');
    b.setAttribute('aria-label', 'В мои образы'); b.innerHTML = heart;
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var i = favs.indexOf(pg.id);
      if (i >= 0) favs.splice(i, 1); else favs.unshift(pg.id);
      LS.set('favs', favs);
      b.classList.toggle('on', i < 0); b.classList.add('pop'); setTimeout(function () { b.classList.remove('pop'); }, 220);
      favToast.textContent = i < 0 ? 'Сохранено в «Мои образы» · в Меню' : 'Убрано из «Моих образов»';
      favToast.classList.add('on'); clearTimeout(favToast._t); favToast._t = setTimeout(function () { favToast.classList.remove('on'); }, 1800);
    });
    wrap.appendChild(b);
  });

  /* ════ 6. Карточка вещи по нажатию на точку ════ */
  var card = null;
  function closeCard() {
    if (!card) return;
    card.el.classList.remove('on'); card.dot.classList.remove('act');
    $$('.look-link-chip.hl').forEach(function (c) { c.classList.remove('hl'); });
    var el = card.el; setTimeout(function () { el.remove(); }, 200); card = null;
  }
  document.addEventListener('click', function (e) {
    var dot = e.target.closest && e.target.closest('.look-hotspot');
    if (!dot) { if (card && !e.target.closest('.hs-card')) closeCard(); return; }
    e.preventDefault(); e.stopPropagation();
    if (card && card.dot === dot) { closeCard(); return; }
    closeCard();
    var pg = dot.closest('.look-pg'), box = dot.closest('.in') || pg;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var t = dot.getAttribute('title') || 'Открыть вещь', parts = t.split(/\s+[—–-]\s+/);
    var el = document.createElement('div'); el.className = 'hs-card';
    el.innerHTML = '<div class="hs-name">' + esc(parts[0]) + '</div>' + (parts[1] ? '<div class="hs-brand">' + esc(parts.slice(1).join(' · ')) + '</div>' : '') +
      '<a class="hs-open" href="' + esc(dot.getAttribute('href')) + '" target="_blank" rel="noopener">Открыть в магазине &#8599;</a>';
    box.appendChild(el);
    var br = box.getBoundingClientRect(), dr = dot.getBoundingClientRect();
    var cw = el.offsetWidth, ch = el.offsetHeight;
    var x = dr.left - br.left + dr.width / 2 - cw / 2;
    x = Math.max(10, Math.min(br.width - cw - 10, x));
    var y = dr.top - br.top - ch - 12;
    if (y < 8) y = dr.bottom - br.top + 12;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    requestAnimationFrame(function () { el.classList.add('on'); });
    dot.classList.add('act');
    $$('.look-link-chip', pg).forEach(function (c) { if (c.getAttribute('href') === dot.getAttribute('href')) c.classList.add('hl'); });
    card = { el: el, dot: dot };
  }, true);

  /* ════ 9. Палитры одного цвета листаются свайпом вбок ════ */
  var tones = anchors.filter(function (a) { return a.lvl === 1 && /^p_pal_/.test(a.el.id); })
    .sort(function (a, b) { return a.el.offsetTop - b.el.offsetTop; });
  function toneGroup(pg) {
    var top = pg.offsetTop, start = null;
    for (var i = 0; i < tones.length; i++) if (tones[i].el.offsetTop <= top) start = tones[i];
    if (!start) return null;
    // граница цвета: следующий любой пункт навигации ниже начала этого цвета
    var end = Infinity;
    anchors.forEach(function (a) { var t = a.el.offsetTop; if (a.el.offsetHeight && t > start.el.offsetTop && t < end) end = t; });
    if (top >= end) return null;
    var list = $$('.app > .pal-pg').filter(function (p) { return p.offsetHeight && p.offsetTop >= start.el.offsetTop && p.offsetTop < end; });
    return { name: start.text, list: list };
  }
  var hintShown = LS.get('swipeHint', 0);
  $$('.app > .pal-pg').forEach(function (pg) {
    var x0 = null, y0 = null;
    pg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    pg.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      var g = toneGroup(pg); if (!g || g.list.length < 2) return;
      var i = g.list.indexOf(pg), j = dx < 0 ? i + 1 : i - 1;
      if (j < 0 || j >= g.list.length) return;
      jump(g.list[j].offsetTop);
    });
  });
  function paintToneCounters() {
    tones.forEach(function (t, k) {
      var g = toneGroup(t.el); if (!g || g.list.length < 2) return;
      g.list.forEach(function (p, i) {
        var c = $('.pal-pg-counter', p); if (!c || c.dataset.n) return;
        c.dataset.n = 1; c.textContent = c.textContent + ' · ' + (i + 1) + '/' + g.list.length;
        if (!hintShown && i === 0) {
          var h = document.createElement('div'); h.className = 'swipe-hint'; h.textContent = '← свайп: палитры цвета →';
          $('.in', p).appendChild(h);
        }
      });
    });
  }

  /* ── запуск ── */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; onScrollProgress(); trackSeen(); savePos(); if (card) closeCard(); });
  }, { passive: true });
  function boot() {
    paintNew(); paintToneCounters(); onScrollProgress(); offerResume();
    if (!hintShown) setTimeout(function () { LS.set('swipeHint', 1); }, 20000);
  }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot);

  /* ════ 5. Работа без интернета ════ */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/guide-sw.js', { scope: '/guide' }).then(function () {
        // через полминуты спокойно докачиваем все палитры и образы, чтобы Система открывалась без сети
        var c = navigator.connection; if (c && (c.saveData || /2g/.test(c.effectiveType || ''))) return;
        setTimeout(function () {
          navigator.serviceWorker.ready.then(function (reg) {
            var urls = $$('.app img').map(function (i) { return i.currentSrc || i.src; }).filter(function (u) { return /\/guide\/(palitry|looks)\//.test(u); });
            if (reg.active) reg.active.postMessage({ type: 'precache', urls: urls });
          });
        }, 30000);
      }).catch(function () {});
    });
  }
})();
