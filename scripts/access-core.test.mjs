// node --test scripts/access-core.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import * as A from '../lib/access-core.mjs';

function memStore() {
  const m = new Map();
  return {
    m,
    getJson: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
    setJson: async (k, v) => { m.set(k, JSON.stringify(v)); },
    setNx: async (k, v) => { if (m.has(k)) return false; m.set(k, v); return true; },
    incrExpire: async (k) => { const n = (+m.get(k) || 0) + 1; m.set(k, String(n)); return n; },
    del: async (k) => { m.delete(k); },
  };
}
const NOW = new Date('2026-11-16T10:00:00Z');
const pay = (o = {}) => ({ payment_status: 'success', customer_email: 'Anna@Mail.ru ', order_id: '1', products: [{ name: 'Система имиджа. База', price: '7000', quantity: '1', sum: '7000' }], ...o });

test('база открывает базу на 6 месяцев, почта приводится к одному виду', async () => {
  const s = memStore(); const r = await A.applyPayment(s, pay(), NOW);
  assert.equal(r.access.tier, 'base'); assert.equal(r.email, 'anna@mail.ru');
  assert.equal(r.access.until.slice(0, 10), '2027-05-16');
  const a = await A.getAccess(s, 'ANNA@mail.ru', NOW); assert.equal(a.active, true); assert.equal(a.tier, 'base');
});
test('премиум открывает премиум', async () => {
  const s = memStore(); await A.applyPayment(s, pay({ products: [{ name: 'Система имиджа. Премиум' }] }), NOW);
  assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).tier, 'premium');
});
test('неоплаченное и чужой продукт доступа не дают', async () => {
  const s = memStore();
  await A.applyPayment(s, pay({ payment_status: 'order_canceled' }), NOW);
  await A.applyPayment(s, pay({ order_id: '2', products: [{ name: 'Лекция «Дресс-код»' }] }), NOW);
  assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).active, false);
});
test('повтор того же уведомления не продлевает срок', async () => {
  const s = memStore(); await A.applyPayment(s, pay(), NOW);
  const r = await A.applyPayment(s, pay(), NOW); assert.equal(r.skipped, 'duplicate');
  assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).until.slice(0, 10), '2027-05-16');
});
test('доплата меняет тариф и не меняет срок', async () => {
  const s = memStore(); await A.applyPayment(s, pay(), NOW);
  await A.applyPayment(s, pay({ order_id: '3', products: [{ name: 'Система имиджа. Доплата до премиума' }] }), NOW);
  const a = await A.getAccess(s, 'anna@mail.ru', NOW); assert.equal(a.tier, 'premium'); assert.equal(a.until.slice(0, 10), '2027-05-16');
});
test('доплата без базы не открывает доступ и уходит на разбор', async () => {
  const s = memStore(); const r = await A.applyPayment(s, pay({ order_id: '4', products: [{ name: 'Система имиджа. Доплата до премиума' }] }), NOW);
  assert.equal(r.skipped, 'upgrade-without-base'); assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).active, false); assert.ok(s.m.has('review:4'));
});
test('продление считается от конца срока, премиум не понижается', async () => {
  const s = memStore(); await A.applyPayment(s, pay({ products: [{ name: 'Система имиджа. Премиум' }] }), NOW);
  await A.applyPayment(s, pay({ order_id: '5' }), NOW);
  const a = await A.getAccess(s, 'anna@mail.ru', NOW); assert.equal(a.tier, 'premium'); assert.equal(a.until.slice(0, 10), '2027-11-16');
});
test('срок истёк', async () => {
  const s = memStore(); await A.applyPayment(s, pay(), NOW);
  assert.equal((await A.getAccess(s, 'anna@mail.ru', new Date('2027-05-17T00:00:00Z'))).active, false);
});
test('конец месяца не перескакивает', () => { assert.equal(A.addMonths(new Date('2026-08-31T00:00:00Z'), 6).toISOString().slice(0, 10), '2027-02-28'); });
test('поля внутри submit тоже читаются', async () => {
  const s = memStore(); await A.applyPayment(s, { submit: pay() }, NOW); assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).tier, 'base');
});
test('подпись: верная проходит, подделка и пустая нет', () => {
  const d = { order_id: '7', customer_email: 'a@b.ru', products: [{ name: 'Система', sum: 7000 }] };
  const [h] = A.signVariants(d, 'key');
  assert.equal(A.verifySign(d, h, 'key'), true); assert.equal(A.verifySign(d, h.toUpperCase(), 'key'), true);
  assert.equal(A.verifySign({ ...d, order_id: '8' }, h, 'key'), false); assert.equal(A.verifySign(d, h, 'other'), false); assert.equal(A.verifySign(d, '', 'key'), false); assert.equal(A.verifySign(d, h, ''), false);
});
test('порядок ключей на подпись не влияет', () => {
  assert.equal(A.signVariants({ b: 1, a: 2 }, 'k')[0], A.signVariants({ a: '2', b: '1' }, 'k')[0]);
});
test('форма разворачивается в объект', () => {
  assert.deepEqual(A.unflatten({ 'products[0][name]': 'X', 'products[0][sum]': '1', order_id: '9' }), { products: [{ name: 'X', sum: '1' }], order_id: '9' });
});
test('код: приходит только покупателю, верный код входит и больше не работает', async () => {
  const s = memStore(); const sent = []; const send = async (e, c) => sent.push([e, c]);
  await A.requestCode(s, 'stranger@mail.ru', 'sec', send, NOW); assert.equal(sent.length, 0);
  await A.applyPayment(s, pay(), NOW); await A.requestCode(s, 'anna@mail.ru', 'sec', send, NOW);
  assert.equal(sent.length, 1); assert.match(sent[0][1], /^\d{6}$/);
  const r = await A.verifyCode(s, 'anna@mail.ru', sent[0][1], 'sec', NOW); assert.equal(r.ok, true);
  assert.equal(A.readSession(r.session, 'sec', NOW), 'anna@mail.ru');
  assert.equal((await A.verifyCode(s, 'anna@mail.ru', sent[0][1], 'sec', NOW)).ok, false);
});
test('код не хранится открытым, попытки ограничены', async () => {
  const s = memStore(); const sent = []; await A.applyPayment(s, pay(), NOW);
  await A.requestCode(s, 'anna@mail.ru', 'sec', async (e, c) => sent.push(c), NOW);
  assert.ok(!s.m.get('code:anna@mail.ru').includes(sent[0]));
  const bad = sent[0] === '000000' ? '000001' : '000000';
  for (let i = 0; i < A.MAX_ATTEMPTS; i++) assert.equal((await A.verifyCode(s, 'anna@mail.ru', bad, 'sec', NOW)).ok, false);
  assert.equal((await A.verifyCode(s, 'anna@mail.ru', sent[0], 'sec', NOW)).error, 'expired');
});
test('кодов в час не больше лимита', async () => {
  const s = memStore(); let n = 0; await A.applyPayment(s, pay(), NOW);
  for (let i = 0; i < A.MAX_CODES_HOUR + 3; i++) await A.requestCode(s, 'anna@mail.ru', 'sec', async () => { n++; }, NOW);
  assert.equal(n, A.MAX_CODES_HOUR);
});
test('сессия: подделка и истёкшая не проходят', () => {
  const t = A.makeSession('a@b.ru', 'sec', NOW);
  assert.equal(A.readSession(t, 'sec', NOW), 'a@b.ru'); assert.equal(A.readSession(t, 'other', NOW), null);
  assert.equal(A.readSession(t + 'x', 'sec', NOW), null); assert.equal(A.readSession(t, 'sec', new Date('2027-01-01T00:00:00Z')), null);
  const body = Buffer.from(JSON.stringify({ e: 'evil@b.ru', x: 9e15 })).toString('base64url');
  assert.equal(A.readSession(body + '.' + crypto.randomBytes(32).toString('base64url'), 'sec', NOW), null);
});
test('общее название Prodamus: тариф по точной сумме', async () => {
  const name = 'Доступ к обучающим материалам';
  assert.equal(A.tierFromItem({ name, sum: '7000.00' }), 'base'); assert.equal(A.tierFromItem({ name, price: '9900' }), 'premium');
  assert.equal(A.tierFromItem({ name, sum: '11900' }), 'premium'); assert.equal(A.tierFromItem({ name, sum: '2900' }), 'upgrade');
  assert.equal(A.tierFromItem({ name, sum: '777' }), null); assert.equal(A.tierFromItem({ name: 'Лекция', sum: '7000' }), null);
  const s = memStore(); await A.applyPayment(s, pay({ order_id: '50', products: [{ name, sum: '9900' }] }), NOW);
  assert.equal((await A.getAccess(s, 'anna@mail.ru', NOW)).tier, 'premium');
  const t = memStore(); await A.applyPayment(t, pay({ order_id: '51', products: [{ name, sum: '777' }] }), NOW);
  assert.equal((await A.getAccess(t, 'anna@mail.ru', NOW)).active, false);
});
test('оплата без почты не теряется: уходит на ручной разбор с телефоном', async () => {
  const s = memStore(); const r = await A.applyPayment(s, pay({ order_id: '60', customer_email: '', customer_phone: '+79990001122' }), NOW);
  assert.equal(r.skipped, 'no-email'); assert.equal(JSON.parse(s.m.get('review:60')).phone, '+79990001122');
});
test('чужой продукт без почты на разбор не попадает', async () => {
  const s = memStore(); const r = await A.applyPayment(s, pay({ order_id: '61', customer_email: '', products: [{ name: 'Лекция', sum: '777' }] }), NOW);
  assert.equal(r.skipped, 'other-product'); assert.equal(s.m.has('review:61'), false);
});
test('тариф по номеру заказа, в том числе при другой сумме', async () => {
  const name = 'Доступ к обучающим материалам';
  const a = memStore(); await A.applyPayment(a, pay({ order_id: '70', order_num: 'Система Имиджа Базовый', sum: '75.00', products: [{ name, sum: '75.00' }] }), NOW);
  assert.equal((await A.getAccess(a, 'anna@mail.ru', NOW)).tier, 'base');
  const b = memStore(); await A.applyPayment(b, pay({ order_id: '71', order_num: 'Система Имиджа  Премиум', products: [{ name, sum: '105' }] }), NOW);
  assert.equal((await A.getAccess(b, 'anna@mail.ru', NOW)).tier, 'premium');
  const c = memStore(); const r = await A.applyPayment(c, pay({ order_id: '1', order_num: 'test', sum: '1000.00', products: [{ name, sum: '1000.00' }] }), NOW);
  assert.equal(r.skipped, 'other-product');
});
test('одно устройство: второй вход отключает первый', async () => {
  const store = memStore(); await store.setJson('acc:a@b.ru', { tier: 'base', until: '2099-01-01T00:00:00Z' });
  const login = async () => { let code; await A.requestCode(store, 'a@b.ru', 'sec', async (e, c) => { code = c; }); return (await A.verifyCode(store, 'a@b.ru', code, 'sec')).session; };
  const first = await login();
  assert.equal((await A.currentSession(store, first, 'sec')).email, 'a@b.ru');
  const second = await login();
  const old = await A.currentSession(store, first, 'sec');
  assert.equal(old.email, null); assert.equal(old.replaced, true);
  assert.equal((await A.currentSession(store, second, 'sec')).email, 'a@b.ru');
  assert.equal((await A.currentSession(store, 'мусор', 'sec')).replaced, false);
});
test('одно устройство: команда работает с нескольких', async () => {
  const store = memStore(); await store.setJson('acc:t@b.ru', { tier: 'premium', until: '2099-01-01T00:00:00Z', team: true });
  const login = async () => { let code; await A.requestCode(store, 't@b.ru', 'sec', async (e, c) => { code = c; }); return (await A.verifyCode(store, 't@b.ru', code, 'sec')).session; };
  const first = await login(); const second = await login();
  assert.equal((await A.currentSession(store, first, 'sec')).email, 't@b.ru');
  assert.equal((await A.currentSession(store, second, 'sec')).email, 't@b.ru');
});
test('код: прежний код работает после повторного запроса', async () => {
  const store = memStore(); await store.setJson('acc:c@b.ru', { tier: 'base', until: '2099-01-01T00:00:00Z' });
  const ask = async () => { let code; await A.requestCode(store, 'c@b.ru', 'sec', async (e, c) => { code = c; }); return code; };
  const one = await ask(); await ask();
  assert.equal((await A.verifyCode(store, 'c@b.ru', one, 'sec')).ok, true);
  const a = await ask(), b = await ask(), c = await ask(), d = await ask();
  assert.equal((await A.verifyCode(store, 'c@b.ru', a, 'sec')).ok, false);
  assert.equal((await A.verifyCode(store, 'c@b.ru', d, 'sec')).ok, true);
});
test('приветственное письмо: тариф, срок, почта, контакт', () => {
  const b = A.welcomeMail('a<b@c.ru', { tier: 'base', until: '2027-05-05T07:00:00Z' });
  assert.match(b.html, /в тарифе «Премиум» доступны три/); assert.match(b.html, /5 мая 2027/); assert.match(b.html, /a&lt;b@c\.ru/);
  assert.match(b.html, /YanaOlkhina/); assert.ok(!/__[A-Z]+__/.test(b.html));
  const p = A.welcomeMail('p@c.ru', { tier: 'premium', until: '2027-05-05T07:00:00Z' });
  assert.match(p.html, /Дресс-код появится скоро/); assert.ok(!/три экспертные/.test(p.html));
});
