/**
 * CONÉXIA — Observação comportamental por dimensão
 *
 * Compara o que o usuário DECLAROU no assessment (assessment_scores,
 * inalterado, calculado uma vez) com o que ele DEMONSTRA nas interações
 * reais — por dimensão, categórico, nunca número.
 *
 * Cada dimensão só recebe um estado observável quando existe uma ponte
 * comportamental defensável entre o dado disponível e o construto
 * psicológico da dimensão. As pontes usadas aqui, com a fonte:
 *
 * PRESENÇA (presenca_mercado) — frequência de interação no tempo.
 *   Definição direta: presença de mercado é estar presente. Sem
 *   referência externa necessária além do próprio construto.
 *
 * CONSISTÊNCIA (ritual_consistencia) — regularidade dos intervalos entre
 *   contatos, comparada ao ritmo ideal declarado por relação. Reaproveita
 *   shared/relationshipPatternDetector.js (RELATIONSHIP_CONSISTENCY_IMPROVING).
 *
 * ESTRATÉGIA (intencao_estrategica) — proporção da atenção (interações)
 *   dirigida a contatos de alta relevância estratégica vs. o resto da
 *   rede. Intenção estratégica se manifesta em PARA ONDE a atenção vai,
 *   não só em quanta atenção existe.
 *
 * RECIPROCIDADE (reciprocidade_ativa) — proporção de retomadas de
 *   contato que parecem reativas (a pessoa trouxe o gatilho) vs.
 *   proativas. Reaproveita RELATIONSHIPS_ONLY_WHEN_NEEDED.
 *
 * AUTENTICIDADE (confianca_autentica) — proporção de interações em que o
 *   usuário ofereceu algo (indicação, ajuda, conteúdo) sem pedir nada em
 *   troca. Base: Adam Grant (Wharton), "Give and Take" — entre os três
 *   estilos de reciprocidade estudados (giver/taker/matcher), o giver é
 *   o que constrói relações de confiança mais fortes e duradouras no
 *   longo prazo. Ver comentário completo em
 *   api/interaction-intent-classifier-cron.js.
 *
 * EMPATIA (escuta_relacional) — proporção de interações que trazem algo
 *   pessoal sobre a outra pessoa (não só assunto de negócio). Base: Reis
 *   & Shaver, "perceived partner responsiveness" — o marcador
 *   comportamental central de escuta relacional é lembrar e retomar o
 *   que a outra pessoa compartilhou sobre si, não reação genérica.
 *
 * Nenhuma dimensão é forçada a ter um estado. Sem evidência mínima,
 * retorna "sem_dados" — nunca um palpite.
 */

import { calculateRelevance, contactInteractionDates } from "./priorityEngine.js";
import { detectPatterns } from "./relationshipPatternDetector.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const NO_DATA = "sem_dados";
export const EVOLUINDO = "evoluindo";
export const ESTAVEL = "estavel";
export const PERDENDO = "perdendo_intensidade";

export const OBSERVED_STATE_LABELS = {
  [EVOLUINDO]: "Evoluindo",
  [ESTAVEL]: "Estável",
  [PERDENDO]: "Perdendo intensidade",
  [NO_DATA]: "Sem dados suficientes",
};

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function interactionContactId(i) {
  return i?.contactId ?? i?.contact_id;
}

function interactionDate(i) {
  return parseDate(i?.createdAt ?? i?.created_at);
}

function interactionTagValue(i, prefix) {
  const tag = (Array.isArray(i?.tags) ? i.tags : []).find((t) => String(t).startsWith(prefix));
  return tag ? String(tag).slice(prefix.length) : null;
}

function windowSplit(interactions, referenceDate, windowDays) {
  const curFrom = new Date(referenceDate.getTime() - windowDays * DAY_MS);
  const prevFrom = new Date(curFrom.getTime() - windowDays * DAY_MS);
  const current = [];
  const previous = [];
  for (const i of interactions || []) {
    const d = interactionDate(i);
    if (!d) continue;
    if (d >= curFrom && d <= referenceDate) current.push(i);
    else if (d >= prevFrom && d < curFrom) previous.push(i);
  }
  return { current, previous };
}

