/**
 * CONÉXIA — Agregações da Visão Empresa (piloto B2B)
 *
 * Única fonte de verdade para transformar a lista de membros retornada por
 * get_org_team_overview() (ou pela mesma forma montada no cron) em:
 *   - resumo agregado do time (contagens por dimensão/estado)
 *   - alertas agregados (nunca aponta pessoa por número, só quando é um
 *     recorte já visível — ex: onboarding incompleto)
 *   - score de atenção, pra ordenar quem precisa de olhar primeiro
 *   - tendência do time ao longo das semanas (agregado, não por pessoa)
 *
 * Usado tanto pelo front (src/App.jsx, aba Empresa) quanto pelo cron
 * (api/relationship-weekly-summary-cron.js, seção de equipe do resumo do
 * admin) — nunca duplicar esta lógica em outro lugar.
 *
 * Formato esperado de cada "member":
 *   { id/member_id, first_name, onboarding_completed,
 *     dimension_observation: { [dimKey]: {state, evidence} } | null,
 *     observation_history: [{ week, observation: {...} }] | null }
 */

export const DIMENSION_LABELS = {
  intencao_estrategica: "Estratégia",
  escuta_relacional: "Empatia",
  presenca_mercado: "Presença",
  reciprocidade_ativa: "Reciprocidade",
  ritual_consistencia: "Consistência",
  confianca_autentica: "Autenticidade",
};

export const DIM_KEYS = Object.keys(DIMENSION_LABELS);

export const STATE_KEYS = ["evoluindo", "estavel", "perdendo_intensidade", "sem_dados"];

export const STATE_LABELS = {
  evoluindo: "Evoluindo",
  estavel: "Estável",
  perdendo_intensidade: "Perdendo intensidade",
  sem_dados: "Sem dados suficientes",
};

/** Resumo agregado — só contagens, nunca aponta pessoa por número. */
export function computeTeamStats(members) {
  const dims = {};
  DIM_KEYS.forEach((d) => { dims[d] = { evoluindo: 0, estavel: 0, perdendo_intensidade: 0, sem_dados: 0 }; });
  let onboardingDone = 0;
  let withObservation = 0;
  (members || []).forEach((m) => {
    if (m.onboarding_completed) onboardingDone++;
    if (m.dimension_observation) {
      withObservation++;
      DIM_KEYS.forEach((d) => {
        const st = m.dimension_observation[d]?.state;
        if (st && dims[d][st] !== undefined) dims[d][st]++;
      });
    }
  });
  return { total: (members || []).length, onboardingDone, withObservation, dims };
}

/**
 * Alertas agregados. Cada item tem um `filter` opcional — quando presente,
 * indica que clicar no alerta pode filtrar a lista de membros já visível
 * (nome + estado já aparecem no card de cada pessoa; filtrar não expõe
 * nada que não estivesse já na tela).
 */
export function computeTeamAlerts(members, teamStats) {
  const list = [];
  const total = (members || []).length;
  const notOnboarded = total - teamStats.onboardingDone;
  if (notOnboarded > 0) {
    list.push({
      text: `${notOnboarded} ${notOnboarded === 1 ? "pessoa ainda não completou" : "pessoas ainda não completaram"} o onboarding.`,
      filter: { kind: "onboarding_incomplete" },
    });
  }
  const noObsCount = (members || []).filter((m) => m.onboarding_completed && !m.dimension_observation).length;
  if (noObsCount > 0) {
    list.push({
      text: `${noObsCount} ${noObsCount === 1 ? "pessoa" : "pessoas"} com onboarding concluído mas ainda sem observação semanal computada.`,
      filter: { kind: "no_observation" },
    });
  }
  DIM_KEYS.forEach((d) => {
    const c = teamStats.dims[d].perdendo_intensidade;
    if (c > 0) {
      list.push({
        text: `${DIMENSION_LABELS[d]}: ${c} ${c === 1 ? "pessoa" : "pessoas"} perdendo intensidade essa semana.`,
        filter: { kind: "dimension", dim: d, state: "perdendo_intensidade" },
      });
    }
  });
  return list;
}

/** Um membro passa no filtro ativo? `filter` vem de um clique no resumo/alerta. */
export function matchesFilter(member, filter) {
  if (!filter) return true;
  if (filter.kind === "onboarding_incomplete") return !member.onboarding_completed;
  if (filter.kind === "no_observation") return member.onboarding_completed && !member.dimension_observation;
  if (filter.kind === "dimension") return member.dimension_observation?.[filter.dim]?.state === filter.state;
  return true;
}

/**
 * Score de atenção — maior primeiro na lista. Onboarding incompleto e "sem
 * observação ainda" pesam mais que qualquer estado observado, porque são
 * bloqueios de ativação, o gargalo real do produto.
 */
export function attentionScore(member) {
  if (!member.onboarding_completed) return 1000;
  if (!member.dimension_observation) return 500;
  let score = 0;
  DIM_KEYS.forEach((d) => {
    const st = member.dimension_observation[d]?.state;
    if (st === "perdendo_intensidade") score += 10;
    else if (st === "sem_dados") score += 3;
  });
  return score;
}

/**
 * Tendência do time por semana — agregado, não por pessoa. Para cada
 * semana presente no histórico de qualquer membro, conta quantas
 * observações (pessoa × dimensão) caíram em cada estado naquela semana,
 * e converte em percentual sobre o total de observações da semana.
 */
