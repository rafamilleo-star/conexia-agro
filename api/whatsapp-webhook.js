// api/whatsapp-webhook.js - VERSÃO CORRIGIDA COM TWILIO (sem secrets hardcoded)
// Recebe mensagens do WhatsApp via webhook (Evolution API ou Twilio)
// Analisa intenção com Gemini, grava no Supabase, responde via Twilio

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// TWILIO CREDENTIALS — vêm SEMPRE das variáveis de ambiente (sem fallback hardcoded)
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

// EVOLUTION API CREDENTIALS — canal antigo, mantido em paralelo ao Twilio
const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-0c6a.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY;
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
async function geminiTextRaw(prompt, maxTokens = 400) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });
    const data = await res.json().catch(() => null);
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return { text, status: res.status, ok: res.ok, raw: data };
  } catch (e) {
    return { text: '', status: 0, ok: false, raw: { fetchError: e.message } };
  }
}

async function geminiText(prompt, maxTokens = 400) {
  const r = await geminiTextRaw(prompt, maxTokens);
  return r.text;
}

// ── Debug: grava um registro em whatsapp_webhook_raw pra diagnóstico ──
async function logDebug(payload) {
  try {
    await sb('whatsapp_webhook_raw', {
      method: 'POST',
      body: JSON.stringify({ raw_payload: payload }),
    });
  } catch (e) {
    console.error('[whatsapp-webhook] falha ao logar debug:', e.message);
  }
}

