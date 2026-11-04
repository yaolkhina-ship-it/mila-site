// node --test scripts/image-gate.test.mjs (запускать из корня сайта)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import url from 'node:url';
import { makeSession } from '../lib/access-core.mjs';

const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
fs.mkdirSync(path.join(dir, 'api')); fs.mkdirSync(path.join(dir, 'lib'));
fs.copyFileSync(path.join(root, 'lib/access-core.mjs'), path.join(dir, 'lib/access-core.mjs'));
fs.copyFileSync(path.join(root, 'api/image-gate.js'), path.join(dir, 'api/image-gate.mjs'));
process.chdir(root);
const redis = new Map();
globalThis.fetch = async (u, o) => { const [c, k] = JSON.parse(o.body); return { ok: true, status: 200, json: async () => ({ result: c === 'GET' ? redis.get(k) ?? null : null }) }; };
process.env.SESSION_SECRET = 'ss'; process.env.KV_REST_API_URL = 'https://r.test'; process.env.KV_REST_API_TOKEN = 't';
const gate = (await import(path.join(dir, 'api/image-gate.mjs'))).default;
const mk = () => { const r = { code: 200, h: {}, out: null, status(c) { r.code = c; return r; }, send(v) { r.out = v; return r; }, end(v) { r.out = v ?? r.out; return r; }, setHeader(k, v) { r.h[k] = v; } }; return r; };
const call = async (query, cookie, headers = {}) => { const r = mk(); await gate({ query, headers: { cookie, ...headers } }, r); return r; };
const look = fs.readdirSync(path.join(root, 'private/business-img')).find((n) => n.startsWith('look-'));
const voice = fs.readdirSync(path.join(root, 'private/business-img')).find((n) => n.endsWith('.m4a'));
const good = 'ms_s=' + makeSession('anna@mail.ru', 'ss');
const old = 'ms_s=' + makeSession('old@mail.ru', 'ss');
redis.set('acc:anna@mail.ru', JSON.stringify({ tier: 'base', until: '2099-01-01T00:00:00Z' }));
redis.set('acc:old@mail.ru', JSON.stringify({ tier: 'base', until: '2020-01-01T00:00:00Z' }));

test('без входа страницы нет, ведёт на вход', async () => { const r = await call({}, undefined); assert.equal(r.code, 302); assert.equal(r.h.Location, '/vhod'); assert.equal(r.out, null); });
test('подделка входа не проходит', async () => { const r = await call({}, 'ms_s=abc.def'); assert.equal(r.code, 302); });
test('срок истёк: на вход с сообщением', async () => { const r = await call({}, old); assert.equal(r.code, 302); assert.equal(r.h.Location, '/vhod?expired=1'); });
test('с доступом страница открывается', async () => { const r = await call({}, good); assert.equal(r.code, 200); assert.match(r.out, /var RULES/); assert.equal(r.h['Cache-Control'], 'no-store'); });
test('образ без входа закрыт, с входом открыт', async () => {
  assert.equal((await call({ f: look }, undefined)).code, 403);
  assert.equal((await call({ f: look }, old)).code, 403);
  const r = await call({ f: look }, good); assert.equal(r.code, 200); assert.equal(r.h['Content-Type'], 'image/jpeg'); assert.match(r.h['Cache-Control'], /private/);
});
test('обложка открыта всем, другие файлы и обход пути нет', async () => {
  const r = await call({ f: 'cover-gallery.jpg' }, undefined); assert.equal(r.code, 200); assert.match(r.h['Cache-Control'], /public/);
  assert.equal((await call({ f: 'cover.jpg' }, undefined)).code, 403);
  assert.equal((await call({ f: '../business.html' }, good)).code, 404);
  assert.equal((await call({ f: '../../vercel.json' }, good)).code, 404);
  assert.equal((await call({ f: 'nope.jpg' }, good)).code, 404);
});
test('голос отдаётся частями для Safari', async () => {
  const r = await call({ f: voice }, good, { range: 'bytes=0-99' }); assert.equal(r.code, 206); assert.equal(r.h['Content-Length'], 100); assert.match(r.h['Content-Range'], /^bytes 0-99\//); assert.equal(r.out.length, 100);
  assert.equal((await call({ f: voice }, undefined, { range: 'bytes=0-99' })).code, 403);
});
