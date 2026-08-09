/**
 * CONÉXIA — Motor único de prioridade relacional
 *
 * Recebe os contatos já normalizados pelo App.jsx e devolve:
 *
 * {
 *   main: recomendação principal ou null,
 *   secondary: até duas recomendações secundárias
 * }
 *
 * O motor considera:
 * - próxima ação vencida;
 * - aniversário próximo;
 * - pessoa importante sem interação;
 * - frequência ideal ultrapassada;
 * - relevância estratégica;
 * - respostas anteriores do usuário.
 */

import { isRecommendationSuppressed } from "./alertsFeedback.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Converte uma data em objeto Date válido.
 *
 * @param {*} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Remove horário para comparações de calendário.
 *
 * @param {Date} date
 * @returns {Date}
 */
function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Calcula quantos dias se passaram desde uma data.
 *
 * @param {*} dateValue
 * @param {Date} referenceDate
 * @returns {number|null}
 */
function daysSince(dateValue, referenceDate) {
  const date = parseDate(dateValue);

  if (!date) return null;

  return Math.max(
    0,
    Math.floor(
      (startOfDay(referenceDate).getTime() - startOfDay(date).getTime()) /
        DAY_MS
    )
  );
}

/**
 * Calcula quantos dias faltam para o próximo aniversário.
 *
 * @param {*} birthday
 * @param {Date} referenceDate
 * @returns {number|null}
 */
function birthdayDaysAway(birthday, referenceDate) {
  if (!birthday) return null;

  /*
   * Utiliza os componentes da string YYYY-MM-DD para evitar alterações
   * causadas pelo fuso horário.
   */
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

/**
 * Calcula relevância com base nos quatro campos estratégicos.
 *
 * Os campos podem chegar como:
 * - números de 1 a 10;
 * - strings numéricas;
 * - booleanos;
 * - null.
 *
 * @param {object} contact
 * @returns {number|null}
 */
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

  /*
   * Mantém compatibilidade com os campos atuais de 1 a 10.
   * Se algum projeto estiver salvando de 0 a 100, normaliza.
   */
  const normalized = valid.map((value) =>
    value > 10 ? Math.min(100, value) : Math.min(100, value * 10)
  );

  return Math.round(
    normalized.reduce((sum, value) => sum + value, 0) /
      normalized.length
  );
}

/**
 * Identificador estável da recomendação.
 *
 * @param {string} contactId
 * @param {string} actionType
 * @returns {string}
 */
function recommendationId(contactId, actionType) {
  return `${contactId}:${actionType}`;
}

/**
 * Cria o formato consumido por HomeToday.jsx.
 *
 * @param {object} contact
 * @param {string} actionType
 * @param {string} title
 * @param {string} reason
 * @param {number} score
 * @returns {object}
 */
function createCandidate(
  contact,
  actionType,
  title,
  reason,
  score
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
  };
}

/**
 * Verifica se uma data de próxima ação está vencida.
 *
 * @param {*} value
 * @param {Date} referenceDate
 * @returns {number|null}
 */
function overdueDays(value, referenceDate) {
  const date = parseDate(value);

  if (!date) return null;

  const today = startOfDay(referenceDate);
  const target = startOfDay(date);

  if (target.getTime() >= today.getTime()) {
    return null;
  }

  return Math.floor((today.getTime() - target.getTime()) / DAY_MS);
}

/**
 * Cria candidatos para um contato.
 *
 * @param {object} contact
 * @param {Date} referenceDate
 * @returns {Array<object>}
 */