async function analyzeIntent(message, contacts) {
  const contactList = contacts.map(c => `- ${c.name}`).join('\n') || '(nenhum contato ainda)';
  const now = new Date();
  const hojeISO = now.toISOString().slice(0, 10);
  const diaSemana = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const prompt = `Você é o assistente do Conéxia, um CRM de inteligência relacional via WhatsApp.

Hoje é ${diaSemana}, ${hojeISO} (use isso como referência pra calcular datas relativas como "segunda que vem", "sexta", "daqui 2 semanas" etc.).

O usuário enviou: "${message}"

Contatos já cadastrados na rede dele:
${contactList}

Sua tarefa é entender a intenção, mesmo que a frase seja informal, incompleta ou não siga um padrão fixo.
Um CRM de verdade não só registra o que já aconteceu — também precisa capturar o que ainda vai acontecer,
com prazo. Por isso existem duas intenções distintas para isso, e é essencial não confundi-las:

REGISTER_INTERACTION — use quando o usuário está relatando/registrando algo que JÁ ACONTECEU ou que ele já
sabe sobre um contato (passado ou fato presente, não uma tarefa futura). Vale tanto pra relatos
("liguei pro André, foi ótimo") quanto pra comandos diretos ("cadastra que o André foi promovido",
"anota que falei com a Bia sobre o projeto X"). Se o usuário mencionar um contato + alguma informação/
novidade/assunto sobre ele, é register_interaction — mesmo sem palavras como "liguei" ou "conversei".
Extraia o "note" resumindo a informação central.

SCHEDULE_ACTION — use quando o usuário está pedindo pra ANOTAR/AGENDAR/MARCAR/LEMBRAR algo que ELE AINDA
PRECISA FAZER no futuro em relação a um contato, com ou sem prazo. Isso vale tanto pra relatos em 1ª pessoa
("preciso mandar a proposta pro Carlos até sexta", "tenho que ligar pra Ana semana que vem", "me lembra de
enviar fotos pro Rafael Vicentini na segunda") quanto pra COMANDOS DIRETOS/IMPERATIVOS, que são o jeito mais
comum das pessoas pedirem isso num CRM ("agenda uma ligação para o Caio Santilli na segunda-feira dia 06/07",
"marca uma reunião com a Bia pra quinta", "agenda um follow-up com o Bruno semana que vem", "cria um lembrete
pra ligar pro André amanhã"). Verbos como "agenda", "agende", "marca", "marque", "cria um lembrete", "cadastra
uma ação/tarefa/ligação/reunião" indicando algo que vai acontecer no futuro SEMPRE são schedule_action, mesmo
sem "eu preciso" — o sinal é a ação estar no futuro (ainda não aconteceu), não a pessoa gramatical do verbo.
Nada aconteceu ainda — não é um relato do passado. Extraia "next_action" (o que precisa ser feito, resumido,
incluindo o tipo se mencionado — ex: "Ligação agendada" ou "Reunião agendada") e "next_action_date" (formato
YYYY-MM-DD). Datas explícitas no formato DD/MM ou DD/MM/AAAA são sempre dia/mês (padrão brasileiro, nunca
mês/dia). Se vier só DD/MM sem ano, assuma o ano corrente ou o próximo se a data já passou este ano.

Regra de desambiguação: se a mensagem descreve algo que JÁ ACONTECEU ou é um fato já conhecido → register_interaction.
Se descreve algo que ainda VAI acontecer (tem data futura, ou é um compromisso/tarefa a fazer) → schedule_action,
mesmo que a frase comece com um verbo de comando como "agenda", "cadastra" ou "marca".

Outras intenções:
- query_contacts: perguntas sobre quem ele não fala há tempo, lista de contatos, etc.
- query_next_actions: perguntas sobre tarefas/próximos passos pendentes já cadastrados.
- query_health: perguntas sobre a saúde geral da rede.
- query_insights: pedidos de insight, dica, análise geral.
- help: pede ajuda, não sabe o que o assistente faz.
- unknown: só use se a mensagem realmente não tiver relação nenhuma com networking/contatos (ex: só "oi", saudação vazia sem contexto).

Retorne APENAS um JSON, sem markdown, sem explicações:
{
  "intent": "register_interaction" | "schedule_action" | "query_contacts" | "query_next_actions" | "query_health" | "query_insights" | "help" | "unknown",
  "contact_name": "nome do contato mencionado, o mais parecido possível com algum da lista acima, ou null",
  "sentiment": "positivo" | "neutro" | "negativo" | null,
  "note": "resumo objetivo da informação/assunto tratado (para register_interaction), em 1 frase, ou null",
  "next_action": "o que precisa ser feito no futuro, resumido, ou null",
  "next_action_date": "YYYY-MM-DD calculada a partir de hoje, ou null se não houver prazo",
  "interaction_type": "ligacao" | "mensagem" | "reuniao" | "email" | "evento" | "outro" | null
}`;
  const g = await geminiTextRaw(prompt, 500);
  try {
    if (!g.ok) throw new Error(`Gemini HTTP ${g.status}: ${JSON.stringify(g.raw).slice(0, 500)}`);
    const cleaned = g.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!cleaned) throw new Error('Gemini retornou texto vazio');
    const parsed = JSON.parse(cleaned);
    await logDebug({ debug: 'analyzeIntent_ok', message, intent: parsed.intent, contact_name: parsed.contact_name, next_action: parsed.next_action, next_action_date: parsed.next_action_date });
    return parsed;
  } catch (e) {
    await logDebug({ debug: 'analyzeIntent_fail', message, error: e.message, geminiStatus: g.status, geminiRawText: g.text?.slice(0, 800), geminiRawResponse: g.raw });
    return { intent: 'unknown' };
  }
}

// ── TWILIO: enviar resposta ───────────────────────────────────
async function sendWhatsappTwilio(number, text) {
  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      console.error('[whatsapp-webhook] Twilio não configurado (faltam TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).');
      await logDebug({ debug: 'send_whatsapp_no_config', channel: 'twilio', number, textPreview: text?.slice(0, 120) });
      return;
    }
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
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
          To: `whatsapp:${number}`,
          Body: text,
        }).toString(),
      }
    );
    const data = await res.json();
    await logDebug({
      debug: res.ok ? 'send_whatsapp_ok' : 'send_whatsapp_fail',
      channel: 'twilio',
      number,
      httpStatus: res.status,
      messageSid: data.sid || null,
      error: data.message || null,
      textPreview: text?.slice(0, 120),
    });
    if (!res.ok) {
      console.error('[whatsapp-webhook] falha ao enviar resposta:', res.status, data.message);
    }
  } catch (e) {
    await logDebug({ debug: 'send_whatsapp_error', channel: 'twilio', number, error: e.message, textPreview: text?.slice(0, 120) });
    console.error('[whatsapp-webhook] erro ao enviar resposta:', e.message);
  }
}

