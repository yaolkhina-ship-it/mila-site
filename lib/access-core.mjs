// Доступ к платным продуктам: кто что купил и до какого числа.
// Логика без привязки к серверу: хранилище и отправка писем передаются снаружи, поэтому всё проверяется тестами.
import crypto from 'node:crypto';

export const CODE_TTL = 600;        // код из письма живёт 10 минут
export const MAX_ATTEMPTS = 5;      // попыток ввода одного кода
export const MAX_CODES_HOUR = 5;    // кодов на почту в час
export const SESSION_DAYS = 30;     // сколько держится вход на устройстве
export const ACCESS_MONTHS = 6;

export function normEmail(e) {
  const s = String(e || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : '';
}

// Какой продукт куплен, определяем по названию товара в Prodamus. Неизвестное название доступ не даёт.
export function tierFromName(name) {
  const n = String(name || '').toLowerCase();
  if (!n.includes('систем') || !n.includes('имидж')) return null;
  if (n.includes('доплат')) return 'upgrade';
  if (n.includes('премиум')) return 'premium';
  if (n.includes('база') || n.includes('базов')) return 'base';
  return null;
}

// На форме Prodamus у обоих тарифов общее название, поэтому при нём тариф определяется по точной сумме.
// Другая сумма доступа не даёт: так случайная оплата с похожим названием ничего не откроет.
const GENERIC_NAME = 'доступ к обучающим материалам';
const TIER_BY_SUM = { 7000: 'base', 8500: 'base', 9900: 'premium', 11900: 'premium', 2900: 'upgrade', 3400: 'upgrade' };
export function tierFromItem(item) {
  const byName = tierFromName(item && item.name);
  if (byName) return byName;
  if (String((item && item.name) || '').trim().toLowerCase() !== GENERIC_NAME) return null;
  const sum = Number(String(item.sum != null ? item.sum : item.price).replace(/\s/g, '').replace(',', '.'));
  return TIER_BY_SUM[sum] || null;
}

export function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) d.setUTCDate(0); // 31 августа + 6 месяцев = конец февраля, а не март
  return d;
}

// Подпись Prodamus: HMAC-SHA256 от JSON с отсортированными ключами и значениями-строками.
// Сериализацию подтверждаем на первой настоящей оплате: варианты отличаются только экранированием.
function sortStr(v) {
  if (Array.isArray(v)) return v.map(sortStr);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortStr(v[k]);
    return o;
  }
  return v == null ? '' : String(v);
}
export function signVariants(data, secret) {
  const plain = JSON.stringify(sortStr(data));
  const esc = plain.replace(/\//g, '\\/');
  const asciiEsc = esc.replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  return [plain, esc, asciiEsc].map((s) => crypto.createHmac('sha256', secret).update(s).digest('hex'));
}
function safeEq(a, b) {
  const x = Buffer.from(String(a).toLowerCase());
  const y = Buffer.from(String(b).toLowerCase());
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function verifySign(data, sign, secret) {
  if (!sign || !secret) return false;
  return signVariants(data, secret).some((h) => safeEq(h, sign));
}

// Плоские поля формы вида products[0][name] превращаем в вложенный объект
export function unflatten(flat) {
  const out = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.replace(/\]/g, '').split('[');
    let cur = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) { cur[p] = val; return; }
      if (cur[p] === undefined) cur[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      cur = cur[p];
    });
  }
  return out;
}

// Оплата пришла: записать доступ. Повтор того же уведомления ничего не меняет.
export async function applyPayment(store, payment, now = new Date()) {
  const body = payment.submit && typeof payment.submit === 'object' ? payment.submit : payment;
  if (String(body.payment_status || '').toLowerCase() !== 'success') return { ok: true, skipped: 'not-paid' };
  const items = Array.isArray(body.products) ? body.products : Object.values(body.products || {});
  // Номер заказа на ссылке («Система Имиджа Базовый», «Система Имиджа Премиум») надёжнее суммы: при оплате в валюте сумма другая
  const byOrder = tierFromName(body.order_num);
  const tiers = byOrder ? [byOrder] : items.map(tierFromItem).filter(Boolean);
  if (!tiers.length) return { ok: true, skipped: 'other-product' };
  const orderId = String(body.order_id || body.order_num || '');
  const email = normEmail(body.customer_email);
  if (!email) {
    // Оплата есть, почты нет: сохраняем для ручной выдачи, чтобы покупатель не потерялся
    await store.setJson('review:' + (orderId || now.getTime()), { reason: 'no-email', phone: String(body.customer_phone || ''), tiers, at: now.toISOString() });
    return { ok: true, skipped: 'no-email' };
  }
  if (orderId) {
    const first = await store.setNx('ord:' + orderId, '1');
    if (!first) return { ok: true, skipped: 'duplicate' };
  }
  const tier = tiers.includes('premium') ? 'premium' : tiers.includes('upgrade') ? 'upgrade' : 'base';
  const cur = await store.getJson('acc:' + email);
  const active = cur && new Date(cur.until) > now;
  let next;
  if (tier === 'upgrade') {
    // Доплата не продлевает срок. Без действующей базы отдаём на ручной разбор, а не открываем молча.
    if (!active) { await store.setJson('review:' + (orderId || email), { email, reason: 'upgrade-without-base', at: now.toISOString() }); return { ok: true, skipped: 'upgrade-without-base' }; }
    next = { ...cur, tier: 'premium' };
  } else {
    // Новая покупка считается от конца текущего срока, тариф не понижается
    const from = active ? new Date(cur.until) : now;
    next = { tier: active && cur.tier === 'premium' ? 'premium' : tier, until: addMonths(from, ACCESS_MONTHS).toISOString(), since: (cur && cur.since) || now.toISOString() };
  }
  await store.setJson('acc:' + email, next);
  return { ok: true, email, access: next, isNew: !cur };
}

