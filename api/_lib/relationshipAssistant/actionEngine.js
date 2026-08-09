// api/_lib/relationshipAssistant/actionEngine.js
//
// Adaptador fino sobre /shared/priorityEngine.js — o mesmo motor usado pela
// Home (HomeToday.jsx). Antes desta correção, este arquivo tinha voltado a
// ter sua própria lógica de prioridade duplicada (reintroduzindo a
// divergência Home vs WhatsApp que já tinha sido corrigida antes). Não
// adicione lógica de priorização aqui — qualquer regra nova entra em
// /shared/priorityEngine.js.
//
// Os crons (relationship-attention-cron.js, relationship-weekly-summary-cron.js)
// não buscam `alerts` hoje, então chamamos computePriorities com feedbackMap
// vazio — sem supressão por resposta do usuário neste canal ainda (mesma
// limitação que já existia antes desta correção, não é uma regressão nova).
//
// `interactions` é opcional (default [] dentro do próprio priorityEngine).
// Sem ele, o momentum de cada contato cai em "insufficient_data" e as
// regras de frequência/saúde não sofrem ajuste — mesmo comportamento de
// antes de existir momentum. Passe o histórico quando o chamador já tiver
// buscado (ver relationship-attention-cron.js).

import { computePriorities } from '../../../shared/priorityEngine.js';

// Mantém o array de até 3 ações ordenadas que os crons já esperavam, e
// preserva o campo `.priority` (relationship-attention-cron.js compara
// `top.priority < MIN_PRIORITY_TO_NOTIFY`) — o motor novo usa `.score`.
export function computeNextBestActions(contacts, interactions = []) {
  const { main, secondary } = computePriorities(contacts, {}, new Date(), interactions);
  return [main, ...secondary]
    .filter(Boolean)
    .map(({ score, ...rest }) => ({ ...rest, priority: score }));
}

export function computeWeeklyAttentionItems(contacts, interactions = []) {
  return computeNextBestActions(contacts, interactions).map(a => a.reason).slice(0, 3);
}
