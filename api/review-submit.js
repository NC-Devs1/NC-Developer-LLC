import crypto from 'crypto';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { name, email, company, rating, review } = body || {};
  if (!name || !email || !review) {
    return res.status(400).json({ error: 'Name, email, and review are required.' });
  }

  const secret = process.env.REVIEW_SECRET;
  if (!secret || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Missing env vars: REVIEW_SECRET, EMAIL_USER, or EMAIL_PASS');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const reviewData = {
    id: Date.now().toString(),
    name:    String(name).slice(0, 100),
    email:   String(email).slice(0, 200),
    company: String(company || '').slice(0, 100),
    rating:  String(rating || '5 Stars').slice(0, 20),
    review:  String(review).slice(0, 800),
    date:    new Date().toISOString().split('T')[0],
    initial: String(name).charAt(0).toUpperCase(),
  };

  // Encode review data and sign it
  const encoded = Buffer.from(JSON.stringify(reviewData)).toString('base64url');
  const token = crypto.createHmac('sha256', secret).update(encoded).digest('hex');

  const baseUrl = process.env.SITE_URL || `https://${req.headers.host}`;
  const approveUrl = `${baseUrl}/api/review-action?action=approve&data=${encoded}&token=${token}`;
  const declineUrl = `${baseUrl}/api/review-action?action=decline&data=${encoded}&token=${token}`;

  const starCount = parseInt(reviewData.rating) || 5;
  const stars = '★'.repeat(Math.min(starCount, 5));

  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"NC Developer Reviews" <${process.env.EMAIL_USER}>`,
      to: 'support@nc-devs.com',
      subject: `New Review Pending Approval — ${reviewData.name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background:#F0E6D8;font-family:Arial,sans-serif;">
          <div style="max-width:580px;margin:32px auto;background:#FDF3EC;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="background:linear-gradient(135deg,#2C1A0E,#5C3A1E);padding:28px 32px;">
              <p style="margin:0;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#C8A44A;margin-bottom:8px;">NC – Developer, LLC</p>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">New Review Awaiting Approval</h1>
            </div>
            <div style="padding:32px;">
              <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
                <tr><td style="padding:8px 0;color:#A07858;font-size:13px;width:90px;vertical-align:top;">From</td><td style="padding:8px 0;color:#2C1A0E;font-weight:600;font-size:14px;">${reviewData.name}</td></tr>
                <tr><td style="padding:8px 0;color:#A07858;font-size:13px;vertical-align:top;">Email</td><td style="padding:8px 0;color:#2C1A0E;font-size:14px;">${reviewData.email}</td></tr>
                ${reviewData.company ? `<tr><td style="padding:8px 0;color:#A07858;font-size:13px;vertical-align:top;">Company</td><td style="padding:8px 0;color:#2C1A0E;font-size:14px;">${reviewData.company}</td></tr>` : ''}
                <tr><td style="padding:8px 0;color:#A07858;font-size:13px;vertical-align:top;">Rating</td><td style="padding:8px 0;color:#C8A44A;font-size:20px;">${stars}</td></tr>
                <tr><td style="padding:8px 0;color:#A07858;font-size:13px;vertical-align:top;">Date</td><td style="padding:8px 0;color:#2C1A0E;font-size:14px;">${reviewData.date}</td></tr>
              </table>
              <div style="background:#fff;border-left:4px solid #C8A44A;padding:18px 20px;border-radius:0 8px 8px 0;margin-bottom:32px;">
                <p style="margin:0;color:#2C1A0E;font-size:15px;line-height:1.8;font-style:italic;">"${reviewData.review}"</p>
              </div>
              <p style="color:#8B6040;font-size:13px;margin-bottom:20px;">Approve to publish this review live on the NC Developer website. Decline to discard it.</p>
              <div style="display:flex;gap:12px;">
                <a href="${approveUrl}" style="display:inline-block;background:#C8A44A;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-right:12px;">✅ Approve &amp; Publish</a>
                <a href="${declineUrl}" style="display:inline-block;background:#E8D0C0;color:#6B4F38;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">❌ Decline</a>
              </div>
            </div>
            <div style="background:#EDD8C8;padding:16px 32px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#A07858;">NC – Developer, LLC · Rosedale, Maryland · support@nc-devs.com</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (err) {
    console.error('Email send error:', err);
    return res.status(502).json({ error: 'Failed to send approval email' });
  }

  return res.status(200).json({ success: true });
}