export async function getAccess(store, email, now = new Date()) {
  const e = normEmail(email);
  const a = e ? await store.getJson('acc:' + e) : null;
  if (!a) return { active: false, tier: null, until: null };
  return { active: new Date(a.until) > now, tier: a.tier, until: a.until };
}

const hashCode = (email, code, secret) => crypto.createHmac('sha256', secret).update(email + ':' + code).digest('hex');

// Запросить код. Ответ всегда одинаковый, чтобы по нему нельзя было узнать, кто покупатель.
export async function requestCode(store, email, secret, send, now = new Date()) {
  const e = normEmail(email);
  if (!e) return { ok: false, error: 'bad-email' };
  const a = await store.getJson('acc:' + e);
  if (!a) return { ok: true };
  const n = await store.incrExpire('rl:' + e, 3600);
  if (n > MAX_CODES_HOUR) return { ok: true };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await store.setJson('code:' + e, { h: hashCode(e, code, secret), left: MAX_ATTEMPTS }, CODE_TTL);
  await send(e, code);
  return { ok: true };
}

export async function verifyCode(store, email, code, secret, now = new Date()) {
  const e = normEmail(email);
  const rec = e ? await store.getJson('code:' + e) : null;
  if (!rec) return { ok: false, error: 'expired' };
  if (!safeEq(rec.h, hashCode(e, String(code || '').trim(), secret))) {
    const left = rec.left - 1;
    if (left <= 0) await store.del('code:' + e);
    else await store.setJson('code:' + e, { ...rec, left }, CODE_TTL);
    return { ok: false, error: 'wrong', left: Math.max(left, 0) };
  }
  await store.del('code:' + e);
  // Один вход на почту: новый вход отключает предыдущее устройство
  const sid = crypto.randomBytes(12).toString('base64url');
  await store.setJson('sid:' + e, { s: sid }, SESSION_DAYS * 86400);
  return { ok: true, session: makeSession(e, secret, now, sid) };
}

const b64 = (s) => Buffer.from(s).toString('base64url');
export function makeSession(email, secret, now = new Date(), sid = null) {
  const body = b64(JSON.stringify({ e: email, x: now.getTime() + SESSION_DAYS * 864e5, ...(sid ? { s: sid } : {}) }));
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
// Текущий вход: подпись и срок верны, и это последнее устройство, с которого вошли.
// replaced = подпись верна, но вход перекрыт новым устройством.
export async function currentSession(store, token, secret, now = new Date()) {
  const email = readSession(token, secret, now);
  if (!email) return { email: null, replaced: false };
  let sid = null;
  try { sid = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString()).s || null; } catch (e) { /* подпись уже проверена */ }
  const cur = await store.getJson('sid:' + email);
  if (!sid || !cur || cur.s !== sid) return { email: null, replaced: true };
  return { email, replaced: false };
}
export function readSession(token, secret, now = new Date()) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const x = Buffer.from(sig), y = Buffer.from(good);
  if (x.length !== y.length || !crypto.timingSafeEqual(x, y)) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    return d.x > now.getTime() ? d.e : null;
  } catch (e) { return null; }
}

// Хранилище Upstash Redis по REST: на Vercel нет своего постоянного диска
export function upstashStore(url, token, fetchFn = fetch) {
  const cmd = async (...args) => {
    const r = await fetchFn(url, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (!r.ok) throw new Error('store ' + r.status);
    return (await r.json()).result;
  };
  return {
    getJson: async (k) => { const v = await cmd('GET', k); return v ? JSON.parse(v) : null; },
    setJson: (k, v, ttl) => (ttl ? cmd('SET', k, JSON.stringify(v), 'EX', ttl) : cmd('SET', k, JSON.stringify(v))),
    setNx: async (k, v) => (await cmd('SET', k, v, 'NX')) === 'OK',
    incrExpire: async (k, ttl) => { const n = await cmd('INCR', k); if (n === 1) await cmd('EXPIRE', k, ttl); return n; },
    del: (k) => cmd('DEL', k),
  };
}
