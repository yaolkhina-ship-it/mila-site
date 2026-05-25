import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const event = req.body;

    if (event.event === 'payment.succeeded') {
      const customerEmail = event.object?.metadata?.email || 
                           event.object?.receipt?.customer?.email;

      if (customerEmail) {
        await resend.emails.send({
          from: 'Мила Ушакова <stylefromila@gmail.com>',
          to: customerEmail,
          subject: 'Ваш гайд — Система цветовых сочетаний',
          html: `
            <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #2a1535;">
              <h1 style="font-size: 24px; margin-bottom: 20px;">Спасибо за покупку!</h1>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Ваш гайд <strong>«Система цветовых сочетаний»</strong> готов. 
                Нажмите кнопку ниже чтобы скачать:
              </p>
              <a href="${process.env.GUIDE_DOWNLOAD_URL}" 
                 style="background: #c97184; color: white; padding: 14px 32px; 
                        text-decoration: none; border-radius: 4px; font-size: 16px;">
                Скачать гайд
              </a>
              <p style="font-size: 13px; color: #888; margin-top: 40px;">
                С любовью, Мила Ушакова
              </p>
            </div>
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
