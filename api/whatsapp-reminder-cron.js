// api/whatsapp-reminder-cron.js
// Roda diariamente (via Vercel Cron, ver vercel.json). Dois tipos de lembrete:
// 1) next_action_date vencendo hoje (ou atrasada) que ainda não gerou lembrete
// 2) aniversário de contato caindo hoje, uma vez por ano
// Envia por Twilio — mesmo canal já em uso e funcionando no assistente de WhatsApp
// (a Evolution API usada aqui antes tinha entrega silenciosamente quebrada).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';
const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-0c6a.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'conexia';
const CRON_SECRET = process.env.CRON_SECRET || '';

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

// Garante formato E.164 (com "+") — no banco a maioria está salvo só em dígitos.
function toE164(number) {
  const n = String(number || '').trim();
  return n.startsWith('+') ? n : `+${n}`;
}

async function sendWhatsappTwilio(number, text) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return false;
  try {
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
          To: `whatsapp:${toE164(number)}`,
          Body: text,
        }).toString(),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp-reminder-cron] falha ao enviar via Twilio:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whatsapp-reminder-cron] erro ao enviar via Twilio:', e.message);
    return false;
  }
}

async function sendWhatsappEvolution(number, text) {
  if (!EVO_KEY) return false;
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp-reminder-cron] falha ao enviar via Evolution:', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[whatsapp-reminder-cron] erro ao enviar via Evolution:', e.message);
    return false;
  }
}

// Os dois canais rodam em paralelo, igual no webhook de entrada — hoje o
// Twilio é quem entrega de verdade, mas quando o número Business (Evolution)
// voltar a funcionar, este fallback passa a usá-lo sem precisar mexer em nada.
async function sendWhatsapp(number, text) {
  if (await sendWhatsappTwilio(number, text)) return true;
  if (await sendWhatsappEvolution(number, text)) return true;
  return false;
}

export default async function handler(req, res) {
  try {
    // Se CRON_SECRET estiver configurado nas env vars da Vercel, exige o header.
    // Se não estiver configurado, roda sem exigir (mais simples, mas menos travado).
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }
    }

    if (!SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const hoje = new Date();
    const hojeISO = hoje.toISOString().slice(0, 10);
    const anoAtual = hoje.getUTCFullYear();
    const mesHoje = hoje.getUTCMonth() + 1;
    const diaHoje = hoje.getUTCDate();

    // 1) Ações com prazo pra hoje ou atrasadas, que ainda não geraram lembrete
    const pendentes = await sb(
      `contacts?select=id,user_id,name,next_action,next_action_date&next_action_date=lte.${hojeISO}&next_action=not.is.null&next_action_reminded_at=is.null`
    );

    // 2) Aniversários de hoje (mês/dia, ignorando o ano-placeholder) que ainda
    // não geraram lembrete este ano — evita repetir todo santo dia até o fim
    // do ano, e evita repetir de novo no ano seguinte sem necessidade.
    const aniversariantes = await sb(
      `contacts?select=id,user_id,name,birthday,birthday_last_reminded_year&birthday=not.is.null`
    );
    const aniversariantesHoje = (aniversariantes || []).filter(c => {
      if (!c.birthday) return false;
      const [, mes, dia] = c.birthday.split('-').map(Number);
      return mes === mesHoje && dia === diaHoje && c.birthday_last_reminded_year !== anoAtual;
    });

    if ((!pendentes || !pendentes.length) && !aniversariantesHoje.length) {
      return res.status(200).json({ ok: true, enviados: 0 });
    }

    // Busca os perfis (números de WhatsApp) dos donos, de uma vez só
    const userIds = [...new Set([...(pendentes || []).map(c => c.user_id), ...aniversariantesHoje.map(c => c.user_id)])];
    const profiles = await sb(`profiles?id=in.(${userIds.join(',')})&select=id,whatsapp,first_name,name`);
    const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    let enviados = 0;

    for (const contato of (pendentes || [])) {
      const profile = profileById[contato.user_id];
      if (!profile?.whatsapp) continue; // usuário sem WhatsApp cadastrado, pula

      const atrasada = contato.next_action_date < hojeISO;
      const dataFormatada = new Date(contato.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR');
      const texto = atrasada
        ? `⏰ Lembrete atrasado: *${contato.next_action}* com *${contato.name}* (era pra ${dataFormatada}).`
        : `⏰ Lembrete de hoje: *${contato.next_action}* com *${contato.name}*.`;

      const ok = await sendWhatsapp(profile.whatsapp, texto);
      if (!ok) continue;

      await sb(`contacts?id=eq.${contato.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ next_action_reminded_at: new Date().toISOString() }),
      });
      enviados++;
    }

    for (const contato of aniversariantesHoje) {
      const profile = profileById[contato.user_id];
      if (!profile?.whatsapp) continue;

      const texto = `🎂 Hoje é aniversário de *${contato.name}*! Boa hora pra mandar uma mensagem — reciprocidade genuína conta mais que qualquer ligação estratégica.`;

      const ok = await sendWhatsapp(profile.whatsapp, texto);
      if (!ok) continue;

      await sb(`contacts?id=eq.${contato.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ birthday_last_reminded_year: anoAtual }),
      });
      enviados++;
    }

    return res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error('[whatsapp-reminder-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
