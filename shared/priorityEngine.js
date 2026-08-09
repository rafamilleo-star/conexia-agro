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
 * - proximidade declarada (ajusta peso, não decide sozinha);
 * - momentum da relação, calculado do histórico real de interações
 *   (ajusta peso, não decide sozinho);
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
 * Converte a proximidade declarada do contato (1 = muito próximo,
 * 5 = distante) em um bônus de 0 a 4 para as regras que já existem.
 *
 * Não gera candidato sozinha e não decide prioridade — apenas ajusta
 * o peso de regras existentes: uma relação próxima esfriando ou
 * ultrapassando a frequência ideal merece mais atenção do que uma
 * relação distante nas mesmas condições.
 *
 * @param {object} contact
 * @returns {number|null}
 */
function proximityCloseness(contact) {
  const raw = Number(contact?.proximity);

  if (!Number.isFinite(raw) || raw < 1 || raw > 5) return null;

  return 5 - raw;
}

/**
 * Filtra e ordena (mais antiga primeiro) as interações de um contato
 * específico a partir da lista completa do usuário.
 *
 * Aceita tanto o formato do frontend (contactId/createdAt) quanto o
 * formato cru do Supabase (contact_id/created_at).
 *
 * @param {Array<object>} interactions
 * @param {string} contactId
 * @returns {Array<Date>}
 */
function contactInteractionDates(interactions, contactId) {
  if (!Array.isArray(interactions) || !contactId) return [];

  return interactions
    .filter((i) => (i?.contactId ?? i?.contact_id) === contactId)
    .map((i) => parseDate(i?.createdAt ?? i?.created_at))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Interpreta a tendência de uma relação a partir do histórico real de
 * interações, em vez de depender só de "dias desde o último contato".
 *
 * Exemplo do problema que isso resolve: alguém pode estar há 30 dias
 * sem contato e continuar estável, se o ritmo histórico real dessa
 * relação é a cada 45 dias — mesmo que o campo de frequência ideal
 * cadastrado esteja desatualizado.
 *
 * Estados possíveis:
 * - insufficient_data: histórico curto demais para afirmar qualquer coisa;
 * - new: contato recém-criado, ainda sem ritmo estabelecido;
 * - reactivated: silêncio longo seguido de retomada recente;
 * - strengthening: ritmo atual mais frequente que o histórico;
 * - stable: dentro da variação normal do ritmo histórico;
 * - cooling: intervalo atual bem acima do ritmo histórico.
 *
 * Exige no mínimo 2 interações para calcular ritmo — nunca afirma
 * tendência com base em 1 único ponto de dado.
 *
 * @param {object} contact
 * @param {Array<object>} interactions
 * @param {Date} referenceDate
 * @returns {string}
 */
function relationshipMomentum(contact, interactions, referenceDate) {
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

  /*
   * Reativação: exige pelo menos 3 interações pra ter uma base de
   * comparação (o intervalo "normal" entre as interações mais antigas)
   * antes de afirmar que houve um silêncio longo seguido de retomada.
   */
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
 * @param {string} [momentum]
 * @returns {object}
 */
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
 * Converte o estado de momentum em um ajuste de pontuação para as
 * regras que dependem de "tempo sem contato". Mesma filosofia da
 * proximidade: sinal que ajusta peso, nunca cria ou remove candidato
 * sozinho.
 *
 * cooling reforça o alerta; stable/strengthening o atenua, porque
 * sugere que o intervalo atual é normal para o ritmo real dessa
 * relação (mesmo que o campo de frequência ideal cadastrado esteja
 * desatualizado). new/reactivated/insufficient_data não alteram nada
 * — não há evidência suficiente para puxar o placar em nenhuma direção.
 *
 * @param {string} momentum
 * @returns {number}
 */
function momentumAdjustment(momentum) {
  if (momentum === "cooling") return 4;
  if (momentum === "stable" || momentum === "strengthening") return -6;
  return 0;
}

/**
 * Cria candidatos para um contato.
 *
 * @param {object} contact
 * @param {Date} referenceDate
 * @param {Array<object>} interactions Histórico completo do usuário (todos
 *   os contatos) — a função filtra internamente pelo contato atual.
 * @returns {Array<object>}
 */
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
        : `Faltam ${birthdayDistance} ${
            birthdayDistance === 1 ? "dia" : "dias"
          }. Vale preparar uma mensagem pessoal.`;

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

    const closeness = proximityCloseness(contact) || 0;
    const momentumBonus = momentumAdjustment(momentum);

    candidates.push(
      createCandidate(
        contact,
        "frequency_exceeded",
        `Talvez valha lembrar de ${contact.name}`,
        `Faz ${daysWithoutContact} dias desde o último registro. O ritmo que você definiu para essa relação era de aproximadamente ${idealFrequency} dias.`,
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
    const closeness = proximityCloseness(contact) || 0;

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
 * @param {Array<object>} [interactions] Histórico completo de interações
 *   do usuário. Opcional — quando omitido, o momentum de cada contato
 *   cai em "insufficient_data" e nenhuma regra é afetada (mesmo
 *   comportamento de antes desta mudança).
 * @returns {{main: object|null, secondary: Array<object>}}
 */
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

  for (const contact of Array.isArray(contacts) ? contacts : []) {
    const feedback = feedbackMap?.[contact.id] || null;
    const candidates = buildContactCandidates(contact, today, interactions);

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
