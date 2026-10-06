const ACTION =
  /\[\[CONEXIA_ACTION:([\s\S]*?)\]\]/g;

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDate(value) {
  if (!value) return null;

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return null;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeText)
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeAction(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const type = normalizeText(data.type);

  if (!type) return null;

  if (type === 'save_interaction') {
    const description = normalizeText(
      data.description || data.sourceText
    );

    if (!description) return null;

    return {
      type,
      contactName:
        normalizeText(data.contactName) || null,
      existingContactId:
        normalizeText(data.existingContactId) || null,
      interactionType:
        normalizeText(data.interactionType) || 'outro',
      description,
      sourceText:
        normalizeText(data.sourceText) || description,
      sentiment:
        normalizeText(data.sentiment) || 'neutro',
      tags: normalizeTags(data.tags),
      company:
        normalizeText(data.company) || null,
      role:
        normalizeText(data.role) || null,
      nextAction:
        normalizeText(data.nextAction) || null,
      nextActionDate:
        normalizeDate(data.nextActionDate),
    };
  }

  if (type === 'add_contact') {
    const contactName = normalizeText(
      data.contactName || data.name
    );

    if (!contactName) return null;

    return {
      type,
      contactName,
      company:
        normalizeText(data.company) || null,
      role:
        normalizeText(data.role) || null,
      sourceInteractionId:
        normalizeText(data.sourceInteractionId) || null,
    };
  }

  if (type === 'complete_relationship_action') {
    const relationshipId = normalizeText(
      data.relationshipId || data.contactId
    );

    if (!relationshipId) return null;

    return {
      type,
      relationshipId,
      recommendationId:
        normalizeText(data.recommendationId) || null,
      actionType:
        normalizeText(data.actionType) || null,
    };
  }

  return {
    ...data,
    type,
  };
}

/**
 * Extrai ações estruturadas produzidas pela Danna.
 *
 * Exemplo esperado:
 *
 * [[CONEXIA_ACTION:{
 *   "type":"save_interaction",
 *   "contactName":"João",
 *   "description":"João apresentará o projeto ao presidente.",
 *   "nextAction":"Mandar mensagem desejando boa apresentação.",
 *   "nextActionDate":"2026-10-08"
 * }]]
 *
 * O marcador não é exibido para o usuário.
 */
export function parseDannaActions(content = '') {
  const actions = [];

  const cleanText = String(content).replace(
    ACTION,
    (_, raw) => {
      const parsed = safeJson(raw);
      const action = normalizeAction(parsed);

      if (action) {
        actions.push(action);
      }

      return '';
    }
  );

  return {
    text: cleanText
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    actions,
  };
}

export function hasDannaAction(content = '') {
  ACTION.lastIndex = 0;
  const found = ACTION.test(String(content));
  ACTION.lastIndex = 0;
  return found;
}

export default parseDannaActions;
