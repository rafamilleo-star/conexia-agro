import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNetworkStructure } from '../shared/networkStructure.js';
import { buildRehearsalPrompt, parseRehearsalResponse, requestRehearsal } from '../src/lib/conversationRehearsal.js';

test('estrutura separa desconhecidos, normaliza empresa e não duplica pessoas', () => {
  const result = analyzeNetworkStructure([
    { id: '1', company: ' Café Brasil ' }, { id: '2', company: 'cafe brasil' },
    { id: '2', company: 'cafe brasil' }, { id: '3', company: 'Não informado' },
    { id: '4', company: 'Outra', name: 'Ana' }, null,
  ]);
  assert.equal(result.total, 4);
  assert.equal(result.knownCompany, 3);
  assert.equal(result.unknownCompany, 1);
  assert.equal(result.companyCount, 2);
  assert.equal(result.concentration, null);
  assert.equal(result.singleContactCompanies[0].contacts[0].name, 'Ana');
  assert.equal('edges' in result, false);
});

test('predominância exige amostra preenchida suficiente e maioria estrita', () => {
  const contacts = Array.from({ length: 6 }, (_, id) => ({ id, company: id < 4 ? 'A' : 'B' }));
  assert.equal(analyzeNetworkStructure(contacts).concentration.company, 'A');
  assert.equal(analyzeNetworkStructure(contacts.slice(0, 5)).concentration, null);
  contacts[3].company = 'B';
  assert.equal(analyzeNetworkStructure(contacts).concentration, null);
  assert.equal(analyzeNetworkStructure(null).total, 0);
});

test('ensaio envia só o contexto do contato selecionado, sem dados de terceiros', () => {
  const prompt = buildRehearsalPrompt({
    contact: { id: '1', name: 'Ana', email: 'privado@example.com', phone: '123' },
    interactions: [
      { contact_id: '1', notes: 'Piloto combinado', created_at: '2026-10-01' },
      { contact_id: '2', notes: 'SEGREDO OUTRO CONTATO', created_at: '2026-10-02' },
    ], scenario: 'ajuda', stance: 'cetico', goal: 'Pedir orientação', messages: [],
  });
  assert.match(prompt, /Piloto combinado/);
  assert.match(prompt, /não prevê suas respostas/);
  assert.doesNotMatch(prompt, /SEGREDO OUTRO CONTATO|privado@example|"phone"/);
});

test('feedback só apresenta citação comprovada em fala do usuário', () => {
  const base = { acerto: 'Objetivo claro', ajuste: 'Faça uma pergunta', alternativa: 'Como está seu projeto?' };
  const messages = [{ role: 'user', text: 'Quero retomar nossa conversa.' }, { role: 'assistant', text: 'Estou sem tempo.' }];
  assert.equal(parseRehearsalResponse(JSON.stringify({ ...base, trecho: 'retomar nossa conversa' }), { feedback: true, messages }).trecho, 'retomar nossa conversa');
  assert.equal(parseRehearsalResponse(JSON.stringify({ ...base, trecho: 'Estou sem tempo.' }), { feedback: true, messages }).trecho, '');
  assert.equal(parseRehearsalResponse(JSON.stringify({ ...base, trecho: 'frase inventada' }), { feedback: true, messages }).trecho, '');
});

test('saídas malformadas não entram na conversa', () => {
  assert.deepEqual(parseRehearsalResponse('```json\n{"resposta":"Pode explicar?"}\n```'), { resposta: 'Pode explicar?' });
  for (const text of ['', 'não é JSON', '{"resposta":{}}', '{"resposta":""}', 'null']) {
    assert.throws(() => parseRehearsalResponse(text));
  }
});

test('requisição propaga cancelamento e rejeita falhas e truncamento', async () => {
  const options = { contact: { id: '1', name: 'Ana' }, goal: 'Retomar', messages: [] };
  const signal = new AbortController().signal;
  const response = await requestRehearsal(options, signal, async (url, init) => {
    assert.equal(url, '/api/claude');
    assert.equal(init.signal, signal);
    assert.equal(JSON.parse(init.body).maxTokens, 500);
    return { ok: true, json: async () => ({ content: [{ text: '{"resposta":"Como posso ajudar?"}' }] }) };
  });
  assert.equal(response.resposta, 'Como posso ajudar?');
  await assert.rejects(requestRehearsal(options, signal, async () => ({ ok: false, json: async () => ({}) })));
  await assert.rejects(requestRehearsal(options, signal, async () => ({ ok: true, json: async () => ({ finishReason: 'MAX_TOKENS' }) })));
});