// ── EVOLUTION API: enviar resposta (canal antigo, mantido em paralelo) ──
async function sendWhatsappEvolution(number, text) {
  try {
    if (!EVO_KEY) {
      console.error('[whatsapp-webhook] Evolution API não configurada (falta EVOLUTION_API_KEY).');
      await logDebug({ debug: 'send_whatsapp_no_config', channel: 'evolution', number, textPreview: text?.slice(0, 120) });
      return;
    }
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    });
    const bodyText = await res.text().catch(() => '');
    await logDebug({
      debug: res.ok ? 'send_whatsapp_ok' : 'send_whatsapp_fail',
      channel: 'evolution',
      number,
      httpStatus: res.status,
      error: res.ok ? null : bodyText?.slice(0, 300),
      textPreview: text?.slice(0, 120),
    });
    if (!res.ok) {
      console.error('[whatsapp-webhook] evolution: falha ao enviar resposta:', res.status, bodyText);
    }
  } catch (e) {
    await logDebug({ debug: 'send_whatsapp_error', channel: 'evolution', number, error: e.message, textPreview: text?.slice(0, 120) });
    console.error('[whatsapp-webhook] evolution: erro ao enviar resposta:', e.message);
  }
}

// Gera as variações possíveis do número (com/sem o 9º dígito, comum no Brasil)
function waVariants(num) {
  const cc = num.slice(0, 2), ddd = num.slice(2, 4), rest = num.slice(4);
  const set = new Set([num]);
  if (rest.length === 9 && rest[0] === '9') set.add(cc + ddd + rest.slice(1));
  if (rest.length === 8) set.add(cc + ddd + '9' + rest);
  return [...set];
}