// Compara uma taxa (0-1) entre duas janelas e devolve o estado
// categórico. Mesmos limiares do resto do produto (explainabilityEngine.js):
// piso maior pra "perdendo" evita marcar queda por ruído normal de semana fraca.
function classifyRateDelta(currentRate, previousRate) {
  const delta = currentRate - previousRate;
  if (delta > 0.1) return EVOLUINDO;
  if (delta < -0.15) return PERDENDO;
  return ESTAVEL;
}

const WINDOW_DAYS = 42; // 6 semanas — mesma janela usada em todo o pattern detector
const MIN_INTERACTIONS_PER_WINDOW = 4;
const MIN_TAGGED_PER_WINDOW = 3;

/**
 * PRESENÇA — volume de interação, janela atual vs anterior.
 */
function observePresenca(contacts, interactions, referenceDate) {
  const { current, previous } = windowSplit(interactions, referenceDate, WINDOW_DAYS);
  if (current.length < MIN_INTERACTIONS_PER_WINDOW || previous.length < MIN_INTERACTIONS_PER_WINDOW) {
    return { state: NO_DATA, evidence: { currentInteractions: current.length, previousInteractions: previous.length } };
  }
  const delta = (current.length - previous.length) / Math.max(previous.length, 1);
  const state = delta > 0.15 ? EVOLUINDO : delta < -0.25 ? PERDENDO : ESTAVEL;
  return { state, evidence: { currentInteractions: current.length, previousInteractions: previous.length } };
}

/**
 * CONSISTÊNCIA — reaproveita o padrão de rede já calculado (Fase 5),
 * não recalcula intervalos aqui.
 */
function observeConsistencia(patterns) {
  const consistency = patterns.find((p) => p.type === "RELATIONSHIP_CONSISTENCY_IMPROVING");
  if (consistency) return { state: EVOLUINDO, evidence: consistency.evidence };
  const cooling = patterns.find((p) => p.type === "STRATEGIC_RELATIONSHIPS_COOLING");
  if (cooling) return { state: PERDENDO, evidence: cooling.evidence };
  return { state: NO_DATA, evidence: {} };
}

/**
 * ESTRATÉGIA — fração das interações da janela atual direcionada a
 * contatos de alta relevância (>=70, mesmo piso do priorityEngine),
 * comparada à janela anterior.
 */
function observeEstrategia(contacts, interactions, referenceDate) {
  const relevantIds = new Set(
    (contacts || [])
      .filter((c) => {
        const r = calculateRelevance(c);
        return r !== null && r >= 70;
      })
      .map((c) => c.id)
  );

  if (relevantIds.size === 0) return { state: NO_DATA, evidence: { relevantContacts: 0 } };

  const { current, previous } = windowSplit(interactions, referenceDate, WINDOW_DAYS);
  if (current.length < MIN_INTERACTIONS_PER_WINDOW || previous.length < MIN_INTERACTIONS_PER_WINDOW) {
    return { state: NO_DATA, evidence: { currentInteractions: current.length, previousInteractions: previous.length } };
  }

  const currentRate = current.filter((i) => relevantIds.has(interactionContactId(i))).length / current.length;
  const previousRate = previous.filter((i) => relevantIds.has(interactionContactId(i))).length / previous.length;

  return {
    state: classifyRateDelta(currentRate, previousRate),
    evidence: { currentRate: Math.round(currentRate * 100) / 100, previousRate: Math.round(previousRate * 100) / 100 },
  };
}

