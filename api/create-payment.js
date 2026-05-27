export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Некорректный email' });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  const idempotenceKey = crypto.randomUUID();

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${shopId}:${secretKey}`).toString('base64'),
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotenceKey,
      },
      body: JSON.stringify({
        amount: { value: '1990.00', currency: 'RUB' },
        confirmation: {
          type: 'redirect',
          return_url: 'https://www.milaushakova.com/thank-you',
        },
        description: 'Система цветовых сочетаний',
        metadata: { email },
        receipt: {
          customer: { email },
          items: [{
            description: 'Система цветовых сочетаний',
            quantity: '1',
            amount: { value: '1990.00', currency: 'RUB' },
            vat_code: 1,
            payment_subject: 'commodity',
            payment_mode: 'full_prepayment',
          }],
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('YooKassa error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Ошибка создания платежа' });
    }

    return res.status(200).json({
      confirmationUrl: data.confirmation.confirmation_url,
    });

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Внутренняя ошибка' });
  }
}