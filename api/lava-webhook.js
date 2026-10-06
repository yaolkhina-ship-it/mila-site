// Пересылка вебхуков Lava в бот клуба на Railway.
// Сервер Lava (Россия) не достаёт до Railway напрямую, а до сайта на Vercel достаёт.
// Тело и заголовок X-Api-Key передаются как есть, проверку ключа делает сам бот.

const BOT_WEBHOOK = 'https://mila-bot-production-14c0.up.railway.app/lava/webhook';

async function readRaw(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('ok');
  }
  try {
    let body = await readRaw(req);
    if (!body && req.body) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const r = await fetch(BOT_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': req.headers['x-api-key'] || '',
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    const text = await r.text();
    return res.status(r.status).send(text);
  } catch (e) {
    return res.status(502).send('bot unreachable');
  }
}
