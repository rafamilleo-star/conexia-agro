// api/_lib/relationshipAssistant/notificationLog.js
//
// Idempotência, auditoria e limite de 1 mensagem automática/dia por usuário,
// em cima da tabela notification_log (ver migration relationship_assistant_schema).
//
// Todo envio proativo passa por aqui ANTES de chamar o provider de WhatsApp.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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

// Chave de idempotência determinística: mesmo tipo + mesmo usuário + mesmo
// "escopo" (normalmente a data, YYYY-MM-DD no timezone do usuário, ou o id do
// relacionamento quando o tipo é por-contato) nunca gera duas linhas 'sent'.
export function buildIdempotencyKey({ userId, notificationType, scopeKey }) {
  return `${notificationType}:${userId}:${scopeKey}`;
}

// true se essa notificação (por chave de idempotência) já foi enviada com sucesso.
export async function alreadySent(idempotencyKey) {
  const rows = await sb(
    `notification_log?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&status=eq.sent&select=id&limit=1`
  );
  return !!rows?.length;
}

// true se o usuário já recebeu QUALQUER mensagem automática hoje (regra geral
// da spec: nunca mais de uma mensagem automática por dia, independente do tipo).
// dateISO deve ser a data local do usuário (YYYY-MM-DD), calculada pelo chamador
// a partir do timezone do profile.
export async function dailyLimitReached(userId, dateISO) {
  const startUTC = new Date(`${dateISO}T00:00:00.000Z`).toISOString();
  const endUTC = new Date(`${dateISO}T23:59:59.999Z`).toISOString();
  const rows = await sb(
    `notification_log?user_id=eq.${userId}&status=eq.sent&sent_at=gte.${startUTC}&sent_at=lte.${endUTC}&select=id&limit=1`
  );
  return !!rows?.length;
}

// Registra a tentativa (status 'scheduled') antes de enviar — garante rastro
// mesmo se o processo morrer no meio do envio.
export async function logScheduled({ userId, relationshipId, notificationType, channel, content, idempotencyKey }) {
  const rows = await sb('notification_log', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      relationship_id: relationshipId || null,
      notification_type: notificationType,
      channel: channel || 'whatsapp',
      content: content || null,
      status: 'scheduled',
      idempotency_key: idempotencyKey,
    }),
  });
  return rows?.[0] || null;
}

export async function markSent(logId, providerMessageId) {
  await sb(`notification_log?id=eq.${logId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: providerMessageId || null }),
  });
}

export async function markFailed(logId, failureReason) {
  await sb(`notification_log?id=eq.${logId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'failed', failure_reason: String(failureReason || '').slice(0, 500) }),
  });
}

export async function markSkipped(logId, reason) {
  await sb(`notification_log?id=eq.${logId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'skipped', failure_reason: String(reason || '').slice(0, 200) }),
  });
}

export async function markCancelled(idempotencyKeyPrefix) {
  // Cancela notificações agendadas (ainda não enviadas) cuja chave começa com
  // o prefixo dado — usado por cancel-obsolete-notifications, ex.: quando o
  // onboarding é concluído, cancela ONBOARDING_REMINDER:<userId>:* pendentes.
  await sb(
    `notification_log?idempotency_key=like.${encodeURIComponent(idempotencyKeyPrefix)}*&status=eq.scheduled`,
    { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }
  );
}

export { sb as supabaseRest };
