// node --test scripts/access-lava.test.mjs
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
const h = (s) => crypto.createHash('sha256').update(s).digest('hex');
const CLAIMS = { [h('base-token')]: 'base', [h('prem-token')]: 'premium' };
const NOW = new Date('2026-11-10T10:00:00Z');

test('ссылка Базы открывает Базу на 6 месяцев', async () => {
  const s = memStore();
  const r = await A.claimLava(s, 'base-token', ' Vera@Gmail.com ', NOW, CLAIMS);
  assert.equal(r.ok, true); assert.equal(r.tier, 'base'); assert.equal(r.email, 'vera@gmail.com');
  assert.equal(r.until.slice(0, 10), '2027-05-10');
  assert.equal((await A.getAccess(s, 'vera@gmail.com', NOW)).tier, 'base');
});
test('ссылка Премиума открывает Премиум', async () => {
  const s = memStore();
  const r = await A.claimLava(s, 'prem-token', 'a@b.ru', NOW, CLAIMS);
  assert.equal(r.tier, 'premium');
});
test('неизвестная ссылка доступ не даёт', async () => {
  const s = memStore();
  const r = await A.claimLava(s, 'wrong', 'a@b.ru', NOW, CLAIMS);
  assert.equal(r.ok, false); assert.equal(r.error, 'link'); assert.equal(await s.getJson('acc:a@b.ru'), null);
});
test('плохая почта отклоняется', async () => {
  const r = await A.claimLava(memStore(), 'base-token', 'no-at', NOW, CLAIMS);
  assert.equal(r.error, 'email');
});
test('повтор той же ссылкой срок не продлевает', async () => {
  const s = memStore();
  const r1 = await A.claimLava(s, 'base-token', 'a@b.ru', NOW, CLAIMS);
  const r2 = await A.claimLava(s, 'base-token', 'a@b.ru', new Date('2026-12-01T10:00:00Z'), CLAIMS);
  assert.equal(r2.again, true); assert.equal(r2.until, r1.until);
});
test('Премиум поверх действующей Базы повышает тариф', async () => {
  const s = memStore();
  await A.claimLava(s, 'base-token', 'a@b.ru', NOW, CLAIMS);
  const r = await A.claimLava(s, 'prem-token', 'a@b.ru', NOW, CLAIMS);
  assert.equal(r.tier, 'premium');
});
test('настоящие ссылки заведены: одна База, одна Премиум', () => {
  assert.deepEqual(Object.values(A.LAVA_CLAIMS).sort(), ['base', 'premium']);
});
