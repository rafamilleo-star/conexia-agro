/**
 * api/whatsapp-webhook-twilio.js
 * 
 * BOT WHATSAPP ROBUSTO - TWILIO OFFICIAL
 * ======================================
 * 
 * Solução definitiva para o problema de entrega de mensagens.
 * - Usa Twilio WhatsApp Business API (oficial e confiável)
 * - Mantém 100% da lógica de análise com Gemini
 * - Implementa retry logic com exponential backoff
 * - Monitora todos os eventos em Supabase
 * 
 * Deployment: Vercel
 * Trigger: Twilio Webhook (POST /api/whatsapp-webhook-twilio)
 * 
 * Configuração necessária:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_NUMBER (ex: whatsapp:+5588987654321)
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 * - GEMINI_API_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Twilio credentials
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// ── Supabase REST API ────────────────────────────────────────
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
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`Supabase ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

// ── Logging ──────────────────────────────────────────────────
async function logEvent(event_type, details) {
  try {
    await sb('whatsapp_webhook_raw', {
      method: 'POST',
      body: JSON.stringify({
        raw_payload: {
          event_type,
          ...details,
          timestamp: new Date().toISOString(),
        },
      }),
    });
  } catch (e) {
    console.error('[whatsapp-webhook-twilio] Erro ao logar:', e.message);
  }
}

// ── Gemini: Análise de Intenção ──────────────────────────────
async function analyzeIntent(message, contacts = []) {
  try {
    const contactList = contacts
      .map(c => `- ${c.name}`)
      .join('\n') || '(nenhum contato ainda)';

    const now = new Date();
    const hojeISO = now.toISOString().slice(0, 10);
    const diaSemana = now.toLocaleDateString('pt-BR', { weekday: 'long' });

    const prompt = `Você é o assistente do Conéxia, um CRM de inteligência relacional via WhatsApp.

Hoje é ${diaSemana}, ${hojeISO}.

O usuário enviou: "${message}"

Contatos já cadastrados:
${contactList}

Sua tarefa é entender a intenção. Retorne APENAS um JSON (sem markdown):

{
  "intent": "register_interaction" | "schedule_action" | "query_contacts" | "query_next_actions" | "query_health" | "query_insights" | "help" | "unknown",
  "contact_name": "nome do contato ou null",
  "sentiment": "positivo" | "neutro" | "negativo" | null,
  "note": "resumo da informação (para register_interaction) ou null",
  "next_action": "ação futura (para schedule_action) ou null",
  "next_action_date": "YYYY-MM-DD ou null",
  "interaction_type": "ligacao" | "mensagem" | "reuniao" | "email" | "evento" | "outro" | null
}

Regras:
- register_interaction: algo que JÁ ACONTECEU (passado/presente)
- schedule_action: algo que VAI ACONTECER (futuro)
- Datas em DD/MM são sempre dia/mês (padrão brasileiro)`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.5,
          },
        }),
      }
    );

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!res.ok || !text.trim()) {
      throw new Error(`Gemini ${res.status}`);
    }

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    await logEvent('analyze_intent_success', {
      message: message.slice(0, 100),
      intent: parsed.intent,
      contact_name: parsed.contact_name,
    });

    return parsed;
  } catch (e) {
    await logEvent('analyze_intent_error', {
      message: message.slice(0, 100),
      error: e.message,
    });
    return { intent: 'unknown' };
  }
}

// ── Twilio: Enviar Mensagem com Retry ────────────────────────
async function sendTwilioMessage(toNumber, messageText, retries = 3) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: TWILIO_WHATSAPP_NUMBER,
            To: `whatsapp:${toNumber}`,
            Body: messageText,
          }).toString(),
        }
      );

      const data = await res.json();

      if (res.ok && data.sid) {
        await logEvent('message_sent_success', {
          to_number: toNumber,
          message_id: data.sid,
          attempt,
        });
        return { success: true, messageId: data.sid };
      }

      // Se não foi sucesso, tenta retry
      if (attempt < retries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      // Última tentativa falhou
      await logEvent('message_sent_failed', {
        to_number: toNumber,
        http_status: res.status,
        error: data.message || 'Unknown error',
        attempts: retries,
      });

      return { success: false, error: data.message };
    } catch (e) {
      if (attempt < retries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }

      await logEvent('message_send_exception', {
        to_number: toNumber,
        error: e.message,
        attempts: retries,
      });

      return { success: false, error: e.message };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

// ── Processar Mensagem ───────────────────────────────────────
async function processMessage(fromNumber, messageText, userId) {
  try {
    // 1. Buscar contatos do usuário
    const contacts = await sb(
      `contacts?user_id=eq.${userId}&select=id,name,last_interaction_at,next_action,next_action_date`
    );
    const contactList = Array.isArray(contacts) ? contacts : [];

    // 2. Analisar intenção
    const analysis = await analyzeIntent(messageText, contactList);

    // 3. Processar baseado na intenção
    let responseText = '';

    switch (analysis.intent) {
      case 'register_interaction': {
        const match = contactList.find(
          c => analysis.contact_name && c.name.toLowerCase().includes(analysis.contact_name.toLowerCase())
        );

        if (!match) {
          responseText = `Não encontrei "${analysis.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`;
        } else {
          try {
            await sb('interactions', {
              method: 'POST',
              body: JSON.stringify({
                user_id: userId,
                contact_id: match.id,
                type: analysis.interaction_type || 'mensagem',
                description: analysis.note || messageText,
                sentiment: analysis.sentiment || 'positivo',
                value_generated: false,
              }),
            });

            await sb(`contacts?id=eq.${match.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                last_interaction_at: new Date().toISOString(),
                ...(analysis.next_action ? { next_action: analysis.next_action, next_action_reminded_at: null } : {}),
                ...(analysis.next_action_date ? { next_action_date: analysis.next_action_date } : {}),
              }),
            });

            responseText = `✅ Registrado! Interação com *${match.name}* salva na sua rede.`;
          } catch (e) {
            responseText = `❌ Erro ao registrar. Tente novamente.`;
            await logEvent('register_interaction_error', { error: e.message, contact_id: match.id });
          }
        }
        break;
      }

      case 'schedule_action': {
        const match = contactList.find(
          c => analysis.contact_name && c.name.toLowerCase().includes(analysis.contact_name.toLowerCase())
        );

        if (!match) {
          responseText = `Não encontrei "${analysis.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`;
        } else if (!analysis.next_action) {
          responseText = `Entendi que é uma ação futura, mas não peguei o que precisa ser feito. Pode reformular?`;
        } else {
          try {
            await sb(`contacts?id=eq.${match.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                next_action: analysis.next_action,
                next_action_date: analysis.next_action_date || null,
                next_action_reminded_at: null,
              }),
            });

            const prazo = analysis.next_action_date
              ? ` até *${new Date(analysis.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR')}*`
              : '';

            responseText = `🗓️ Anotado! Próxima ação com *${match.name}*: ${analysis.next_action}${prazo}.`;
          } catch (e) {
            responseText = `❌ Erro ao agendar. Tente novamente.`;
            await logEvent('schedule_action_error', { error: e.message, contact_id: match.id });
          }
        }
        break;
      }

      case 'query_next_actions': {
        const pending = contactList.filter(c => c.next_action).slice(0, 8);
        if (!pending.length) {
          responseText = `Você não tem próximas ações pendentes registradas. 🎉`;
        } else {
          const list = pending
            .map(c => `• *${c.name}*: ${c.next_action}${c.next_action_date ? ` (${c.next_action_date})` : ''}`)
            .join('\n');
          responseText = `📋 Suas próximas ações:\n\n${list}`;
        }
        break;
      }

      case 'query_contacts': {
        if (!contactList.length) {
          responseText = `Você ainda não tem contatos cadastrados.`;
        } else {
          const sorted = [...contactList]
            .sort((a, b) => new Date(a.last_interaction_at || 0) - new Date(b.last_interaction_at || 0))
            .slice(0, 8);
          const list = sorted
            .map(
              c =>
                `• *${c.name}* — ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'sem interação'}`
            )
            .join('\n');
          responseText = `👥 Contatos sem contato recente:\n\n${list}`;
        }
        break;
      }

      case 'query_health': {
        const total = contactList.length;
        const cooling = contactList.filter(c => {
          if (!c.last_interaction_at) return true;
          const days = (Date.now() - new Date(c.last_interaction_at).getTime()) / 86400000;
          return days > 30;
        }).length;
        responseText = `💚 Saúde da sua rede:\n\n${total} contatos no total\n${cooling} esfriando (30+ dias)\n${total - cooling} saudáveis`;
        break;
      }

      case 'query_insights': {
        const summary = contactList
          .map(c => `${c.name}: ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'nunca'}`)
          .join('; ');
        try {
          const insightRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: `Com base nesta rede: ${summary || 'sem contatos'}. Dê 1 insight curto (máx 3 frases) sobre como cuidar da rede esta semana.`,
                      },
                    ],
                  },
                ],
                generationConfig: { maxOutputTokens: 200, temperature: 0.5 },
              }),
            }
          );
          const insightData = await insightRes.json();
          const insight = insightData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          responseText = `🧠 ${insight || 'Cadastre mais contatos para gerar insights.'}`;
        } catch (e) {
          responseText = `🧠 Cadastre mais contatos e interações para gerar insights.`;
        }
        break;
      }

      case 'help': {
        responseText = `👋 Oi! Aqui está o que eu faço:\n\n📝 *Registrar interação*: "Liguei para o André hoje"\n🗓️ *Agendar ação*: "Preciso enviar proposta pro André até sexta"\n👥 *Consultar contatos*: "Quem eu não contato há mais tempo?"\n📋 *Próximas ações*: "Minhas próximas ações"\n💚 *Saúde da rede*: "Saúde da minha rede"\n🧠 *Insights*: "Me dê insights"`;
        break;
      }

      case 'unknown':
      default: {
        responseText = `Não entendi bem 🤔 Pode reformular? Ex: "Liguei para o André hoje" ou "Minhas próximas ações".`;
        break;
      }
    }

    // 4. Enviar resposta via Twilio
    const result = await sendTwilioMessage(fromNumber, responseText);

    return {
      success: result.success,
      intent: analysis.intent,
      response: responseText,
      messageId: result.messageId,
    };
  } catch (e) {
    await logEvent('process_message_error', {
      from_number: fromNumber,
      error: e.message,
    });

    // Enviar mensagem de erro genérica
    await sendTwilioMessage(
      fromNumber,
      '❌ Ocorreu um erro ao processar sua mensagem. Tente novamente.'
    );

    return { success: false, error: e.message };
  }
}

// ── Handler Principal ────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true });
  }

  try {
    const body = req.body || {};

    // Extrair dados da mensagem Twilio
    const fromNumber = body.From?.replace('whatsapp:', '') || '';
    const messageText = body.Body || '';
    const userId = body.UserId || fromNumber; // Usar número como fallback

    if (!fromNumber || !messageText) {
      return res.status(400).json({ error: 'Missing From or Body' });
    }

    await logEvent('message_received', {
      from_number: fromNumber,
      message_preview: messageText.slice(0, 100),
    });

    // Processar mensagem (não aguardar antes de retornar)
    processMessage(fromNumber, messageText, userId).catch(e => {
      console.error('[whatsapp-webhook-twilio] Erro ao processar:', e.message);
    });

    // Retornar imediatamente
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[whatsapp-webhook-twilio] Erro no handler:', e.message);
    await logEvent('handler_error', { error: e.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}
