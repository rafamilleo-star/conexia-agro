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

SUA TAREFA NÃO É PROCURAR COMANDOS OU PALAVRAS-CHAVE. Sua tarefa é responder: "o que esse usuário quer
realizar?" — não importa como ele escreveu, mesmo que a frase seja informal, incompleta, indireta ou não
siga nenhum padrão fixo. O usuário pode escrever naturalmente, do jeito que quiser.

Exemplos do tipo de frase natural que você deve entender (a lista é só ilustrativa, não exaustiva — o
entendimento tem que funcionar mesmo pra frases que não estão aqui):
- "Ganhei o contato de um produtor." → register_contact
- "Conheci uma gerente da BASF." → register_contact
- "Recebi um WhatsApp interessante, é de um novo contato." → register_contact
- "Conversei com o João hoje." → register_interaction
- "Falei com João hoje." → register_interaction
- "Preciso ligar para ele semana que vem." → schedule_action
- "Ligar para ele sexta." → schedule_action
- "Tenho reunião amanhã com o Carlos." → briefing
- "Me prepara pra falar com a Ana." → briefing
- "Quem faz tempo que não vejo?" / "Quem faz tempo que não converso?" → query_health
- "O que tenho para fazer hoje?" → query_next_actions
- "Me ajuda." → help

Um CRM de verdade não só registra o que já aconteceu — também precisa capturar o que ainda vai acontecer,
com prazo. Por isso existem duas intenções distintas para isso, e é essencial não confundi-las:

REGISTER_INTERACTION — use quando o usuário está relatando/registrando algo que JÁ ACONTECEU ou que ele já
sabe sobre um contato (passado ou fato presente, não uma tarefa futura). Vale tanto pra relatos
("liguei pro André, foi ótimo") quanto pra comandos diretos ("cadastra que o André foi promovido",
"anota que falei com a Bia sobre o projeto X"). Se o usuário mencionar um contato + alguma informação/
novidade/assunto sobre ele, é register_interaction — mesmo sem palavras como "liguei" ou "conversei".
Preencha fields.note resumindo a informação central.

