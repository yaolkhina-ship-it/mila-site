// Подарочная ссылка без сети: node --test scripts/access-gift.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { giftStatus, redeemGift, currentSession, getAccess } from '../lib/access-core.mjs';

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const gifts = { [hash('tok1')]: { id: 'g1', tier: 'premium', months: 6 }, [hash('tok2')]: { id: 'g1', tier: 'premium', months: 6 } };
function mem() { const m = new Map(), ttl = new Map(); return { m, ttl,
  getJson: async (k) => (m.has(k) ? JSON.parse(m.get(k)) : null),
  setJson: async (k, v, t) => { m.set(k, JSON.stringify(v)); if (t) ttl.set(k, t); },
  setNx: async (k, v) => { if (m.has(k)) return false; m.set(k, v); return true; },
  del: async (k) => m.delete(k) }; }
const S = 'secret', now = new Date('2026-11-05T12:00:00Z');

test('неизвестная ссылка ничего не открывает', async () => {
  const s = mem(); assert.equal((await giftStatus(s, 'x', '', S, gifts, now)).state, 'invalid');
  assert.deepEqual(await redeemGift(s, 'x', '', S, gifts, now), { ok: false, error: 'invalid' }); assert.equal(s.m.size, 0);
});
test('просмотр статуса (превью мессенджера) ссылку не тратит', async () => {
  const s = mem(); for (let i = 0; i < 3; i++) assert.equal((await giftStatus(s, 'tok1', '', S, gifts, now)).state, 'new'); assert.equal(s.m.size, 0);
});
test('первое устройство получает премиум на 6 месяцев, второе нет', async () => {
  const s = mem(); const a = await redeemGift(s, 'tok1', '', S, gifts, now); assert.equal(a.ok, true);
  const u = await currentSession(s, a.session, S, now); assert.equal(u.email, 'g1@gift.milaushakova.com');
  const acc = await getAccess(s, u.email, now); assert.equal(acc.active, true); assert.equal(acc.tier, 'premium'); assert.equal(acc.until.slice(0, 7), '2027-05');
  assert.deepEqual(await redeemGift(s, 'tok1', '', S, gifts, now), { ok: false, error: 'used' });
  assert.equal((await giftStatus(s, 'tok1', '', S, gifts, now)).state, 'used');
});
test('то же устройство открывает снова, вход не перевыпускается', async () => {
  const s = mem(); const a = await redeemGift(s, 'tok1', '', S, gifts, now);
  assert.equal((await giftStatus(s, 'tok1', a.session, S, gifts, now)).state, 'mine');
  assert.deepEqual(await redeemGift(s, 'tok1', a.session, S, gifts, now), { ok: true, session: null });
});
test('вход не обрывается через 30 дней и закрывается в конце срока', async () => {
  const s = mem(); const a = await redeemGift(s, 'tok1', '', S, gifts, now);
  assert.ok(s.ttl.get('sid:g1@gift.milaushakova.com') > 170 * 86400);
  const d100 = new Date(now.getTime() + 100 * 864e5); assert.equal((await currentSession(s, a.session, S, d100)).email, 'g1@gift.milaushakova.com');
  assert.equal((await currentSession(s, a.session, S, new Date('2027-06-01T00:00:00Z'))).email, null);
});
test('ссылка на замену: новое устройство работает, прежнее отключено, срок тот же', async () => {
  const s = mem(); const a = await redeemGift(s, 'tok1', '', S, gifts, now); const until = (await getAccess(s, 'g1@gift.milaushakova.com', now)).until;
  const later = new Date(now.getTime() + 30 * 864e5); const b = await redeemGift(s, 'tok2', '', S, gifts, later); assert.equal(b.ok, true);
  assert.equal((await getAccess(s, 'g1@gift.milaushakova.com', later)).until, until);
  assert.equal((await currentSession(s, a.session, S, later)).replaced, true); assert.equal((await currentSession(s, b.session, S, later)).email, 'g1@gift.milaushakova.com');
});
test('сбой записи не сжигает ссылку', async () => {
  const s = mem(); const orig = s.setJson; s.setJson = async () => { throw new Error('store'); };
  await assert.rejects(redeemGift(s, 'tok1', '', S, gifts, now)); s.setJson = orig;
  assert.equal((await redeemGift(s, 'tok1', '', S, gifts, now)).ok, true);
});
test('в репозитории нет самой ссылки, только хеш', async () => {
  const fs = await import('node:fs'); const src = fs.readFileSync(new URL('../lib/gifts.mjs', import.meta.url), 'utf8'); assert.match(src, /'[0-9a-f]{64}'/);
});
