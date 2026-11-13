// Доступ к платным продуктам: кто что купил и до какого числа.
// Логика без привязки к серверу: хранилище и отправка писем передаются снаружи, поэтому всё проверяется тестами.
import crypto from 'node:crypto';

export const CODE_TTL = 600;        // код из письма живёт 10 минут
export const MAX_ATTEMPTS = 5;      // попыток ввода одного кода
const KEEP_CODES = 3;             // сколько последних кодов действуют одновременно
export const MAX_CODES_HOUR = 10;    // кодов на почту в час
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

// Покупки через Lava: ссылка из содержимого продукта Lava открывает доступ по почте покупателя.
// sha256 секрета ссылки → тариф. Сами ссылки в репозиторий не попадают (лежат у Яны).
export const LAVA_CLAIMS = { '6d7a3f0934e242c1379af89a89a66a5b8d7638d6935ead1a946cdf9c15bf0ce1': 'base', '9eca0c5c297fa879a295c073146e71a7713cef73e792909975e50b5a3969c6b4': 'premium' };

export async function claimLava(store, t, email, now = new Date(), claims = LAVA_CLAIMS) {
  const tier = t ? claims[crypto.createHash('sha256').update(String(t)).digest('hex')] : null;
  if (!tier) return { ok: false, error: 'link' };
  const e = normEmail(email);
  if (!e) return { ok: false, error: 'email' };
  // Повторное открытие той же ссылкой с той же почтой срок не продлевает (order_id одинаковый)
  const r = await applyPayment(store, { payment_status: 'success', order_num: tier === 'premium' ? 'Система Имиджа Премиум' : 'Система Имиджа Базовый', order_id: `lava-${tier}-${e}`, customer_email: e }, now);
  if (r.skipped === 'duplicate') { const a = await getAccess(store, e, now); return { ok: !!a.active, email: e, tier, again: true, until: a.until || null }; }
  if (!r.access) return { ok: false, error: r.skipped || 'error' };
  return { ok: true, email: e, tier: r.access.tier, until: r.access.until, access: r.access, isNew: r.isNew };
}

export async function getAccess(store, email, now = new Date()) {
  const e = normEmail(email);
  const a = e ? await store.getJson('acc:' + e) : null;
  if (!a) return { active: false, tier: null, until: null };
  // 13.11: подарок, убранный из lib/gifts.mjs, сразу перестаёт открывать Систему (так закрываем доступ после ознакомления)
  if (e.endsWith('@gift.milaushakova.com') && !Object.values((await import('./gifts.mjs')).GIFTS).some((g) => g.id + '@gift.milaushakova.com' === e)) return { active: false, tier: a.tier, until: a.until };
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
  // Письмо может идти дольше, чем человек ждёт: прежние неистёкшие коды продолжают работать
  const prev = await store.getJson('code:' + e);
  const earlier = prev ? [].concat(prev.hs || prev.h || []).slice(-(KEEP_CODES - 1)) : [];
  await store.setJson('code:' + e, { hs: [...earlier, hashCode(e, code, secret)], left: MAX_ATTEMPTS }, CODE_TTL);
  await send(e, code);
  return { ok: true };
}

export async function verifyCode(store, email, code, secret, now = new Date()) {
  const e = normEmail(email);
  const rec = e ? await store.getJson('code:' + e) : null;
  if (!rec) return { ok: false, error: 'expired' };
  const given = hashCode(e, String(code || '').trim(), secret);
  if (![].concat(rec.hs || rec.h || []).some((h) => safeEq(h, given))) {
    const left = rec.left - 1;
    if (left <= 0) await store.del('code:' + e);
    else await store.setJson('code:' + e, { ...rec, left }, CODE_TTL);
    return { ok: false, error: 'wrong', left: Math.max(left, 0) };
  }
  await store.del('code:' + e);
  // Один вход на почту: новый вход отключает предыдущее устройство
  const sid = crypto.randomBytes(12).toString('base64url');
  await addDevice(store, e, sid);
  return { ok: true, session: makeSession(e, secret, now, sid) };
}