SCHEDULE_ACTION — use quando o usuário está pedindo pra ANOTAR/AGENDAR/MARCAR/LEMBRAR algo que ELE AINDA
PRECISA FAZER no futuro em relação a um contato, com ou sem prazo. Isso vale tanto pra relatos em 1ª pessoa
("preciso mandar a proposta pro Carlos até sexta", "tenho que ligar pra Ana semana que vem") quanto pra
COMANDOS DIRETOS/IMPERATIVOS ("agenda uma ligação para o Caio na segunda", "marca uma reunião com a Bia pra
quinta"). O sinal é a ação estar no futuro (ainda não aconteceu), não a pessoa gramatical do verbo. Preencha
fields.next_action (o que precisa ser feito, resumido) e fields.next_action_date (formato YYYY-MM-DD, calculado
a partir de hoje). Datas explícitas DD/MM ou DD/MM/AAAA são sempre dia/mês (padrão brasileiro, nunca mês/dia).
Se vier só DD/MM sem ano, assuma o ano corrente ou o próximo se a data já passou este ano.

Regra de desambiguação: algo que JÁ ACONTECEU ou é um fato já conhecido → register_interaction. Algo que
ainda VAI acontecer (data futura, compromisso, tarefa a fazer) → schedule_action, mesmo que a frase comece
com um verbo de comando como "agenda", "cadastra" ou "marca".

REGISTER_CONTACT — use quando o usuário quer adicionar uma pessoa NOVA à rede dele, mesmo sem dizer
explicitamente "cadastra" ou "contato" — o sinal é ele mencionar ter conhecido, ganho o contato de, ou
recebido a indicação de alguém que ainda não está na lista de contatos já cadastrados acima. Preencha o
que conseguir em fields: contact_name, company, role, how_met, e category (chute entre "mentor", "aliado",
"ponte", "potencial", "dormindo" pelo contexto — null se não der pra saber). Se a mensagem não trouxer o
nome da pessoa, contact_name fica ausente — NÃO responda unknown por causa disso, responda register_contact
mesmo assim e liste "contact_name" em missing_fields. O sistema pergunta o nome depois.

CAPTURA PASSIVA (hobbies e aniversário) — vale tanto pra register_contact quanto pra register_interaction.
NUNCA pergunte ativamente por isso — só preencha fields.hobbies e/ou fields.birthday se o usuário JÁ
mencionou espontaneamente algo do tipo (ex.: "ele pesca nos fins de semana", "gosta de corrida", "aniversário
dele é dia 15/03", "faz aniversário mês que vem dia 4"). fields.hobbies é um texto curto livre. fields.birthday
é "YYYY-MM-DD" — se o ano não for dado (o mais comum), use 1900 como ano-placeholder (ex.: "15/03" vira
"1900-03-15"); nunca invente o ano. Se nada foi mencionado, deixe os dois de fora — não é obrigatório em
nenhuma intenção.

BRIEFING — o usuário quer se preparar para falar/se encontrar com alguém que JÁ está na rede dele. Preencha
fields.contact_name com o nome mais parecido possível com algum da lista de contatos já cadastrados acima
(sem artigos como "o"/"a", sem palavras de tempo como "hoje"/"amanhã" — só o nome).

Outras intenções:
- query_contacts: perguntas sobre quem ele não fala há tempo, lista de contatos, etc.
- query_next_actions: perguntas sobre tarefas/próximos passos pendentes já cadastrados.
- query_health: perguntas sobre a saúde geral da rede (incluindo "quem eu não vejo há tempo" — isso é sobre a rede como um todo, não sobre 1 contato específico, então é query_health e não briefing).
- query_insights: pedidos de insight, dica, análise geral.
- help: pede ajuda, não sabe o que o assistente faz.
- unknown: só use se a mensagem realmente não tiver relação nenhuma com networking/contatos (ex: só "oi", saudação vazia sem contexto) — nunca use unknown só porque faltou um dado, veja a regra do register_contact acima.

Se a mensagem contiver MAIS DE UMA intenção ao mesmo tempo (ex.: "Conheci um produtor e preciso ligar pra
ele sexta" = register_contact + schedule_action), retorne as duas no formato de múltiplas ações (formato 2
abaixo), na ordem em que fazem sentido acontecer.

Retorne APENAS JSON, sem markdown, sem texto fora do JSON, em UM dos dois formatos:

FORMATO 1 — uma intenção só:
{
  "intent": "register_interaction" | "schedule_action" | "register_contact" | "briefing" | "query_contacts" | "query_next_actions" | "query_health" | "query_insights" | "help" | "unknown",
  "confidence": 0.0 a 1.0,
  "fields": {
    "contact_name": string ou null,
    "sentiment": "positivo" | "neutro" | "negativo" | null,
    "note": string ou null,
    "next_action": string ou null,
    "next_action_date": "YYYY-MM-DD" ou null,
    "interaction_type": "ligacao" | "mensagem" | "reuniao" | "email" | "evento" | "outro" | null,
    "company": string ou null,
    "role": string ou null,
    "category": "mentor" | "aliado" | "ponte" | "potencial" | "dormindo" | null,
    "how_met": string ou null,
    "hobbies": string ou null,
    "birthday": "YYYY-MM-DD ou null (use 1900 como ano se não foi informado)"
  },
  "missing_fields": ["nome dos campos de fields que faltam e são necessários pra essa intenção, ou array vazio"],
  "reasoning": "1 frase curta explicando por que você entendeu essa intenção"
}

FORMATO 2 — mais de uma intenção na mesma mensagem:
{
  "actions": [ { ...um objeto no formato 1 para cada intenção... } ]
}

Omita campos de "fields" que não se aplicam à intenção identificada (não precisa preencher tudo, só o relevante).`;

  const g = await geminiTextRaw(prompt, 700);
  const flatten = (item) => ({
    intent: item?.intent || 'unknown',
    confidence: item?.confidence ?? null,
    missing_fields: item?.missing_fields || [],
    reasoning: item?.reasoning || null,
    ...(item?.fields || {}),
  });
  try {
    if (!g.ok) throw new Error(`Gemini HTTP ${g.status}: ${JSON.stringify(g.raw).slice(0, 500)}`);
    const cleaned = g.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    if (!cleaned) throw new Error('Gemini retornou texto vazio');
    const parsed = JSON.parse(cleaned);
    const list = Array.isArray(parsed.actions) ? parsed.actions.map(flatten) : [flatten(parsed)];
    await logDebug({
      debug: 'analyzeIntent_ok', message,
      intents: list.map(i => i.intent), confidences: list.map(i => i.confidence),
      missingFields: list.map(i => i.missing_fields), reasonings: list.map(i => i.reasoning),
    });
    return list;
  } catch (e) {
    await logDebug({ debug: 'analyzeIntent_fail', message, error: e.message, geminiStatus: g.status, geminiRawText: g.text?.slice(0, 800), geminiRawResponse: g.raw });
    return [{ intent: 'unknown' }];
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

// Normaliza o número pra dígitos puros — remove o prefixo "whatsapp:" (Evolution
// já não vem com isso, mas não custa cobrir) e qualquer caractere que não seja
// dígito, incluindo o "+" do formato E.164 que o Twilio manda em `From`.
// Sem isso, um número como "+554391557894" quebrava o waVariants (que assume
// dígitos puros), e a busca no profiles nunca encontrava ninguém.
function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone)
    .replace(/^whatsapp:/i, '')
    .replace(/\D/g, '');
}

// Gera as variações possíveis do número (com/sem o 9º dígito, comum no Brasil).
// A heurística do 9º dígito só se aplica a números com DDI 55 (Brasil) — pra
// não gerar variante incorreta em número internacional. Fixo não entra aqui
// na prática: WhatsApp exige número móvel, então todo número que chega por
// este webhook já é celular por definição do próprio provedor.
function waVariants(num) {
  const cc = num.slice(0, 2), ddd = num.slice(2, 4), rest = num.slice(4);
  const set = new Set([num]);
  if (cc === '55') {
    if (rest.length === 9 && rest[0] === '9') set.add(cc + ddd + rest.slice(1));
    if (rest.length === 8) set.add(cc + ddd + '9' + rest);
  }
  return [...set];
}

// ── Idempotência: nunca processar a mesma mensagem duas vezes ──────
// Twilio e Evolution podem reentregar a mesma mensagem (retry de rede,
// timeout na resposta, etc.) — sem isso, cada reentrega vira uma interação
// duplicada, um segundo cadastro de contato, etc.
async function alreadyProcessedMessage(messageId, userId) {
  if (!messageId) return false; // sem id (não deveria acontecer) — deixa passar em vez de bloquear tudo
  try {
    const existing = await sb(`whatsapp_processed_messages?message_id=eq.${encodeURIComponent(messageId)}&select=message_id`);
    if (existing?.length) return true;
    await sb('whatsapp_processed_messages', {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, user_id: userId || null }),
    });
    return false;
  } catch (e) {
    // Falha ao checar/gravar não deve travar o atendimento — loga e segue.
    console.error('[whatsapp-webhook] falha na checagem de idempotência:', e.message);
    return false;
  }
}

// ── Rate limit: no máximo N mensagens processadas por usuário por hora ──
// Usa a tabela whatsapp_rate_limits, que já existia no schema mas nunca
// tinha sido conectada a nenhuma lógica real.
const RATE_LIMIT_PER_HOUR = 30;
async function checkRateLimit(userId) {
  const hourBucket = new Date();
  hourBucket.setMinutes(0, 0, 0);
  const hourISO = hourBucket.toISOString();
  try {
    const rows = await sb(`whatsapp_rate_limits?user_id=eq.${userId}&hour=eq.${encodeURIComponent(hourISO)}&select=id,message_count`);
    if (rows?.length) {
      const row = rows[0];
      if (row.message_count >= RATE_LIMIT_PER_HOUR) return false;
      await sb(`whatsapp_rate_limits?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ message_count: row.message_count + 1 }),
      });
    } else {
      await sb('whatsapp_rate_limits', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, hour: hourISO, message_count: 1 }),
      });
    }
    return true;
  } catch (e) {
    console.error('[whatsapp-webhook] falha no rate limit:', e.message);
    return true; // falha na checagem não deve bloquear o usuário
  }
}

