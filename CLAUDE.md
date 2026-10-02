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

## Ideas in progress
- A Sanzo Wada colour dictionary tool: the user picks the colour of their item, sees the nearest Wada colour, then his combinations as book spreads with the 70/20/10 rule. The data comes from sanzo-wada.dmbk.io (159 colours, 348 combinations).
- The club page «В моём стиле» (based on /uverennost) needs residents' reviews, which are still pending.

## Related
- The bot lives in a separate private repo, `mila-bot` (Railway; a push restarts the bot, so **never push it during a mailing**).
