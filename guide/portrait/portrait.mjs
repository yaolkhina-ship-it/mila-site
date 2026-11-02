// Портретная зона по фото, полностью в браузере (фото никуда не отправляется).
// MediaPipe Face Landmarker (та же модель, что в «Контрасте внешности») находит точки лица,
// дальше считаем масштаб черт, геометрию линий и пропорцию лица.
import { FilesetResolver, FaceLandmarker } from '../contrast/mp/vision_bundle.mjs';

const BASE = new URL('../contrast/mp/', import.meta.url).href;
let modelPromise = null;

function getModel() {
  if (!modelPromise) {
    modelPromise = FilesetResolver.forVisionTasks(BASE + 'wasm').then(fs => FaceLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: BASE + 'face_landmarker.task' },
      runningMode: 'IMAGE',
      numFaces: 2,
    }));
  }
  return modelPromise;
}

const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Угол в вершине b между лучами b→a и b→c, в градусах
function angle(a, b, c) {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
  return Math.acos((v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y))) * 180 / Math.PI;
}

// Сырые замеры по точкам сетки лица MediaPipe (все величины относительные, от размера фото не зависят)
export function measure(pts) {
  const fw = d(pts[234], pts[454]);                // ширина лица по скулам
  const fh = d(pts[10], pts[152]);                 // высота: верх лба → подбородок
  const eye = (d(pts[33], pts[133]) + d(pts[362], pts[263])) / 2;
  const brow = (d(pts[70], pts[107]) + d(pts[300], pts[336])) / 2;
  const scale = {                                  // черты относительно лица
    eye: eye / fw,
    mouth: d(pts[61], pts[291]) / fw,
    lips: d(pts[0], pts[17]) / fh,
    nose: d(pts[98], pts[327]) / fw,
    brow: brow / fw,
  };
  const jaw = d(pts[172], pts[397]) / fw;          // ширина челюсти к скулам: больше = квадратнее
  const chin = d(pts[176], pts[400]) / fw;         // ширина подбородка
  const gonial = (angle(pts[234], pts[172], pts[152]) + angle(pts[454], pts[397], pts[152])) / 2; // меньше = резче угол челюсти
  const chinTip = angle(pts[172], pts[152], pts[397]); // острота подбородка: меньше = острее
  const yaw = Math.abs(pts[1].x - (pts[234].x + pts[454].x) / 2) / fw; // поворот головы
  return { fw, fh, ratio: fh / fw, scale, jaw, chin, gonial, chinTip, yaw };
}

// Пороги: черновая калибровка 02.11.2026 на 15 портретах из ~/Desktop/Мила/Система/калибровка,
// по третям выборки (масштаб 0.89–1.03, геометрия −0.08…+0.06, пропорция 1.16–1.24). Уточнять на фото с вердиктами Милы.
export const CAL = {
  scale: { lo: 0.92, hi: 0.96 },  // индекс масштаба черт: < lo мелкие, > hi крупные
  angular: 0,                     // индекс геометрии: > angular угловатая, иначе мягкая
  ratio: { lo: 1.17, hi: 1.20 },  // высота/ширина: < lo широкое, > hi вытянутое
};

// Индексы: масштаб = средняя доля черт, геометрия = квадратность челюсти и подбородка минус плавность угла
export function indices(m) {
  const s = m.scale;
  const scaleIdx = (s.eye / 0.205 + s.mouth / 0.40 + s.lips / 0.115 + s.nose / 0.265) / 4;
  const angIdx = m.jaw / 0.80 + m.chin / 0.30 - m.gonial / 120 - m.chinTip / 130;
  return { scaleIdx, angIdx };
}

export async function analyze(img) {
  const lm = await getModel();
  const max = 1024, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const faces = lm.detect(canvas).faceLandmarks || [];
  if (faces.length === 0) return { status: 'retake', reason: 'noface' };
  if (faces.length > 1) return { status: 'retake', reason: 'many' };
  const pts = faces[0].map(p => ({ x: p.x * w, y: p.y * h }));
  const m = measure(pts);
  if (m.fh < h * 0.18) return { status: 'retake', reason: 'small' };
  if (m.yaw > 0.09) return { status: 'retake', reason: 'turned' };
  const { scaleIdx, angIdx } = indices(m);
  const scale = scaleIdx < CAL.scale.lo ? 's' : scaleIdx > CAL.scale.hi ? 'l' : 'm';
  const geom = angIdx > CAL.angular ? 'angular' : 'soft';
  const shape = m.ratio < CAL.ratio.lo ? 'wide' : m.ratio > CAL.ratio.hi ? 'long' : 'balanced';
  // Рамка лица для превью (в долях фото)
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const box = { x: Math.min(...xs) / w, y: Math.min(...ys) / h, w: (Math.max(...xs) - Math.min(...xs)) / w, h: (Math.max(...ys) - Math.min(...ys)) / h };
  return { status: 'ok', scale, geom, shape, box, raw: { scaleIdx, angIdx, ratio: m.ratio, m } };
}
