// api/whatsapp-reminder-cron.js
// Roda diariamente (via Vercel Cron, ver vercel.json). Dois tipos de lembrete:
// 1) next_action_date vencendo hoje (ou atrasada) que ainda não gerou lembrete
// 2) aniversário de contato caindo hoje, uma vez por ano
// O envio passa pelo pipeline proativo, que usa a configuração Meta e aplica
// opt-in, quiet hours, limite diário e log/idempotência.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET || '';

import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';

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

const NON_INFRA_FAILURE_REASONS = new Set([
  'no_whatsapp_number',
  'notifications_disabled',
  'weekly_summary_disabled',
  'no_opt_in',
  'quiet_hours',
  'forbidden_tone_blocked',
  'already_sent',
  'daily_limit_reached',
  'whatsapp_access_denied',
]);

// Não devolve mensagens da Meta ou conteúdo de contatos na resposta do cron.
// Erros desconhecidos ficam agrupados em uma razão estável e não sensível.
function safeFailureReason(reason) {
  const value = String(reason || 'not_sent');
  if (/^[a-z][a-z0-9_:-]{0,79}$/.test(value)) return value;
  return 'provider_failed';
}

function countFailure(state, reason) {
  const safeReason = safeFailureReason(reason);
  state.falhas += 1;
  state.falhasPorMotivo[safeReason] = (state.falhasPorMotivo[safeReason] || 0) + 1;
  if (!NON_INFRA_FAILURE_REASONS.has(safeReason)) state.infraFailure = true;
}

export default async function handler(req, res) {
  const state = { enviados: 0, falhas: 0, falhasPorMotivo: {}, infraFailure: false };
  try {
    // Se CRON_SECRET estiver configurado nas env vars da Vercel, exige o header.
    // Se não estiver configurado, roda sem exigir (mais simples, mas menos travado).
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }
    }

    if (!SUPABASE_SERVICE_KEY || !META_WHATSAPP_TOKEN) {
      return res.status(503).json({ ok: false, error: 'configuration_missing' });
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
      return res.status(200).json({
        ok: true,
        enviados: state.enviados,
        falhas: state.falhas,
        falhas_por_motivo: state.falhasPorMotivo,
      });
    }

    // Busca os perfis (números de WhatsApp) dos donos, de uma vez só
    const userIds = [...new Set([...(pendentes || []).map(c => c.user_id), ...aniversariantesHoje.map(c => c.user_id)])];
    const profiles = await sb(`profiles?id=in.(${userIds.join(',')})&select=id,whatsapp,first_name,name,is_pro,plan,pro_expires_at,whatsapp_trial_started_at,timezone,notifications_enabled,weekly_summary_enabled,whatsapp_opt_in`);
    const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    // Mesma regra de acesso usada no app e no webhook: PRO sempre libera;
    // Free só recebe lembrete dentro dos 10 dias de trial após cadastrar o
    // WhatsApp. Sem isso, o cron continuaria mandando mensagem pra Free
    // mesmo depois do trial acabar, ignorando o paywall.
    const hasWhatsappAccess = (profile) => {
      if (!profile?.whatsapp) return false;
      const isPro = !!profile.is_pro || (profile.plan === 'pro' && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > new Date()));
      if (isPro) return true;
      if (!profile.whatsapp_trial_started_at) return false;
      const diasDeTrial = (Date.now() - new Date(profile.whatsapp_trial_started_at).getTime()) / (1000 * 60 * 60 * 24);
      return diasDeTrial <= 10;
    };

    for (const contato of (pendentes || [])) {
      const profile = profileById[contato.user_id];
      if (!hasWhatsappAccess(profile)) {
        countFailure(state, 'whatsapp_access_denied'); // sem WhatsApp, ou Free fora do trial
        continue;
      }

      const atrasada = contato.next_action_date < hojeISO;
      const dataFormatada = new Date(contato.next_action_date + 'T00:00:00').toLocaleDateString('pt-BR');
      const texto = atrasada
        ? `⏰ Lembrete atrasado: *${contato.next_action}* com *${contato.name}* (era pra ${dataFormatada}).`
        : `⏰ Lembrete de hoje: *${contato.next_action}* com *${contato.name}*.`;

      // Lacuna conhecida: os textos existentes continuam sendo texto livre;
      // este ajuste não inventa nem cadastra templates aprovados na Meta.
      const result = await sendProactiveNotification({
        profile,
        notificationType: 'NEXT_BEST_ACTION',
        scopeKey: `next-action:${contato.id}:${contato.next_action_date}`,
        text: texto,
        relationshipId: contato.id,
      });
      if (!result?.sent) {
        countFailure(state, result?.reason);
        continue;
      }

      state.enviados++;
      await sb(`contacts?id=eq.${contato.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ next_action_reminded_at: new Date().toISOString() }),
      });
    }

    for (const contato of aniversariantesHoje) {
      const profile = profileById[contato.user_id];
      if (!hasWhatsappAccess(profile)) {
        countFailure(state, 'whatsapp_access_denied');
        continue;
      }

      const texto = `🎂 Hoje é aniversário de *${contato.name}*! Boa hora pra mandar uma mensagem — reciprocidade genuína conta mais que qualquer ligação estratégica.`;

      // Aniversários usam o tipo permitido NEXT_BEST_ACTION; não criar
      // BIRTHDAY, pois a constraint real do banco não aceita esse valor.
      const result = await sendProactiveNotification({
        profile,
        notificationType: 'NEXT_BEST_ACTION',
        scopeKey: `birthday:${contato.id}:${anoAtual}`,
        text: texto,
        relationshipId: contato.id,
      });
      if (!result?.sent) {
        countFailure(state, result?.reason);
        continue;
      }

      state.enviados++;
      await sb(`contacts?id=eq.${contato.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ birthday_last_reminded_year: anoAtual }),
      });
    }

    return res.status(state.infraFailure ? 500 : 200).json({
      ok: !state.infraFailure,
      enviados: state.enviados,
      falhas: state.falhas,
      falhas_por_motivo: state.falhasPorMotivo,
    });
  } catch (err) {
    console.error('[whatsapp-reminder-cron] erro:', err);
    return res.status(500).json({
      ok: false,
      error: 'internal_error',
      enviados: state.enviados,
      falhas: state.falhas,
      falhas_por_motivo: state.falhasPorMotivo,
    });
  }
}
