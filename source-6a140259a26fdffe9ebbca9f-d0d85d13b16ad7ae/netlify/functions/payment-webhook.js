// netlify/functions/payment-webhook.js
// Netlify Function
// Получает уведомление от ЮКассы → отправляет email со ссылкой на гайд

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  try {
    const eventBody = event.body ? JSON.parse(event.body) : {};

    // Проверяем что это успешная оплата
    if (eventBody.event !== 'payment.succeeded') {
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'ignored' }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }

    const payment = eventBody.object;

    // Проверяем подлинность платежа через ЮКасса API
    const isValid = await verifyPayment(payment.id);
    if (!isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid payment' }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }

    // Получаем email покупателя
    const buyerEmail =
      payment.metadata?.email ||
      payment.receipt?.customer?.email ||
      null;

    if (!buyerEmail) {
      console.error('No email found in payment:', payment.id);
      return {
        statusCode: 200,
        body: JSON.stringify({ status: 'no_email' }),
        headers: {
          'Content-Type': 'application/json',
        },
      };
    }

    // Отправляем письмо через Resend
    await sendGuideEmail(buyerEmail, payment.id);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'ok' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };

  } catch (error) {
    console.error('Webhook error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }
};

// Проверка платежа через ЮКасса API
async function verifyPayment(paymentId) {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  const response = await fetch(
    `https://api.yookassa.ru/v3/payments/${paymentId}`,
    {
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  return data.status === 'succeeded';
}

// Отправка письма через Resend
async function sendGuideEmail(email, paymentId) {
  const resendKey = process.env.RESEND_API_KEY;
  const guideUrl = process.env.GUIDE_DOWNLOAD_URL; // ссылка на Google Drive

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL, // например: guide@твойдомен.ru
      to: email,
      subject: 'Ваш гайд — система цветовых сочетаний',
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #2a1535;">
          <h1 style="font-size: 24px; font-weight: normal; margin-bottom: 24px;">
            Спасибо за покупку!
          </h1>
          <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
            Ваш гайд готов к скачиванию. Нажмите кнопку ниже чтобы получить файл.
          </p>
          <a href="${guideUrl}"
             style="display: inline-block; background: #2a1535; color: #f2edf0;
                    padding: 14px 32px; text-decoration: none; font-size: 15px;
                    letter-spacing: 0.05em; margin-bottom: 32px;">
            Скачать гайд
          </a>
          <p style="font-size: 13px; color: #888; line-height: 1.6;">
            Если кнопка не работает, скопируйте ссылку:<br>
            <a href="${guideUrl}" style="color: #888;">${guideUrl}</a>
          </p>
          <p style="font-size: 13px; color: #aaa; margin-top: 32px;">
            Номер платежа: ${paymentId}
          </p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }

  return response.json();
}
