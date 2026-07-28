// api/relationship-weekly-summary-cron.js
// Job: generate-weekly-summaries
//
// Roda todo dia (via Vercel Cron), mas só processa de fato os usuários para
// quem hoje é segunda-feira NO TIMEZONE DELES — assim funciona corretamente
// mesmo que todo o time esteja hoje em América/São_Paulo, sem travar a
// arquitetura num único fuso caso a base internacionalize no futuro.
//
// Não inventa dado quando não há informação suficiente — usa a mensagem
// "semana leve" nesse caso (ver messages.js).

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { weeklySummaryOpeningMessage, weeklySummaryBodyMessage } from './_lib/relationshipAssistant/messages.js';
import { computeWeeklyAttentionItems, computeNextBestActions } from './_lib/relationshipAssistant/actionEngine.js';
import { isMonday, localDateISO } from './_lib/relationshipAssistant/timeWindow.js';

const CRON_SECRET = process.env.CRON_SECRET || '';

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const perfis = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,weekly_summary_enabled,whatsapp_opt_in&onboarding_completed=eq.true&whatsapp=not.is.null&weekly_summary_enabled=eq.true`
    );

    const elegiveis = (perfis || []).filter(p => isMonday(p.timezone));

    let enviados = 0, pulados = 0;
    for (const profile of elegiveis) {
      const todayISO = localDateISO(profile.timezone);
      const weekAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();

      const [contacts, interactions] = await Promise.all([
        sb(`contacts?user_id=eq.${profile.id}&select=id,name,proximity,ideal_frequency_days,last_interaction_at,next_action,next_action_date,birthday`),
        sb(`interactions?user_id=eq.${profile.id}&created_at=gte.${weekAgoISO}&select=id`),
      ]);

      const items = computeWeeklyAttentionItems(contacts, todayISO);
      const actions = computeNextBestActions(contacts);
      const suggestion = actions[0]?.suggestedMessage
        ? `mande uma mensagem simples para ${actions[0].contactName} perguntando como ${actions[0].contactName ? 'ele/ela' : 'a pessoa'} está.`
        : null;

      const abertura = weeklySummaryOpeningMessage(profile.first_name);
      const corpo = weeklySummaryBodyMessage({
        firstName: profile.first_name,
        weekInteractionsCount: interactions?.length || 0,
        items,
        suggestion,
      });
      const text = `${abertura}\n\n${corpo}`;

      const result = await sendProactiveNotification({
        profile,
        notificationType: 'WEEKLY_RELATIONSHIP_SUMMARY',
        scopeKey: todayISO, // no máximo 1 resumo por dia local — evita duplicar se o cron rodar 2x na mesma segunda
        text,
      });
      if (result.sent) enviados++; else pulados++;
    }

    return res.status(200).json({ ok: true, elegiveis: elegiveis.length, enviados, pulados });
  } catch (err) {
    console.error('[relationship-weekly-summary-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
