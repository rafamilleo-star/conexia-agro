/**
 * CONÉXIA — Motor único de prioridade relacional
 *
 * Regras temporais blindadas:
 * - datas impossíveis são ignoradas;
 * - próxima ação anterior à criação do contato não é válida;
 * - datas futuras não viram "0 dias";
 * - atrasos antigos não exibem números absurdos;
 * - linguagem temporal prioriza contexto humano, não cronômetro.
 */

import { isRecommendationSuppressed } from "./alertsFeedback.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_ACTION_DAYS = 180;

function parseDate(value) {
  if (!value) return null;

  // Datas YYYY-MM-DD são interpretadas em horário local para evitar
  // deslocamento de um dia por UTC/fuso.
  if (typeof value === "string") {
    const raw = value.trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);

      const local = new Date(year, month, day);

      if (
        local.getFullYear() === year &&
        local.getMonth() === month &&
        local.getDate() === day
      ) {
        return local;
      }

      return null;
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function calendarDiffDays(fromDate, toDate) {
  const from = startOfDay(fromDate).getTime();
  const to = startOfDay(toDate).getTime();
  return Math.round((to - from) / DAY_MS);
}

function daysSince(dateValue, referenceDate) {
  const date = parseDate(dateValue);
  if (!date) return null;

  const diff = calendarDiffDays(date, referenceDate);

  // Uma data futura não significa "0 dias atrás".
  if (diff < 0) return null;

  return diff;
}

function birthdayDaysAway(birthday, referenceDate) {
  if (!birthday) return null;

  const raw = String(birthday).slice(0, 10);
  const parts = raw.split("-").map(Number);

  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    return null;
  }

  const month = parts[1] - 1;
  const day = parts[2];

  const today = startOfDay(referenceDate);
  const next = new Date(today.getFullYear(), month, day);

  if (next.getTime() < today.getTime()) {
    next.setFullYear(today.getFullYear() + 1);
  }

  return Math.round((next.getTime() - today.getTime()) / DAY_MS);
}