// Вход без кода: только почта (решение Яны 07.11, Лана не могла войти по коду). Доступ и одно устройство проверяются как обычно.
export const NO_CODE = ['lanakravtsovaprof@mail.ru'];

// Личные ссылки входа: sha256 от секрета ссылки → почта. Сама ссылка в репозиторий не попадает.
export const LOGIN_LINKS = { 'fcb9241e02374fa74f8defd2c8dfd347479c14f7067e9a49510a872f75b1ca0d': 'lanakravtsovaprof@mail.ru' };

export async function linkLogin(store, t, secret, now = new Date()) {
  if (!t) return { ok: false };
  const email = LOGIN_LINKS[crypto.createHash('sha256').update(String(t)).digest('hex')];
  if (!email) return { ok: false };
  const a = await getAccess(store, email, now);
  if (!a.active) return { ok: false };
  const sid = crypto.randomBytes(12).toString('base64url');
  await addDevice(store, email, sid);
  return { ok: true, session: makeSession(email, secret, now, sid) };
}

export async function directLogin(store, email, secret, now = new Date()) {
  const e = normEmail(email);
  if (!e || !NO_CODE.includes(e)) return { ok: false };
  const a = await getAccess(store, e, now);
  if (!a.active) return { ok: false };
  const sid = crypto.randomBytes(12).toString('base64url');
  await addDevice(store, e, sid);
  return { ok: true, session: makeSession(e, secret, now, sid) };
}

