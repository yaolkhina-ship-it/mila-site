(() => {
  const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400&family=Montserrat:wght@300;400;500&display=swap';
  // Верхнее меню без Клуба/Проектов/Лекций. Гамбургер: полный список.
  const TOP_LINKS = [
    {href: '/about', label: 'Обо мне'},
    {href: '/color-guide', label: 'Система цвета'},
    {href: '/image', label: 'Система имиджа'},
    {href: '/contacts', label: 'Контакты'}
  ];
  const PANEL_LINKS = [
    {href: '/about', label: 'Обо мне'},
    {href: '/projects', label: 'Проекты'},
    {href: '/lekcii', label: 'Лекции'},
    {href: '/color-guide', label: 'Система цвета'},
    {href: '/image', label: 'Система имиджа'},
    {href: 'https://t.me/MilaUshakova_ClubBot?start=club', label: 'Клуб', blank: true},
    {href: '/contacts', label: 'Контакты'}
  ];

  const ensureFonts = () => {
    if ([...document.styleSheets].some((s) => (s.href || '').includes('Bodoni+Moda'))) return;
    if (!document.querySelector('link[href*="fonts.googleapis.com"][href*="Bodoni"]')) {
      const pre1 = document.createElement('link');
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = '';
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.append(pre1, pre2, link);
    }
  };

  const hideLegacyNav = () => {
    const keep = (el) => el.classList.contains('mu-hd') || el.classList.contains('mu-panel') || el.id === 'hd' || el.id === 'mu-hd' || el.id === 'mu-panel';
    document.querySelectorAll(
      'body > nav, body > header.topbar, body > header.mast, body > .topbar, .app > .top, .top .tmenu, .top .ed, .top .logo'
    ).forEach((el) => {
      if (keep(el)) return;
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
    // страница оплаты имиджа: старая липкая шапка целиком
    document.querySelectorAll('.app > .top').forEach((el) => {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
    // color-guide page2: убрать «Назад» и бренд-дубль, оставить только якорный ряд
    document.querySelectorAll('#page2 .btn-back, #page2 .logo-mark').forEach((el) => {
      const wrap = el.closest('div');
      if (el.classList.contains('btn-back') && wrap && wrap.parentElement && wrap.parentElement.classList.contains('p2sans')) {
        wrap.style.display = 'none';
        wrap.setAttribute('aria-hidden', 'true');
      }
      if (el.classList.contains('logo-mark')) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });
  };

  const aAttrs = (item) => {
    const blank = item.blank ? ' target="_blank" rel="noopener"' : '';
    return `href="${item.href}"${blank}`;
  };

  const mount = () => {
    if (document.getElementById('mu-hd')) return;
    ensureFonts();
    hideLegacyNav();
    document.body.classList.add('has-mu-chrome');

    const header = document.createElement('header');
    header.className = 'mu-hd';
    header.id = 'mu-hd';
    header.innerHTML = `
      <div class="mu-g"><div class="mu-in mu-row">
        <a class="mu-monogram" href="/" aria-label="Мила Ушакова">MU</a>
        <nav class="mu-nav" aria-label="Основное меню">
          ${TOP_LINKS.map((l) => `<a ${aAttrs(l)}>${l.label}</a>`).join('')}
        </nav>
        <button class="mu-menu-btn" type="button" aria-label="Меню" aria-expanded="false" aria-controls="mu-panel"><span></span></button>
      </div></div>`;

    const panel = document.createElement('nav');
    panel.className = 'mu-panel';
    panel.id = 'mu-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <button class="mu-close" type="button" aria-label="Закрыть">Закрыть</button>
      <div class="mu-links">
        ${PANEL_LINKS.map((l) => `<a ${aAttrs(l)}>${l.label}</a>`).join('')}
      </div>`;

    document.body.prepend(panel);
    document.body.prepend(header);
    if (!document.querySelector('a.social-br')) {
      const care = document.createElement('a');
      care.className = 'social-br';
      care.href = 'https://t.me/MilaUshakova_ClubBot?start=support';
      care.target = '_blank';
      care.rel = 'noopener';
      care.textContent = 'Служба заботы';
      document.body.appendChild(care);
    }
    // на светлых страницах — solid шапка; color-guide #system и белые страницы не dark
    const colorSales = !!document.querySelector('#page2.page.active') || document.body.classList.contains('mu-on-page2');
    const dark = !colorSales && (
      document.body.classList.contains('mu-dark') ||
      !!document.querySelector('.hero:not(.hero-sec), #page1.page.active')
    );
    if (document.body.getAttribute('data-mu-solid') === '1' || colorSales || !dark) header.classList.add('is-solid');
    else document.body.classList.add('mu-dark');
    if (header.classList.contains('is-solid')) document.body.classList.remove('mu-dark');
    if (colorSales) document.body.classList.add('mu-on-page2');

    const btn = header.querySelector('.mu-menu-btn');
    const closeBtn = panel.querySelector('.mu-close');
    const setOpen = (open) => {
      btn.classList.toggle('is-open', open);
      panel.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    };
    btn.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    closeBtn.addEventListener('click', () => setOpen(false));
    panel.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
