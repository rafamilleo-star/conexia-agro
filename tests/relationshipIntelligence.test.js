import test from 'node:test';
import assert from 'node:assert/strict';
import { computeRelationshipIntelligence } from '../shared/relationshipIntelligence.js';
import { localDay, validDateOnly } from '../shared/relationshipTriggers.js';
import { readUserRows } from '../shared/relationshipData.js';
import { persistDannaCommitment } from '../src/lib/dannaCapture.js';
import { completeRelationshipAction } from '../src/lib/completeRelationshipAction.js';

const now = new Date('2026-10-06T17:00:00Z');
const contact = { id: 'person-a', name: 'João', created_at: '2026-05-01T12:00:00Z' };
const memory = { id: 'memory-a', contact_id: contact.id, memory_type: 'commitment', confidence: 1,
  status: 'active', content: 'Desejar boa sorte na apresentação', metadata: { confirmed: true,
    due_date: '2026-10-07', next_action: 'Desejar boa sorte na apresentação' } };
const run = extras => computeRelationshipIntelligence({ contacts: [contact], ...extras }, now);

test('não inventa atenção sem contexto suficiente', () => {
  assert.equal(run({}).main, null);
  assert.equal(run({}).status, 'no_supported_action');
});
test('compromisso confirmado amanhã tem pessoa, motivo, movimento e evidência', () => {
  const result = run({ memories: [memory] });
  assert.equal(result.main.contactId, contact.id);
  assert.match(result.main.reason, /amanhã/);
  assert.equal(result.main.nextMove, memory.metadata.next_action);
  assert.equal(result.main.evidence.sourceId, memory.id);
  assert.equal(result.main.confidence, 1);
});
test('ignora memória sem confirmação, baixa confiança, encerrada ou expirada', () => {
  for (const patch of [{ confidence: 0.5 }, { status: 'superseded' }, { valid_until: '2026-10-01T12:00:00Z' },
    { metadata: { ...memory.metadata, confirmed: false } }, { metadata: { ...memory.metadata, completed: true } }]) {
    assert.equal(run({ memories: [{ ...memory, ...patch }] }).main, null);
  }
});
test('feedback da Home suprime a mesma decisão no cérebro central', () => {
  const action = run({ memories: [memory] }).main;
  const alerts = [{ contact_id: contact.id, status: 'dismissed', created_at: now.toISOString(),
    metadata: { recommendationId: action.recommendationId, actionType: action.actionType, suppressUntil: '2026-10-20T17:00:00Z' } }];
  assert.equal(run({ memories: [memory], alerts }).main, null);
});
test('passar a data de um encontro não prova que aconteceu', () => {
  const event = { id: 'e', contact_id: contact.id, scheduled_at: '2026-10-06T12:00:00Z', status: 'pendente' };
  assert.equal(run({ events: [event] }).main.actionType, 'event_followup');
  assert.match(run({ events: [event] }).main.reason, /não comprova/);
  assert.equal(run({ events: [{ ...event, status: 'cancelado' }] }).main, null);
  assert.equal(run({ events: [{ ...event, status: 'concluido' }] }).main, null);
});
test('compromisso próximo usa o fuso do usuário e datas impossíveis são rejeitadas', () => {
  assert.equal(localDay('2026-10-07T01:30:00Z', 'America/Sao_Paulo'), '2026-10-06');
  assert.equal(validDateOnly('2026-02-30'), null);
  assert.equal(validDateOnly('2028-02-29'), '2028-02-29');
  const data = { contacts: [{ ...contact, next_action: 'Enviar material', next_action_date: '2026-10-07' }],
    profile: { timezone: 'America/Sao_Paulo' } };
  assert.match(computeRelationshipIntelligence(data, new Date('2026-10-07T01:30:00Z')).main.reason, /amanhã/);
});
test('compromisso persistente vence cópia legada do mesmo próximo passo', () => {
  const result = run({ contacts: [{ ...contact, next_action: memory.content, next_action_date: '2026-10-05' }],
    memories: [{ ...memory, metadata: { ...memory.metadata, due_date: '2026-10-05' } }] });
  assert.equal(result.main.actionType, 'tracked_commitment');
});
test('a decisão retorna no máximo três pessoas distintas', () => {
  const contacts = Array.from({ length: 5 }, (_, i) => ({ ...contact, id: `p${i}`, name: `Pessoa ${i}`,
    next_action: 'Enviar material', next_action_date: '2026-10-06' }));
  const result = computeRelationshipIntelligence({ contacts }, now);
  assert.equal(result.decisions.length, 3);
  assert.equal(new Set(result.decisions.map(x => x.contactId)).size, 3);
});
test('histórico recente evita cobrar uma cadência já atendida', () => {
  assert.equal(run({ contacts: [{ ...contact, last_interaction_at: '2026-07-01T12:00:00Z', ideal_frequency_days: 30 }],
    interactions: [{ contact_id: contact.id, created_at: '2026-10-05T12:00:00Z' }] }).main, null);
});
test('paginação lê mais de mil linhas e sempre aplica o usuário', async () => {
  const rows = Array.from({ length: 1201 }, (_, i) => ({ id: i }));
  const seen = [];
  const db = { from() { return { select() { return this; }, eq(key, id) { seen.push([key, id]); return this; },
    order() { return this; }, async range(a, b) { return { data: rows.slice(a, b + 1) }; } }; } };
  assert.equal((await readUserRows(db, 'contacts', 'user-a')).length, 1201);
  assert.deepEqual(seen, Array(3).fill(['user_id', 'user-a']));
});
test('salva um compromisso por interação, sem data inventada ou contato obrigatório', async () => {
  let payload;
  const db = { from(table) { assert.equal(table, 'relational_memory'); return { async upsert(row) { payload = row; return {}; } }; } };
  await persistDannaCommitment(db, 'user-a', { interactionId: 'i', nextAction: 'Enviar material', savedAt: now.toISOString() });
  assert.equal(payload.id, 'i');
  assert.equal(payload.user_id, 'user-a');
  assert.equal(payload.metadata.due_date, null);
  assert.equal(payload.contact_id, null);
  await assert.rejects(() => persistDannaCommitment(db, 'user-a', { interactionId: 'i', nextAction: 'Enviar', nextActionDate: '2026-02-30' }));
});
test('conclusão preserva metadados e não apaga um próximo passo diferente', async () => {
  const calls = [];
  const db = { from(table) { const q = { select() { return q; }, eq(k, v) { calls.push([table, k, v]); return q; },
    update(row) { calls.push([table, 'update', row]); return q; },
    async single() { return { data: { id: 'm', metadata: { next_action: 'Enviar', custom: true } } }; },
    then(resolve) { resolve({}); } }; return q; } };
  await completeRelationshipAction(db, 'u', { relationshipId: 'p', evidence: { source: 'relational_memory', sourceId: 'm' } });
  assert.ok(calls.some(x => x[0] === 'contacts' && x[1] === 'next_action' && x[2] === 'Enviar'));
  assert.ok(calls.some(x => x[1] === 'update' && x[2].metadata?.custom === true && x[2].metadata?.completed === true));
});