// ── Ação pendente: no máximo 1 pergunta em aberto por usuário ──────
// Usada hoje só pelo fluxo de cadastro de contato (quando falta o nome).
async function getPendingAction(userId) {
  try {
    const rows = await sb(`whatsapp_pending_actions?user_id=eq.${userId}&select=intent,data,expires_at`);
    const pending = rows?.[0];
    if (!pending) return null;
    if (new Date(pending.expires_at) < new Date()) {
      await clearPendingAction(userId);
      return null;
    }
    return pending;
  } catch (e) {
    console.error('[whatsapp-webhook] falha ao buscar ação pendente:', e.message);
    return null;
  }
}
async function setPendingAction(userId, intent, data) {
  await sb(`whatsapp_pending_actions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {});
  await sb('whatsapp_pending_actions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, intent, data: data || {} }),
  }).catch((e) => console.error('[whatsapp-webhook] falha ao gravar ação pendente:', e.message));
}
async function clearPendingAction(userId) {
  await sb(`whatsapp_pending_actions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {});
}

// Frase curta usada depois de todo cadastro de contato pelo WhatsApp — não
// pergunta hobby/aniversário aqui (quebraria a rapidez do canal), só lembra
// de completar no app, incluindo as 4 perguntas de relevância do contato.
const APP_ENRICHMENT_NUDGE = '\n\n💡 Cadastro feito por aqui é só o essencial. Pra melhor experiência, completa no app as outras informações (aniversário, hobby, cidade...) e as 4 perguntas de relevância do contato.';

