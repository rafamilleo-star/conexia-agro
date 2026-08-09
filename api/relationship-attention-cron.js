// api/relationship-attention-cron.js
// Job: scan-relationships-needing-attention
//
// Para cada usuário PRO (recurso hoje gated como PRO, igual contact_coaching/
// query_insights no webhook — ver ENGENHARIA abaixo), calcula a ação de maior
// prioridade do dia e, se houver uma relevante, envia como RELATIONSHIP_ATTENTION.
// O limite de 1 mensagem automática/dia (em sendProactiveNotification) já
// impede que isso conflite com onboarding/inatividade/resumo semanal no
// mesmo dia — quem já recebeu algo hoje simplesmente não recebe este também.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { relationshipAttentionMessage } from './_lib/relationshipAssistant/messages.js';
import { computeNextBestActions } from './_lib/relationshipAssistant/actionEngine.js';
import { localDateISO } from './_lib/relationshipAssistant/timeWindow.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
// Só dispara mensagem proativa quando a prioridade calculada é alta o
// suficiente — evita notificar por qualquer coisa marginal.
const MIN_PRIORITY_TO_NOTIFY = Number(process.env.RELATIONSHIP_ATTENTION_MIN_PRIORITY || 85);

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
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro,plan&onboarding_completed=eq.true&whatsapp=not.is.null&is_pro=eq.true`
    );

    let enviados = 0, pulados = 0, semAcao = 0;
    for (const profile of perfis || []) {
      const [contacts, interactions] = await Promise.all([
        sb(
          `contacts?user_id=eq.${profile.id}&select=id,name,created_at,proximity,ideal_frequency_days,last_interaction_at,next_action,next_action_date,birthday,influencia_pessoas,gera_oportunidade,abre_portas,momento_atual`
        ),
        sb(
          `interactions?user_id=eq.${profile.id}&select=contact_id,created_at`
        ),
      ]);
      const [top] = computeNextBestActions(contacts, interactions);
      if (!top || top.priority < MIN_PRIORITY_TO_NOTIFY) { semAcao++; continue; }

      const todayISO = localDateISO(profile.timezone);
      const text = relationshipAttentionMessage({
        firstName: profile.first_name,
        contactName: top.contactName,
        reason: top.reason,
      });

      const result = await sendProactiveNotification({
        profile,
        notificationType: 'RELATIONSHIP_ATTENTION',
        relationshipId: top.relationshipId,
        scopeKey: `${top.relationshipId}:${todayISO}`,
        text,
      });
      if (result.sent) enviados++; else pulados++;
    }

    return res.status(200).json({ ok: true, avaliados: perfis?.length || 0, enviados, pulados, semAcao });
  } catch (err) {
    console.error('[relationship-attention-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
