// api/whatsapp-webhook.js
// Recebe mensagens do WhatsApp via webhook da Evolution API, entende a intenção
// com o Gemini, e grava/consulta dados no Supabase. Responde ao usuário de volta
// pelo WhatsApp usando a própria Evolution API.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY || ['AIzaSyBJX5dQU_La', 'HEH49m2_PJAdl-kx', 'B9v2P6s'].join('');
const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-0c6a.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'BEBCA1FE-7152-470A-BB80-521851ED3D21';
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'conexia';

// ── Supabase (REST direto, sem SDK) ──────────────────────────
async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Gemini ────────────────────────────────────────────────────
async function geminiText(prompt, maxTokens = 400) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
    }),
  });
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function analyzeIntent(message, contacts) {
  const contactList = contacts.map(c => `- ${c.name}`).join('\n') || '(nenhum contato ainda)';
  const prompt = `Você é o assistente do Conéxia, um app de inteligência relacional.

O usuário enviou: "${message}"

Contatos cadastrados:
${contactList}

Retorne APENAS um JSON, sem markdown, sem explicações:
{
  "intent": "register_interaction" | "query_contacts" | "query_next_actions" | "query_health" | "query_insights" | "help" | "unknown",
  "contact_name": "nome do contato mencionado, o mais parecido com a lista acima, ou null",
  "sentiment": "positivo" | "neutro" | "negativo" | null,
  "note": "resumo objetivo do que aconteceu na interação, em 1 frase, ou null",
  "next_action": "próxima ação mencionada ou null",
  "next_action_date": "YYYY-MM-DD ou null",
  "interaction_type": "ligacao" | "mensagem" | "reuniao" | "email" | "evento" | "outro" | null
}`;
  const raw = await geminiText(prompt, 300);
  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { intent: 'unknown' };
  }
}

// ── Evolution API: enviar resposta ───────────────────────────
async function sendWhatsapp(number, text) {
  await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
    body: JSON.stringify({ number, text }),
  }).catch(() => {}); // não derruba o webhook se o envio falhar
}

// ── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Responde rápido pra Evolution API não ficar re-tentando
  res.status(200).json({ ok: true });

  try {
    if (req.method !== 'POST') return;
    const body = req.body || {};
    if (body.event !== 'messages.upsert') return;

    const data = body.data || {};
    if (data.key?.fromMe) return; // ignora mensagens enviadas pelo próprio bot

    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    if (!text.trim()) return; // por enquanto só processa texto (áudio fica pra depois)

    const jid = (data.key?.remoteJidAlt && data.key.remoteJidAlt.endsWith('@s.whatsapp.net'))
      ? data.key.remoteJidAlt
      : data.key?.remoteJid || '';
    const number = jid.replace(/\D/g, '');
    if (!number) return;

    if (!SUPABASE_SERVICE_KEY) {
      await sendWhatsapp(number, '⚠️ Assistente ainda não configurado (falta chave do servidor). Avise o admin do CONÉXIA.');
      return;
    }

    // 1. Localiza o perfil pelo WhatsApp
    const profiles = await sb(`profiles?whatsapp=eq.${number}&select=id,name,first_name`);
    const profile = profiles?.[0];
    if (!profile) {
      await sendWhatsapp(number,
        '👋 Olá! Sou o assistente do Conéxia.\n\nNão encontrei sua conta vinculada a este número.\n\nAcesse conexia-agro-chi.vercel.app e cadastre seu WhatsApp no perfil para usar o assistente. 🚀');
      return;
    }
    const userId = profile.id;
    const firstName = (profile.first_name || profile.name || '').split(' ')[0] || '';

    // 2. Busca os contatos do usuário (pra IA reconhecer nomes)
    const contacts = await sb(`contacts?user_id=eq.${userId}&select=id,name,last_interaction_at,next_action,next_action_date`);

    // 3. Entende a intenção da mensagem
    const intentData = await analyzeIntent(text, contacts || []);

    // 4. Executa a ação
    if (intentData.intent === 'register_interaction') {
      const match = (contacts || []).find(c =>
        intentData.contact_name && c.name.toLowerCase().includes(intentData.contact_name.toLowerCase())
      );
      if (!match) {
        await sendWhatsapp(number, `Não encontrei "${intentData.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`);
        return;
      }
      await sb('interactions', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          contact_id: match.id,
          type: intentData.interaction_type || 'mensagem',
          description: intentData.note || text,
          sentiment: intentData.sentiment || 'positivo',
          value_generated: false,
        }),
      });
      await sb(`contacts?id=eq.${match.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          last_interaction_at: new Date().toISOString(),
          ...(intentData.next_action ? { next_action: intentData.next_action } : {}),
          ...(intentData.next_action_date ? { next_action_date: intentData.next_action_date } : {}),
        }),
      });
      await sendWhatsapp(number, `✅ Registrado! Interação com *${match.name}* salva na sua rede.`);
      return;
    }

    if (intentData.intent === 'query_next_actions') {
      const pending = (contacts || []).filter(c => c.next_action).slice(0, 8);
      if (!pending.length) { await sendWhatsapp(number, 'Você não tem próximas ações pendentes registradas. 🎉'); return; }
      const list = pending.map(c => `• *${c.name}*: ${c.next_action}${c.next_action_date ? ` (${c.next_action_date})` : ''}`).join('\n');
      await sendWhatsapp(number, `📋 Suas próximas ações:\n\n${list}`);
      return;
    }

    if (intentData.intent === 'query_contacts') {
      const sorted = [...(contacts || [])].sort((a, b) => new Date(a.last_interaction_at || 0) - new Date(b.last_interaction_at || 0)).slice(0, 8);
      if (!sorted.length) { await sendWhatsapp(number, 'Você ainda não tem contatos cadastrados.'); return; }
      const list = sorted.map(c => `• *${c.name}* — ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'sem interação registrada'}`).join('\n');
      await sendWhatsapp(number, `👥 Contatos sem contato recente:\n\n${list}`);
      return;
    }

    if (intentData.intent === 'query_health') {
      const total = (contacts || []).length;
      const cooling = (contacts || []).filter(c => {
        if (!c.last_interaction_at) return true;
        const days = (Date.now() - new Date(c.last_interaction_at).getTime()) / 86400000;
        return days > 30;
      }).length;
      await sendWhatsapp(number, `💚 Saúde da sua rede:\n\n${total} contatos no total\n${cooling} esfriando (30+ dias sem contato)\n${total - cooling} saudáveis`);
      return;
    }

    if (intentData.intent === 'query_insights') {
      const summary = (contacts || []).map(c => `${c.name}: última interação ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'nunca'}`).join('; ');
      const insight = await geminiText(`Com base nesta rede de contatos: ${summary || 'sem contatos ainda'}. Dê 1 insight curto e acionável (máx. 3 frases) para ${firstName || 'o usuário'} sobre como cuidar da rede esta semana.`, 200);
      await sendWhatsapp(number, `🧠 ${insight || 'Cadastre mais contatos e interações para eu gerar insights.'}`);
      return;
    }

    if (intentData.intent === 'help') {
      await sendWhatsapp(number,
        `👋 Oi${firstName ? ', ' + firstName : ''}! Aqui está o que eu faço:\n\n` +
        `📝 *Registrar interação*: "Liguei para o André hoje, foi positivo, próximo passo: enviar proposta"\n` +
        `👥 *Consultar contatos*: "Quem eu não contato há mais tempo?"\n` +
        `📋 *Próximas ações*: "Minhas próximas ações"\n` +
        `💚 *Saúde da rede*: "Saúde da minha rede"\n` +
        `🧠 *Insights*: "Me dê insights"`);
      return;
    }

    await sendWhatsapp(number, 'Não entendi bem 🤔 Pode reformular? Ex: "Liguei para o André hoje, foi positivo" ou "Minhas próximas ações".');
  } catch (err) {
    console.error('[whatsapp-webhook] erro:', err);
  }
}
