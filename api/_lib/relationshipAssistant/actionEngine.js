// api/_lib/relationshipAssistant/actionEngine.js
//
// Adaptador fino sobre /shared/priorityEngine.js — o mesmo motor usado pela
// Home (HomeToday.jsx). Antes desta correção, este arquivo tinha voltado a
// ter sua própria lógica de prioridade duplicada (reintroduzindo a
// divergência Home vs WhatsApp que já tinha sido corrigida antes). Não
// adicione lógica de priorização aqui — qualquer regra nova entra em
// /shared/priorityEngine.js.
//
// FASE 0 (consolidação, ago/2026): os crons agora buscam `alerts` e passam
// um feedbackMap real (ver relationship-attention-cron.js e
// relationship-weekly-summary-cron.js) — uma recomendação dispensada na Home
// ou no painel do app não deve reaparecer como mensagem proativa de
// WhatsApp. `feedbackMap` é opcional aqui só para não quebrar nenhum
// chamador que ainda não tenha sido atualizado; o valor default `{}`
// equivale a "nenhuma supressão conhecida", nunca a "não suprimir por
// design".
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
export function computeNextBestActions(
  contacts,
  interactions = [],
  feedbackMap = {},
  context = {}
) {
  const { main, secondary } = computePriorities(
    contacts,
    feedbackMap,
    new Date(),
    interactions,
    context
  );

  return [main, ...secondary]
    .filter(Boolean)
    .map(({ score, ...rest }) => ({
      ...rest,
      priority: score,
    }));
}

export function computeWeeklyAttentionItems(
  contacts,
  interactions = [],
  feedbackMap = {},
  context = {}
) {
  const agora = Date.now();
  return computeNextBestActions(
    contacts,
    interactions,
    feedbackMap,
    context
  ).map((a) => {
    // Cada item nomeia a pessoa e diz o motivo com o número de dias, para o
    // resumo não virar três frases iguais sem nome. O corte para exibir
    // (até 3) fica em messages.js, que também conta quantas ficaram de fora.
    const contato = (contacts || []).find((c) => c.id === a.contactId);
    const ultimo = contato?.last_interaction_at ? new Date(contato.last_interaction_at).getTime() : null;
    const dias = ultimo ? Math.floor((agora - ultimo) / 86400000) : null;
    const ritmo = contato?.ideal_frequency_days;
    const motivo =
      a.actionType === 'frequency_exceeded' && dias !== null && ritmo
        ? `${dias} dias sem contato (seu ritmo é de ${ritmo} dias)`
        : a.reason;
    return `*${a.contactName}*: ${motivo}`;
  });
}
