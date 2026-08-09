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

// Direção de cada padrão da Fase 5 (shared/relationshipPatternDetector.js)
// em relação à tendência: +1 empurra pra "Evoluindo", -1 pra "Perdendo
// intensidade". Só padrões com direção clara entram aqui — os demais
// (nenhum hoje) simplesmente não têm efeito na tendência.
const PATTERN_DIRECTION = {
  CORE_RELATIONSHIPS_STRENGTHENING: 1,
  REACTIVATION_IMPROVING: 1,
  RELATIONSHIP_CONSISTENCY_IMPROVING: 1,
  STRATEGIC_RELATIONSHIPS_COOLING: -1,
  NETWORK_CONCENTRATION_INCREASING: -1,
  NETWORK_EXPANSION_DECREASING: -1,
  NEW_CONTACTS_WITHOUT_CONTINUITY: -1,
  RELATIONSHIPS_ONLY_WHEN_NEEDED: -1,
};

// Frase curta por padrão, no mesmo tom do resto do arquivo — nunca
// julgamento, sempre observação. RELATIONSHIPS_ONLY_WHEN_NEEDED usa
// linguagem tentativa de propósito: a confiança desse padrão específico
// tem teto de 0.6 (é inferência de IA, não fato direto — ver
// relationshipPatternDetector.js), então a frase nunca afirma com certeza.
const PATTERN_NOTES = {
  NETWORK_CONCENTRATION_INCREASING: 'Sua rede ficou mais concentrada nas últimas semanas — boa parte das suas interações está com um grupo pequeno de pessoas.',
  NETWORK_EXPANSION_DECREASING: 'Você tem criado menos conexões novas do que no período anterior.',
  NEW_CONTACTS_WITHOUT_CONTINUITY: 'A maioria dos contatos que você adicionou recentemente ainda não teve uma segunda conversa registrada.',
  STRATEGIC_RELATIONSHIPS_COOLING: 'Algumas relações relevantes pro seu momento estão esfriando.',
  RELATIONSHIPS_ONLY_WHEN_NEEDED: 'Percebi um possível padrão: boa parte das vezes que você retoma contato com alguém, parece vir de algo que a pessoa trouxe primeiro. Vale observar se é isso mesmo.',
  CORE_RELATIONSHIPS_STRENGTHENING: 'Seu núcleo de relações mais próximas está mais consistente que o normal.',
  REACTIVATION_IMPROVING: 'Você tem retomado relações que esfriaram com mais frequência do que antes.',
  RELATIONSHIP_CONSISTENCY_IMPROVING: 'Sua regularidade com relações importantes melhorou em relação às semanas anteriores.',
};

// Peso pequeno de propósito: padrões de rede complementam a leitura da
// semana, nunca dominam sobre a atividade real registrada. Um padrão de
// alta confiança move o delta em até ~0.15 — o suficiente pra decidir um
// caso limítrofe, não pra virar sozinho uma semana fraca em "Evoluindo".
function patternBias(patterns) {
  return (patterns || []).reduce((sum, p) => {
    const direction = PATTERN_DIRECTION[p?.type];
    if (!direction) return sum;
    return sum + direction * (p.confidence || 0) * 0.15;
  }, 0);
}

/**
 * Frase adicional sobre o padrão de rede mais relevante, para
 * complementar (nunca substituir) a explicação baseada em atividade da
 * semana. Só considera o padrão de maior confiança, e só a partir de um
 * piso mínimo — abaixo disso, o sinal é fraco demais pra virar frase.
 *
 * @param {Array<object>} patterns
 * @returns {string|null}
 */
const PATTERN_NOTE_MIN_CONFIDENCE = 0.5;

function buildPatternNote(patterns) {
  const top = (patterns || [])
    .filter((p) => (p?.confidence || 0) >= PATTERN_NOTE_MIN_CONFIDENCE && PATTERN_NOTES[p?.type])
    .sort((a, b) => b.confidence - a.confidence)[0];
  return top ? PATTERN_NOTES[top.type] : null;
}

export function classifyTrend(currentSignals, previousSignals, patterns) {
  const cur = compositeScore(currentSignals);
  const prev = compositeScore(previousSignals);

  if (cur === 0 && prev === 0) return NO_DATA;
  if (prev === 0 && cur > 0) return EVOLUINDO;

  const delta = (cur - prev) / Math.max(prev, 1) + patternBias(patterns);
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
export function buildExplanation(signals, trend, patterns) {
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

  let texto;
  if (!partes.length) {
    texto = trend === PERDENDO
      ? 'Esta semana teve menos movimento do que as anteriores — isso é normal, relacionamentos têm ritmos diferentes. Quando fizer sentido, retome no seu tempo.'
      : 'Sua atividade se manteve estável esta semana.';
  } else {
    const lista = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1];
    const abertura = trend === EVOLUINDO ? 'Seu momento relacional está em alta porque ' : trend === PERDENDO ? 'Mesmo com menos intensidade esta semana, ' : 'Nesta semana, ';
    texto = `${abertura}${lista}.`;
  }

  const patternNote = buildPatternNote(patterns);
  if (patternNote) {
    texto = `${texto} ${patternNote}`;
  }

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

export function computeWeeklyEvolution({ currentSignals, previousSignals, events, patterns = [] }) {
  const trend = classifyTrend(currentSignals, previousSignals, patterns);
  const highlight = buildValueHighlight(currentSignals);
  return {
    trend,
    trendLabel: TREND_LABELS[trend],
    explanation: buildExplanation(currentSignals, trend, patterns),
    valueHighlight: highlight && containsForbiddenTone(highlight) ? null : highlight,
    timeline: buildTimeline(events),
  };
}

export const TRENDS = { EVOLUINDO, ESTAVEL, PERDENDO, NO_DATA };
