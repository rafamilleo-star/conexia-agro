// api/relationship-inactivity-cron.js
// Job: scan-inactive-users
//
// DEPENDÊNCIA: assume que `profiles.last_access_at` é atualizado pelo
// frontend a cada acesso autenticado (ver pendência no resumo da entrega —
// hoje nenhuma tela grava esse campo ainda). Enquanto isso não existir, esta
// rotina simplesmente não encontrará candidatos (fail-safe: nunca dispara
// achando que todo mundo está inativo).
//
// Nunca informa "há quantos dias" na mensagem — só convida a agir.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { inactivityCheckInMessage } from './_lib/relationshipAssistant/messages.js';
import { localDateISO } from './_lib/relationshipAssistant/timeWindow.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const INACTIVITY_DAYS_THRESHOLD = Number(process.env.INACTIVITY_DAYS_THRESHOLD || 14);
// Não repete o check-in de inatividade mais de 1x a cada N dias, mesmo que o
// usuário continue inativo — evita virar rotina mensal incômoda.
const INACTIVITY_COOLDOWN_DAYS = Number(process.env.INACTIVITY_COOLDOWN_DAYS || 21);

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const cutoff = new Date(Date.now() - INACTIVITY_DAYS_THRESHOLD * 86400000).toISOString();
    const candidatos = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,last_access_at&onboarding_completed=eq.true&whatsapp=not.is.null&last_access_at=lte.${cutoff}`
    );

    let enviados = 0, pulados = 0;
    for (const profile of candidatos || []) {
      const text = inactivityCheckInMessage(profile.first_name);
      // scopeKey = janela de cooldown (bloco de N dias) — impede repetir o
      // check-in todo dia enquanto o usuário continuar ausente.
      const cooldownBucket = Math.floor(Date.now() / (INACTIVITY_COOLDOWN_DAYS * 86400000));
      const result = await sendProactiveNotification({
        profile,
        notificationType: 'INACTIVITY_CHECK_IN',
        scopeKey: `cooldown-${cooldownBucket}`,
        text,
      });
      if (result.sent) enviados++; else pulados++;
    }

    return res.status(200).json({ ok: true, avaliados: candidatos?.length || 0, enviados, pulados });
  } catch (err) {
    console.error('[relationship-inactivity-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
