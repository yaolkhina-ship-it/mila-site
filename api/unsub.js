// Отписка от рассылки Милы Ушаковой: /api/unsub?e=<email>&t=<token>
// GET  — страница с кнопкой «Отписаться» (чтобы почтовые сканеры ссылок никого не отписали сами).
// POST — отписка: контакт в Resend получает unsubscribed=true. Скрипты рассылки
//        (rassylka/unsub_guard.py) читают этот флаг и больше не шлют письма на адрес.
// Почтовые программы (Gmail, Яндекс, Mail.ru) шлют сюда POST по кнопке «Отписаться»
// из заголовка List-Unsubscribe-Post (One-Click).
// t = первые 24 символа HMAC-SHA256(UNSUB_SECRET, "unsub:" + email).

const crypto = require('crypto');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function token(email) {
  return crypto.createHmac('sha256', process.env.UNSUB_SECRET || '').update('unsub:' + email).digest('hex').slice(0, 24);
}

function valid(email, t) {
  if (!process.env.UNSUB_SECRET || !email || !t || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return false;
  const a = Buffer.from(token(email)), b = Buffer.from(String(t));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function unsubscribe(email) {
  const h = { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' };
  const opt = (method, body) => ({ method, headers: h, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
  let r = await fetch('https://api.resend.com/contacts/' + encodeURIComponent(email), opt('PATCH', { unsubscribed: true }));
  if (r.status === 404) r = await fetch('https://api.resend.com/contacts', opt('POST', { email, unsubscribed: true }));
  if (!r.ok) console.log(`unsub: resend ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.ok;
}

function page(title, text, form) {
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)} · Мила Ушакова</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400&family=Jost:wght@300;400&display=swap" rel="stylesheet">
<style>
body{margin:0;min-height:100vh;background:#111;color:#F4F2EE;display:flex;align-items:center;justify-content:center;font-family:'Jost',Helvetica,Arial,sans-serif}
main{max-width:520px;padding:48px 24px}
.k{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:4px;color:#B08F57;text-transform:uppercase}
h1{font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-weight:400;font-size:34px;line-height:1.1;text-transform:uppercase;margin:18px 0 0}
p{font-size:16px;line-height:1.7;color:#d9d3c9;margin:22px 0 0}
button{margin-top:30px;background:#B08F57;color:#0b0b0b;border:0;padding:18px 28px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:15px;letter-spacing:3px;text-transform:uppercase;cursor:pointer;width:100%}
.d{margin-top:28px;font-size:11px;color:#6f685e}.d a{color:#8f877b}
.s{margin-top:34px;border-top:1px solid #B08F57;padding-top:20px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:3px;text-transform:uppercase}
</style></head><body><main><div class="k">Рассылка Милы Ушаковой</div><h1>${esc(title)}</h1><p>${text}</p>${form || ''}<div class="s">Мила Ушакова</div><div class="d"><a href="/oferta">Оферта</a> · <a href="/privacy">Конфиденциальность</a> · <a href="https://t.me/MilaUshakova_ClubBot?start=support">Поддержка</a> · ИП Ольхина Я.Ф.</div></main></body></html>`;
}

module.exports = async (req, res) => {
  const q = req.query || {};
  const email = String(q.e || '').trim().toLowerCase();
  const t = String(q.t || '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (!valid(email, t)) {
    return res.status(400).send(page('Ссылка не сработала',
      'Напишите, пожалуйста, на <a style="color:#B08F57" href="mailto:yaolkhina@gmail.com?subject=Отписаться">yaolkhina@gmail.com</a> с адреса, на который приходят письма, и мы отпишем вас вручную.'));
  }

  if (req.method === 'POST') {
    const ok = await unsubscribe(email);
    if (!ok) {
      return res.status(502).send(page('Не получилось',
        'Попробуйте ещё раз через минуту или напишите на <a style="color:#B08F57" href="mailto:yaolkhina@gmail.com?subject=Отписаться">yaolkhina@gmail.com</a>.'));
    }
    return res.status(200).send(page('Вы отписаны',
      `Письма на ${esc(email)} больше не придут. Спасибо, что были с нами.`));
  }

  return res.status(200).send(page('Отписаться от писем?',
    `Адрес ${esc(email)} больше не будет получать письма Милы Ушаковой.`,
    `<form method="post" action="/api/unsub?e=${encodeURIComponent(email)}&t=${esc(t)}"><button type="submit">Отписаться</button></form>`));
};
