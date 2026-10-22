// Анкета предзаписи «Системы имиджа» (/predzapis).
// Каждая анкета: контакт в списке Resend «Система имиджа · предзапись»,
// письмо с ответами на yaolkhina@gmail.com и письмо-подтверждение человеку.
// Ключ берётся из переменной окружения RESEND_API_KEY (в репозитории его нет).

const AUDIENCE = '4c017c28-938b-4d09-b852-5090d1f1bc0d';
const NOTIFY_TO = 'yaolkhina@gmail.com';
const FROM = 'Мила Ушакова <mila@milaushakova.com>';

const LABELS = [
  ['name', 'Имя'], ['email', 'E-mail'], ['tg', 'Telegram'], ['sex', 'Для кого образ'],
  ['role', 'Роль'], ['places', 'Где нужен имидж'], ['impression', 'Главное впечатление'],
  ['status', 'Уже со мной'], ['src', 'Откуда'],
];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clip = (v, n = 200) => (Array.isArray(v) ? v.slice(0, 12).map((x) => String(x).slice(0, n)) : String(v || '').trim().slice(0, n));

async function resend(path, body) {
  const r = await fetch('https://api.resend.com' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!r.ok) console.log(`predzapis: resend ${path} ${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.ok;
}

function confirmHtml(name) {
  return `<!doctype html><html><body style="margin:0;background:#111111;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111111;"><tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:12px;letter-spacing:4px;color:#B08F57;text-transform:uppercase;">Система имиджа · предзапись</td></tr>
<tr><td style="padding-top:18px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:34px;line-height:1.1;color:#F4F2EE;text-transform:uppercase;">Вы в списке первых</td></tr>
<tr><td style="padding-top:22px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.7;color:#d9d3c9;">${name ? esc(name) + ', спасибо.' : 'Спасибо.'} Ваша анкета у меня. Приглашение в Систему имиджа придёт на этот адрес в первых числах ноября, раньше, чем откроется общий доступ.</td></tr>
<tr><td style="padding-top:26px;border-bottom:1px solid #B08F57;"></td></tr>
<tr><td style="padding-top:22px;font-family:'Oswald','Arial Narrow',Arial,sans-serif;font-size:14px;letter-spacing:3px;color:#F4F2EE;text-transform:uppercase;">Мила Ушакова</td></tr>
<tr><td style="padding-top:4px;font-family:'Jost',Helvetica,Arial,sans-serif;font-size:13px;color:#8f877b;">Ваш стилист и проводник в мир аутентичного стиля</td></tr>
<tr><td style="padding-top:36px;font-family:Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:#6f685e;">Вы получили это письмо, потому что заполнили анкету предзаписи. <a href="mailto:yaolkhina@gmail.com?subject=Отписаться%20от%20рассылки" style="color:#8f877b;">Отписаться</a><br>
<a href="https://www.milaushakova.com/oferta" style="color:#8f877b;">Договор оферты</a> · <a href="https://www.milaushakova.com/privacy" style="color:#8f877b;">Политика конфиденциальности</a> · <a href="https://t.me/MilaUshakova_ClubBot?start=support" style="color:#8f877b;">Поддержка</a><br>
ИП Ольхина Я.Ф., ИНН 222411003828, ОГРНИП 326220200112474</td></tr>
</table></td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (b.website) return res.status(200).json({ ok: true }); // ловушка для ботов

  const d = {};
  for (const [k] of LABELS) d[k] = clip(b[k]);
  d.email = String(d.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(d.email) || !d.name || !b.consent) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  await resend(`/audiences/${AUDIENCE}/contacts`, { email: d.email, first_name: d.name, unsubscribed: false });

  const rows = LABELS.map(([k, label]) => {
    const v = Array.isArray(d[k]) ? d[k].join(', ') : d[k];
    return `<tr><td style="padding:6px 14px 6px 0;color:#7E7B76;vertical-align:top;">${label}</td><td style="padding:6px 0;">${esc(v || '—')}</td></tr>`;
  }).join('');
  const notified = await resend('/emails', {
    from: 'Система имиджа <mila@milaushakova.com>',
    to: [NOTIFY_TO],
    reply_to: d.email,
    subject: `Предзапись: ${d.name}`,
    html: `<table style="font-family:Helvetica,Arial,sans-serif;font-size:14px;">${rows}</table><p style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#7E7B76;">Согласие на обработку ПД: да, ${new Date().toISOString()}</p>`,
  });
  await resend('/emails', {
    from: FROM,
    to: [d.email],
    subject: 'Вы в списке первых · Система имиджа',
    html: confirmHtml(d.name),
    headers: { 'List-Unsubscribe': '<mailto:yaolkhina@gmail.com?subject=unsubscribe>' },
  });

  console.log(`predzapis: ${d.email} src=${d.src} notified=${notified}`);
  return res.status(200).json({ ok: true });
}
