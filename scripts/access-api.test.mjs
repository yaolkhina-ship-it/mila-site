// Проверка обработчиков без сети: node --test scripts/access-api.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { signVariants } from '../lib/access-core.mjs';

const redis = new Map(), mails = [];
globalThis.fetch = async (url, opt) => {
  const body = JSON.parse(opt.body);
  if (String(url).includes('resend')) { mails.push(body); return { ok: true, status: 200, json: async () => ({}) }; }
  const [c, k, v, ...rest] = body; let result = null;
  if (c === 'GET') result = redis.get(k) ?? null;
  if (c === 'SET') { if (rest[0] === 'NX' && redis.has(k)) result = null; else { redis.set(k, v); result = 'OK'; } }
  if (c === 'DEL') { redis.delete(k); result = 1; }
  if (c === 'INCR') { result = (+redis.get(k) || 0) + 1; redis.set(k, String(result)); }
  if (c === 'EXPIRE') result = 1;
  return { ok: true, status: 200, json: async () => ({ result }) };
};
process.env.PRODAMUS_SECRET = 'ps'; process.env.KV_REST_API_URL = 'https://r.test'; process.env.KV_REST_API_TOKEN = 't';
process.env.SESSION_SECRET = 'ss'; process.env.RESEND_API_KEY = 'k';

// .js с export в каталоге без type: module на Vercel собирается сборщиком; здесь загружаем копию как модуль
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import url from 'node:url';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'acc-'));
const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
fs.mkdirSync(path.join(dir, 'api')); fs.mkdirSync(path.join(dir, 'lib'));
fs.copyFileSync(path.join(root, 'lib/access-core.mjs'), path.join(dir, 'lib/access-core.mjs'));
for (const f of ['prodamus-webhook', 'access']) fs.copyFileSync(path.join(root, `api/${f}.js`), path.join(dir, `api/${f}.mjs`));
const hook = (await import(path.join(dir, 'api/prodamus-webhook.mjs'))).default;
const access = (await import(path.join(dir, 'api/access.mjs'))).default;

const mkRes = () => { const r = { code: 200, h: {}, out: null, status(c) { r.code = c; return r; }, send(v) { r.out = v; return r; }, json(v) { r.out = v; return r; }, setHeader(k, v) { r.h[k] = v; } }; return r; };
function hookReq(body, headers) { const q = Readable.from([Buffer.from(body)]); q.method = 'POST'; q.headers = headers; return q; }
const data = { order_id: '100', customer_email: 'anna@mail.ru', payment_status: 'success', products: [{ name: 'Система имиджа. Премиум', price: '9900', quantity: '1', sum: '9900' }] };
const form = new URLSearchParams({ order_id: '100', customer_email: 'anna@mail.ru', payment_status: 'success', 'products[0][name]': 'Система имиджа. Премиум', 'products[0][price]': '9900', 'products[0][quantity]': '1', 'products[0][sum]': '9900' }).toString();

test('уведомление без верной подписи доступ не открывает', async () => {
  const r = mkRes(); await hook(hookReq(form, { 'content-type': 'application/x-www-form-urlencoded', sign: 'bad' }), r);
  assert.equal(r.code, 401); assert.equal(redis.has('acc:anna@mail.ru'), false);
});
test('верная подпись открывает доступ и шлёт письмо', async () => {
  const r = mkRes(); await hook(hookReq(form, { 'content-type': 'application/x-www-form-urlencoded', sign: signVariants(data, 'ps')[0] }), r);
  assert.equal(r.code, 200); assert.equal(r.out, 'success'); assert.equal(JSON.parse(redis.get('acc:anna@mail.ru')).tier, 'premium');
  assert.equal(mails.at(-1).to, 'anna@mail.ru');
});
test('форма multipart тоже читается', async () => {
  const b = 'XX'; const fields = { order_id: '101', customer_email: 'olga@mail.ru', payment_status: 'success', 'products[0][name]': 'Система имиджа. База' };
  const raw = Object.entries(fields).map(([k, v]) => `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`).join('') + `--${b}--\r\n`;
  const d = { order_id: '101', customer_email: 'olga@mail.ru', payment_status: 'success', products: [{ name: 'Система имиджа. База' }] };
  const r = mkRes(); await hook(hookReq(raw, { 'content-type': `multipart/form-data; boundary=${b}`, sign: signVariants(d, 'ps')[0] }), r);
  assert.equal(r.code, 200); assert.equal(JSON.parse(redis.get('acc:olga@mail.ru')).tier, 'base');
});
test('вход: код, проверка, cookie и тариф', async () => {
  let r = mkRes(); await access({ method: 'POST', query: { do: 'code' }, body: { email: 'anna@mail.ru' }, headers: {} }, r); assert.equal(r.code, 200);
  const code = mails.at(-1).subject.match(/\d{6}/)[0];
  r = mkRes(); await access({ method: 'POST', query: { do: 'verify' }, body: { email: 'anna@mail.ru', code: '000000' === code ? '111111' : '000000' }, headers: {} }, r); assert.equal(r.code, 401);
  r = mkRes(); await access({ method: 'POST', query: { do: 'verify' }, body: { email: 'anna@mail.ru', code }, headers: {} }, r); assert.equal(r.code, 200);
  const ck = r.h['Set-Cookie']; assert.match(ck, /HttpOnly/); assert.match(ck, /Secure/);
  r = mkRes(); await access({ method: 'GET', query: { do: 'me' }, headers: { cookie: ck.split(';')[0] } }, r);
  assert.equal(r.out.signedIn, true); assert.equal(r.out.tier, 'premium'); assert.equal(r.out.active, true);
});
test('без входа тариф не виден, чужая почта кода не получает', async () => {
  let r = mkRes(); await access({ method: 'GET', query: { do: 'me' }, headers: {} }, r); assert.equal(r.out.signedIn, false);
  const n = mails.length; r = mkRes(); await access({ method: 'POST', query: { do: 'code' }, body: { email: 'stranger@mail.ru' }, headers: {} }, r);
  assert.equal(r.code, 200); assert.equal(mails.length, n);
});
test('видео: идентификаторы получает только премиум', async () => {
  redis.set('videos', JSON.stringify({ watch: 'W1', perfume: 'P1' }));
  redis.set('acc:base@mail.ru', JSON.stringify({ tier: 'base', until: '2099-01-01T00:00:00Z' }));
  const { makeSession } = await import(path.join(dir, 'lib/access-core.mjs'));
  let r = mkRes(); await access({ method: 'GET', query: { do: 'videos' }, headers: {} }, r);
  assert.equal(r.out.signedIn, false); assert.ok(r.out.items.every((v) => v.id === null)); assert.equal(r.out.items.length, 4);
  r = mkRes(); await access({ method: 'GET', query: { do: 'videos' }, headers: { cookie: 'ms_s=' + makeSession('base@mail.ru', 'ss') } }, r);
  assert.equal(r.out.tier, 'base'); assert.ok(r.out.items.every((v) => v.id === null));
  r = mkRes(); await access({ method: 'GET', query: { do: 'videos' }, headers: { cookie: 'ms_s=' + makeSession('anna@mail.ru', 'ss') } }, r);
  assert.equal(r.out.tier, 'premium'); assert.equal(r.out.items.find((v) => v.key === 'watch').id, 'W1');
  assert.equal(r.out.items.find((v) => v.key === 'dresscode').ready, false);
});
