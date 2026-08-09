/**
 * CONÉXIA — Detector de padrões comportamentais da rede
 *
 * Módulo separado de shared/priorityEngine.js por design: este arquivo
 * NUNCA decide prioridade e NUNCA recomenda uma pessoa específica. Ele só
 * observa a rede como um todo e devolve padrões, com evidência anexada.
 * Quem decide "falar com quem agora" continua sendo exclusivamente o
 * priorityEngine.
 *
 * Cada função de padrão só devolve um resultado quando há evidência
 * mínima documentada. Sem evidência suficiente, a função retorna `null` e
 * o padrão simplesmente não aparece — nunca inventamos um insight fraco
 * "porque parece plausível".
 *
 * Formato de saída de cada padrão:
 * {
 *   type: string,
 *   state: string,
 *   confidence: number (0 a 1),
 *   evidence: object,
 *   period: { windowDays: number, from: string, to: string }
 * }
 *
 * IMPORTANTE — maturidade da base: em Ago/2026 a base de usuários reais é
 * muito recente (o usuário com mais histórico tem 16 interações em 70
 * dias). A maioria destes padrões vai devolver null pra maioria dos
 * usuários por enquanto — isso é o comportamento correto, não um bug. Os
 * thresholds abaixo não devem ser afrouxados só pra "fazer aparecer algo".
 */

import {
  calculateRelevance,
  relationshipMomentum,
  contactInteractionDates,
} from "./priorityEngine.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / DAY_MS;
}

