import crypto from 'crypto';

const GITHUB_API = 'https://api.github.com';
const REPO = process.env.GITHUB_REPO || 'NC-Devs1/NC-Developer-LLC';
const COLORS = ['gold', 'teal', 'lime'];

export default async function handler(req, res) {
  const { action, data, token } = req.query;

  if (!action || !data || !token) {
    return res.status(400).send(page('Invalid Request', 'Missing required parameters.', '#E85040'));
  }

  const secret = process.env.REVIEW_SECRET;
  if (!secret) {
    return res.status(500).send(page('Server Error', 'Server is misconfigured. Contact support@nc-devs.com.', '#E85040'));
  }

  // Verify HMAC token
  const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
  if (token.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(403).send(page('Invalid Link', 'This approval link is invalid or has already been used.', '#E85040'));
  }

  let reviewData;
  try {
    reviewData = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return res.status(400).send(page('Invalid Data', 'Could not parse review data.', '#E85040'));
  }

  if (action === 'decline') {
    return res.status(200).send(page(
      'Review Declined',
      `The review from <strong>${esc(reviewData.name)}</strong> has been declined and will not appear on the site.`,
      '#A07858'
    ));
  }

  if (action === 'approve') {
    try {
      await publishReview(reviewData);
      return res.status(200).send(page(
        '✅ Review Published!',
        `<strong>${esc(reviewData.name)}'s</strong> review has been approved and committed to the site. It will be live after Vercel finishes deploying (~30 seconds).`,
        '#1EBFA0'
      ));
    } catch (err) {
      console.error('Publish error:', err);
      return res.status(500).send(page('Publish Failed', `Error: ${esc(err.message)}<br><br>Check your GITHUB_TOKEN environment variable.`, '#E85040'));
    }
  }

  return res.status(400).send(page('Unknown Action', 'The action provided is not recognized.', '#E85040'));
}

async function publishReview(reviewData) {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) throw new Error('GITHUB_TOKEN not configured');

  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Fetch current reviews.json from GitHub
  const fileRes = await fetch(`${GITHUB_API}/repos/${REPO}/contents/reviews.json`, { headers });

  let currentReviews = [];
  let sha;

  if (fileRes.ok) {
    const fileData = await fileRes.json();
    sha = fileData.sha;
    currentReviews = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf8'));
  } else if (fileRes.status !== 404) {
    const err = await fileRes.json().catch(() => ({}));
    throw new Error(`GitHub API ${fileRes.status}: ${err.message || 'unknown error'}`);
  }

  // Build new review entry
  const colorIndex = currentReviews.length % COLORS.length;
  const newReview = {
    id:      reviewData.id,
    name:    reviewData.name,
    company: reviewData.company || '',
    rating:  reviewData.rating,
    review:  reviewData.review,
    date:    reviewData.date,
    initial: reviewData.initial || reviewData.name.charAt(0).toUpperCase(),
    color:   COLORS[colorIndex],
  };

  currentReviews.push(newReview);

  // Commit updated reviews.json back to GitHub
  const body = {
    message: `Add approved review from ${reviewData.name} [skip ci]`,
    content: Buffer.from(JSON.stringify(currentReviews, null, 2)).toString('base64'),
    committer: { name: 'NC Developer', email: 'support@nc-devs.com' },
  };
  if (sha) body.sha = sha;

  const commitRes = await fetch(`${GITHUB_API}/repos/${REPO}/contents/reviews.json`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body),
  });

  if (!commitRes.ok) {
    const err = await commitRes.json().catch(() => ({}));
    throw new Error(err.message || `Commit failed with status ${commitRes.status}`);
  }
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function page(title, message, accent) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} — NC Developer</title>
  <style>
    body { margin:0; background:#F0E6D8; font-family:Arial,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#FDF3EC; border-radius:16px; padding:48px 40px; max-width:480px; width:90%; text-align:center; box-shadow:0 4px 32px rgba(0,0,0,0.08); }
    h1 { color:${accent}; margin:0 0 16px; font-size:26px; }
    p { color:#8B6040; line-height:1.75; margin:0 0 28px; font-size:15px; }
    a { display:inline-block; background:#C8A44A; color:#fff; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:700; font-size:14px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://nc-devs.com">← Back to Site</a>
  </div>
</body>
</html>`;
}
