// Контраст внешности по фото, полностью в браузере (фото никуда не отправляется).
// MediaPipe Face Landmarker (Apache-2.0) находит точки лица, дальше по методике Милы
// сравниваем светлоту кожи с линией роста волос, бровями и глазами на ч/б версии фото.
import { FilesetResolver, FaceLandmarker } from './mp/vision_bundle.mjs';

const BASE = new URL('./mp/', import.meta.url).href;
let landmarkerPromise = null;

function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(BASE + 'wasm').then(fs =>
      FaceLandmarker.createFromOptions(fs, {
        baseOptions: { modelAssetPath: BASE + 'face_landmarker.task' },
        runningMode: 'IMAGE',
        numFaces: 2,
      }));
  }
  return landmarkerPromise;
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
  const lm = await getLandmarker();
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

  const r = Math.max(2, faceH * 0.018);
  const skin = median(SKIN.map(i => patch(L, w, h, pts[i].x, pts[i].y, r * 1.6)));
  const brow = median(BROWS.map(i => patch(L, w, h, pts[i].x, pts[i].y, r * 1.2, 0.2)));
  const eye = median(IRIS.map(i => patch(L, w, h, pts[i].x, pts[i].y, r * 0.6)));

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
  const hair = median(hairSamples);

  if (skin < 22) return { status: 'retake', reason: 'dark' };
  if (skin > 93) return { status: 'retake', reason: 'bright' };

  // Главный признак по Миле: кожа ↔ линия роста волос, затем брови. Глаза в счёт не идут:
  // зрачок тёмный у всех и только шумит. Разница считается относительно светлоты кожи,
  // как её видит глаз: на светлой коже та же разница читается мягче, чем на средней.
  const dHair = Math.abs(skin - hair), dBrow = Math.abs(skin - brow), dEye = Math.abs(skin - eye);
  const score = Math.round(100 * (0.6 * dHair + 0.4 * dBrow) / skin);
  const level = score < LOW_MAX ? 'low' : score < MID_MAX ? 'mid' : 'high';

  return {
    status: 'ok', level, score,
    values: { skin: Math.round(skin), hair: Math.round(hair), brow: Math.round(brow), eye: Math.round(eye) },
    diffs: { hair: Math.round(dHair), brow: Math.round(dBrow), eye: Math.round(dEye) },
    marks: {
      skin: SKIN.map(i => pts[i]), brow: BROWS.map(i => pts[i]), eye: IRIS.map(i => pts[i]), hair: hairPoints,
      size: { w, h },
    },
  };
}

// Пороги шкалы 0–100. Откалиброваны на трёх эталонных фото (низкий 27, средний 34, высокий 67);
// уточнять на реальных фото с вердиктом Милы.
export const LOW_MAX = 31;
export const MID_MAX = 50;
