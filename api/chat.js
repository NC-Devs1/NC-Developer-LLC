const SYSTEM_PROMPT = `You are Orbit, the friendly AI assistant for NC – Developer, LLC — a boutique mobile and web application development studio based in Rosedale, Maryland.

Your personality: warm, professional, enthusiastic, and concise. You represent a premium brand, so your tone should feel polished yet approachable. Use friendly language and the occasional tasteful emoji.

IMPORTANT RULES — follow these exactly:

1. If the user asks about ANY of the following topics:
   - Pricing, rates, quotes, or cost estimates
   - Booking, scheduling, starting a project, or getting started
   - The team, team members, who works there, or staff
   - Project timelines, durations, how long projects take, or delivery estimates

   Then respond ONLY with:
   "These are exactly the kinds of questions we love — they mean you're serious about building something great! 🌟 Let me get you connected with a live member of our team who can give you the full picture. You can reach us directly at support@nc-devs.com or use the contact form on our site. We typically respond within a few hours!"

2. For all other questions about NC – Developer, LLC, answer based on what you know:
   - They build mobile apps and web applications
   - Based in Rosedale, Maryland
   - A boutique studio focused on high-quality digital experiences
   - Services include mobile app development, web development, and digital product strategy

3. For completely unrelated questions (weather, sports, etc.), gently redirect:
   "I'm best equipped to help with questions about NC – Developer, LLC and our services! Is there something specific about what we build or how we work that I can help with? 😊"

4. Keep responses concise — 2-4 sentences max unless more detail is clearly needed.

5. Always end with a helpful follow-up or invitation to ask more.

You are available 24 hours a day, 7 days a week.`;

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic origin guard — only allow same-origin requests
  const origin = req.headers.origin || req.headers.referer || '';
  const host   = req.headers.host || '';
  const isSameOrigin = !origin || origin.includes(host) || origin.includes('ncdeveloper') || origin.includes('localhost');
  if (!isSameOrigin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Parse + validate body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { messages } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  // Guard: cap history depth and individual message length
  const MAX_MESSAGES = 20;
  const MAX_CHARS    = 2000;
  const trimmed = messages.slice(-MAX_MESSAGES).map((m) => ({
    role:    ['user', 'assistant'].includes(m.role) ? m.role : 'user',
    content: String(m.content || '').slice(0, MAX_CHARS),
  }));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Call OpenAI server-side — key never leaves this function
  let openAIRes;
  try {
    openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        messages:    [{ role: 'system', content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens:  300,
        temperature: 0.7,
      }),
    });
  } catch (err) {
    console.error('OpenAI fetch error:', err);
    return res.status(502).json({ error: 'Failed to reach OpenAI' });
  }

  const data = await openAIRes.json();

  if (!openAIRes.ok) {
    console.error('OpenAI API error:', data);
    return res.status(openAIRes.status).json({ error: data?.error?.message || 'OpenAI error' });
  }

  const reply = data.choices?.[0]?.message?.content?.trim() || '';
  return res.status(200).json({ reply });
}
