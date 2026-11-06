// Закрытая Система имиджа: страница и файлы отдаются только с действующим доступом.
// /sistem-image → без параметра f: страница. /guide/business-img/x → f=x: файл.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'private');
// Обложка и превью используются на открытых страницах и в письмах
const PUBLIC_FILE = /^(cover-gallery\.jpg|pv-[1-3]\.jpg)$/;
const SAFE_NAME = /^[\w.-]+\.(jpg|jpeg|png|webp|m4a|mp3)$/i;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', m4a: 'audio/mp4', mp3: 'audio/mpeg' };
const cookieOf = (req) => (String(req.headers.cookie || '').match(/(?:^|;\s*)ms_s=([^;]+)/) || [])[1];

async function hasAccess(req) {
  const { currentSession, getAccess, upstashStore, renewSession, SESSION_DAYS } = await import('../lib/access-core.mjs');
  const secret = process.env.SESSION_SECRET, url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!secret || !url || !token) return { ok: false };
  const store = upstashStore(url, token);
  const { email, replaced } = await currentSession(store, cookieOf(req), secret);
  if (!email) return { ok: false, replaced };
  const a = await getAccess(store, email);
  const fresh = a.active ? await renewSession(store, cookieOf(req), secret) : null;
  return { ok: !!a.active, expired: !a.active && !!a.until, fresh, days: SESSION_DAYS };
}

function sendFile(req, res, file, name, cache) {
  const type = TYPES[name.split('.').pop().toLowerCase()];
  const buf = fs.readFileSync(file);
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', cache);
  // Голос в Safari запрашивается частями
  const m = String(req.headers.range || '').match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const start = m[1] ? +m[1] : Math.max(0, buf.length - +m[2]);
    const end = m[1] && m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
    if (start >= buf.length || start > end) { res.setHeader('Content-Range', `bytes */${buf.length}`); return res.status(416).end(); }
    res.setHeader('Content-Range', `bytes ${start}-${end}/${buf.length}`);
    res.setHeader('Content-Length', end - start + 1);
    res.status(206);
    return res.end(buf.subarray(start, end + 1));
  }
  res.setHeader('Content-Length', buf.length);
  res.status(200);
  return res.end(buf);
}

export default async function handler(req, res) {
  const f = req.query && req.query.f ? String(req.query.f) : '';
  if (f) {
    if (!SAFE_NAME.test(f)) return res.status(404).end();
    const file = path.join(ROOT, 'business-img', f);
    if (!fs.existsSync(file)) return res.status(404).end();
    if (PUBLIC_FILE.test(f)) return sendFile(req, res, file, f, 'public, max-age=86400');
    let a;
    try { a = await hasAccess(req); } catch (e) { console.error('gate: store failed'); return res.status(503).end(); }
    if (!a.ok) return res.status(403).end();
    return sendFile(req, res, file, f, 'private, max-age=86400');
  }
  res.setHeader('Cache-Control', 'no-store');
  let a;
  try { a = await hasAccess(req); } catch (e) { console.error('gate: store failed'); return res.status(503).send('Сервис временно недоступен. Обновите страницу через минуту.'); }
  if (!a.ok) { res.setHeader('Location', a.expired ? '/vhod?expired=1' : a.replaced ? '/vhod?other=1' : '/vhod'); return res.status(302).end(); }
  if (a.fresh) res.setHeader('Set-Cookie', `ms_s=${a.fresh}; Path=/; Max-Age=${a.days * 86400}; HttpOnly; Secure; SameSite=Lax`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(fs.readFileSync(path.join(ROOT, 'business.html'), 'utf8'));
}