// Match exato (case-insensitive) por nome — usado pra não duplicar contato
// quando o mesmo nome é cadastrado de novo (por mensagem ou por vCard).
function findExistingContactByName(contacts, name) {
  const target = (name || '').trim().toLowerCase();
  if (!target) return null;
  return (contacts || []).find(c => (c.name || '').trim().toLowerCase() === target) || null;
}

// Baixa o anexo de mídia do Twilio (contato compartilhado, áudio, etc.) —
// exige autenticação básica com as mesmas credenciais usadas pra enviar.
async function downloadTwilioMedia(url) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) throw new Error(`Twilio media ${res.status}`);
  return await res.text();
}

// Parser simples de vCard (formato que o WhatsApp usa ao compartilhar um
// contato da agenda). Cobre os campos que interessam pro cadastro: nome,
// telefone e empresa. Não tenta ser um parser de vCard completo.
function parseVCard(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  let name = null, phone = null, org = null;
  for (const line of lines) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const rawKey = line.slice(0, sep);
    const value = line.slice(sep + 1).trim();
    const key = rawKey.split(';')[0].toUpperCase();
    if (key === 'FN' && !name) name = value;
    if (key === 'N' && !name) {
      // Formato N:Sobrenome;Nome;Nome do meio;;
      const parts = value.split(';').filter(Boolean);
      if (parts.length) name = parts.reverse().join(' ').trim();
    }
    if (key === 'TEL' && !phone) phone = value.replace(/[^\d+]/g, '');
    if (key === 'ORG' && !org) org = value.split(';')[0].trim() || null;
  }
  return { name, phone, org };
}

