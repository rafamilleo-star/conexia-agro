/**
 * CONÉXIA — Tratamento de feedback das recomendações
 *
 * Converte os registros da tabela `alerts` em um mapa que o motor
 * de prioridade consegue consultar.
 *
 * Regras:
 * - accepted: não repetir a mesma recomendação por 7 dias;
 * - dismissed:
 *   - primeira dispensa: 14 dias;
 *   - segunda dispensa: 60 dias;
 *   - terceira ou mais: 180 dias e contato considerado silencioso;
 * - snoozed: esconder até a data escolhida;
 * - logged: o fato real foi alterado por uma interação, mas também evita
 *   repetição imediata da recomendação anterior.
 */

/**
 * Soma ou subtrai dias de uma data.
 *
 * @param {Date|string} date
 * @param {number} days
 * @returns {Date}
 */
export function addDays(date, days) {
  const result = date instanceof Date
    ? new Date(date.getTime())
    : new Date(date);

  if (Number.isNaN(result.getTime())) {
    return new Date();
  }

  result.setDate(result.getDate() + Number(days || 0));
  return result;
}

/**
 * Define o período de supressão após o usuário responder
 * "Está tudo bem assim".
 *
 * previousDismissals representa quantas dispensas já existiam antes
 * da resposta atual.
 *
 * @param {number} previousDismissals
 * @returns {number}
 */
export function nextDismissSuppressionDays(previousDismissals = 0) {
  const count = Number(previousDismissals) || 0;

  if (count <= 0) return 14;
  if (count === 1) return 60;

  return 180;
}

/**
 * Retorna uma data válida ou null.
 *
 * @param {*} value
 * @returns {Date|null}
 */
function parseDate(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Retorna o identificador da recomendação armazenado no metadata.
 *
 * @param {object} row
 * @returns {string|null}
 */
function getRecommendationId(row) {
  return (
    row?.metadata?.recommendationId ||
    row?.metadata?.recommendation_id ||
    null
  );
}

/**
 * Retorna o tipo de ação armazenado no metadata.
 *
 * @param {object} row
 * @returns {string|null}
 */
function getActionType(row) {
  return (
    row?.metadata?.actionType ||
    row?.metadata?.action_type ||
    null
  );
}

/**
 * Constrói um mapa de feedback por contato.
 *
 * Formato retornado:
 *
 * {
 *   [contactId]: {
 *     rows: [...],
 *     dismissedCount: 2,
 *     muted: false,
 *     suppressUntil: Date | null,
 *     recommendationSuppressions: {
 *       [recommendationId]: Date
 *     },
 *     actionSuppressions: {
 *       [actionType]: Date
 *     }
 *   }
 * }
 *
 * @param {Array<object>} rows
 * @returns {Record<string, object>}
 */
export function buildFeedbackMap(rows = []) {
  const map = {};

  for (const row of Array.isArray(rows) ? rows : []) {
    const contactId = row?.contact_id;

    if (!contactId) continue;

    if (!map[contactId]) {
      map[contactId] = {
        rows: [],
        dismissedCount: 0,
        muted: false,
        suppressUntil: null,
        recommendationSuppressions: {},
        actionSuppressions: {},
      };
    }

    const entry = map[contactId];
    const status = row?.status || "";
    const createdAt = parseDate(row?.created_at) || new Date();
    const recommendationId = getRecommendationId(row);
    const actionType = getActionType(row);

    entry.rows.push(row);

    let suppressUntil = parseDate(row?.metadata?.suppressUntil);

    if (status === "dismissed") {
      entry.dismissedCount += 1;

      /*
       * Registros antigos podem não ter suppressUntil.
       * Nesse caso, calculamos defensivamente com base na ordem histórica.
       */
      if (!suppressUntil) {
        const previousDismissals = Math.max(0, entry.dismissedCount - 1);
        suppressUntil = addDays(
          createdAt,
          nextDismissSuppressionDays(previousDismissals)
        );
      }

      /*
       * Após a terceira dispensa, tratamos a pessoa como silenciosa.
       * Isso evita transformar uma relação tranquila em tarefa recorrente.
       */
      if (entry.dismissedCount >= 3) {
        entry.muted = true;
      }
    }

    if (status === "accepted" && !suppressUntil) {
      suppressUntil = addDays(createdAt, 7);
    }

    if (status === "logged" && !suppressUntil) {
      suppressUntil = addDays(createdAt, 7);
    }

    if (status === "snoozed" && !suppressUntil) {
      suppressUntil = addDays(createdAt, 1);
    }

    if (suppressUntil) {
      if (
        !entry.suppressUntil ||
        suppressUntil.getTime() > entry.suppressUntil.getTime()
      ) {
        entry.suppressUntil = suppressUntil;
      }

      if (recommendationId) {
        const current = entry.recommendationSuppressions[recommendationId];

        if (!current || suppressUntil.getTime() > current.getTime()) {
          entry.recommendationSuppressions[recommendationId] = suppressUntil;
        }
      }

      if (actionType) {
        const current = entry.actionSuppressions[actionType];

        if (!current || suppressUntil.getTime() > current.getTime()) {
          entry.actionSuppressions[actionType] = suppressUntil;
        }
      }
    }
  }

  return map;
}

/**
 * Verifica se uma recomendação está suprimida.
 *
 * @param {object|null} feedback
 * @param {string} recommendationId
 * @param {string} actionType
 * @param {Date|string} referenceDate
 * @returns {boolean}
 */
export function isRecommendationSuppressed(
  feedback,
  recommendationId,
  actionType,
  referenceDate = new Date()
) {
  if (!feedback) return false;
  if (feedback.muted) return true;

  const now = parseDate(referenceDate) || new Date();

  const recommendationUntil =
    recommendationId &&
    feedback.recommendationSuppressions?.[recommendationId];

  if (
    recommendationUntil &&
    parseDate(recommendationUntil)?.getTime() > now.getTime()
  ) {
    return true;
  }

  const actionUntil =
    actionType &&
    feedback.actionSuppressions?.[actionType];

  if (
    actionUntil &&
    parseDate(actionUntil)?.getTime() > now.getTime()
  ) {
    return true;
  }

  if (
    feedback.suppressUntil &&
    parseDate(feedback.suppressUntil)?.getTime() > now.getTime()
  ) {
    return true;
  }

  return false;
}