export function calculateRelevance(contact) {
  const rawFields = [
    contact?.influenciaPessoas ?? contact?.influencia_pessoas,
    contact?.geraOportunidade ?? contact?.gera_oportunidade,
    contact?.abrePortas ?? contact?.abre_portas,
    contact?.momentoAtual ?? contact?.momento_atual,
  ];

  const values = rawFields.map((value) => {
    if (value === true) return 10;
    if (value === false) return 0;

    if (value === null || value === undefined || value === "") {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  });

  const valid = values.filter((value) => value !== null);
  if (valid.length === 0) return null;

  const normalized = valid.map((value) =>
    value > 10 ? Math.min(100, value) : Math.min(100, value * 10)
  );

  return Math.round(
    normalized.reduce((sum, value) => sum + value, 0) /
      normalized.length
  );
}

function proximityCloseness(contact) {
  const raw = Number(contact?.proximity);

  if (!Number.isFinite(raw) || raw < 1 || raw > 5) return null;

  return 5 - raw;
}

export function contactInteractionDates(interactions, contactId) {
  if (!Array.isArray(interactions) || !contactId) return [];

  return interactions
    .filter((i) => (i?.contactId ?? i?.contact_id) === contactId)
    .map((i) => parseDate(i?.createdAt ?? i?.created_at))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
}

export function relationshipMomentum(contact, interactions, referenceDate) {
  const contactId = contact?.id;
  if (!contactId) return "insufficient_data";

  const history = contactInteractionDates(interactions, contactId);
  const createdAt = parseDate(contact?.created_at ?? contact?.createdAt);
  const contactAgeDays = createdAt ? daysSince(createdAt, referenceDate) : null;
  const RECENT_CONTACT_WINDOW = 21;

  if (history.length === 0) {
    if (contactAgeDays !== null && contactAgeDays <= RECENT_CONTACT_WINDOW) {
      return "new";
    }
    return "insufficient_data";
  }

  if (history.length === 1) {
    if (contactAgeDays !== null && contactAgeDays <= RECENT_CONTACT_WINDOW) {
      return "new";
    }
    return "insufficient_data";
  }

  const intervals = [];

  for (let i = 1; i < history.length; i++) {
    intervals.push(
      (history[i].getTime() - history[i - 1].getTime()) / DAY_MS
    );
  }

  const lastInteraction = history[history.length - 1];
  const daysSinceLast = daysSince(lastInteraction, referenceDate);

  if (daysSinceLast === null) return "insufficient_data";

  if (intervals.length >= 2) {
    const priorIntervals = intervals.slice(0, -1);
    const avgPriorInterval =
      priorIntervals.reduce((a, b) => a + b, 0) / priorIntervals.length;

    const lastGap = intervals[intervals.length - 1];

    const hadDormantGap = lastGap >= Math.max(avgPriorInterval * 2, 45);
    const resumedRecently = daysSinceLast <= 14;

    if (hadDormantGap && resumedRecently) {
      return "reactivated";
    }
  }

  const avgInterval =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;

  if (avgInterval <= 0) return "insufficient_data";

  const ratio = daysSinceLast / avgInterval;

  if (ratio <= 0.7) return "strengthening";
  if (ratio <= 1.4) return "stable";
  return "cooling";
}

function recommendationId(contactId, actionType) {
  return `${contactId}:${actionType}`;
}

function createCandidate(
  contact,
  actionType,
  title,
  reason,
  score,
  momentum
) {
  return {
    recommendationId: recommendationId(contact.id, actionType),
    relationshipId: contact.id,
    contactId: contact.id,
    contactName: contact.name,
    actionType,
    title,
    reason,
    score,
    momentum: momentum || "insufficient_data",
  };
}

function isActionDatePlausible(contact, actionDateValue, referenceDate) {
  const actionDate = parseDate(actionDateValue);
  if (!actionDate) return false;

  const createdAt = parseDate(
    contact?.created_at ?? contact?.createdAt
  );

  // Uma próxima ação nunca pode existir antes do próprio contato.
  if (
    createdAt &&
    startOfDay(actionDate).getTime() <
      startOfDay(createdAt).getTime()
  ) {
    return false;
  }

  // Proteção contra datas absurdamente futuras por erro de digitação/import.
  const daysAhead = calendarDiffDays(referenceDate, actionDate);

  if (daysAhead > 3650) {
    return false;
  }

  return true;
}

function overdueDays(contact, value, referenceDate) {
  if (!isActionDatePlausible(contact, value, referenceDate)) {
    return null;
  }

  const date = parseDate(value);
  if (!date) return null;

  const diff = calendarDiffDays(date, referenceDate);

  if (diff <= 0) {
    return null;
  }

  return diff;
}

function overdueHumanText(contactName, daysOverdue) {
  if (daysOverdue === 1) {
    return `Você tinha uma próxima ação combinada com ${contactName} para ontem.`;
  }

  if (daysOverdue <= 7) {
    return `Há alguns dias existe uma próxima ação pendente com ${contactName}.`;
  }

  if (daysOverdue <= 30) {
    return `Existe uma próxima ação pendente com ${contactName} há algumas semanas.`;
  }

  if (daysOverdue <= STALE_ACTION_DAYS) {
    return `Existe uma próxima ação antiga ainda aberta com ${contactName}.`;
  }

  // Se chegou aqui, o compromisso é muito antigo. Pode ser legado, import
  // ou uma ação que deixou de representar a realidade. Não mostramos
  // "790 dias atrasado".
  return `Há uma próxima ação muito antiga registrada com ${contactName}. Vale confirmar se ela ainda faz sentido.`;
}

function momentumAdjustment(momentum) {
  if (momentum === "cooling") return 4;
  if (momentum === "stable" || momentum === "strengthening") return -6;
  return 0;
}

function buildContactCandidates(contact, referenceDate, interactions) {
  const candidates = [];

  if (!contact?.id || !contact?.name) {
    return candidates;
  }

  const relevance = calculateRelevance(contact);
  const momentum = relationshipMomentum(contact, interactions, referenceDate);

  const lastInteraction =
    contact.lastInteraction ||
    contact.last_interaction_at ||
    null;

  const idealFrequency = Math.max(
    1,
    Number(
      contact.idealFreq ||
      contact.ideal_frequency_days ||
      30
    ) || 30
  );

  const daysWithoutContact = daysSince(
    lastInteraction,
    referenceDate
  );

  const actionDate =
    contact.nextActionDate ||
    contact.next_action_date ||
    null;

  const actionText =
    contact.nextAction ||
    contact.next_action ||
    "";

  /*
   * 1. Próxima ação vencida.
   *
   * Só entra se a cronologia for plausível.
   * Atrasos longos são descritos humanamente, sem cronômetro absurdo.
   */
  const daysOverdue = overdueDays(
    contact,
    actionDate,
    referenceDate
  );

  if (daysOverdue !== null) {
    const reason = overdueHumanText(
      contact.name,
      daysOverdue
    );

    candidates.push(
      createCandidate(
        contact,
        "overdue_next_action",
        `Retomar o combinado com ${contact.name}`,
        actionText
          ? `${reason} Próximo passo registrado: ${actionText}.`
          : reason,
        100 + Math.min(daysOverdue, 30),
        momentum
      )
    );
  }

  /*
   * 2. Aniversário próximo.
   */
  const birthdayDistance = birthdayDaysAway(
    contact.birthday,
    referenceDate
  );

  if (
    birthdayDistance !== null &&
    birthdayDistance >= 0 &&
    birthdayDistance <= 7
  ) {
    const title =
      birthdayDistance === 0
        ? `Hoje é aniversário de ${contact.name}`
        : `Aniversário de ${contact.name} está chegando`;

    const reason =
      birthdayDistance === 0
        ? "Uma mensagem pessoal hoje pode fortalecer essa relação sem transformar o momento em contato comercial."
        : birthdayDistance === 1
          ? "O aniversário é amanhã. Vale preparar uma mensagem pessoal."
          : "O aniversário está próximo. Vale preparar uma mensagem pessoal.";

    candidates.push(
      createCandidate(
        contact,
        "birthday",
        title,
        reason,
        birthdayDistance === 0 ? 96 : 88 - birthdayDistance,
        momentum
      )
    );
  }

  /*
   * 3. Pessoa importante sem nenhuma interação registrada.
   */
  if (!lastInteraction && relevance !== null && relevance >= 60) {
    const closeness = proximityCloseness(contact) || 0;

    candidates.push(
      createCandidate(
        contact,
        "important_without_history",
        `Comece a cuidar da relação com ${contact.name}`,
        `${contact.name} parece importante para o seu momento, mas ainda não há nenhuma conversa registrada.`,
        82 + Math.round((relevance - 60) / 5) + closeness,
        momentum
      )
    );
  }

  /*
   * 4. Frequência ideal ultrapassada.
   *
   * Sem despejar contagem exata por padrão.
   */
  if (
    daysWithoutContact !== null &&
    daysWithoutContact > idealFrequency
  ) {
    const excessDays =
      daysWithoutContact - idealFrequency;

    const strategicBonus =
      relevance !== null
        ? Math.round(relevance / 10)
        : 0;

    const closeness =
      proximityCloseness(contact) || 0;

    const momentumBonus =
      momentumAdjustment(momentum);

    const temporalReason =
      daysWithoutContact <= idealFrequency * 1.5
        ? `A relação passou um pouco do ritmo que você definiu para manter contato.`
        : daysWithoutContact <= idealFrequency * 3
          ? `Já faz mais tempo do que o ritmo habitual que você definiu para essa relação.`
          : `Há um silêncio bem maior do que o ritmo que você definiu para essa relação.`;

    candidates.push(
      createCandidate(
        contact,
        "frequency_exceeded",
        `Talvez valha lembrar de ${contact.name}`,
        temporalReason,
        65 +
          Math.min(excessDays, 20) +
          strategicBonus +
          closeness +
          momentumBonus,
        momentum
      )
    );
  }

  /*
   * 5. Contato relevante com saúde baixa.
   */
  const health = Number(contact.health);

  if (
    Number.isFinite(health) &&
    health > 0 &&
    health < 55 &&
    relevance !== null &&
    relevance >= 70
  ) {
    const closeness =
      proximityCloseness(contact) || 0;

    candidates.push(
      createCandidate(
        contact,
        "strategic_relationship_cooling",
        `${contact.name} pode merecer sua atenção`,
        "É uma relação relevante para o seu momento e há pouco registro recente de presença.",
        76 +
          Math.round((relevance - 70) / 5) +
          Math.round((55 - health) / 10) +
          closeness +
          momentumAdjustment(momentum),
        momentum
      )
    );
  }

  return candidates;
}

function keepBestCandidatePerContact(candidates) {
  const bestByContact = new Map();

  for (const candidate of candidates) {
    const current =
      bestByContact.get(candidate.relationshipId);

    if (
      !current ||
      candidate.score > current.score
    ) {
      bestByContact.set(
        candidate.relationshipId,
        candidate
      );
    }
  }

  return Array.from(bestByContact.values());
}

export function computePriorities(
  contacts = [],
  feedbackMap = {},
  referenceDate = new Date(),
  interactions = []
) {
  const today =
    parseDate(referenceDate) ||
    new Date();

  const allCandidates = [];

  for (
    const contact of Array.isArray(contacts)
      ? contacts
      : []
  ) {
    const feedback =
      feedbackMap?.[contact.id] || null;

    const candidates =
      buildContactCandidates(
        contact,
        today,
        interactions
      );

    for (const candidate of candidates) {
      const suppressed =
        isRecommendationSuppressed(
          feedback,
          candidate.recommendationId,
          candidate.actionType,
          today
        );

      if (!suppressed) {
        allCandidates.push(candidate);
      }
    }
  }

  const ordered =
    keepBestCandidatePerContact(
      allCandidates
    )
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return String(
          a.contactName || ""
        ).localeCompare(
          String(b.contactName || ""),
          "pt-BR"
        );
      })
      .slice(0,3);

  return {
    main: ordered[0] || null,
    secondary: ordered.slice(1,3),
  };
}

export default computePriorities;
