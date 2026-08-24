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

/**
 * Diagnóstico + ação sugerida por dimensão, a partir da MESMA evidence já
 * calculada acima — nunca um texto genérico solto, e nunca uma dimensão
 * "achando" algo sem dado (NO_DATA sempre cai no fallback honesto).
 * Usado no clique de uma dimensão em "Suas 6 dimensões" (aba Trajetória).
 */
const NO_DATA_FALLBACK = {
  presenca_mercado: {
    diagnosis: "Ainda não há interações suficientes nas últimas semanas pra medir sua presença com segurança — precisa de um volume mínimo em 2 janelas de 6 semanas pra comparar.",
    action: "Registre toda interação relevante na aba Contatos, mesmo as informais. Ex: uma mensagem de WhatsApp trocada num evento também conta.",
  },
  ritual_consistencia: {
    diagnosis: "Ainda não há intervalos suficientes entre interações pra comparar sua regularidade com o ritmo ideal de cada contato.",
    action: "No perfil de pelo menos alguns contatos importantes, defina a frequência ideal de contato (ex: a cada 30 dias) e registre as interações conforme acontecem — a consistência é medida comparando intervalo real com o combinado.",
  },
  intencao_estrategica: {
    diagnosis: "Ainda não há contatos marcados como alta relevância estratégica, ou interações suficientes com eles, pra medir o foco da sua atenção.",
    action: "Marque a relevância estratégica de pelo menos alguns contatos-chave no perfil deles, e registre suas conversas com essas pessoas.",
  },
  reciprocidade_ativa: {
    diagnosis: "Ainda não há retomadas de contato suficientes classificadas pra saber se costuma ser você ou a outra pessoa quem puxa a conversa depois de um tempo parado.",
    action: "Isso é calculado automaticamente pela IA a partir da descrição que você escreve ao registrar cada interação — não precisa marcar nada manualmente. Ex: em vez de \"conversamos\", escreva \"ela me procurou depois de meses sumida, pedindo uma indicação\" — quanto mais contexto, melhor a leitura.",
  },
  confianca_autentica: {
    diagnosis: "Ainda não há interações suficientes com descrição detalhada o bastante pra saber se você costuma oferecer algo sem pedir nada em troca.",
    action: "Ao registrar uma interação, descreva o que de fato aconteceu. Ex: \"indiquei ela pra uma vaga\" (dando) vs \"pedi uma apresentação pra um cliente dela\" (pedindo) — a IA usa esse texto pra identificar o padrão.",
  },
  escuta_relacional: {
    diagnosis: "Ainda não há interações suficientes com conteúdo pessoal registrado pra medir sua escuta.",
    action: "Ao anotar uma interação, inclua o que for pessoal que a pessoa compartilhou. Ex: \"ela comentou que o filho começou a faculdade\" — isso é o que a IA usa pra identificar escuta genuína, não só assunto de negócio.",
  },
};