// ── Lógica de negócio compartilhada ───────────────────────────
// Usada tanto pelo Twilio quanto pela Evolution API — só muda a função de envio.
async function handleIncomingMessage(number, text, sendReply) {
  if (!SUPABASE_SERVICE_KEY) {
    await sendReply(number, '⚠️ Assistente ainda não configurado (falta chave do servidor). Avise o admin do CONÉXIA.');
    return;
  }

  const variants = waVariants(number);

  // 1. Localiza o perfil pelo WhatsApp
  const profiles = await sb(`profiles?whatsapp=in.(${variants.join(',')})&select=id,name,first_name,is_pro,plan,pro_expires_at,created_at`);
  const profile = profiles?.[0];
  if (!profile) {
    await sendReply(number,
      '👋 Olá! Sou o assistente do Conéxia.\n\nNão encontrei sua conta vinculada a este número.\n\nAcesse conexia-agro-chi.vercel.app e cadastre seu WhatsApp no perfil para usar o assistente. 🚀');
    return;
  }
  const userIdProfile = profile.id;
  const firstName = (profile.first_name || profile.name || '').split(' ')[0] || '';

  // 1.1 Checa se é PRO
  const isPro = !!profile.is_pro || (profile.plan === 'pro' && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date()));

  // 1.2 Usuário Free: assistente liberado só nas primeiras 4 semanas
  if (!isPro) {
    const diasDesdeCadastro = profile.created_at
      ? (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
      : 0;
    if (diasDesdeCadastro > 28) {
      await sendReply(number,
        `👋 Oi${firstName ? ' ' + firstName : ''}! Seu período gratuito do assistente de WhatsApp (4 semanas) terminou.\n\nPra continuar usando o CONÉXIA por aqui, faça upgrade pro PRO (R$39,90/mês): acesse conexia-agro-chi.vercel.app e ative seu plano. 🚀`);
      return;
    }
  }

  // 2. Busca os contatos do usuário
  const contacts = await sb(`contacts?user_id=eq.${userIdProfile}&select=id,name,last_interaction_at,next_action,next_action_date`);

  // 3. Entende a intenção da mensagem
  const intentData = await analyzeIntent(text, contacts || []);

  // 4. Executa a ação
  if (intentData.intent === 'register_interaction') {
    const match = (contacts || []).find(c =>
      intentData.contact_name && c.name.toLowerCase().includes(intentData.contact_name.toLowerCase())
    );
    if (!match) {
      await sendReply(number, `Não encontrei "${intentData.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`);
      return;
    }
    await sb('interactions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userIdProfile,
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
        ...(intentData.next_action ? { next_action: intentData.next_action, next_action_reminded_at: null } : {}),
        ...(intentData.next_action_date ? { next_action_date: intentData.next_action_date } : {}),
      }),
    });
    await sendReply(number, `✅ Registrado! Interação com *${match.name}* salva na sua rede.`);
    return;
  }

  if (intentData.intent === 'schedule_action') {
    const match = (contacts || []).find(c =>
      intentData.contact_name && c.name.toLowerCase().includes(intentData.contact_name.toLowerCase())
    );
    if (!match) {
      await sendReply(number, `Não encontrei "${intentData.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`);
      return;
    }
    if (!intentData.next_action) {
      await sendReply(number, 'Entendi que é uma ação futura, mas não peguei o que precisa ser feito. Pode reformular? Ex: "Preciso enviar a proposta pro Carlos até sexta".');
      return;
    }
    await sb(`contacts?id=eq.${match.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        next_action: intentData.next_action,
        next_action_date: intentData.next_action_date || null,
        next_action_reminded_at: null,
      }),
    });
    const prazo = intentData.next_action_date
      ? ` até *${new Date(intentData.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR')}*`
      : '';
    await sendReply(number, `🗓️ Anotado! Próxima ação com *${match.name}*: ${intentData.next_action}${prazo}.${intentData.next_action_date ? '\n\nTe aviso por aqui quando chegar o dia.' : ''}`);
    return;
  }

  if (intentData.intent === 'query_next_actions') {
    const pending = (contacts || []).filter(c => c.next_action).slice(0, 8);
    if (!pending.length) { await sendReply(number, 'Você não tem próximas ações pendentes registradas. 🎉'); return; }
    const list = pending.map(c => `• *${c.name}*: ${c.next_action}${c.next_action_date ? ` (${c.next_action_date})` : ''}`).join('\n');
    await sendReply(number, `📋 Suas próximas ações:\n\n${list}`);
    return;
  }

  if (intentData.intent === 'query_contacts') {
    const sorted = [...(contacts || [])].sort((a, b) => new Date(a.last_interaction_at || 0) - new Date(b.last_interaction_at || 0)).slice(0, 8);
    if (!sorted.length) { await sendReply(number, 'Você ainda não tem contatos cadastrados.'); return; }
    const list = sorted.map(c => `• *${c.name}* — ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'sem interação registrada'}`).join('\n');
    await sendReply(number, `👥 Contatos sem contato recente:\n\n${list}`);
    return;
  }

  if (intentData.intent === 'query_health') {
    const total = (contacts || []).length;
    const cooling = (contacts || []).filter(c => {
      if (!c.last_interaction_at) return true;
      const days = (Date.now() - new Date(c.last_interaction_at).getTime()) / 86400000;
      return days > 30;
    }).length;
    await sendReply(number, `💚 Saúde da sua rede:\n\n${total} contatos no total\n${cooling} esfriando (30+ dias sem contato)\n${total - cooling} saudáveis`);
    return;
  }

  if (intentData.intent === 'query_insights') {
    const summary = (contacts || []).map(c => `${c.name}: última interação ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'nunca'}`).join('; ');
    const insight = await geminiText(`Com base nesta rede de contatos: ${summary || 'sem contatos ainda'}. Dê 1 insight curto e acionável (máx. 3 frases) para ${firstName || 'o usuário'} sobre como cuidar da rede esta semana.`, 200);
    await sendReply(number, `🧠 ${insight || 'Cadastre mais contatos e interações para eu gerar insights.'}`);
    return;
  }

  if (intentData.intent === 'help') {
    await sendReply(number,
      `👋 Oi${firstName ? ', ' + firstName : ''}! Aqui está o que eu faço:\n\n📝 *Registrar interação*: "Liguei para o André hoje, foi positivo"\n🗓️ *Agendar ação futura*: "Preciso enviar a proposta pro André até sexta" (te lembro no dia)\n👥 *Consultar contatos*: "Quem eu não contato há mais tempo?"\n📋 *Próximas ações*: "Minhas próximas ações"\n💚 *Saúde da rede*: "Saúde da minha rede"\n🧠 *Insights*: "Me dê insights"\n\n🎙️ Pode mandar tudo isso por áudio também, funciona igual.`);
    return;
  }

  await sendReply(number, `Não entendi bem 🤔 Pode reformular? Ex: "Liguei para o André hoje, foi positivo" ou "Minhas próximas ações".`);
}

// ── Handler ────────────────────────────────────────────────────
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(200).json({ ok: true });
    let body = req.body;
    const contentType = req.headers?.['content-type'] || '';

    // Fallback: se a Vercel não populou req.body (ex.: mismatch de content-type),
    // lê e parseia o corpo bruto na mão em vez de falhar em silêncio.
    if (!body || (typeof body === 'object' && Object.keys(body).length === 0)) {
      try {
        const raw = await readRawBody(req);
        if (raw) {
          body = contentType.includes('application/json')
            ? JSON.parse(raw)
            : Object.fromEntries(new URLSearchParams(raw));
        } else {
          body = {};
        }
      } catch (e) {
        console.error('[whatsapp-webhook] fallback body parse falhou:', e.message);
        body = body || {};
      }
    }

    // Suporte para Twilio
    const fromNumber = body.From?.replace('whatsapp:', '') || '';
    const messageText = body.Body || '';

    // Log incondicional de todo request recebido — sem isso, um mismatch de
    // parsing derruba a mensagem em silêncio (retorna 200 sem processar nada).
    await logDebug({
      debug: 'incoming_request',
      contentType,
      bodyKeys: Object.keys(body || {}),
      fromPresent: !!fromNumber,
      messagePresent: !!messageText,
    });

    // Canal Twilio
    if (fromNumber && messageText) {
      await handleIncomingMessage(fromNumber, messageText, sendWhatsappTwilio);
      return res.status(200).json({ ok: true });
    }

    // Canal Evolution API (compatibilidade com o número antigo, mantido em paralelo)
    if (body.event === 'messages.upsert') {
      const data = body.data || {};
      if (data.key?.fromMe) return res.status(200).json({ ok: true }); // ignora mensagens enviadas pelo próprio bot

      const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
      if (!text.trim()) return res.status(200).json({ ok: true }); // por enquanto só processa texto (áudio fica pra depois)

      const jid = (data.key?.remoteJidAlt && data.key.remoteJidAlt.endsWith('@s.whatsapp.net'))
        ? data.key.remoteJidAlt
        : data.key?.remoteJid || '';
      const number = jid.replace(/\D/g, '');
      if (!number) return res.status(200).json({ ok: true });

      await handleIncomingMessage(number, text, sendWhatsappEvolution);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[whatsapp-webhook] erro:', err);
    return res.status(200).json({ ok: true, error: true });
  }
}
