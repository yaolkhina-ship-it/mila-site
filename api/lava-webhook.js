// Пересылка вебхуков Lava в бот клуба на Railway.
// Сервер Lava (Россия) не достаёт до Railway напрямую, а до сайта на Vercel достаёт.
// Запрос пропускаем, если он пришёл с IP Lava (из их документации) или с верным X-Api-Key.
// Ключ для бота берётся из переменной окружения LAVA_WEBHOOK_KEY (в репозитории его нет).

const BOT_WEBHOOK = 'https://mila-bot-production-14c0.up.railway.app/lava/webhook';
const LAVA_IPS = ['158.160.60.174'];

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('ok');
  }
  const key = process.env.LAVA_WEBHOOK_KEY || '';
  const ip = String(req.headers['x-real-ip'] || '').trim();
  const sentKey = String(req.headers['x-api-key'] || '');
  const fromLava = LAVA_IPS.includes(ip);
  console.log(`lava-webhook: ip=${ip} fromLava=${fromLava} keyHeader=${sentKey ? 'yes' : 'no'} keyOk=${!!key && sentKey === key}`);
  if (!key || (!fromLava && sentKey !== key)) {
    return res.status(403).send('forbidden');
  }
  try {
    let body = await readRaw(req);
    if (!body && req.body) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const r = await fetch(BOT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).send('bot unreachable');
  }
}
