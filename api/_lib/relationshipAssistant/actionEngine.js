// api/_lib/relationshipAssistant/actionEngine.js
//
// Prioriza no máximo 3 ações relacionais por usuário, usando só o que já
// existe em `contacts` (equivalente ao "Relationship" da spec):
// proximity (importância declarada), ideal_frequency_days, last_interaction_at,
// next_action / next_action_date, birthday.
//
// Nunca inventa fatos: toda "reason" é derivada só de campos presentes.

const DAY_MS = 86400000;

function daysSince(dateStr) {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / DAY_MS;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return (new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / DAY_MS;
}

// Cada contato vira 0 ou 1 "candidata a ação", com uma pontuação de prioridade.
// A ordem dos ifs importa: vencido > importante sem interação > próximo do
// prazo de frequência > ação futura próxima.
function evaluateContact(contact) {
  const importancia = contact.proximity || 0; // 1-5 (escala já usada no app)
  const freqDias = contact.ideal_frequency_days || null;
  const diasDesdeUltima = daysSince(contact.last_interaction_at);

  // 1) Ação agendada vencida (next_action_date no passado)
  if (contact.next_action && contact.next_action_date) {
    const diasAte = daysUntil(contact.next_action_date);
    if (diasAte !== null && diasAte < 0) {
      return {
        actionType: 'OVERDUE_ACTION',
        title: `Ação pendente com ${contact.name}`,
        reason: `Você marcou "${contact.next_action}" e o prazo já passou.`,
        priority: 95 + Math.min(5, Math.abs(diasAte)),
      };
    }
    // 2) Ação agendada próxima (nos próximos 3 dias)
    if (diasAte !== null && diasAte >= 0 && diasAte <= 3) {
      return {
        actionType: 'UPCOMING_ACTION',
        title: `Ação próxima com ${contact.name}`,
        reason: `"${contact.next_action}" está previsto para breve.`,
        priority: 80 - diasAte,
      };
    }
  }

  // 3) Relação importante (proximity alta) sem nenhuma interação registrada
  if (importancia >= 4 && !contact.last_interaction_at) {
    return {
      actionType: 'RECONNECT_NO_HISTORY',
      title: `Que tal falar com ${contact.name}?`,
      reason: `Você marcou essa relação como importante, mas ainda não há interação registrada.`,
      priority: 88,
    };
  }

  // 4) Relação passou (ou está perto de passar) da frequência desejada
  if (freqDias && diasDesdeUltima !== null && diasDesdeUltima >= freqDias) {
    const atraso = diasDesdeUltima - freqDias;
    return {
      actionType: 'RECONNECT',
      title: `Que tal falar com ${contact.name}?`,
      reason: `Faz algum tempo desde a última interação e você marcou essa relação como importante.`,
      priority: 60 + importancia * 5 + Math.min(20, atraso),
    };
  }

  return null;
}

// contacts: array vindo de `contacts` do usuário.
// Retorna no máximo 3 ações, ordenadas por prioridade desc.
export function computeNextBestActions(contacts) {
  const candidates = (contacts || [])
    .map(c => {
      const evaluated = evaluateContact(c);
      if (!evaluated) return null;
      return {
        relationshipId: c.id,
        contactName: c.name,
        ...evaluated,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority);

  return candidates.slice(0, 3);
}

// Até 3 relações "que merecem atenção" para o resumo semanal — mesmo motor,
// mas formatado como frases prontas (sem dado sensível).
export function computeWeeklyAttentionItems(contacts, todayISO) {
  const actions = computeNextBestActions(contacts);
  const items = actions.map(a => a.reason.replace(/^Faz algum tempo.*$/, `${a.contactName} está próximo da frequência que você definiu.`));

  // Aniversários da semana (próximos 7 dias, sem expor mais nada do contato)
  const hoje = new Date(todayISO || new Date().toISOString().slice(0, 10) + 'T00:00:00');
  const aniversariantes = (contacts || []).filter(c => {
    if (!c.birthday) return false;
    const [, mes, dia] = c.birthday.split('-').map(Number);
    const proximo = new Date(hoje.getFullYear(), mes - 1, dia);
    if (proximo < hoje) proximo.setFullYear(hoje.getFullYear() + 1);
    const diff = (proximo - hoje) / DAY_MS;
    return diff >= 0 && diff <= 7;
  }).map(c => `${c.name} faz aniversário essa semana.`);

  return [...items, ...aniversariantes].slice(0, 3);
}
