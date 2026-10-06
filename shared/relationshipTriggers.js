// Gatilhos baseados somente em datas e próximos passos registrados.
const DAY = 86400000;

export function localDay(value = new Date(), timezone = 'America/Sao_Paulo') {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  }
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

const distance = (from, to) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);
const closed = status => ['cancelado', 'concluido', 'cancelled', 'canceled', 'completed', 'done', 'dismissed', 'expired', 'superseded'].includes(status);

export function buildRelationshipTriggers(contacts = [], context = {}, now = new Date()) {
  const timezone = context.timezone || 'America/Sao_Paulo';
  const today = localDay(now, timezone);
  if (!today) return [];
  const people = new Map(contacts.map(c => [c.id, c]));
  const candidates = [];
  const add = (contact, key, type, title, reason, nextMove, score, evidence) => {
    candidates.push({ recommendationId: `${contact.id}:${key}`, relationshipId: contact.id, contactId: contact.id,
      contactName: contact.name, actionType: type, title, reason, nextMove, score, confidence: 1,
      evidence, momentum: 'insufficient_data', actionable: true });
  };

  for (const contact of contacts) {
    if (closed(contact.status)) continue;
    const date = validDateOnly(contact.next_action_date ?? contact.nextActionDate);
    const text = String(contact.next_action ?? contact.nextAction ?? '').trim();
    if (!date || !text || !contact.id || !contact.name) continue;
    const created = contact.created_at ?? contact.createdAt;
    if (created && date < localDay(created, timezone)) continue;
    const days = distance(today, date);
    if (days < 0 || days > 1) continue; // atrasados permanecem no motor original
    add(contact, `next_action:${date}`, 'upcoming_next_action', `${days === 0 ? 'Hoje' : 'Amanhã'}: ${text}`,
      `Você registrou um próximo passo com ${contact.name} para ${days === 0 ? 'hoje' : 'amanhã'}: ${text}.`, text,
      days === 0 ? 115 : 105, { source: 'contacts', sourceId: contact.id, date, text });
  }

  for (const memory of context.memories || []) {
    if (memory.status !== 'active' || memory.memory_type !== 'commitment' || Number(memory.confidence) < 0.8) continue;
    const contact = people.get(memory.contact_id);
    if (!contact?.name || closed(contact.status)) continue;
    const meta = memory.metadata || {};
    if (meta.completed === true || closed(meta.status)) continue;
    if (memory.valid_from && Date.parse(memory.valid_from) > now.getTime()) continue;
    if (memory.valid_until && Date.parse(memory.valid_until) < now.getTime()) continue;
    const date = validDateOnly(meta.due_date);
    const nextMove = String(meta.next_action || '').trim();
    if (!date || !nextMove || meta.confirmed !== true) continue;
    const days = distance(today, date);
    if (days > 1 || days < -30) continue;
    const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : 'uma data que já passou';
    add(contact, `commitment:${memory.id}`, 'tracked_commitment', `Acompanhar o combinado com ${contact.name}`,
      `Há um compromisso confirmado para ${when}: ${memory.summary || memory.content}.`, nextMove,
      days < 0 ? 120 + Math.min(-days, 10) : days === 0 ? 116 : 106,
      { source: 'relational_memory', sourceId: memory.id, date, excerpt: memory.source_excerpt });
  }

  for (const event of context.events || []) {
    const contact = people.get(event.contact_id);
    if (!contact?.name || closed(contact.status) || closed(event.status)) continue;
    const at = Date.parse(event.scheduled_at);
    if (!Number.isFinite(at)) continue;
    const date = localDay(event.scheduled_at, timezone);
    const days = distance(today, date);
    const end = at + Math.max(0, Number(event.duration_minutes) || 0) * 60000;
    if (event.status === 'pendente' && at >= now.getTime() && days >= 0 && days <= 1) {
      add(contact, `event_prepare:${event.id}`, 'event_preparation', `Preparar a conversa com ${contact.name}`,
        `Há um encontro registrado com ${contact.name} ${days === 0 ? 'hoje' : 'amanhã'}.`,
        'Rever o contexto e os assuntos em aberto antes da conversa.', days === 0 ? 112 : 102,
        { source: 'scheduled_events', sourceId: event.id, date, at: event.scheduled_at });
    } else if (event.status === 'pendente' && end < now.getTime() && days >= -2 && !event.converted_interaction_id) {
      add(contact, `event_followup:${event.id}`, 'event_followup', `Confirmar o encontro com ${contact.name}`,
        'A data prevista do encontro passou e ainda não há confirmação de realização. Isso não comprova que a conversa aconteceu.',
        'Confirmar se o encontro aconteceu e registrar o próximo passo, se houver.', 90,
        { source: 'scheduled_events', sourceId: event.id, date, at: event.scheduled_at });
    }
  }
  return candidates;
}
