// Уведомление Prodamus об оплате: проверяем подпись и записываем доступ.
// Секреты только в переменных окружения Vercel. Без верной подписи доступ не открывается.
import { applyPayment, verifySign, unflatten, upstashStore } from '../lib/access-core.mjs';

export const config = { api: { bodyParser: false } };

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export function parseBody(raw, contentType) {
  const ct = String(contentType || '');
  if (ct.includes('application/json')) return JSON.parse(raw);
  const flat = {};
  if (ct.includes('multipart/form-data')) {
    const boundary = (ct.match(/boundary="?([^";]+)"?/) || [])[1];
    if (!boundary) return {};
    for (const part of raw.split('--' + boundary)) {
      const m = part.match(/name="([^"]+)"[^\r\n]*\r?\n(?:[^\r\n]+\r?\n)*\r?\n([\s\S]*?)\r?\n?$/);
      if (m) flat[m[1]] = m[2];
    }
    return unflatten(flat);
  }
  for (const [k, v] of new URLSearchParams(raw)) flat[k] = v;
  return unflatten(flat);
}

async function sendWelcome(email, access) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const until = new Date(access.until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Система имиджа <mila@milaushakova.com>',
      to: email,
      subject: 'Ваш доступ к Системе имиджа',
      html: `<p>Оплата получена. Доступ открыт до ${until}.</p><p><a href="https://www.milaushakova.com/vhod">Открыть Систему имиджа</a></p><p>Войдите с почтой, которую указали при оплате: на неё придёт код.</p><p style="font-size:12px;color:#777"><a href="https://www.milaushakova.com/oferta">Договор оферты</a> · <a href="https://www.milaushakova.com/privacy">Политика конфиденциальности</a> · <a href="https://t.me/MilaUshakova_ClubBot?start=support">Поддержка</a><br>ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</p>`,
    }),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('ok');
  const secret = process.env.PRODAMUS_SECRET, url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!secret || !url || !token) { console.error('prodamus: not configured'); return res.status(503).send('not configured'); }
  const raw = await readRaw(req);
  let data;
  try { data = parseBody(raw, req.headers['content-type']); } catch (e) { return res.status(400).send('bad body'); }
  const sign = req.headers['sign'] || req.headers['Sign'];
  const signed = data && typeof data.submit === 'object' ? data.submit : data;
  // В журнал только служебное: ни почты, ни телефона
  console.log('prodamus: fields=' + Object.keys(data || {}).sort().join(',') + ' signPresent=' + !!sign);
  if (!verifySign(signed, sign, secret) && !verifySign(data, sign, secret)) {
    console.warn('prodamus: signature mismatch');
    return res.status(401).send('signature incorrect');
  }
  try {
    const r = await applyPayment(upstashStore(url, token), data);
    console.log('prodamus: result=' + (r.skipped || r.error || 'granted'));
    if (r.access && r.email) await sendWelcome(r.email, r.access).catch((e) => console.error('prodamus: mail failed'));
    return res.status(200).send('success');
  } catch (e) {
    console.error('prodamus: store failed'); // 500: Prodamus повторит уведомление
    return res.status(500).send('error');
  }
}
