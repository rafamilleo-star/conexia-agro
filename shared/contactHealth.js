/**
 * CONÉXIA — Saúde de contato por frequência ideal
 *
 * Espelha intencionalmente a fórmula `hScore` já usada em src/App.jsx
 * (card individual de cada contato, aba Rede): mesma curva, mesmos pontos
 * de corte. Não importa de lá porque src/App.jsx é hoje um arquivo único
 * de ~5000 linhas e extrair a função pra cá seria risco de regressão numa
 * tela que já funciona, pra ganho zero (a tela individual não precisa
 * deste módulo). Aqui a fórmula é usada só pra agregado — nunca aparece
 * ligada a um contato específico pro admin, só contagem por pessoa/time.
 *
 * Se um dia o hScore original mudar, esta cópia precisa ser atualizada
 * junto — comentário espelhado no App.jsx nesse trecho.
 */

const DAY_MS = 86400000;

function daysSince(dateStr, referenceDate) {
  if (!dateStr) return null;
  return Math.floor((new Date(referenceDate).getTime() - new Date(dateStr).getTime()) / DAY_MS);
}

/**
 * Categoriza um contato pela frequência ideal dele — não um corte
 * genérico igual pra todo mundo, o prazo que a própria pessoa definiu pra
 * aquele contato específico.
 *   ativo:     dentro do prazo ideal (d <= freq)
 *   esfriando: passou do ideal mas ainda não é crítico (freq < d <= freq*1.5)
 *   frio:      além do ponto onde hScore já zera (d > freq*1.5), ou nunca contatado
 */
export function contactFrequencyBucket(lastInteractionAt, idealFrequencyDays, referenceDate = new Date()) {
  const freq = Number(idealFrequencyDays) || 30;
  const d = daysSince(lastInteractionAt, referenceDate);
  if (d === null) return "frio";
  const ratio = d / freq;
  if (ratio <= 1) return "ativo";
  if (ratio <= 1.5) return "esfriando";
  return "frio";
}

/**
 * Agregado por pessoa — contagem de contatos em cada faixa, mais a pior
 * razão (dias em atraso / frequência ideal) entre todos os contatos dela,
 * usada pra dar peso à urgência sem expor QUAL contato está mais frio.
 */
export function computeContactFrequencyStats(contacts, referenceDate = new Date()) {
  const buckets = { ativo: 0, esfriando: 0, frio: 0 };
  let worstRatio = 0;
  (contacts || []).forEach((c) => {
    const bucket = contactFrequencyBucket(c.last_interaction_at, c.ideal_frequency_days, referenceDate);
    buckets[bucket]++;
    const freq = Number(c.ideal_frequency_days) || 30;
    const d = daysSince(c.last_interaction_at, referenceDate);
    const ratio = d === null ? 3 : d / freq;
    worstRatio = Math.max(worstRatio, ratio);
  });
  return { total: (contacts || []).length, ...buckets, worstRatio: Math.round(worstRatio * 10) / 10 };
}
