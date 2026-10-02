// Контраст внешности по фото, полностью в браузере (фото никуда не отправляется).
// MediaPipe Face Landmarker (Apache-2.0) находит точки лица, дальше по методике Милы
// сравниваем светлоту кожи с линией роста волос, бровями и глазами на ч/б версии фото.
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from './mp/vision_bundle.mjs';

const BASE = new URL('./mp/', import.meta.url).href;
let modelsPromise = null;

// Две бесплатные модели MediaPipe: точки лица и маска волос
function getModels() {
  if (!modelsPromise) {
    modelsPromise = FilesetResolver.forVisionTasks(BASE + 'wasm').then(fs => Promise.all([
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: BASE + 'face_landmarker.task' },
        runningMode: 'IMAGE',
        numFaces: 2,
      }),
      ImageSegmenter.createFromOptions(fs, {
        baseOptions: { modelAssetPath: BASE + 'hair_segmenter.tflite' },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      }),
    ]));
  }
  return modelsPromise;
}

// Светлота волос по маске: пиксели волос над лицом и по бокам до уровня бровей
function hairFromMask(seg, canvas, L, w, h, pts, faceH) {
  let mask = null;
  seg.segment(canvas, res => {
    const m = res.confidenceMasks && res.confidenceMasks[res.confidenceMasks.length - 1];
    if (m) mask = { data: m.getAsFloat32Array().slice(), w: m.width, h: m.height };
    (res.confidenceMasks || []).forEach(x => x.close());
  });
  if (!mask) return null;
  const left = Math.min(pts[234].x, pts[127].x) - faceH * 0.15, right = Math.max(pts[454].x, pts[356].x) + faceH * 0.15;
  const top = pts[10].y - faceH * 0.45, bottom = (pts[105].y + pts[334].y) / 2;
  const vals = [], pix = [];
  const step = Math.max(1, Math.round(faceH / 160));
  for (let y = Math.max(0, Math.round(top)); y < Math.min(h, bottom); y += step)
    for (let x = Math.max(0, Math.round(left)); x < Math.min(w, right); x += step) {
      const mx = Math.min(mask.w - 1, Math.round(x * mask.w / w)), my = Math.min(mask.h - 1, Math.round(y * mask.h / h));
      if (mask.data[my * mask.w + mx] > 0.75) { vals.push(L[y * w + x]); if (pix.length < 400 && Math.random() < 0.08) pix.push({ x, y }); }
    }
  if (vals.length < 50) return null;
  return { value: median(vals), dark: percentile(vals, 0.25), points: pix };
}

// Точки сетки лица MediaPipe
const SKIN = [151, 9, 108, 337, 50, 280, 205, 425];
const BROWS = [70, 63, 105, 66, 107, 300, 293, 334, 296, 336, 46, 53, 52, 65, 276, 283, 282, 295];
const IRIS = [468, 473];
const HAIRLINE = [10, 109, 338, 67, 297]; // верх лба: от них шагаем вверх, к линии роста волос

// sRGB → светлота L* (0 чёрный … 100 белый): так «ч/б» совпадает с тем, как видит глаз
function lightness(r, g, b) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

function median(a) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(a, q) {
  if (!a.length) return NaN;
  const s = a.slice().sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

// L* в круге радиуса r вокруг (x, y): медиана, а для волосков бровей и волос q < 0.5 (тёмные пиксели)
function patch(L, w, h, x, y, r, q = 0.5) {
  const out = [];
  const x0 = Math.max(0, Math.round(x - r)), x1 = Math.min(w - 1, Math.round(x + r));
  const y0 = Math.max(0, Math.round(y - r)), y1 = Math.min(h - 1, Math.round(y + r));
  for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++)
    if ((i - x) * (i - x) + (j - y) * (j - y) <= r * r) out.push(L[j * w + i]);
  return percentile(out, q);
}

