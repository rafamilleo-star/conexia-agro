/**
 * CONÉXIA — Context Card
 *
 * FASE 1 do plano de evolução (ago/2026). Antes desta extração, a
 * preparação de contexto para o briefing pré-contato vivia só dentro de
 * src/components/AbaIA.jsx::generateBriefing(), como um objeto montado
 * inline. Isso impedia reaproveitar a mesma preparação para o briefing
 * automático disparado por evento de calendário (ver
 * api/relationship-calendar-sync-cron.js).
 *
 * Este módulo NÃO decide prioridade — reaproveita shared/priorityEngine.js
 * para "momentum" e "por que agora" em vez de recalcular. NÃO cria tabela
 * nova: tudo aqui é derivado de `contacts` + `interactions` na hora,
 * exatamente como o resto do motor de prioridade já funciona.
 *
 * Formato de saída (consumido por src/components/AbaIA.jsx e por
 * api/_lib/relationshipAssistant/*):
 *
 * {
 *   pessoa: { nome, empresa, cargo },
 *   relacao: { proximidade, relevancia, ultimaInteracaoEm, diasSemContato, frequenciaIdealDias },
 *   momentum: "new" | "stable" | "strengthening" | "cooling" | "reactivated" | "insufficient_data",
 *   memoria: { ultimasInteracoes: [{ tipo, sentimento, descricao, data }] },
 *   pendencias: { proximaAcao, proximaAcaoData },
 *   porQueAgora: { reason, actionType, title } | null,
 * }
 */

import { calculateRelevance, relationshipMomentum, computePriorities } from "./priorityEngine.js";

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value, referenceDate) {
  const date = parseDate(value);
  if (!date) return null;
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((referenceDate.getTime() - date.getTime()) / DAY_MS));
}

function contactInteractions(interactions, contactId) {
  if (!Array.isArray(interactions) || !contactId) return [];
  return interactions
    .filter((i) => (i?.contactId ?? i?.contact_id) === contactId)
    .sort((a, b) => {
      const da = parseDate(a?.createdAt ?? a?.created_at)?.getTime() || 0;
      const db = parseDate(b?.createdAt ?? b?.created_at)?.getTime() || 0;
      return db - da; // mais recente primeiro
    });
}

/**
 * Monta o Context Card de um contato específico.
 *
 * @param {object} contact Formato do frontend OU o cru do Supabase — os dois
 *   já são aceitos, mesma tolerância que priorityEngine.js tem hoje.
 * @param {Array<object>} allInteractions Histórico COMPLETO do usuário
 *   (todos os contatos) — a função filtra internamente pelo contato.
 * @param {Date|string} [referenceDate]
 * @param {Record<string, object>} [feedbackMap] Opcional — mesmo mapa de
 *   shared/alertsFeedback.js. Sem ele, "por que agora" pode incluir uma
 *   recomendação que o usuário já dispensou (aceitável para o briefing
 *   manual, que é sempre uma decisão explícita do usuário de olhar aquele
 *   contato; recomendado passar quando disponível).
 * @param {number} [maxRecentInteractions=5]
 * @returns {object}
 */
export function buildContextCard(
  contact,
  allInteractions = [],
  referenceDate = new Date(),
  feedbackMap = {},
  maxRecentInteractions = 5
) {
  const today = parseDate(referenceDate) || new Date();
  const contactId = contact?.id;

  const lastInteractionAt = contact?.lastInteraction ?? contact?.last_interaction_at ?? null;
  const idealFrequencyDays =
    contact?.idealFreq ?? contact?.ideal_frequency_days ?? null;

  const relevancia = calculateRelevance(contact);
  const momentum = relationshipMomentum(contact, allInteractions, today);

  const recentes = contactInteractions(allInteractions, contactId).slice(0, maxRecentInteractions);

  // Reaproveita o motor real para "por que agora" — nunca inventa um motivo
  // à parte. Roda computePriorities só para este contato: mesma fórmula que
  // decide a Home, sem duplicar a lógica de candidatos aqui.
  let porQueAgora = null;
  if (contactId) {
    const { main } = computePriorities([contact], feedbackMap, today, allInteractions);
    if (main && main.relationshipId === contactId) {
      porQueAgora = { reason: main.reason, actionType: main.actionType, title: main.title };
    }
  }

  return {
    pessoa: {
      nome: contact?.name ?? null,
      empresa: contact?.company ?? null,
      cargo: contact?.role ?? null,
    },
    relacao: {
      proximidade: contact?.proximity ?? null,
      relevancia, // 0-100 ou null se os 4 campos estratégicos não estiverem completos
      ultimaInteracaoEm: lastInteractionAt,
      diasSemContato: daysSince(lastInteractionAt, today),
      frequenciaIdealDias: idealFrequencyDays,
    },
    momentum,
    memoria: {
      ultimasInteracoes: recentes.map((i) => ({
        tipo: i?.type ?? null,
        sentimento: i?.sentiment ?? null,
        descricao: i?.description ?? i?.notes ?? i?.note ?? null,
        data: i?.createdAt ?? i?.created_at ?? null,
      })),
    },
    pendencias: {
      proximaAcao: contact?.nextAction ?? contact?.next_action ?? null,
      proximaAcaoData: contact?.nextActionDate ?? contact?.next_action_date ?? null,
    },
    porQueAgora,
  };
}

export default buildContextCard;
