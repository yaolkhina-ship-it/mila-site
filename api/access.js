// Вход по почте и коду, проверка доступа.
// POST /api/access?do=gift-status|gift-open {token}: подарочная ссылка
// POST /api/access?do=code {email} · POST /api/access?do=verify {email, code} · POST /api/access?do=logout · GET /api/access?do=me

async function sendCode(email, code) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Система имиджа <mila@milaushakova.com>', to: email, subject: 'Код для входа: ' + code,
      html: `<p>Ваш код для входа в Систему имиджа:</p><p style="font-size:30px;letter-spacing:6px"><b>${code}</b></p><p>Код действует 10 минут. Если вы не запрашивали его, просто ничего не делайте.</p><p style="font-size:12px;color:#777"><a href="https://www.milaushakova.com/oferta">Договор оферты</a> · <a href="https://www.milaushakova.com/privacy">Политика конфиденциальности</a> · <a href="https://t.me/MilaUshakova_ClubBot?start=support">Поддержка</a><br>ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</p>`,
    }),
  });
  if (!r.ok) throw new Error('mail ' + r.status);
}

const VIDEOS = [{ key: 'watch', title: 'Часовой этикет' }, { key: 'accessories', title: 'Этикет аксессуаров' }, { key: 'perfume', title: 'Парфюмерный этикет' }, { key: 'dresscode', title: 'Дресс-код' }];
const READY = ['watch', 'perfume'];
const cookieOf = (req) => (String(req.headers.cookie || '').match(/(?:^|;\s*)ms_s=([^;]+)/) || [])[1];
const setCookie = (res, val, age) => res.setHeader('Set-Cookie', `ms_s=${val}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const { requestCode, verifyCode, getAccess, currentSession, renewSession, upstashStore, giftStatus, redeemGift, SESSION_DAYS } = await import('../lib/access-core.mjs');
  const secret = process.env.SESSION_SECRET, url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!secret || !url || !token || !process.env.RESEND_API_KEY) return res.status(503).json({ ok: false, error: 'not-configured' });
  const store = upstashStore(url, token), action = req.query.do, body = req.body || {};
  try {
    if (action === 'me' && req.method === 'GET') {
      const { email } = await currentSession(store, cookieOf(req), secret);
      if (!email) return res.status(200).json({ signedIn: false });
      const fresh = await renewSession(store, cookieOf(req), secret);
      if (fresh) setCookie(res, fresh, SESSION_DAYS * 86400);
      return res.status(200).json({ signedIn: true, email, ...(await getAccess(store, email)) });
    }
    if (action === 'videos' && req.method === 'GET') {
      const { email } = await currentSession(store, cookieOf(req), secret);
      const a = email ? await getAccess(store, email) : { active: false, tier: null };
      const premium = a.active && a.tier === 'premium';
      const ids = premium ? (await store.getJson('videos')) || {} : {};
      const items = VIDEOS.map((v) => ({ key: v.key, title: v.title, id: ids[v.key] || null, ready: READY.includes(v.key) }));
      return res.status(200).json({ signedIn: !!email, active: !!a.active, tier: a.tier || null, items });
    }
    if (req.method !== 'POST') return res.status(405).json({ ok: false });
    if (action === 'code') {
      const r = await requestCode(store, body.email, secret, sendCode);
      return res.status(r.ok ? 200 : 400).json(r);
    }
    if (action === 'verify') {
      const r = await verifyCode(store, body.email, body.code, secret);
      if (!r.ok) return res.status(401).json(r);
      setCookie(res, r.session, SESSION_DAYS * 86400);
      return res.status(200).json({ ok: true });
    }
    if (action === 'gift-status' || action === 'gift-open') {
      const { GIFTS } = await import('../lib/gifts.mjs');
      if (action === 'gift-status') return res.status(200).json(await giftStatus(store, body.token, cookieOf(req), secret, GIFTS));
      const r = await redeemGift(store, body.token, cookieOf(req), secret, GIFTS);
      if (!r.ok) return res.status(r.error === 'used' ? 409 : 404).json(r);
      if (r.session) setCookie(res, r.session, r.seconds);
      return res.status(200).json({ ok: true });
    }
    if (action === 'logout') { setCookie(res, '', 0); return res.status(200).json({ ok: true }); }
    return res.status(404).json({ ok: false });
  } catch (e) {
    console.error('access: ' + action + ' failed');
    return res.status(500).json({ ok: false, error: 'server' });
  }
}