const b64 = (s) => Buffer.from(s).toString('base64url');
export function makeSession(email, secret, now = new Date(), sid = null, expires = null) {
  const body = b64(JSON.stringify({ e: email, x: expires || now.getTime() + SESSION_DAYS * 864e5, ...(sid ? { s: sid } : {}) }));
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
// Текущий вход: подпись и срок верны, и это последнее устройство, с которого вошли.
// replaced = подпись верна, но вход перекрыт новым устройством.
// Устройства на одну почту: до MAX_DEVICES последних входов (07.11 Яна: «на несколько устройств»).
// Подарочная ссылка по-прежнему пишет { s } и остаётся на одном устройстве.
export const MAX_DEVICES = 3;
export const sidList = (cur) => (cur ? [].concat(cur.ss || cur.s || []) : []);
export async function addDevice(store, email, sid) {
  const cur = await store.getJson('sid:' + email);
  const ss = [...sidList(cur).filter((x) => x !== sid), sid].slice(-MAX_DEVICES);
  await store.setJson('sid:' + email, { ss }, SESSION_DAYS * 86400);
}

export async function currentSession(store, token, secret, now = new Date()) {
  const email = readSession(token, secret, now);
  if (!email) return { email: null, replaced: false };
  let sid = null;
  try { sid = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString()).s || null; } catch (e) { /* подпись уже проверена */ }
  const cur = await store.getJson('sid:' + email);
  if (sid && sidList(cur).includes(sid)) return { email, replaced: false };
  // Команда (team:true) работает с нескольких устройств
  const acc = await store.getJson('acc:' + email);
  if (acc && acc.team) return { email, replaced: false };
  return { email: null, replaced: true };
}
// 06.11: вход продлевается сам. Если с выдачи прошло больше суток, выдаём новый токен на SESSION_DAYS
// с тем же устройством и продлеваем запись устройства. Вызывать только после успешного currentSession.
export async function renewSession(store, token, secret, now = new Date()) {
  const email = readSession(token, secret, now);
  if (!email) return null;
  let d;
  try { d = JSON.parse(Buffer.from(String(token).split('.')[0], 'base64url').toString()); } catch (e) { return null; }
  if (d.x - now.getTime() > (SESSION_DAYS - 1) * 864e5) return null;
  if (d.s) {
    const cur = await store.getJson('sid:' + email);
    if (sidList(cur).includes(d.s)) await store.setJson('sid:' + email, cur, SESSION_DAYS * 86400);
  }
  return makeSession(email, secret, now, d.s || null);
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

// Подарочная ссылка: одна ссылка, одно устройство. Почты у получателя нет, поэтому вход держится весь срок подарка.
const giftHash = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
const giftEmail = (id) => id + '@gift.milaushakova.com';

export async function giftStatus(store, token, cookie, secret, gifts, now = new Date()) {
  const hash = giftHash(token), gift = gifts[hash];
  if (!gift) return { state: 'invalid' };
  const { email } = await currentSession(store, cookie, secret, now);
  if (email === giftEmail(gift.id) && (await getAccess(store, email, now)).active) return { state: 'mine' };
  return { state: (await store.getJson('giftused:' + hash)) ? 'used' : 'new', tier: gift.tier, months: gift.months, days: gift.days };
}

export async function redeemGift(store, token, cookie, secret, gifts, now = new Date()) {
  const hash = giftHash(token), gift = gifts[hash];
  if (!gift) return { ok: false, error: 'invalid' };
  const email = giftEmail(gift.id);
  const { email: signedIn } = await currentSession(store, cookie, secret, now);
  if (signedIn === email && (await getAccess(store, email, now)).active) return { ok: true, session: null };
  if (!(await store.setNx('giftused:' + hash, '1'))) return { ok: false, error: 'used' };
  try {
    const cur = await store.getJson('acc:' + email);
    const until = cur ? new Date(cur.until) : gift.days ? new Date(now.getTime() + gift.days * 864e5) : new Date(addMonths(now, gift.months));   // 13.11: days — короткий доступ для ознакомления
    if (!cur) await store.setJson('acc:' + email, { tier: gift.tier, until: until.toISOString(), since: now.toISOString(), gift: true });
    const sid = crypto.randomBytes(12).toString('base64url');
    const seconds = Math.max(Math.ceil((until.getTime() - now.getTime()) / 1000), 1);
    await store.setJson('sid:' + email, { s: sid }, seconds);
    return { ok: true, session: makeSession(email, secret, now, sid, until.getTime()), seconds };
  } catch (e) {
    await store.del('giftused:' + hash); // запись не удалась: ссылка не должна сгореть
    throw e;
  }
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


// Приветственное письмо покупателю (текст Милы, 05.11). Имени в уведомлении Prodamus нет, поэтому без обращения по имени.
const WELCOME_HTML = "<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><link href=\"https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500&family=Jost:wght@300;400;500&display=swap\" rel=\"stylesheet\"><style>@media (max-width:620px){.pad{padding-left:24px !important;padding-right:24px !important}.t{font-size:40px !important}}</style></head><body style=\"margin:0;padding:0;background:#0b0b0b;\"><div style=\"display:none;max-height:0;overflow:hidden;\">Добро пожаловать в «Систему имиджа»!</div>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#0b0b0b;\"><tr><td align=\"center\">\n<table role=\"presentation\" width=\"600\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"width:100%;max-width:600px;background:#111111;\">\n<tr><td class=\"pad\" style=\"padding:22px 40px;border-bottom:1px solid #2a2622;\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td style=\"font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:13px;letter-spacing:4px;color:#ede8df;text-transform:uppercase;\">Mila Ushakova</td><td align=\"right\" style=\"font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:11px;letter-spacing:3px;color:#b8975a;text-transform:uppercase;\">Система имиджа</td></tr></table></td></tr>\n<tr><td class=\"pad\" style=\"padding:56px 40px 0;\"><p style=\"margin:0 0 14px;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Здравствуйте!</p><h1 class=\"t\" style=\"margin:0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:400;font-size:50px;line-height:1.02;letter-spacing:1px;color:#ede8df;text-transform:uppercase;\">Добро пожаловать в «Систему имиджа»!</h1></td></tr>\n<tr><td class=\"pad\" style=\"padding:32px 40px 0;\">\n<p style=\"margin:0px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Перед вами приложение, в котором собраны экспертные знания о стиле, психологии восприятия, невербальной коммуникации и искусстве первого впечатления.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Здесь вы не найдёте привычных рекомендаций о том, как сочетать пиджак с рубашкой или какую юбку выбрать к жакету.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">«Система имиджа» не о правильных сочетаниях одежды. Она о том, как с помощью внешнего вида и поведения управлять впечатлением о себе.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Впечатление: вещь практически неосязаемая, но при этом удивительно управляемая.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">На то, как нас воспринимают окружающие, влияют фактуры, силуэты, аксессуары, манера держаться, жесты и даже скорость речи.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Мы собрали эти знания в одном приложении, чтобы вы могли использовать их в повседневной жизни.</p>\n<p style=\"margin:42px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:300;font-size:26px;line-height:1.2;letter-spacing:1px;color:#ede8df;text-transform:uppercase;\">Как пользоваться «Системой имиджа»?</p>\n<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-top:20px;border-bottom:1px solid #2a2622;\"><tr><td valign=\"top\" style=\"padding:22px 0;border-top:1px solid #2a2622;\"><p style=\"margin:0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#b8975a;text-transform:uppercase;\">Шаг 1</p><p style=\"margin:6px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:16px;letter-spacing:1px;line-height:1.35;color:#ede8df;\">Выберите, куда вы направляетесь.</p><p style=\"margin:8px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Это может быть офис, деловая встреча, мероприятие вне офиса или вечернее событие.</p></td></tr><tr><td valign=\"top\" style=\"padding:22px 0;border-top:1px solid #2a2622;\"><p style=\"margin:0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#b8975a;text-transform:uppercase;\">Шаг 2</p><p style=\"margin:6px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:16px;letter-spacing:1px;line-height:1.35;color:#ede8df;\">Определите из списка, какое впечатление вы хотите произвести.</p><p style=\"margin:8px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Допустим, вы выбрали офис.<br>Теперь подумайте, какую задачу вам необходимо решить. Вы хотите вызвать доверие? Продемонстрировать компетентность? Обозначить личные границы? Показать способность к креативному мышлению? Или заявить о своих амбициях?</p><p style=\"margin:14px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Каждое из этих впечатлений требует собственных инструментов.</p></td></tr><tr><td valign=\"top\" style=\"padding:22px 0;border-top:1px solid #2a2622;\"><p style=\"margin:0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#b8975a;text-transform:uppercase;\">Шаг 3</p><p style=\"margin:6px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:16px;letter-spacing:1px;line-height:1.35;color:#ede8df;\">Изучите рекомендации и примеры образов.</p><p style=\"margin:8px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Выбрав желаемое впечатление, вы получите конкретные рекомендации: какие фактуры, фасоны, аксессуары и особенности поведения помогут вам достичь цели.</p><p style=\"margin:14px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">В приложении вы найдёте объяснения этих механизмов, примеры образов и мои аудиоразборы, которые помогут понять значение каждой детали.</p></td></tr><tr><td valign=\"top\" style=\"padding:22px 0;border-top:1px solid #2a2622;\"><p style=\"margin:0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:3px;color:#b8975a;text-transform:uppercase;\">Шаг 4</p><p style=\"margin:6px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:16px;letter-spacing:1px;line-height:1.35;color:#ede8df;\">Примените знания к собственному гардеробу.</p><p style=\"margin:8px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Вам не нужно покупать вещи.</p></td></tr></table>\n<p style=\"margin:42px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:300;font-size:26px;line-height:1.2;letter-spacing:1px;color:#ede8df;text-transform:uppercase;\">Что ещё есть в приложении?</p>\n<p style=\"margin:16px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Мы предусмотрели ситуации, с которыми вы сталкиваетесь в жизни.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Как одеться на бизнес-завтрак, обед или ужин? Чем отличается корпоратив от коктейльного мероприятия?</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Как учитывать дресс-код, не отказываясь от собственного характера и стиля?</p>\n__LECTURES__\n<p style=\"margin:24px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Постепенно вы начнёте замечать, как меняется не только ваш подход к выбору одежды, но и реакция окружающих.</p>\n<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Мы продолжим дополнять и совершенствовать «Систему имиджа», чтобы у вас под рукой был полноценный инструмент для самых разных жизненных ситуаций.</p>\n<p style=\"margin:34px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:300;font-size:22px;line-height:1.35;letter-spacing:1px;color:#b8975a;text-transform:uppercase;\">Пользуйтесь. Экспериментируйте.<br>Наблюдайте за реакцией окружающих.</p>\n</td></tr>\n<tr><td class=\"pad\" style=\"padding:36px 40px 0;\"><p style=\"margin:0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;font-size:15px;line-height:1.6;color:#8f877b;\">Доступ открыт до __UNTIL__. Вход по почте __EMAIL__ и коду, который придёт на неё.</p><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin-top:14px;\"><tr><td style=\"background:#b8975a;padding:16px 44px;\"><a href=\"https://www.milaushakova.com/vhod\" style=\"font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:4px;color:#0b0b0b;text-decoration:none;text-transform:uppercase;\">Войти</a></td></tr></table></td></tr>\n<tr><td class=\"pad\" style=\"padding:42px 40px 44px;\"><p style=\"margin:0 0 22px;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;font-size:15px;line-height:1.6;color:#8f877b;\">Если есть вопросы, пишите в Telegram: <a href=\"https://t.me/YanaOlkhina\" style=\"color:#b8975a;\">@YanaOlkhina</a></p><p style=\"margin:0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">С уважением,</p><p style=\"margin:10px 0 0;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:18px;letter-spacing:3px;color:#ede8df;text-transform:uppercase;\">Мила Ушакова и команда</p></td></tr>\n<tr><td class=\"pad\" style=\"padding:24px 40px 30px;border-top:1px solid #2a2622;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#6f685e;\"><a href=\"https://www.milaushakova.com/oferta\" style=\"color:#8f877b;\">Договор оферты</a> · <a href=\"https://www.milaushakova.com/privacy\" style=\"color:#8f877b;\">Политика конфиденциальности</a> · <a href=\"https://t.me/MilaUshakova_ClubBot?start=support\" style=\"color:#8f877b;\">Поддержка</a><br>ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</td></tr>\n</table></td></tr></table></body></html>";
const WELCOME_LECTURES = { base: "<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Помимо рекомендаций, в тарифе «Премиум» доступны три экспертные лекции:</p><p style=\"margin:10px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">•&nbsp;Этикет часов<br>•&nbsp;Парфюмерный этикет<br>•&nbsp;Дресс-код</p>", premium: "<p style=\"margin:18px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">Помимо рекомендаций, вам уже доступны экспертные лекции в разделе «Видео»:</p><p style=\"margin:10px 0 0;font-family:'Jost',Helvetica,Arial,sans-serif;font-weight:300;font-size:17px;line-height:1.75;color:#d9d3c9;\">•&nbsp;Этикет часов<br>•&nbsp;Парфюмерный этикет<br>•&nbsp;Дресс-код появится скоро</p>" };
export function welcomeMail(email, access) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const until = new Date(access.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow' }).replace(/\s*г\.?$/, ' года');
  const lectures = access.tier === 'premium' ? WELCOME_LECTURES.premium : WELCOME_LECTURES.base;
  return {
    subject: 'Добро пожаловать в «Систему имиджа»',
    html: WELCOME_HTML.replace('__LECTURES__', () => lectures).replace('__UNTIL__', () => esc(until)).replace('__EMAIL__', () => esc(email)),
  };
}
