export default async (req) => {
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const { passcode, question, summary } = await req.json().catch(() => ({}));
  if (!process.env.APP_PASSCODE || passcode !== process.env.APP_PASSCODE) return json({ error: 'Wrong or missing passcode.' }, 401);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set in Netlify.' }, 500);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.AI_MODEL || 'claude-sonnet-5-5',
      max_tokens: 1200,
      system: 'You are a collections analyst for an electric utility accounts team in the Philippines. Amounts are in pesos. Collections are counted by the month of the payment date. Be concise and practical. Use only the data given; say so if something is missing.',
      messages: [{ role: 'user', content: `Data summary (JSON):\n${JSON.stringify(summary).slice(0, 20000)}\n\nQuestion: ${String(question || '').slice(0, 1000)}` }]
    })
  });
  const d = await r.json();
  if (!r.ok) return json({ error: d.error?.message || 'AI request failed.' }, 502);
  return json({ text: (d.content || []).map((b) => b.text || '').join('') });
};
