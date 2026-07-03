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
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp-webhook] falha ao enviar resposta:', res.status, body);
    }
  } catch (e) {
    console.error('[whatsapp-webhook] erro ao enviar resposta:', e.message);
  }
}

// ── Handler ────────────────────────────────────────────────────
export default async function handler(req, res) {
  // Processa tudo ANTES de responder — na Vercel, respostas antecipadas podem
  // congelar a função antes do trabalho em segundo plano terminar.
  try {
    if (req.method !== 'POST') return res.status(200).json({ ok: true });
    const body = req.body || {};
    if (body.event !== 'messages.upsert') return res.status(200).json({ ok: true });

    const data = body.data || {};
    if (data.key?.fromMe) return res.status(200).json({ ok: true }); // ignora mensagens enviadas pelo próprio bot

    const text = data.message?.conversation || data.message?.extendedTextMessage?.text || '';
    if (!text.trim()) return res.status(200).json({ ok: true }); // por enquanto só processa texto (áudio fica pra depois)

    const jid = (data.key?.remoteJidAlt && data.key.remoteJidAlt.endsWith('@s.whatsapp.net'))
      ? data.key.remoteJidAlt
      : data.key?.remoteJid || '';
    const number = jid.replace(/\D/g, '');
    if (!number) return res.status(200).json({ ok: true });

    if (!SUPABASE_SERVICE_KEY) {
      await sendWhatsapp(number, '⚠️ Assistente ainda não configurado (falta chave do servidor). Avise o admin do CONÉXIA.');
      return res.status(200).json({ ok: true });
    }

    // Gera as variações possíveis do número (com/sem o 9º dígito, comum no Brasil)
    function waVariants(num) {
      const cc = num.slice(0, 2), ddd = num.slice(2, 4), rest = num.slice(4);
      const set = new Set([num]);
      if (rest.length === 9 && rest[0] === '9') set.add(cc + ddd + rest.slice(1));
      if (rest.length === 8) set.add(cc + ddd + '9' + rest);
      return [...set];
    }
    const variants = waVariants(number);

    // 1. Localiza o perfil pelo WhatsApp (tentando as variações do número)
    const profiles = await sb(`profiles?whatsapp=in.(${variants.join(',')})&select=id,name,first_name`);
    const profile = profiles?.[0];
    if (!profile) {
      await sendWhatsapp(number,
        '👋 Olá! Sou o assistente do Conéxia.\n\nNão encontrei sua conta vinculada a este número.\n\nAcesse conexia-agro-chi.vercel.app e cadastre seu WhatsApp no perfil para usar o assistente. 🚀');
      return res.status(200).json({ ok: true });
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
        return res.status(200).json({ ok: true });
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
          ...(intentData.next_action ? { next_action: intentData.next_action, next_action_reminded_at: null } : {}),
          ...(intentData.next_action_date ? { next_action_date: intentData.next_action_date } : {}),
        }),
      });
      await sendWhatsapp(number, `✅ Registrado! Interação com *${match.name}* salva na sua rede.`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'schedule_action') {
      const match = (contacts || []).find(c =>
        intentData.contact_name && c.name.toLowerCase().includes(intentData.contact_name.toLowerCase())
      );
      if (!match) {
        await sendWhatsapp(number, `Não encontrei "${intentData.contact_name || 'esse contato'}" na sua rede. Confere o nome ou cadastra ele primeiro pelo app.`);
        return res.status(200).json({ ok: true });
      }
      if (!intentData.next_action) {
        await sendWhatsapp(number, 'Entendi que é uma ação futura, mas não peguei o que precisa ser feito. Pode reformular? Ex: "Preciso enviar a proposta pro Carlos até sexta".');
        return res.status(200).json({ ok: true });
      }
      await sb(`contacts?id=eq.${match.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          next_action: intentData.next_action,
          next_action_date: intentData.next_action_date || null,
          next_action_reminded_at: null, // reseta pra essa nova ação poder gerar um lembrete
        }),
      });
      const prazo = intentData.next_action_date
        ? ` até *${new Date(intentData.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR')}*`
        : '';
      await sendWhatsapp(number, `🗓️ Anotado! Próxima ação com *${match.name}*: ${intentData.next_action}${prazo}.${intentData.next_action_date ? '\n\nTe aviso por aqui quando chegar o dia.' : ''}`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'query_next_actions') {
      const pending = (contacts || []).filter(c => c.next_action).slice(0, 8);
      if (!pending.length) { await sendWhatsapp(number, 'Você não tem próximas ações pendentes registradas. 🎉'); return res.status(200).json({ ok: true }); }
      const list = pending.map(c => `• *${c.name}*: ${c.next_action}${c.next_action_date ? ` (${c.next_action_date})` : ''}`).join('\n');
      await sendWhatsapp(number, `📋 Suas próximas ações:\n\n${list}`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'query_contacts') {
      const sorted = [...(contacts || [])].sort((a, b) => new Date(a.last_interaction_at || 0) - new Date(b.last_interaction_at || 0)).slice(0, 8);
      if (!sorted.length) { await sendWhatsapp(number, 'Você ainda não tem contatos cadastrados.'); return res.status(200).json({ ok: true }); }
      const list = sorted.map(c => `• *${c.name}* — ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'sem interação registrada'}`).join('\n');
      await sendWhatsapp(number, `👥 Contatos sem contato recente:\n\n${list}`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'query_health') {
      const total = (contacts || []).length;
      const cooling = (contacts || []).filter(c => {
        if (!c.last_interaction_at) return true;
        const days = (Date.now() - new Date(c.last_interaction_at).getTime()) / 86400000;
        return days > 30;
      }).length;
      await sendWhatsapp(number, `💚 Saúde da sua rede:\n\n${total} contatos no total\n${cooling} esfriando (30+ dias sem contato)\n${total - cooling} saudáveis`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'query_insights') {
      const summary = (contacts || []).map(c => `${c.name}: última interação ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'nunca'}`).join('; ');
      const insight = await geminiText(`Com base nesta rede de contatos: ${summary || 'sem contatos ainda'}. Dê 1 insight curto e acionável (máx. 3 frases) para ${firstName || 'o usuário'} sobre como cuidar da rede esta semana.`, 200);
      await sendWhatsapp(number, `🧠 ${insight || 'Cadastre mais contatos e interações para eu gerar insights.'}`);
      return res.status(200).json({ ok: true });
    }

    if (intentData.intent === 'help') {
      await sendWhatsapp(number,
        `👋 Oi${firstName ? ', ' + firstName : ''}! Aqui está o que eu faço:\n\n` +
        `📝 *Registrar interação*: "Liguei para o André hoje, foi positivo"\n` +
        `🗓️ *Agendar ação futura*: "Preciso enviar a proposta pro André até sexta" (te lembro no dia)\n` +
        `👥 *Consultar contatos*: "Quem eu não contato há mais tempo?"\n` +
        `📋 *Próximas ações*: "Minhas próximas ações"\n` +
        `💚 *Saúde da rede*: "Saúde da minha rede"\n` +
        `🧠 *Insights*: "Me dê insights"`);
      return res.status(200).json({ ok: true });
    }

    await sendWhatsapp(number, 'Não entendi bem 🤔 Pode reformular? Ex: "Liguei para o André hoje, foi positivo" ou "Minhas próximas ações".');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[whatsapp-webhook] erro:', err);
    return res.status(200).json({ ok: true, error: true });
  }
}