export function computeTeamWeeklyTrend(members) {
  const weekMap = {};
  (members || []).forEach((m) => {
    (m.observation_history || []).forEach((h) => {
      const w = h.week;
      if (!weekMap[w]) weekMap[w] = { evoluindo: 0, estavel: 0, perdendo_intensidade: 0, sem_dados: 0, total: 0 };
      DIM_KEYS.forEach((d) => {
        const st = h.observation?.[d]?.state;
        if (st && weekMap[w][st] !== undefined) {
          weekMap[w][st]++;
          weekMap[w].total++;
        }
      });
    });
  });
  return Object.keys(weekMap)
    .map(Number)
    .sort((a, b) => a - b)
    .map((week) => {
      const wd = weekMap[week];
      const pct = (n) => (wd.total ? Math.round((n / wd.total) * 100) : 0);
      return {
        week,
        pctEvoluindo: pct(wd.evoluindo),
        pctEstavel: pct(wd.estavel),
        pctPerdendo: pct(wd.perdendo_intensidade),
        pctSemDados: pct(wd.sem_dados),
      };
    });
}

/**
 * Dimensão que representa o risco ESTRUTURAL de cada arquétipo — não uma
 * dimensão qualquer, a mesma que o próprio texto do arquétipo (PROFILES,
 * em src/App.jsx) já descreve como ponto fraco típico desse perfil. Fonte
 * de cada mapeamento, lida direto da descrição de cada arquétipo:
 *   estrategista            → "pode parecer transacional"            → reciprocidade
 *   influenciador           → "pode se sobrecarregar" (perde ritmo)  → consistência
 *   conector                → "falta de direcionamento estratégico" → estratégia
 *   tecnico_invisivel       → "confiança alta, presença baixa"       → presença
 *   relacional_intuitivo    → "networking inconsistente"             → consistência
 *   ativador_intermitente   → "inconsistência crônica"               → consistência
 *   construtor_confianca    → "rede pode ser pequena demais"         → presença
 *   explorador_rede         → sem padrão dominante ainda              → (nenhuma)
 */
export const ARCHETYPE_RISK_DIMENSION = {
  estrategista: "reciprocidade_ativa",
  influenciador: "ritual_consistencia",
  conector: "intencao_estrategica",
  tecnico_invisivel: "presenca_mercado",
  relacional_intuitivo: "ritual_consistencia",
  ativador_intermitente: "ritual_consistencia",
  construtor_confianca: "presenca_mercado",
  explorador_rede: null,
};

/** Quantas semanas seguidas (a partir da mais recente) uma dimensão está no mesmo estado. */
function trailingStreak(history, dim, state) {
  if (!history || history.length === 0) return 0;
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].observation?.[dim]?.state === state) streak++;
    else break;
  }
  return streak;
}

/**
 * Cruza o arquétipo relacional de cada pessoa com o estado observado AGORA
 * na dimensão que é o ponto fraco estrutural desse arquétipo específico —
 * e traz junto a evidência bruta (números), há quantas semanas seguidas
 * isso vem acontecendo, e a saúde de frequência de contato dela (quantos
 * contatos já passaram do prazo ideal) — pra virar uma frase com dado
 * real e comparável, não um texto fixo repetido pra qualquer pessoa
 * daquele arquétipo.
 */
export function computeArchetypeRiskFlags(members) {
  const flags = [];
  (members || []).forEach((m) => {
    const dim = ARCHETYPE_RISK_DIMENSION[m.profile_key];
    if (!dim) return;
    const obs = m.dimension_observation?.[dim];
    if (obs?.state === "perdendo_intensidade") {
      flags.push({
        memberId: m.member_id || m.id,
        firstName: m.first_name,
        profileKey: m.profile_key,
        dim,
        evidence: obs.evidence || {},
        streakWeeks: trailingStreak(m.observation_history, dim, "perdendo_intensidade"),
        contactFrequency: m.contact_frequency || null,
      });
    }
  });
  return flags;
}

/**
 * Quando a MESMA dimensão cai (perdendo_intensidade) pra várias pessoas do
 * time ao mesmo tempo, é mais provável ser causa externa (safra, evento do
 * setor, sazonalidade) do que desempenho individual de cada uma — sinal
 * estatístico real (correlação entre pessoas independentes), não coincidência
 * de cadastro. Evita o gestor tratar como falha pessoal o que é padrão de
 * time.
 */
export function computeSystemicDropPatterns(members, minPeople = 2) {
  const byDim = {};
  DIM_KEYS.forEach((d) => { byDim[d] = []; });
  (members || []).forEach((m) => {
    DIM_KEYS.forEach((d) => {
      if (m.dimension_observation?.[d]?.state === "perdendo_intensidade") {
        byDim[d].push({ memberId: m.member_id || m.id, firstName: m.first_name });
      }
    });
  });
  return Object.entries(byDim)
    .filter(([, people]) => people.length >= minPeople)
    .map(([dim, people]) => ({ dim, people }));
}

/**
 * Saúde de frequência de contato agregada do TIME inteiro — soma dos
 * "ativo/esfriando/frio" (já calculados por pessoa no cron semanal via
 * shared/contactHealth.js) entre todas as pessoas. Responde direto "quantos
 * estão bem" e "quantos estão esfriando", sem nunca expor qual contato é.
 */
export function computeTeamContactFrequencyStats(members) {
  const totals = { total: 0, ativo: 0, esfriando: 0, frio: 0, peopleWithData: 0 };
  (members || []).forEach((m) => {
    const f = m.contact_frequency;
    if (!f) return;
    totals.peopleWithData++;
    totals.total += f.total || 0;
    totals.ativo += f.ativo || 0;
    totals.esfriando += f.esfriando || 0;
    totals.frio += f.frio || 0;
  });
  return totals;
}
