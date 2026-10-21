# mila-site: milaushakova.com

The website of stylist Mila Ushakova (the «В моём стиле» club). Vercel auto-deploys every push to `main`.
Yana (yaolkhina-ship-it) runs the tech side. She writes in Russian and wants short, plain status updates.

## Working rules
- **Deploy only when Yana says «деплой» or gives an explicit OK.** Until then, make the change and show it.
- Write all copy in Mila's voice: no dashes (use a colon, comma or full stop), calm editorial register, no «успейте»/«только сегодня».
- This repo is **public**: never commit secrets, keys or customers' personal data.
- Every page carries a docs strip at the bottom (offer /oferta, privacy /privacy, support t.me/MilaUshakova_ClubBot?start=support, «ИП Ольхина Я.Ф.»).
- `vercel.json`: a new top-level folder of static files needs its own `builds` entry, or production returns 404.

## Система цветовых сочетаний (`/guide` → `guide/gaidosen.html`)
A paid product: a mobile page of full-screen snap slides (`.pg`). `scrollToEl(id)` moves to a slide.
- Page order: cover, about, welcome, «Как пользоваться» (p3), **Навигация (p4)**, «Правило пропорций», **«Контраст внешности» (p_contrast)**, the hidden level pages, Бонус, and so on.
- The nav opens with a swipeable row of NEW cards (`.ni-row`/`.ni-new`). The pulsing top badge «Новый инструмент» → `p_contrast`.
- Palette slides are `.pal-pg` (`palitry/NN.jpg`), each followed by a look slide `.look-pg` (`looks/*.jpg`, hotspots plus link chips).

### «Контраст внешности» tool (runs on the phone, free, the photo never leaves the device)
- `guide/contrast/contrast.mjs`: MediaPipe (self-hosted in `guide/contrast/mp/`: face_landmarker.task, hair_segmenter.tflite, wasm). It measures L* of the skin, the hair (segmentation mask), the brows (20th percentile) and the iris ring.
  `score = 100*(0.25*dHair + 0.25*dBrow + 0.5*dEye)/skin`; `LOW_MAX = 47`, `MID_MAX = 71`.
  Calibrated on 18 photos with Mila's verdicts, 18/18 correct. The weak spot is the mid/high border.
- `guide/contrast/palettes.mjs`: tags the System's palettes by contrast (`level`), with swatches and look images. Mila is to review the tagging.
- Result: a meter, Mila's text, then «book spread» cards (swatches | look). Only the user's own level page `p_contrast_<low|mid|high>` unlocks after the analysis, and it is NOT remembered (it hides again on reload).
- The b/w preview is drawn manually because canvas `ctx.filter` does not work in Safari.
- To re-calibrate, run the photos through `analyze()` in headless Chrome (CDP) with a local static server that serves `.mjs`/`.wasm` with the right MIME types.

### Mobile UX layer (10.2026)
- `guide/gaidosen.html` has `<base href="/guide/">`: the page is also served at `/guide` without a slash, and relative images broke there.
- Inline block at the end of the page: soft snap (`proximity`, tall pages `.pg-tall` scroll freely), the bottom dock (`#dock`: Назад / Меню / ✦+N / support), an instant jump with a veil for far targets, and a «Назад» stack. `window.scrollToEl` is overridden there.
- `guide/ux.js` + `guide/ux.css` (bump `?v=` when changing them): the menu bottom sheet (a clone of the p4 nav) with search over every look's item chips, «Мои образы» (hearts, localStorage `sys_favs`), the item card on hotspot tap, the progress bar and section toast, «продолжить с места» (`sys_pos`), new looks that fade once seen (`sys_seen`, drop = `p_look_drop_oct*`; the dock/badge/nav card counts update), and a sideways swipe between palettes of one colour.
- Offline: `/guide-sw.js` (root, scope `/guide`; its own `builds` entry in vercel.json). The page is network-first, images cache-first; it precaches palitry/looks 30s after load.
- Link check: `node scripts/check-links.mjs` (dead = 404/410; Farfetch, Frankie, Vestiaire, Sézane, H&M and Mango block robots). A weekly GitHub Action `.github/workflows/check-links.yml` sends to Telegram when the repo secrets `TG_TOKEN`/`TG_CHAT` are set.
- Deploy: Yana wants System changes pushed right away after a mobile-emulation test (no «деплой» round-trip for the guide).

### App mode (20.10.2026): the System opens as an app, not a feed
- `guide/app.js` + `guide/app.css` (bump `?v=`), loaded after ux.js. They hide the slide feed and build screens from the same DOM:
  home, colours (groups from the p4 tone-index start ids), trends (`.tr-pg`), drops (`p_look_drop_oct*` = October, other `p_look_drop_*` = September), search, «Мои» (`sys_favs`), «Ещё».
- Hash routes: `#/`, `#/colors`, `#/color/N`, `#/trends`, `#/trend/<slug>`, `#/drop/oct|sep`, `#/search`, `#/mine`, `#/more`, `#/page/<pg id>` (the original page is moved into the screen and back). `/look/<look id>` on any route opens the look card.
- Look card «Две стороны»: Палитра (photo only; the computed colour breakdown was removed 21.10 as misleading) / Образ (cloned collage inside a `.in` box so ux.js item cards work, chips row), round ‹ › and colour/trend tags, sideways swipe.
- `<base href="/guide/">`: every in-app href is prefixed with `location.pathname`, or `#/x` would leave the page. Old links like `/guide#p_look_4` are translated on load. `window.scrollToEl` is overridden to route.
- First visit shows «О Системе» (p2) once (`sys_app_intro`).
- «Палитры» tab: full-screen palette feed `#/pal/<all|new|N>`; «Образ ›» opens the card on the look side.
- Home hero «Палитра дня из искусства» and `#/art` were removed 21.10 at Yana's request (paintings still sit in `guide/art/`, unused).
- CTA block on home and «Ещё»: «Стать резидентом» → bot `?start=club`; «Сотрудничество» → t.me/YanaOlkhina (`CONTACT` in app.js).
- Design rules from Yana (20.10): keep the System colours and PT Serif, change navigation only; accent badges gold, never pink; «новинка» only next to a section heading, not on every card; palette first, then the look. When a layout misses, show 2–3 switchable variants and let her pick.
- Edit a trend: change the `.tr-look` cells of its `p_trend_<slug>` page in gaidosen.html (and the nav list in p4); app.js reads them. Cover photo = `data-cover` on the page (`guide/trends/<slug>.jpg`), shown on the home row, as a photo card («плашка») in the trends list and on top of the trend screen. A trend with no looks shows only cover + title.
- Trends (5): Атласная сумка, Юбки в стиле Prada, Короткий жакет, Необычные подвески, Головные уборы (added 21.10; 6 looks with a clear hat: хурма, жёлтый, сафари, кофе, авто, овчина); pages `p_trend_<slug>`, nav section 04.

## Ideas in progress
- A Sanzo Wada colour dictionary tool: the user picks the colour of their item, sees the nearest Wada colour, then his combinations as book spreads with the 70/20/10 rule. The data comes from sanzo-wada.dmbk.io (159 colours, 348 combinations).
- The club page «В моём стиле» (based on /uverennost) needs residents' reviews, which are still pending.

## Related
- The bot lives in a separate private repo, `mila-bot` (Railway; a push restarts the bot, so **never push it during a mailing**).