// Fluxo completo pra quando alguém compartilha um contato da agenda pelo
// WhatsApp: identifica o usuário, baixa o vCard, extrai os dados e cadastra
// direto na rede — mesmo caminho de dados do register_contact por texto.
async function handleSharedContact(number, mediaUrl, sendReply) {
  if (!SUPABASE_SERVICE_KEY) {
    await sendReply(number, '⚠️ Assistente ainda não configurado (falta chave do servidor). Avise o admin do CONÉXIA.');
    return;
  }
  const normalized = normalizePhone(number);
  const variants = waVariants(normalized);
  const profiles = await sb(`profiles?whatsapp=in.(${variants.join(',')})&select=id,name,first_name,is_pro,plan,pro_expires_at,created_at,whatsapp`);
  const profile = profiles?.[0];
  if (!profile) {
    await sendReply(number, '👋 Olá! Sou o assistente do Conéxia.\n\nNão encontrei sua conta vinculada a este número.\n\nAcesse conexia-agro-chi.vercel.app e cadastre seu WhatsApp no perfil para usar o assistente. 🚀');
    return;
  }
  const userIdProfile = profile.id;

  if (!(await checkRateLimit(userIdProfile))) {
    await sendReply(number, `⏳ Você mandou muitas mensagens na última hora. Dá uma pausa e tenta de novo daqui a pouco — isso é só uma proteção contra uso excessivo, não é permanente.`);
    return;
  }

  const isPro = !!profile.is_pro || (profile.plan === 'pro' && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date()));
  if (!isPro) {
    const diasDesdeCadastro = profile.created_at ? (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24) : 0;
    if (diasDesdeCadastro > 28) {
      await sendReply(number, `👋 Seu período gratuito do assistente de WhatsApp (4 semanas) terminou.\n\nPra continuar usando o CONÉXIA por aqui, faça upgrade pro PRO: acesse conexia-agro-chi.vercel.app. 🚀`);
      return;
    }
  }

  let vcardRaw;
  try {
    vcardRaw = await downloadTwilioMedia(mediaUrl);
  } catch (e) {
    await logDebug({ debug: 'vcard_download_fail', error: e.message, mediaUrl });
    await sendReply(number, 'Recebi o contato, mas não consegui abrir o arquivo. Me manda o nome (e telefone, se quiser) em texto que eu cadastro.');
    return;
  }

  const { name, phone, org } = parseVCard(vcardRaw);
  await logDebug({ debug: 'vcard_parsed', name, phone: phone ? '***' + phone.slice(-4) : null, org });
  if (!name) {
    await sendReply(number, 'Recebi o contato, mas não consegui ler o nome dele no arquivo. Me manda o nome em texto?');
    return;
  }

  const contacts = await sb(`contacts?user_id=eq.${userIdProfile}&select=id,name`);
  const dup = findExistingContactByName(contacts, name);
  if (dup) {
    await sendReply(number, `Você já tem *${dup.name}* cadastrado na sua rede. Se quiser registrar uma conversa com ele, manda "conversei com ${dup.name.split(' ')[0]} hoje" que eu já registro.`);
    return;
  }

  const created = await createContactFromWhatsapp(userIdProfile, {
    contact_name: name,
    company: org,
    role: null,
    category: null,
    how_met: 'Contato compartilhado via WhatsApp',
  });
  if (!created) {
    await sendReply(number, 'Deu um problema salvando o contato. Tenta de novo em instantes, ou cadastra pelo app.');
    return;
  }
  const tel = phone ? `\n📞 ${phone}` : '';
  await sendReply(number, `✅ *${created.name}* cadastrado na sua rede a partir do contato compartilhado!${org ? ` (${org})` : ''}${tel}\n\nPróximo passo: manda "conversei com ${created.name.split(' ')[0]} hoje" quando tiver a primeira interação, que eu já registro.${APP_ENRICHMENT_NUDGE}`);
}

// Cria o contato de fato — reaproveitado tanto no cadastro direto (1 mensagem
// com dados suficientes) quanto no fluxo de esclarecimento (nome veio depois).
async function createContactFromWhatsapp(userId, { contact_name, company, role, category, how_met, hobbies, birthday }) {
  const contact = await sb('contacts', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      name: contact_name.trim(),
      company: company || null,
      role: role || null,
      category: ['mentor', 'aliado', 'ponte', 'potencial', 'dormindo'].includes(category) ? category : 'potencial',
      proximity: 3,
      ideal_frequency_days: 30,
      how_met: how_met || 'Cadastrado via WhatsApp',
      hobbies: hobbies || null,
      birthday: birthday || null,
    }),
  });
  return contact?.[0] || null;
}

