export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Log assíncrono no Supabase (mesmo padrão de api/whatsapp-webhook.js).
  // Nunca bloqueia nem derruba a resposta ao usuário — só registra pra diagnóstico.
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  const logDebug = async (row) => {
    if (!SUPABASE_SERVICE_KEY) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/ai_debug_log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(row),
      });
    } catch (_) { /* logging nunca deve derrubar a resposta principal */ }
  };

  try {
    const { prompt, maxTokens, thinkingBudget } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    // Por padrão desligamos o "pensamento" do Gemini 2.5 Flash (thinkingBudget: 0).
    // Todos os usos atuais deste endpoint pedem saída em JSON puro, onde o thinking
    // só consome tokens do orçamento sem melhorar o resultado. Se no futuro algum
    // caso precisar de raciocínio mais profundo, basta enviar thinkingBudget no body
    // da requisição (ex: { thinkingBudget: 1024 }) para sobrescrever esse padrão.
    const effectiveThinkingBudget = typeof thinkingBudget === 'number' ? thinkingBudget : 0;

    // A chave SEMPRE vem de variável de ambiente do Vercel — sem fallback hardcoded.
    // Se isso disparar, é sinal de que GEMINI_API_KEY não está configurada/correta no Vercel.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada nas variáveis de ambiente do Vercel.' });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens || 1024,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: effectiveThinkingBudget },
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      await logDebug({
        endpoint: 'claude.js',
        ok: false,
        http_status: geminiRes.status,
        finish_reason: null,
        text_length: 0,
        prompt_preview: String(prompt).slice(0, 300),
        response_preview: JSON.stringify(geminiData).slice(0, 500),
        raw_gemini: geminiData,
      });
      return res.status(geminiRes.status).json(geminiData);
    }

    // Normaliza para o mesmo formato que o app espera: { content: [{ text }] }
    const candidate = geminiData?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text || '';
    const finishReason = candidate?.finishReason || null;

    await logDebug({
      endpoint: 'claude.js',
      ok: true,
      http_status: 200,
      finish_reason: finishReason,
      text_length: text.length,
      prompt_preview: String(prompt).slice(0, 300),
      response_preview: text.slice(0, 500) || JSON.stringify(geminiData).slice(0, 500),
      raw_gemini: geminiData,
    });

    return res.status(200).json({ content: [{ text }], finishReason });

  } catch (error) {
    await logDebug({
      endpoint: 'claude.js',
      ok: false,
      http_status: 500,
      finish_reason: 'exception',
      text_length: 0,
      prompt_preview: '',
      response_preview: error.message,
      raw_gemini: null,
    });
    return res.status(500).json({ error: error.message });
  }
}
