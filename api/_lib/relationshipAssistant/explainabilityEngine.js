// api/_lib/relationshipAssistant/explainabilityEngine.js
//
// Transforma atividade relacional real (interações, retomadas, metas
// concluídas) em UMA frase explicativa + UMA tendência categórica, para
// alimentar a Carta de Evolução em "Meu Perfil".
//
// Regras duras (mesmo espírito de messages.js — não duplicar a lista aqui,
// mas seguir o mesmo tom):
// - NUNCA expor um número tipo score 0-100.
// - NUNCA linguagem de desempenho/cobrança ("parabéns", "você está atrasado").
// - Tendência é sobre COMPORTAMENTO RECENTE, não sobre "quão perto de 100%".
// - Sem dado suficiente => estado neutro "sem_dados", nunca "perdendo".

import { containsForbiddenTone } from './messages.js';

const DIMENSION_LABELS = {
  intencao_estrategica: 'Estratégia',
  escuta_relacional: 'Empatia',
  presenca_mercado: 'Presença',
  reciprocidade_ativa: 'Reciprocidade',
  ritual_consistencia: 'Consistência',
  confianca_autentica: 'Autenticidade',
};

export function dimensionLabel(key) {
  return DIMENSION_LABELS[key] || key;
}

// signals: { interactionsCount, contactsEngaged, retomadas, novasConexoes, metasConcluidas }
// Composto interno apenas para comparar semana a semana — nunca exposto ao usuário.
function compositeScore(signals) {
  if (!signals) return 0;
  const { interactionsCount = 0, retomadas = 0, novasConexoes = 0, metasConcluidas = 0 } = signals;
  // Retornos decrescentes: volume bruto de interações pesa pouco (raiz),
  // retomada de relação esfriando pesa mais (sinal mais forte de mudança real).
  return Math.sqrt(interactionsCount) * 1 + retomadas * 3 + novasConexoes * 1.5 + metasConcluidas * 1;
}

const NO_DATA = 'sem_dados';
const EVOLUINDO = 'evoluindo';
const ESTAVEL = 'estavel';
const PERDENDO = 'perdendo_intensidade';

export function classifyTrend(currentSignals, previousSignals) {
  const cur = compositeScore(currentSignals);
  const prev = compositeScore(previousSignals);

  if (cur === 0 && prev === 0) return NO_DATA;
  if (prev === 0 && cur > 0) return EVOLUINDO;

  const delta = (cur - prev) / Math.max(prev, 1);
  if (delta > 0.15) return EVOLUINDO;
  if (delta < -0.25) return PERDENDO; // limiar maior pra baixo: evita marcar "perdendo" por ruído normal de semana fraca
  return ESTAVEL;
}

export const TREND_LABELS = {
  [EVOLUINDO]: 'Evoluindo',
  [ESTAVEL]: 'Estável',
  [PERDENDO]: 'Perdendo intensidade',
  [NO_DATA]: 'Ainda sem dados suficientes',
};

// Gera a frase de explicabilidade a partir dos sinais da semana.
// Nunca inventa causa que não está nos sinais.
export function buildExplanation(signals, trend) {
  if (trend === NO_DATA) {
    return 'Ainda não há atividade suficiente nesta semana para mostrar uma tendência — assim que você registrar interações ou avançar no plano, isso aparece aqui.';
  }

  const { interactionsCount = 0, retomadas = 0, novasConexoes = 0, metasConcluidas = 0 } = signals || {};
  const partes = [];

  if (retomadas > 0) {
    partes.push(`você retomou ${retomadas} contato${retomadas === 1 ? '' : 's'} que estava${retomadas === 1 ? '' : 'm'} esfriando`);
  }
  if (interactionsCount > 0) {
    partes.push(`registrou ${interactionsCount} interaç${interactionsCount === 1 ? 'ão' : 'ões'}`);
  }
  if (novasConexoes > 0) {
    partes.push(`iniciou ${novasConexoes} nova${novasConexoes === 1 ? '' : 's'} conexão${novasConexoes === 1 ? '' : 'ões'}`);
  }
  if (metasConcluidas > 0) {
    partes.push(`avançou em ${metasConcluidas} meta${metasConcluidas === 1 ? '' : 's'} do seu plano`);
  }

  if (!partes.length) {
    return trend === PERDENDO
      ? 'Esta semana teve menos movimento do que as anteriores — isso é normal, relacionamentos têm ritmos diferentes. Quando fizer sentido, retome no seu tempo.'
      : 'Sua atividade se manteve estável esta semana.';
  }

  const lista = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
  const abertura = trend === EVOLUINDO ? 'Seu momento relacional está em alta porque ' : trend === PERDENDO ? 'Mesmo com menos intensidade esta semana, ' : 'Nesta semana, ';
  const texto = `${abertura}${lista}.`;

  // Checagem defensiva: nunca deixar passar tom de cobrança/CRM, mesmo que a
  // composição acima nunca deva gerar isso.
  if (containsForbiddenTone(texto)) {
    return 'Sua atividade relacional teve movimento esta semana.';
  }
  return texto;
}

// events: array de { type: 'retomada'|'interacao'|'nova_conexao'|'meta', label, at }
// Retorna no máximo 4 marcos, priorizando os tipos mais significativos.
export function buildTimeline(events) {
  const PRIORITY = { retomada: 0, meta: 1, nova_conexao: 2, interacao: 3 };
  return [...(events || [])]
    .sort((a, b) => (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9) || new Date(b.at) - new Date(a.at))
    .slice(0, 4);
}

// Frase independente da tendência — não entra no composite score nem afeta
// Evoluindo/Estável/Perdendo. É só prova de resultado (elo relação →
// oportunidade), por isso fica separada da explicação de tendência.
// Retorna null quando não há dado, nunca "0 interações geraram valor".
function buildValueHighlight(signals) {
  const { interacoesComValor = 0, retomadasComValor = 0 } = signals || {};
  if (retomadasComValor > 0) {
    return retomadasComValor === 1
      ? 'Uma relação que você retomou esta semana já teve desdobramento comercial — o Radar de Silêncio funcionando na prática.'
      : `${retomadasComValor} relações que você retomou esta semana já tiveram desdobramento comercial.`;
  }
  if (interacoesComValor > 0) {
    return interacoesComValor === 1
      ? 'Você registrou desdobramento comercial em uma interação esta semana.'
      : `Você registrou desdobramento comercial em ${interacoesComValor} interações esta semana.`;
  }
  return null;
}

export function computeWeeklyEvolution({ currentSignals, previousSignals, events }) {
  const trend = classifyTrend(currentSignals, previousSignals);
  const highlight = buildValueHighlight(currentSignals);
  return {
    trend,
    trendLabel: TREND_LABELS[trend],
    explanation: buildExplanation(currentSignals, trend),
    valueHighlight: highlight && containsForbiddenTone(highlight) ? null : highlight,
    timeline: buildTimeline(events),
  };
}

export const TRENDS = { EVOLUINDO, ESTAVEL, PERDENDO, NO_DATA };