export function buildDimensionInsight(dimKey, obs) {
  const ev = obs?.evidence || {};
  const pct = (r) => Math.round((r ?? 0) * 100);

  if (!obs || obs.state === NO_DATA) {
    return NO_DATA_FALLBACK[dimKey] || {
      diagnosis: "Ainda não há interações registradas suficientes nessa dimensão pra avaliar com segurança — sem dado, sem palpite.",
      action: "Registre suas próximas conversas relevantes na aba Contatos. Em algumas semanas isso fica visível aqui.",
    };
  }

  switch (dimKey) {
    case "presenca_mercado": {
      const { currentInteractions, previousInteractions } = ev;
      if (obs.state === PERDENDO) return {
        diagnosis: `Você registrou ${currentInteractions} interações nas últimas 6 semanas, contra ${previousInteractions} no período anterior — o ritmo caiu.`,
        action: "Escolha 2 contatos relevantes que esfriaram e marque uma conversa essa semana, mesmo sem pauta.",
      };
      if (obs.state === EVOLUINDO) return {
        diagnosis: `${currentInteractions} interações nas últimas 6 semanas, contra ${previousInteractions} antes — presença crescendo.`,
        action: "Mantenha o ritmo. Vale registrar também as interações informais (evento, corredor, WhatsApp), não só reuniões marcadas.",
      };
      return { diagnosis: `${currentInteractions} interações nas últimas 6 semanas, ritmo estável em relação às ${previousInteractions} anteriores.`, action: "Pra sair do platô, adicione 1 contato novo relevante à rede este mês." };
    }
    case "ritual_consistencia": {
      if (obs.state === EVOLUINDO) return {
        diagnosis: `Suas interações estão respeitando a frequência ideal combinada por contato em ${pct(ev.currentOnTimeRate)}% dos casos (era ${pct(ev.previousOnTimeRate)}%).`,
        action: "Continue com o ritual — considere revisar se a frequência ideal de cada contato ainda faz sentido.",
      };
      if (obs.state === PERDENDO) return {
        diagnosis: `${ev.coolingCount} de ${ev.strategicContactsEvaluated} relações estratégicas estão esfriando em relação ao ritmo esperado.`,
        action: "Abra a aba Rede, filtre por relevância alta e veja quem está sem contato há mais tempo que o ideal.",
      };
      return { diagnosis: "Sem tendência clara de melhora ou piora na regularidade dos contatos ainda.", action: "Defina (ou revise) a frequência ideal dos seus contatos mais importantes em cada perfil." };
    }
    case "intencao_estrategica": {
      const { currentRate, previousRate } = ev;
      if (obs.state === PERDENDO) return {
        diagnosis: `Só ${pct(currentRate)}% das suas interações recentes foram com contatos de alta relevância estratégica (era ${pct(previousRate)}%) — a atenção está se dispersando.`,
        action: "Antes da próxima conversa, pergunte: essa pessoa está entre as mais estratégicas da minha rede agora?",
      };
      if (obs.state === EVOLUINDO) return {
        diagnosis: `${pct(currentRate)}% das interações recentes foram com contatos estratégicos, contra ${pct(previousRate)}% antes — foco aumentando.`,
        action: "Bom sinal. Cuidado só pra não deixar relações fora do círculo estratégico esfriarem de vez.",
      };
      return { diagnosis: `Proporção estável (${pct(currentRate)}%) de atenção pros contatos mais estratégicos.`, action: "Revise sua lista de contatos de alta relevância — ela ainda reflete suas prioridades atuais?" };
    }
    case "reciprocidade_ativa": {
      if (obs.state === PERDENDO) return {
        diagnosis: `Em ${ev.resumptionEventsEvaluated} retomadas de contato recentes, ${pct(ev.reactiveShare)}% aconteceram porque a outra pessoa te procurou primeiro — não o contrário.`,
        action: "Escolha 1 contato que esfriou e seja você quem retoma essa semana, sem estar pedindo nada.",
      };
      return { diagnosis: "Sem sinal de que suas relações só se movem quando a outra pessoa procura — o que já é positivo.", action: "Mantenha o hábito de puxar você algumas das retomadas, não só reagir." };
    }
    case "confianca_autentica": {
      const { currentRate, previousRate } = ev;
      if (obs.state === PERDENDO) return {
        diagnosis: `${pct(currentRate)}% das suas interações recentes tiveram você oferecendo algo sem pedir nada em troca (era ${pct(previousRate)}%) — a proporção caiu.`,
        action: "Na próxima interação, ofereça uma indicação, conteúdo ou ajuda concreta, sem pedir nada de volta.",
      };
      if (obs.state === EVOLUINDO) return {
        diagnosis: `${pct(currentRate)}% das interações recentes foram você dando algo sem pedir nada em troca, contra ${pct(previousRate)}% antes.`,
        action: "Continue — esse é o padrão que mais constrói confiança de longo prazo (Adam Grant, \"Give and Take\").",
      };
      return { diagnosis: `Proporção estável (${pct(currentRate)}%) de interações em que você oferece algo sem pedir nada em troca.`, action: "Pra evoluir, escolha 1 relação onde você mais recebe do que dá e inverta a mão essa semana." };
    }
    case "escuta_relacional": {
      const { currentRate, previousRate } = ev;
      if (obs.state === PERDENDO) return {
        diagnosis: `Só ${pct(currentRate)}% das suas interações recentes trouxeram algo pessoal sobre a outra pessoa, não só assunto de negócio (era ${pct(previousRate)}%).`,
        action: "Na próxima conversa, pergunte e registre algo pessoal — família, hobby, um momento específico que a pessoa comentou.",
      };
      if (obs.state === EVOLUINDO) return {
        diagnosis: `${pct(currentRate)}% das interações recentes trouxeram algo pessoal sobre a pessoa, contra ${pct(previousRate)}% antes.`,
        action: "Continue registrando esses detalhes — retomar o que a pessoa compartilhou é o que mais demonstra escuta real.",
      };
      return { diagnosis: `Proporção estável (${pct(currentRate)}%) de interações com conteúdo pessoal, não só de negócio.`, action: "Escolha 1 contato próximo e, na próxima conversa, pergunte sobre algo fora do trabalho." };
    }
    default:
      return { diagnosis: "Sem diagnóstico específico disponível pra essa dimensão ainda.", action: "" };
  }
}

export default computeObservedDimensions;