/**
 * RECIPROCIDADE — reaproveita RELATIONSHIPS_ONLY_WHEN_NEEDED. Presença
 * do padrão = perdendo intensidade. Ausência, com dado suficiente pra
 * outros padrões terem rodado, não afirma "evoluindo" sozinha — falta de
 * padrão negativo não é a mesma coisa que evidência positiva.
 */
function observeReciprocidade(patterns) {
  const onlyWhenNeeded = patterns.find((p) => p.type === "RELATIONSHIPS_ONLY_WHEN_NEEDED");
  if (onlyWhenNeeded) return { state: PERDENDO, evidence: onlyWhenNeeded.evidence };
  return { state: NO_DATA, evidence: {} };
}

/**
 * AUTENTICIDADE — fração de interações tagueadas "_value:giving" entre
 * as tagueadas (giving/asking/neutral), janela atual vs anterior.
 */
function observeAutenticidade(interactions, referenceDate) {
  const { current, previous } = windowSplit(interactions, referenceDate, WINDOW_DAYS);

  const tag = (list) => list.map((i) => interactionTagValue(i, "_value:")).filter(Boolean);
  const curTags = tag(current);
  const prevTags = tag(previous);

  if (curTags.length < MIN_TAGGED_PER_WINDOW || prevTags.length < MIN_TAGGED_PER_WINDOW) {
    return { state: NO_DATA, evidence: { currentTagged: curTags.length, previousTagged: prevTags.length } };
  }

  const givingRate = (list) => list.filter((v) => v === "giving").length / list.length;
  const currentRate = givingRate(curTags);
  const previousRate = givingRate(prevTags);

  return {
    state: classifyRateDelta(currentRate, previousRate),
    evidence: { currentRate: Math.round(currentRate * 100) / 100, previousRate: Math.round(previousRate * 100) / 100 },
  };
}

/**
 * EMPATIA — fração de interações tagueadas "_personal:personal" entre as
 * tagueadas (personal/business), janela atual vs anterior.
 */
function observeEmpatia(interactions, referenceDate) {
  const { current, previous } = windowSplit(interactions, referenceDate, WINDOW_DAYS);

  const tag = (list) => list.map((i) => interactionTagValue(i, "_personal:")).filter((v) => v === "personal" || v === "business");
  const curTags = tag(current);
  const prevTags = tag(previous);

  if (curTags.length < MIN_TAGGED_PER_WINDOW || prevTags.length < MIN_TAGGED_PER_WINDOW) {
    return { state: NO_DATA, evidence: { currentTagged: curTags.length, previousTagged: prevTags.length } };
  }

  const personalRate = (list) => list.filter((v) => v === "personal").length / list.length;
  const currentRate = personalRate(curTags);
  const previousRate = personalRate(prevTags);

  return {
    state: classifyRateDelta(currentRate, previousRate),
    evidence: { currentRate: Math.round(currentRate * 100) / 100, previousRate: Math.round(previousRate * 100) / 100 },
  };
}

/**
 * Calcula o estado observado das 6 dimensões.
 *
 * @param {Array<object>} contacts
 * @param {Array<object>} interactions
 * @param {Date|string} [referenceDate]
 * @returns {Record<string, {state: string, evidence: object}>}
 */
export function computeObservedDimensions(contacts = [], interactions = [], referenceDate = new Date()) {
  const today = parseDate(referenceDate) || new Date();
  const safeContacts = Array.isArray(contacts) ? contacts : [];
  const safeInteractions = Array.isArray(interactions) ? interactions : [];
  const patterns = detectPatterns(safeContacts, safeInteractions, today);

  return {
    presenca_mercado: observePresenca(safeContacts, safeInteractions, today),
    ritual_consistencia: observeConsistencia(patterns),
    intencao_estrategica: observeEstrategia(safeContacts, safeInteractions, today),
    reciprocidade_ativa: observeReciprocidade(patterns),
    confianca_autentica: observeAutenticidade(safeInteractions, today),
    escuta_relacional: observeEmpatia(safeInteractions, today),
  };
}

export default computeObservedDimensions;
