// api/whatsapp-reminder-cron.js
// Roda diariamente (via Vercel Cron, ver vercel.json). Busca contatos com
// next_action_date vencendo hoje (ou atrasada) que ainda não geraram lembrete,
// e manda uma mensagem de WhatsApp pro dono do contato avisando.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-0c6a.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY || 'BEBCA1FE-7152-470A-BB80-521851ED3D21';
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

async function sendWhatsapp(number, text) {
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[whatsapp-reminder-cron] falha ao enviar:', res.status, body);
    }
  } catch (e) {
    console.error('[whatsapp-reminder-cron] erro ao enviar:', e.message);
  }
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

    const hojeISO = new Date().toISOString().slice(0, 10);

    // Ações com prazo pra hoje ou atrasadas, que ainda não geraram lembrete
    const pendentes = await sb(
      `contacts?select=id,user_id,name,next_action,next_action_date&next_action_date=lte.${hojeISO}&next_action=not.is.null&next_action_reminded_at=is.null`
    );

    if (!pendentes || !pendentes.length) {
      return res.status(200).json({ ok: true, enviados: 0 });
    }

    // Busca os perfis (números de WhatsApp) dos donos desses contatos, de uma vez
    const userIds = [...new Set(pendentes.map(c => c.user_id))];
    const profiles = await sb(`profiles?id=in.(${userIds.join(',')})&select=id,whatsapp,first_name,name`);
    const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    let enviados = 0;
    for (const contato of pendentes) {
      const profile = profileById[contato.user_id];
      if (!profile?.whatsapp) continue; // usuário sem WhatsApp cadastrado, pula

      const atrasada = contato.next_action_date < hojeISO;
      const dataFormatada = new Date(contato.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR');
      const texto = atrasada
        ? `⏰ Lembrete atrasado: *${contato.next_action}* com *${contato.name}* (era pra ${dataFormatada}).`
        : `⏰ Lembrete de hoje: *${contato.next_action}* com *${contato.name}*.`;

      await sendWhatsapp(profile.whatsapp, texto);

      await sb(`contacts?id=eq.${contato.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ next_action_reminded_at: new Date().toISOString() }),
      });
      enviados++;
    }

    return res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error('[whatsapp-reminder-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