// ── Lógica de negócio compartilhada ───────────────────────────
// Usada tanto pelo Twilio quanto pela Evolution API — só muda a função de envio.
async function handleIncomingMessage(number, text, sendReply, messageId) {
  if (!SUPABASE_SERVICE_KEY) {
    await sendReply(number, '⚠️ Assistente ainda não configurado (falta chave do servidor). Avise o admin do CONÉXIA.');
    return;
  }

  // Normaliza pra dígitos puros só pra buscar o perfil — 'number' (original,
  // com "+" se vier do Twilio) continua intacto pra usar no envio da resposta.
  const normalized = normalizePhone(number);
  const variants = waVariants(normalized);

  // 1. Localiza o perfil pelo WhatsApp
  const profiles = await sb(`profiles?whatsapp=in.(${variants.join(',')})&select=id,name,first_name,is_pro,plan,pro_expires_at,created_at,whatsapp`);
  const profile = profiles?.[0];
  console.log({ from: number, normalized, profileWhatsapp: profile?.whatsapp || null }); // TEMPORÁRIO — remover depois do diagnóstico
  // Log seguro e permanente (sem número completo): só dispara quando o match
  // não foi pelo número exato, e sim por uma das variantes geradas — nunca
  // grava nem sobrescreve profiles.whatsapp, é só pra visibilidade.
  if (profile && normalized !== profile.whatsapp) {
    console.log('telefone identificado por compatibilidade brasileira', '****' + String(profile.whatsapp || '').slice(-4));
  }
  if (!profile) {
    await sendReply(number,
      '👋 Olá! Sou o assistente do Conéxia.\n\nNão encontrei sua conta vinculada a este número.\n\nAcesse conexia-agro-chi.vercel.app e cadastre seu WhatsApp no perfil para usar o assistente. 🚀');
    return;
  }
  const userIdProfile = profile.id;
  const firstName = (profile.first_name || profile.name || '').split(' ')[0] || '';

  // 1.0 Idempotência — se essa mensagem já foi processada antes (reentrega do
  // provedor), não faz nada de novo. Silencioso de propósito: não é erro.
  if (await alreadyProcessedMessage(messageId, userIdProfile)) {
    return;
  }

  // 1.05 Rate limit — protege contra custo de IA descontrolado (spam, loop, etc.)
  if (!(await checkRateLimit(userIdProfile))) {
    await sendReply(number, `⏳ Você mandou muitas mensagens na última hora. Dá uma pausa e tenta de novo daqui a pouco — isso é só uma proteção contra uso excessivo, não é permanente.`);
    return;
  }

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

  // 2.5 Havia uma pergunta em aberto pra este usuário? (hoje só usado pelo
  // cadastro de contato quando falta o nome) Se sim, esta mensagem é a
  // resposta a ela — não passa pelo analyzeIntent normal.
  const pending = await getPendingAction(userIdProfile);
  if (pending?.intent === 'register_contact_missing_name') {
    const name = text.trim();
    if (!name) {
      await sendReply(number, 'Não peguei o nome. Qual é o nome do contato?');
      return;
    }
    const dupContact = findExistingContactByName(contacts, name);
    if (dupContact) {
      await clearPendingAction(userIdProfile);
      await sendReply(number, `Você já tem *${dupContact.name}* cadastrado na sua rede. Se quiser registrar uma conversa com ele, manda "conversei com ${dupContact.name.split(' ')[0]} hoje" que eu já registro.`);
      return;
    }
    const created = await createContactFromWhatsapp(userIdProfile, { contact_name: name, ...pending.data });
    await clearPendingAction(userIdProfile);
    if (!created) {
      await sendReply(number, `Deu um problema salvando o contato. Tenta de novo em instantes, ou cadastra pelo app.`);
      return;
    }
    await sendReply(number, `✅ *${created.name}* cadastrado na sua rede!${pending.data?.company ? ` (${pending.data.company})` : ''}\n\nPróximo passo: manda uma mensagem tipo "conversei com ${created.name.split(' ')[0]} hoje" quando tiver a primeira interação, que eu já registro.${APP_ENRICHMENT_NUDGE}`);
    return;
  }

  // 3. Entende a intenção da mensagem (pode haver mais de uma ação na mesma mensagem)
  const intentDataList = await analyzeIntent(text, contacts || []);

  // 4. Executa cada ação identificada, na ordem em que vieram
  for (const intentData of intentDataList) {
    await executeIntent(intentData, { userIdProfile, contacts, number, sendReply, text, firstName, isPro });
  }
}