export async function analyze(img) {
  const [lm, seg] = await getModels();
  const max = 1024, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);

  const res = lm.detect(canvas);
  const faces = res.faceLandmarks || [];
  if (faces.length === 0) return { status: 'retake', reason: 'noface' };
  if (faces.length > 1) return { status: 'retake', reason: 'many' };
  const pts = faces[0].map(p => ({ x: p.x * w, y: p.y * h }));

  const chin = pts[152], top = pts[10];
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  if (faceH < h * 0.18) return { status: 'retake', reason: 'small' };

  const data = ctx.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = lightness(data[p], data[p + 1], data[p + 2]);
  const rgbAt = (x, y) => { const p = (y * w + x) * 4; return [data[p], data[p + 1], data[p + 2]]; };

  const r = Math.max(2, faceH * 0.018);
  const skin = median(SKIN.map(i => patch(L, w, h, pts[i].x, pts[i].y, r * 1.6)));
  const brow = median(BROWS.map(i => patch(L, w, h, pts[i].x, pts[i].y, r * 1.2, 0.2)));
  // Радужка: кольцо между зрачком и краем радужки (зрачок тёмный у всех и не говорит о цвете глаз)
  const irisRing = (c, e) => {
    const R = Math.hypot(pts[e].x - pts[c].x, pts[e].y - pts[c].y), out = [], warm = [];
    for (let a = 0; a < 6.28; a += 0.2) for (const k of [0.55, 0.7, 0.85]) {
      const x = Math.round(pts[c].x + Math.cos(a) * R * k), y = Math.round(pts[c].y + Math.sin(a) * R * k);
      if (x >= 0 && y >= 0 && x < w && y < h) { out.push(L[y * w + x]); const [r, g, b] = rgbAt(x, y); warm.push((r - b) / 255 * 100); }
    }
    irisWarm.push(median(warm));
    return median(out);
  };
  const irisWarm = [];
  const eye = median([irisRing(468, 469), irisRing(473, 474)]);
  const eyeWarm = median(irisWarm); // > 0 карие/тёплые, < 0 голубые/серые

  // Линия роста волос: идём от верхних точек лба вверх (вдоль оси подбородок → лоб)
  // и берём первую зону, где светлота заметно уходит от кожи. Если не уходит, волосы светлые.
  const ux = (top.x - chin.x) / faceH, uy = (top.y - chin.y) / faceH;
  const hairSamples = [], hairPoints = [];
  for (const i of HAIRLINE) {
    let best = null;
    for (let t = 0.03; t <= 0.16; t += 0.01) {
      const x = pts[i].x + ux * faceH * t, y = pts[i].y + uy * faceH * t;
      if (x < 0 || y < 0 || x >= w || y >= h) break;
      const v = patch(L, w, h, x, y, r * 1.3, 0.3);
      if (best === null || Math.abs(v - skin) > Math.abs(best.v - skin)) best = { v, x, y };
    }
    if (best) { hairSamples.push(best.v); hairPoints.push(best); }
  }
  if (hairSamples.length < 2) return { status: 'retake', reason: 'hair' };
  const hairline = median(hairSamples);
  const hm = hairFromMask(seg, canvas, L, w, h, pts, faceH);
  const hair = hm ? hm.value : hairline;

  if (skin < 22) return { status: 'retake', reason: 'dark' };
  if (skin > 93) return { status: 'retake', reason: 'bright' };

  // По Миле: разница светлоты кожи с волосами, бровями и глазами (радужка без зрачка: «глубокий цвет глаз»).
  // Разница считается относительно светлоты кожи, как её видит глаз. Веса подобраны на фото с вердиктами Милы.
  const dHair = Math.abs(skin - hair), dBrow = Math.abs(skin - brow), dEye = Math.abs(skin - eye);
  const score = Math.round(100 * (0.25 * dHair + 0.25 * dBrow + 0.5 * dEye) / skin);
  const level = score < LOW_MAX ? 'low' : score < MID_MAX ? 'mid' : 'high';

  return {
    status: 'ok', level, score,
    values: { skin: Math.round(skin), hair: Math.round(hair), hairDark: hm ? Math.round(hm.dark) : null, hairline: Math.round(hairline), brow: Math.round(brow), eye: Math.round(eye), eyeWarm: Math.round(eyeWarm) },
    diffs: { hair: Math.round(dHair), brow: Math.round(dBrow), eye: Math.round(dEye) },
    marks: {
      skin: SKIN.map(i => pts[i]), brow: BROWS.map(i => pts[i]), eye: IRIS.map(i => pts[i]), hair: hm ? hm.points : hairPoints,
      size: { w, h },
    },
  };
}

// Пороги шкалы. Калибровка 02.10.2026 на 18 фото с вердиктами Милы
// (~/Desktop/Мила/Система/калибровка): низкий 33–44, средний 50–70, высокий 71–82, все 18 верно.
// Граница средний/высокий узкая (70.2 против 71.1): уточнять на новых фото.
export const LOW_MAX = 47;
export const MID_MAX = 71;
