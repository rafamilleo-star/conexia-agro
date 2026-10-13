// Contexto transitório das telas. Nunca é uma interação, fato confirmado ou memória do banco.
const workspace = new Map();
const TTL = 4 * 3600000;
const slots = new Set(['ai_view', 'rehearsal_feedback']);

export function publishDannaWorkspace(userId, slot, value, now = Date.now()) {
  if (!userId || !slots.has(slot) || !value || JSON.stringify(value).length > 40000) return;
  const record = workspace.get(userId) || {};
  record[slot] = { value: JSON.parse(JSON.stringify(value)), generatedAt: new Date(now).toISOString(),
    kind: slot === 'rehearsal_feedback' ? 'simulation' : 'ai_suggestion', source: 'current_app_session' };
  workspace.set(userId, record);
}

export function getDannaWorkspace(userId, now = Date.now()) {
  if (!userId) return {};
  const record = workspace.get(userId) || {};
  return Object.fromEntries(Object.entries(record).filter(([, item]) => now - Date.parse(item.generatedAt) >= 0 && now - Date.parse(item.generatedAt) < TTL));
}

export function clearDannaWorkspace(userId) { workspace.delete(userId); }