function periodLabel(windowDays, from, to) {
  return {
    windowDays,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

/**
 * Todas as interações de um contato específico, como objetos completos
 * (não só datas) — usado pelos padrões que precisam do valor bruto além
 * do momento.
 */
function contactInteractions(interactions, contactId) {
  if (!Array.isArray(interactions) || !contactId) return [];
  return interactions.filter(
    (i) => (i?.contactId ?? i?.contact_id) === contactId
  );
}

function interactionDate(i) {
  return parseDate(i?.createdAt ?? i?.created_at);
}

function contactTags(i) {
  return Array.isArray(i?.tags) ? i.tags : [];
}

function intentOf(i) {
  const tag = contactTags(i).find((t) => String(t).startsWith("_intent:"));
  return tag ? String(tag).slice("_intent:".length) : null;
}

/*
 * ------------------------------------------------------------------
 * 1. NETWORK_CONCENTRATION_INCREASING
 * ------------------------------------------------------------------
 * Compara, entre duas janelas de 6 semanas, qual fração das interações
 * foi com os 3 contatos mais falados. Exige volume mínimo em cada
 * janela — com poucas interações, qualquer variação é ruído, não
 * tendência.
 */
const CONCENTRATION_WINDOW_DAYS = 42;
const CONCENTRATION_MIN_INTERACTIONS_PER_WINDOW = 8;
const CONCENTRATION_MIN_MARGIN = 0.15;

function topShare(interactionsInWindow) {
  const counts = new Map();
  for (const i of interactionsInWindow) {
    const cid = i?.contactId ?? i?.contact_id;
    if (!cid) continue;
    counts.set(cid, (counts.get(cid) || 0) + 1);
  }
  const total = interactionsInWindow.length;
  if (total === 0) return null;
  const top3 = [...counts.values()].sort((a, b) => b - a).slice(0, 3);
  const topSum = top3.reduce((a, b) => a + b, 0);
  return topSum / total;
}

function detectNetworkConcentrationIncreasing(interactions, referenceDate) {
  const curFrom = new Date(referenceDate.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);
  const prevFrom = new Date(curFrom.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);

  const current = (interactions || []).filter((i) => {
    const d = interactionDate(i);
    return d && d >= curFrom && d <= referenceDate;
  });
  const previous = (interactions || []).filter((i) => {
    const d = interactionDate(i);
    return d && d >= prevFrom && d < curFrom;
  });

  if (
    current.length < CONCENTRATION_MIN_INTERACTIONS_PER_WINDOW ||
    previous.length < CONCENTRATION_MIN_INTERACTIONS_PER_WINDOW
  ) {
    return null;
  }

  const currentShare = topShare(current);
  const previousShare = topShare(previous);
  if (currentShare === null || previousShare === null) return null;

  const margin = currentShare - previousShare;
  if (margin < CONCENTRATION_MIN_MARGIN) return null;

  return {
    type: "NETWORK_CONCENTRATION_INCREASING",
    state: "concentrating",
    confidence: Math.min(0.9, 0.5 + margin),
    evidence: {
      currentTopShare: Math.round(currentShare * 100) / 100,
      previousTopShare: Math.round(previousShare * 100) / 100,
      currentInteractions: current.length,
      previousInteractions: previous.length,
    },
    period: periodLabel(CONCENTRATION_WINDOW_DAYS, curFrom, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 2. NETWORK_EXPANSION_DECREASING
 * ------------------------------------------------------------------
 * Compara contatos novos (created_at) entre as duas mesmas janelas.
 * Exige pelo menos 2 contatos novos na janela anterior — sem isso, "caiu
 * de 1 para 0" não é uma tendência, é ruído de amostra pequena.
 */
const EXPANSION_MIN_PREVIOUS_NEW_CONTACTS = 2;
const EXPANSION_DROP_RATIO = 0.5;

function detectNetworkExpansionDecreasing(contacts, referenceDate) {
  const curFrom = new Date(referenceDate.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);
  const prevFrom = new Date(curFrom.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);

  const currentNew = (contacts || []).filter((c) => {
    const d = parseDate(c?.created_at ?? c?.createdAt);
    return d && d >= curFrom && d <= referenceDate;
  }).length;
  const previousNew = (contacts || []).filter((c) => {
    const d = parseDate(c?.created_at ?? c?.createdAt);
    return d && d >= prevFrom && d < curFrom;
  }).length;

  if (previousNew < EXPANSION_MIN_PREVIOUS_NEW_CONTACTS) return null;
  if (currentNew > previousNew * EXPANSION_DROP_RATIO) return null;

  const drop = 1 - currentNew / previousNew;

  return {
    type: "NETWORK_EXPANSION_DECREASING",
    state: "decreasing",
    confidence: Math.min(0.85, 0.4 + drop),
    evidence: { currentNewContacts: currentNew, previousNewContacts: previousNew },
    period: periodLabel(CONCENTRATION_WINDOW_DAYS, curFrom, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 3. NEW_CONTACTS_WITHOUT_CONTINUITY
 * ------------------------------------------------------------------
 * Não compara janelas — é sobre o estado atual dos contatos criados
 * recentemente. Exige pelo menos 5 contatos novos no período pra a
 * proporção significar algo.
 */
const NEW_CONTACT_WINDOW_DAYS = 60;
const NEW_CONTACTS_MIN_SAMPLE = 5;
const NO_CONTINUITY_RATIO_THRESHOLD = 0.6;

function detectNewContactsWithoutContinuity(contacts, interactions, referenceDate) {
  const from = new Date(referenceDate.getTime() - NEW_CONTACT_WINDOW_DAYS * DAY_MS);
  const recentContacts = (contacts || []).filter((c) => {
    const d = parseDate(c?.created_at ?? c?.createdAt);
    return d && d >= from && d <= referenceDate;
  });

  if (recentContacts.length < NEW_CONTACTS_MIN_SAMPLE) return null;

  const withoutContinuity = recentContacts.filter((c) => {
    const count = contactInteractionDates(interactions, c.id).length;
    return count <= 1;
  }).length;

  const ratio = withoutContinuity / recentContacts.length;
  if (ratio < NO_CONTINUITY_RATIO_THRESHOLD) return null;

  return {
    type: "NEW_CONTACTS_WITHOUT_CONTINUITY",
    state: "no_continuity",
    confidence: Math.min(0.85, 0.4 + recentContacts.length * 0.03 + (ratio - NO_CONTINUITY_RATIO_THRESHOLD)),
    evidence: {
      totalNewContacts: recentContacts.length,
      withoutContinuity,
      ratio: Math.round(ratio * 100) / 100,
    },
    period: periodLabel(NEW_CONTACT_WINDOW_DAYS, from, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 4. STRATEGIC_RELATIONSHIPS_COOLING
 * ------------------------------------------------------------------
 * Reaproveita relationshipMomentum (Fase 4) e calculateRelevance —
 * nenhuma lógica de tendência nova aqui, só agregação. Exige pelo menos
 * 3 relações estratégicas com momentum computável (não insufficient_data
 * nem new).
 */
const STRATEGIC_RELEVANCE_THRESHOLD = 70;
const STRATEGIC_MIN_SAMPLE = 3;
const STRATEGIC_COOLING_RATIO_THRESHOLD = 0.5;

function detectStrategicRelationshipsCooling(contacts, interactions, referenceDate) {
  const strategic = (contacts || []).filter((c) => {
    const relevance = calculateRelevance(c);
    return relevance !== null && relevance >= STRATEGIC_RELEVANCE_THRESHOLD;
  });

  const withMomentum = strategic
    .map((c) => relationshipMomentum(c, interactions, referenceDate))
    .filter((m) => m !== "insufficient_data" && m !== "new");

  if (withMomentum.length < STRATEGIC_MIN_SAMPLE) return null;

  const coolingCount = withMomentum.filter((m) => m === "cooling").length;
  const ratio = coolingCount / withMomentum.length;
  if (ratio < STRATEGIC_COOLING_RATIO_THRESHOLD) return null;

  return {
    type: "STRATEGIC_RELATIONSHIPS_COOLING",
    state: "cooling",
    confidence: Math.min(0.9, 0.45 + withMomentum.length * 0.05 + (ratio - STRATEGIC_COOLING_RATIO_THRESHOLD)),
    evidence: {
      strategicContactsEvaluated: withMomentum.length,
      coolingCount,
    },
    period: periodLabel(0, referenceDate, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 5. RELATIONSHIPS_ONLY_WHEN_NEEDED
 * ------------------------------------------------------------------
 * O único padrão que depende de IA (tags "_intent:" geradas por
 * api/interaction-intent-classifier-cron.js). Por depender de uma
 * inferência e não de um fato direto, o teto de confiança é mais baixo
 * que os demais padrões, mesmo com bastante evidência.
 *
 * Identifica "eventos de retomada": uma interação que veio depois de um
 * silêncio bem maior que o normal daquela relação. Entre esses eventos,
 * olha quantos foram classificados como reativos.
 */
const RESUMPTION_MIN_GAP_DAYS = 30;
const NEEDED_MIN_TAGGED_EVENTS = 5;
const NEEDED_REACTIVE_RATIO_THRESHOLD = 0.7;
const NEEDED_MAX_CONFIDENCE = 0.6;

function detectRelationshipsOnlyWhenNeeded(contacts, interactions, referenceDate) {
  const taggedEvents = [];

  for (const contact of contacts || []) {
    const history = contactInteractionDates(interactions, contact.id);
    const idealFrequency = Math.max(
      1,
      Number(contact.idealFreq || contact.ideal_frequency_days || 30) || 30
    );
    const gapThreshold = Math.max(idealFrequency * 1.5, RESUMPTION_MIN_GAP_DAYS);

    if (history.length < 2) continue;

    const contactIx = contactInteractions(interactions, contact.id)
      .slice()
      .sort((a, b) => interactionDate(a) - interactionDate(b));

    for (let i = 1; i < contactIx.length; i++) {
      const prevDate = interactionDate(contactIx[i - 1]);
      const curDate = interactionDate(contactIx[i]);
      if (!prevDate || !curDate) continue;

      const gap = daysBetween(curDate, prevDate);
      if (gap < gapThreshold) continue;

      const intent = intentOf(contactIx[i]);
      if (intent === "reactive" || intent === "proactive") {
        taggedEvents.push(intent);
      }
    }
  }

  if (taggedEvents.length < NEEDED_MIN_TAGGED_EVENTS) return null;

  const reactiveCount = taggedEvents.filter((t) => t === "reactive").length;
  const ratio = reactiveCount / taggedEvents.length;
  if (ratio < NEEDED_REACTIVE_RATIO_THRESHOLD) return null;

  return {
    type: "RELATIONSHIPS_ONLY_WHEN_NEEDED",
    state: "reactive_pattern",
    confidence: Math.min(
      NEEDED_MAX_CONFIDENCE,
      0.3 + taggedEvents.length * 0.02 + (ratio - NEEDED_REACTIVE_RATIO_THRESHOLD)
    ),
    evidence: {
      resumptionEventsEvaluated: taggedEvents.length,
      reactiveShare: Math.round(ratio * 100) / 100,
    },
    period: periodLabel(0, referenceDate, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 6. CORE_RELATIONSHIPS_STRENGTHENING
 * ------------------------------------------------------------------
 * Mesma base do padrão 4, filtrando por proximidade declarada (1-2 =
 * núcleo) em vez de relevância estratégica.
 */
const CORE_PROXIMITY_THRESHOLD = 2;
const CORE_MIN_SAMPLE = 3;

function detectCoreRelationshipsStrengthening(contacts, interactions, referenceDate) {
  const core = (contacts || []).filter((c) => {
    const p = Number(c?.proximity);
    return Number.isFinite(p) && p >= 1 && p <= CORE_PROXIMITY_THRESHOLD;
  });

  const momenta = core
    .map((c) => relationshipMomentum(c, interactions, referenceDate))
    .filter((m) => m !== "insufficient_data" && m !== "new");

  if (momenta.length < CORE_MIN_SAMPLE) return null;

  const strengtheningCount = momenta.filter((m) => m === "strengthening").length;
  const stableCount = momenta.filter((m) => m === "stable").length;
  const coolingCount = momenta.filter((m) => m === "cooling").length;

  const fires = strengtheningCount >= Math.max(2, Math.ceil(momenta.length * 0.4));
  if (!fires) return null;

  return {
    type: "CORE_RELATIONSHIPS_STRENGTHENING",
    state: "strengthening",
    confidence: Math.min(0.85, 0.4 + momenta.length * 0.05 + strengtheningCount * 0.05),
    evidence: {
      coreContactsEvaluated: momenta.length,
      strengtheningCount,
      stableCount,
      coolingCount,
    },
    period: periodLabel(0, referenceDate, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 7. REACTIVATION_IMPROVING
 * ------------------------------------------------------------------
 * Varre o histórico de cada contato procurando "eventos de reativação"
 * reais (um intervalo bem maior que o ritmo histórico anterior daquele
 * contato, seguido de retomada) e compara quantos caíram em cada janela.
 */
function findReactivationEvents(contacts, interactions) {
  const events = [];

  for (const contact of contacts || []) {
    const contactIx = contactInteractions(interactions, contact.id)
      .slice()
      .sort((a, b) => interactionDate(a) - interactionDate(b));

    if (contactIx.length < 3) continue;

    for (let i = 2; i < contactIx.length; i++) {
      const priorGaps = [];
      for (let j = 1; j < i; j++) {
        const a = interactionDate(contactIx[j - 1]);
        const b = interactionDate(contactIx[j]);
        if (a && b) priorGaps.push(daysBetween(b, a));
      }
      if (priorGaps.length === 0) continue;

      const avgPrior = priorGaps.reduce((a, b) => a + b, 0) / priorGaps.length;
      const curDate = interactionDate(contactIx[i]);
      const prevDate = interactionDate(contactIx[i - 1]);
      if (!curDate || !prevDate) continue;

      const gap = daysBetween(curDate, prevDate);
      if (gap >= Math.max(avgPrior * 2, 45)) {
        events.push(curDate);
      }
    }
  }

  return events;
}

function detectReactivationImproving(contacts, interactions, referenceDate) {
  const curFrom = new Date(referenceDate.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);
  const prevFrom = new Date(curFrom.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);

  const events = findReactivationEvents(contacts, interactions);
  const currentCount = events.filter((d) => d >= curFrom && d <= referenceDate).length;
  const previousCount = events.filter((d) => d >= prevFrom && d < curFrom).length;

  if (currentCount + previousCount < 3) return null;
  if (currentCount <= previousCount) return null;

  return {
    type: "REACTIVATION_IMPROVING",
    state: "improving",
    confidence: Math.min(0.8, 0.35 + (currentCount - previousCount) * 0.1 + (currentCount + previousCount) * 0.03),
    evidence: { currentReactivations: currentCount, previousReactivations: previousCount },
    period: periodLabel(CONCENTRATION_WINDOW_DAYS, curFrom, referenceDate),
  };
}

/*
 * ------------------------------------------------------------------
 * 8. RELATIONSHIP_CONSISTENCY_IMPROVING
 * ------------------------------------------------------------------
 * Para cada par consecutivo de interações de cada contato, marca se o
 * intervalo respeitou a frequência ideal (com 20% de tolerância) e
 * compara a taxa de "em dia" entre as duas janelas.
 */
const CONSISTENCY_MIN_INTERVALS_PER_WINDOW = 5;
const CONSISTENCY_MIN_IMPROVEMENT = 0.2;

function findConsistencyIntervals(contacts, interactions) {
  const intervals = [];

  for (const contact of contacts || []) {
    const idealFrequency = Math.max(
      1,
      Number(contact.idealFreq || contact.ideal_frequency_days || 30) || 30
    );
    const contactIx = contactInteractions(interactions, contact.id)
      .slice()
      .sort((a, b) => interactionDate(a) - interactionDate(b));

    for (let i = 1; i < contactIx.length; i++) {
      const a = interactionDate(contactIx[i - 1]);
      const b = interactionDate(contactIx[i]);
      if (!a || !b) continue;
      const gap = daysBetween(b, a);
      intervals.push({ date: b, onTime: gap <= idealFrequency * 1.2 });
    }
  }

  return intervals;
}

function detectRelationshipConsistencyImproving(contacts, interactions, referenceDate) {
  const curFrom = new Date(referenceDate.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);
  const prevFrom = new Date(curFrom.getTime() - CONCENTRATION_WINDOW_DAYS * DAY_MS);

  const intervals = findConsistencyIntervals(contacts, interactions);
  const current = intervals.filter((i) => i.date >= curFrom && i.date <= referenceDate);
  const previous = intervals.filter((i) => i.date >= prevFrom && i.date < curFrom);

  if (
    current.length < CONSISTENCY_MIN_INTERVALS_PER_WINDOW ||
    previous.length < CONSISTENCY_MIN_INTERVALS_PER_WINDOW
  ) {
    return null;
  }

  const currentRate = current.filter((i) => i.onTime).length / current.length;
  const previousRate = previous.filter((i) => i.onTime).length / previous.length;
  const improvement = currentRate - previousRate;

  if (improvement < CONSISTENCY_MIN_IMPROVEMENT) return null;

  return {
    type: "RELATIONSHIP_CONSISTENCY_IMPROVING",
    state: "improving",
    confidence: Math.min(0.85, 0.4 + improvement),
    evidence: {
      currentIntervals: current.length,
      currentOnTimeRate: Math.round(currentRate * 100) / 100,
      previousIntervals: previous.length,
      previousOnTimeRate: Math.round(previousRate * 100) / 100,
    },
    period: periodLabel(CONCENTRATION_WINDOW_DAYS, curFrom, referenceDate),
  };
}

/**
 * Executa todos os padrões e devolve só os que têm evidência suficiente.
 *
 * @param {Array<object>} contacts
 * @param {Array<object>} interactions
 * @param {Date|string} [referenceDate]
 * @returns {Array<object>}
 */
export function detectPatterns(contacts = [], interactions = [], referenceDate = new Date()) {
  const today = parseDate(referenceDate) || new Date();
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeInteractions = Array.isArray(interactions) ? interactions : [];

  const detectors = [
    () => detectNetworkConcentrationIncreasing(safeInteractions, today),
    () => detectNetworkExpansionDecreasing(safeContacts, today),
    () => detectNewContactsWithoutContinuity(safeContacts, safeInteractions, today),
    () => detectStrategicRelationshipsCooling(safeContacts, safeInteractions, today),
    () => detectRelationshipsOnlyWhenNeeded(safeContacts, safeInteractions, today),
    () => detectCoreRelationshipsStrengthening(safeContacts, safeInteractions, today),
    () => detectReactivationImproving(safeContacts, safeInteractions, today),
    () => detectRelationshipConsistencyImproving(safeContacts, safeInteractions, today),
  ];

  return detectors
    .map((fn) => {
      try {
        return fn();
      } catch (err) {
        console.error("[relationshipPatternDetector] falha ao rodar detector:", err.message);
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.confidence - a.confidence);
}

export default detectPatterns;