// ── Dispatch de uma única ação identificada ───────────────────
// Reaproveitado tanto pra mensagens com 1 intenção quanto pra mensagens com
// várias (chamado uma vez por ação, na ordem). O corpo de cada `if` abaixo é
// EXATAMENTE o mesmo que já existia — só foi movido pra uma função separada
// pra poder ser chamado em loop sem duplicar nenhuma lógica de handler.
async function executeIntent(intentData, { userIdProfile, contacts, number, sendReply, text, firstName, isPro }) {
  if (intentData.intent === 'register_contact') {
    if (!intentData.contact_name) {
      await setPendingAction(userIdProfile, 'register_contact_missing_name', {
        company: intentData.company || null,
        role: intentData.role || null,
        category: intentData.category || null,
        how_met: intentData.how_met || null,
        hobbies: intentData.hobbies || null,
        birthday: intentData.birthday || null,
      });
      await sendReply(number, 'Qual é o nome do contato?');
      return;
    }
    const dupContact = findExistingContactByName(contacts, intentData.contact_name);
    if (dupContact) {
      await sendReply(number, `Você já tem *${dupContact.name}* cadastrado na sua rede. Se quiser registrar uma conversa com ele, manda "conversei com ${dupContact.name.split(' ')[0]} hoje" que eu já registro.`);
      return;
    }
    const created = await createContactFromWhatsapp(userIdProfile, {
      contact_name: intentData.contact_name,
      company: intentData.company,
      role: intentData.role,
      category: intentData.category,
      how_met: intentData.how_met,
      hobbies: intentData.hobbies,
      birthday: intentData.birthday,
    });
    if (!created) {
      await sendReply(number, `Deu um problema salvando o contato. Tenta de novo em instantes, ou cadastra pelo app.`);
      return;
    }
    const detalhes = [intentData.role, intentData.company].filter(Boolean).join(' na ');
    await sendReply(number, `✅ *${created.name}* cadastrado na sua rede!${detalhes ? ` (${detalhes})` : ''}\n\nPróximo passo: manda uma mensagem tipo "conversei com ${created.name.split(' ')[0]} hoje" quando tiver a primeira interação, que eu já registro.${APP_ENRICHMENT_NUDGE}`);
    return;
  }

  if (intentData.intent === 'briefing') {
    if (!isPro) {
      await sendReply(number, `🔒 Briefing inteligente é um recurso PRO.\n\nNo PRO, antes de cada conversa você recebe o histórico completo, pontos de atenção e sugestão de próximo passo — não só os dados brutos.\n\nAcesse conexia-agro-chi.vercel.app pra ativar (chave de acesso ou assinatura).`);
      return;
    }
    const match = (contacts || []).find(c =>
      intentData.contact_name && c.name.toLowerCase().includes(intentData.contact_name.toLowerCase())
    );
    if (!match) {
      await sendReply(number, `Não encontrei "${intentData.contact_name || 'esse contato'}" na sua rede.`);
      return;
    }
    const full = await sb(`contacts?id=eq.${match.id}&select=name,company,role,category,how_met,last_interaction_at,next_action,next_action_date`);
    const c = full?.[0];
    if (!c) { await sendReply(number, `Não encontrei os detalhes de "${match.name}".`); return; }
    const diasSemContato = c.last_interaction_at ? Math.floor((Date.now() - new Date(c.last_interaction_at).getTime()) / 86400000) : null;
    const linhas = [
      `📋 *Briefing — ${c.name}*`,
      c.role || c.company ? `${[c.role, c.company].filter(Boolean).join(' na ')}` : null,
      c.category ? `Categoria: ${c.category}` : null,
      c.how_met ? `Como conheceu: ${c.how_met}` : null,
      diasSemContato !== null ? `Última interação: há ${diasSemContato} dia(s)` : 'Última interação: nenhuma registrada ainda',
      c.next_action ? `Próxima ação: ${c.next_action}${c.next_action_date ? ` (${new Date(c.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR')})` : ''}` : 'Sem próxima ação definida',
    ].filter(Boolean);
    await sendReply(number, linhas.join('\n'));
    return;
  }

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
    // Registrar uma interação com o contato resolve a pendência anterior dele —
    // por isso sempre limpamos next_action aqui, a não ser que esta mesma
    // mensagem já defina uma nova ação. Antes disso, a ação ficava presa pra
    // sempre porque nada nunca limpava o campo.
    await sb(`contacts?id=eq.${match.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        last_interaction_at: new Date().toISOString(),
        next_action: intentData.next_action || null,
        next_action_date: intentData.next_action_date || null,
        next_action_reminded_at: null,
        // Só sobrescreve se a mensagem trouxe algo novo — nunca apaga o que já tinha.
        ...(intentData.hobbies ? { hobbies: intentData.hobbies } : {}),
        ...(intentData.birthday ? { birthday: intentData.birthday } : {}),
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
    if (!isPro) {
      await sendReply(number, `🔒 Insights e recomendações estratégicas são um recurso PRO.\n\nNo Free você já acompanha saúde da rede e próximas ações. No PRO, a IA analisa sua rede e recomenda o que fazer.\n\nAcesse conexia-agro-chi.vercel.app pra ativar (chave de acesso ou assinatura).`);
      return;
    }
    const summary = (contacts || []).map(c => `${c.name}: última interação ${c.last_interaction_at ? new Date(c.last_interaction_at).toLocaleDateString('pt-BR') : 'nunca'}`).join('; ');
    const insight = await geminiText(`Com base nesta rede de contatos: ${summary || 'sem contatos ainda'}. Dê 1 insight curto e acionável (máx. 3 frases) para ${firstName || 'o usuário'} sobre como cuidar da rede esta semana.`, 200);
    await sendReply(number, `🧠 ${insight || 'Cadastre mais contatos e interações para eu gerar insights.'}`);
    return;
  }

  if (intentData.intent === 'help') {
    await sendReply(number,
      `👋 Oi${firstName ? ', ' + firstName : ''}! Aqui está o que eu faço:\n\n👤 *Cadastrar contato*: "Cadastra a Maria, gerente comercial da Bayer"\n📝 *Registrar interação*: "Liguei para o André hoje, foi positivo"\n🗓️ *Agendar ação futura*: "Preciso enviar a proposta pro André até sexta" (te lembro no dia)\n👥 *Consultar contatos*: "Quem eu não contato há mais tempo?"\n📋 *Próximas ações*: "Minhas próximas ações"\n💚 *Saúde da rede*: "Saúde da minha rede"\n\n🔒 *No PRO*:\n🧭 *Briefing antes de uma conversa*: "Me prepara pra falar com a Ana"\n🧠 *Insights e recomendações*: "Me dê insights"\n\n🎙️ Pode mandar tudo isso por áudio também, funciona igual.`);
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

    // Contato compartilhado da agenda chega como mídia (Body vazio), não como
    // texto. Varre os anexos procurando um vCard antes de decidir a rota.
    const numMedia = parseInt(body.NumMedia || '0', 10) || 0;
    let sharedContactUrl = null;
    for (let i = 0; i < numMedia; i++) {
      const ct = (body[`MediaContentType${i}`] || '').toLowerCase();
      if (ct.includes('vcard') || ct.includes('x-vcard') || ct === 'text/directory') {
        sharedContactUrl = body[`MediaUrl${i}`];
        break;
      }
    }

    // Log incondicional de todo request recebido — sem isso, um mismatch de
    // parsing derruba a mensagem em silêncio (retorna 200 sem processar nada).
    await logDebug({
      debug: 'incoming_request',
      contentType,
      bodyKeys: Object.keys(body || {}),
      fromPresent: !!fromNumber,
      messagePresent: !!messageText,
    });

    // Canal Twilio — contato compartilhado (vCard)
    if (fromNumber && sharedContactUrl) {
      await handleSharedContact(fromNumber, sharedContactUrl, sendWhatsappTwilio);
      return res.status(200).json({ ok: true });
    }

    // Canal Twilio — mensagem de texto normal
    if (fromNumber && messageText) {
      console.log("FROM:", fromNumber); // TEMPORÁRIO — remover depois do diagnóstico
      const messageId = body.MessageSid ? `twilio:${body.MessageSid}` : null;
      await handleIncomingMessage(fromNumber, messageText, sendWhatsappTwilio, messageId);
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

      console.log("FROM:", number); // TEMPORÁRIO — remover depois do diagnóstico
      const messageId = data.key?.id ? `evolution:${data.key.id}` : null;
      await handleIncomingMessage(number, text, sendWhatsappEvolution, messageId);
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[whatsapp-webhook] erro:', err);
    return res.status(200).json({ ok: true, error: true });
  }
}
