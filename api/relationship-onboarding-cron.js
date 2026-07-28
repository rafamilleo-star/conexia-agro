// api/relationship-onboarding-cron.js
// Job: scan-incomplete-onboarding
//
// Identifica usuários com onboarding_completed = false há mais de X horas e
// envia o 1º lembrete; se continuar incompleto depois de Y horas, envia o 2º.
// Não envia nada se o cadastro foi concluído — a checagem é feita a cada
// execução direto na query (onboarding_completed=eq.false), então concluir o
// onboarding automaticamente "cancela" qualquer lembrete futuro sem precisar
// de um job separado de cancelamento.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { onboardingReminderMessage } from './_lib/relationshipAssistant/messages.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const FIRST_REMINDER_HOURS = Number(process.env.ONBOARDING_FIRST_REMINDER_HOURS || 24);
const SECOND_REMINDER_HOURS = Number(process.env.ONBOARDING_SECOND_REMINDER_HOURS || 96);

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const now = Date.now();
    const firstCutoff = new Date(now - FIRST_REMINDER_HOURS * 3600000).toISOString();
    const secondCutoff = new Date(now - SECOND_REMINDER_HOURS * 3600000).toISOString();

    const candidatos = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,created_at&onboarding_completed=eq.false&whatsapp=not.is.null&created_at=lte.${firstCutoff}`
    );

    let enviados = 0, pulados = 0;
    for (const profile of candidatos || []) {
      const step = profile.created_at <= secondCutoff ? 'second' : 'first';
      const text = onboardingReminderMessage(profile.first_name, step);
      const result = await sendProactiveNotification({
        profile,
        notificationType: 'ONBOARDING_REMINDER',
        scopeKey: step, // no máximo 1 envio por step, por usuário — nunca repete o mesmo lembrete
        text,
      });
      if (result.sent) enviados++; else pulados++;
    }

    return res.status(200).json({ ok: true, avaliados: candidatos?.length || 0, enviados, pulados });
  } catch (err) {
    console.error('[relationship-onboarding-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
