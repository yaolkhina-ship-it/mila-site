import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const event = req.body;

    if (event.event === 'payment.succeeded') {
      const customerEmail =
        event.object?.metadata?.email ||
        event.object?.receipt?.customer?.email ||
        event.object?.payment_method?.saved_to?.customer?.email;

      if (customerEmail) {
        await resend.emails.send({
          from: 'Мила Ушакова <stylefromila@gmail.com>',
          to: customerEmail,
          subject: '✨ Ваш гайд — Система цветовых сочетаний',
          html: `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#1a0d20;font-family:'Georgia',serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0d20;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <tr>
            <td align="center" style="padding-bottom:32px;">
              <p style="margin:0;color:#d4a574;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Мила Ушакова</p>
            </td>
          </tr>

          <tr><td><div style="height:1px;background:linear-gradient(to right,transparent,#c97184,transparent);margin-bottom:40px;"></div></td></tr>

          <tr>
            <td style="background:#2a1535;border-radius:12px;padding:48px 40px;">

              <p style="margin:0 0 16px;color:#d4a574;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;text-align:center;">Эксклюзивная система</p>

              <h1 style="margin:0 0 40px;color:#ffffff;font-size:28px;font-weight:400;line-height:1.3;text-align:center;">Система цветовых сочетаний</h1>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Много лет индустрия убеждала женщин в очень удобной для себя мысли: чтобы выглядеть дорого — нужно покупать дорого. И какое-то время мы действительно верили, что статус в логотипе, в бирке, в количестве нулей после цены.</p>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Чем больше я работаю и анализирую, тем яснее понимаю: самые привлекательные люди редко выглядят так, будто потратили огромные средства на образ. Они выглядят гармонично, уверенно, без блуждающего взгляда в поисках одобрения.</p>

              <p style="margin:0 0 32px;color:#d4a574;font-size:16px;line-height:1.8;font-style:italic;text-align:center;">Они точно знают о себе что-то, чего не знают другие.</p>

              <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.8;">Не фасон делает лицо свежим в семь утра.</p>
              <p style="margin:0 0 8px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.8;">Не бренд убирает усталость из взгляда.</p>
              <p style="margin:0 0 32px;color:rgba(255,255,255,0.7);font-size:15px;line-height:1.8;">Не тренд создаёт ощущение внутренней собранности.</p>

              <p style="margin:0 0 32px;color:#c97184;font-size:20px;text-align:center;">Это делает цвет!</p>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Цвет — это первое, за чем мы тянемся выбирая одежду для своего дня.</p>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Сегодня мода дала нам абсолютную свободу! Масс-маркет может выглядеть роскошно. Люкс может выглядеть скучно. Винтаж — актуально. Базовый гардероб — дорого. Даже простая белая футболка иногда производит больше впечатления, чем сложный стилизованный образ.</p>

              <p style="margin:0 0 32px;color:#d4a574;font-size:16px;font-style:italic;text-align:center;">Правил больше нет… Остался только вопрос вашего любопытства понять свой стиль.</p>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Этот материал я создавала не для того, чтобы научить вас «правильно одеваться». Мне намного интереснее научить вас видеть.</p>

              <p style="margin:0 0 20px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;"><strong style="color:#ffffff;">Смотрите!</strong> Вот те цвета, что делают вас смелее, мягче, увереннее, моложе, спокойнее.</p>

              <p style="margin:0 0 40px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.8;">Если после этих страниц вы перестанете покупать вещи только потому, что они «в моде», и начнёте выбирать то, что нужно именно вам — значит, всё не зря! Добро пожаловать!</p>

              <div style="height:1px;background:linear-gradient(to right,transparent,#c97184,transparent);margin-bottom:40px;"></div>

              <p style="margin:0 0 24px;color:rgba(255,255,255,0.7);font-size:15px;text-align:center;">Нажмите кнопку чтобы скачать ваш гайд:</p>

              <div style="text-align:center;">
                <a href="${process.env.GUIDE_DOWNLOAD_URL}" style="display:inline-block;background:#c97184;color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:4px;font-size:13px;letter-spacing:0.15em;text-transform:uppercase;">Скачать гайд</a>
              </div>

            </td>
          </tr>

          <tr><td><div style="height:1px;background:linear-gradient(to right,transparent,#c97184,transparent);margin:40px 0;"></div></td></tr>

          <tr>
            <td align="center">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:12px;">С теплом к вам,</p>
              <p style="margin:0 0 16px;color:#d4a574;font-size:16px;font-style:italic;">Мила</p>
              <p style="margin:0;color:rgba(255,255,255,0.2);font-size:10px;letter-spacing:0.1em;">milaushakova.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}