function buildContactCandidates(contact, referenceDate) {
  const candidates = [];

  if (!contact?.id || !contact?.name) {
    return candidates;
  }

  const relevance = calculateRelevance(contact);
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
   * É o sinal mais objetivo de que existe algo combinado.
   */
  const daysOverdue = overdueDays(actionDate, referenceDate);

  if (daysOverdue !== null) {
    const reason =
      daysOverdue === 1
        ? `Você tinha uma próxima ação combinada com ${contact.name} para ontem.`
        : `A próxima ação combinada com ${contact.name} está atrasada há ${daysOverdue} dias.`;

    candidates.push(
      createCandidate(
        contact,
        "overdue_next_action",
        `Retomar o combinado com ${contact.name}`,
        actionText
          ? `${reason} Próximo passo registrado: ${actionText}.`
          : reason,
        100 + Math.min(daysOverdue, 30)
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
        : `Faltam ${birthdayDistance} ${
            birthdayDistance === 1 ? "dia" : "dias"
          }. Vale preparar uma mensagem pessoal.`;

    candidates.push(
      createCandidate(
        contact,
        "birthday",
        title,
        reason,
        birthdayDistance === 0 ? 96 : 88 - birthdayDistance
      )
    );
  }

  /*
   * 3. Pessoa importante sem nenhuma interação registrada.
   */
  if (!lastInteraction && relevance !== null && relevance >= 60) {
    candidates.push(
      createCandidate(
        contact,
        "important_without_history",
        `Comece a cuidar da relação com ${contact.name}`,
        `${contact.name} parece importante para o seu momento, mas ainda não há nenhuma conversa registrada.`,
        82 + Math.round((relevance - 60) / 5)
      )
    );
  }

  /*
   * 4. Frequência ideal ultrapassada.
   */
  if (
    daysWithoutContact !== null &&
    daysWithoutContact > idealFrequency
  ) {
    const excessDays = daysWithoutContact - idealFrequency;

    const strategicBonus =
      relevance !== null
        ? Math.round(relevance / 10)
        : 0;

    candidates.push(
      createCandidate(
        contact,
        "frequency_exceeded",
        `Talvez valha lembrar de ${contact.name}`,
        `Faz ${daysWithoutContact} dias desde o último registro. O ritmo que você definiu para essa relação era de aproximadamente ${idealFrequency} dias.`,
        65 +
          Math.min(excessDays, 20) +
          strategicBonus
      )
    );
  }

  /*
   * 5. Contato relevante com saúde baixa.
   *
   * O App.jsx já calcula `health` com base em recência e frequência.
   */
  const health = Number(contact.health);

  if (
    Number.isFinite(health) &&
    health > 0 &&
    health < 55 &&
    relevance !== null &&
    relevance >= 70
  ) {
    candidates.push(
      createCandidate(
        contact,
        "strategic_relationship_cooling",
        `${contact.name} pode merecer sua atenção`,
        "É uma relação relevante para o seu momento e há pouco registro recente de presença.",
        76 +
          Math.round((relevance - 70) / 5) +
          Math.round((55 - health) / 10)
      )
    );
  }

  return candidates;
}

/**
 * Evita mostrar duas recomendações diferentes sobre a mesma pessoa
 * na mesma Home.
 *
 * @param {Array<object>} candidates
 * @returns {Array<object>}
 */
function keepBestCandidatePerContact(candidates) {
  const bestByContact = new Map();

  for (const candidate of candidates) {
    const current = bestByContact.get(candidate.relationshipId);

    if (!current || candidate.score > current.score) {
      bestByContact.set(candidate.relationshipId, candidate);
    }
  }

  return Array.from(bestByContact.values());
}

/**
 * Calcula a recomendação principal e até duas secundárias.
 *
 * @param {Array<object>} contacts
 * @param {Record<string, object>} feedbackMap
 * @param {Date|string} referenceDate
 * @returns {{main: object|null, secondary: Array<object>}}
 */
export function computePriorities(
  contacts = [],
  feedbackMap = {},
  referenceDate = new Date()
) {
  const today =
    parseDate(referenceDate) ||
    new Date();

  const allCandidates = [];

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const feedback = feedbackMap?.[contact.id] || null;
    const candidates = buildContactCandidates(contact, today);

    for (const candidate of candidates) {
      const suppressed = isRecommendationSuppressed(
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

  const ordered = keepBestCandidatePerContact(allCandidates)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return String(a.contactName || "").localeCompare(
        String(b.contactName || ""),
        "pt-BR"
      );
    })
    .slice(0, 3);

  return {
    main: ordered[0] || null,
    secondary: ordered.slice(1, 3),
  };
}

export default computePriorities;
