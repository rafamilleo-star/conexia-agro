// api/_lib/relationshipAssistant/sendProactiveNotification.js
//
// Ponto único por onde toda notificação PROATIVA (onboarding, inatividade,
// resumo semanal, atenção, próxima ação) precisa passar. Aplica, nesta ordem,
// todas as regras gerais da spec — nenhum cron deve enviar direto pelo
// provider sem passar por aqui:
//
//   1) notifications_enabled / weekly_summary_enabled (usuário desativou?)
//   2) whatsapp_opt_in (consentimento)
//   3) quiet hours no timezone do usuário (nunca de madrugada)
//   4) limite de 1 mensagem automática/dia (dailyLimitReached)
//   5) idempotência (alreadySent, pela idempotencyKey)
//
// Só então: loga 'scheduled' -> envia pelo provider -> marca 'sent'/'failed'.

import { getWhatsAppProvider } from './whatsappSender.js';
import { buildIdempotencyKey, alreadySent, dailyLimitReached, logScheduled, markSent, markFailed, markSkipped } from './notificationLog.js';
import { isQuietHours, localDateISO } from './timeWindow.js';
import { containsForbiddenTone } from './messages.js';

/**
 * @param {object} params
 * @param {object} params.profile - linha de `profiles` (precisa: id, whatsapp, timezone, notifications_enabled, weekly_summary_enabled, whatsapp_opt_in)
 * @param {string} params.notificationType - ONBOARDING_REMINDER | INACTIVITY_CHECK_IN | WEEKLY_RELATIONSHIP_SUMMARY | RELATIONSHIP_ATTENTION | NEXT_BEST_ACTION
 * @param {string} params.scopeKey - parte variável da chave de idempotência (ex.: data local, ou `${relationshipId}:${step}`)
 * @param {string} params.text - texto final já personalizado (nunca conteúdo sensível)
 * @param {string} [params.relationshipId]
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function sendProactiveNotification({ profile, notificationType, scopeKey, text, relationshipId }) {
  if (!profile?.whatsapp) return { sent: false, reason: 'no_whatsapp_number' };

  if (notificationType === 'WEEKLY_RELATIONSHIP_SUMMARY' && profile.weekly_summary_enabled === false) {
    return { sent: false, reason: 'weekly_summary_disabled' };
  }
  if (notificationType !== 'WEEKLY_RELATIONSHIP_SUMMARY' && profile.notifications_enabled === false) {
    return { sent: false, reason: 'notifications_disabled' };
  }
  if (profile.whatsapp_opt_in === false) {
    return { sent: false, reason: 'no_opt_in' };
  }
  if (isQuietHours(profile.timezone)) {
    return { sent: false, reason: 'quiet_hours' };
  }
  if (containsForbiddenTone(text)) {
    // Defesa em profundidade: nunca deveria acontecer vindo dos templates,
    // mas se acontecer, bloqueia o envio em vez de mandar tom de cobrança.
    return { sent: false, reason: 'forbidden_tone_blocked' };
  }

  const todayISO = localDateISO(profile.timezone);
  const idempotencyKey = buildIdempotencyKey({ userId: profile.id, notificationType, scopeKey: scopeKey || todayISO });

  if (await alreadySent(idempotencyKey)) {
    return { sent: false, reason: 'already_sent' };
  }
  if (await dailyLimitReached(profile.id, todayISO)) {
    return { sent: false, reason: 'daily_limit_reached' };
  }

  const logRow = await logScheduled({
    userId: profile.id,
    relationshipId,
    notificationType,
    channel: 'whatsapp',
    content: text,
    idempotencyKey,
  });

  const provider = getWhatsAppProvider();
  const result = await provider.sendMessage({ number: profile.whatsapp, text });

  if (!result.ok) {
    if (logRow?.id) await markFailed(logRow.id, result.error);
    return { sent: false, reason: result.error || 'provider_failed' };
  }

  if (logRow?.id) await markSent(logRow.id, result.providerMessageId);
  return { sent: true };
}
