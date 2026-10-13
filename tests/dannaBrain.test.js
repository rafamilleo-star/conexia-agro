import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDannaAppKnowledge, selectDannaHistory, projectDannaProfile, buildDannaReadPrompt } from '../shared/dannaAppKnowledge.js';
import { resolveDannaContact, detectDannaNavigation, dannaCapabilities } from '../shared/dannaCapabilities.js';
import { advanceDannaRehearsal, isDannaRehearsalRequest } from '../src/lib/dannaRehearsal.js';
import { answerDannaReadIntent } from '../api/_lib/dannaKnowledge.js';
import { buildNetworkOverview } from '../src/lib/dannaConversation.js';
import { createDannaMockDb } from './helpers/dannaMockDb.js';
import { getDannaWorkspace, publishDannaWorkspace, clearDannaWorkspace } from '../src/lib/dannaWorkspaceContext.js';

const profile = { id: 'u1', name: 'Rafael', role: 'Gestor', assessment_scores: { escuta_relacional: 75 },
  calendar_ics_url: 'SECRET-ICS-URL', stripe_customer_id: 'SECRET-STRIPE' };
const contacts = [{ id: 'ana', user_id: 'u1', name: 'Ana Lima', company: 'A' }, { id: 'joao', user_id: 'u1', name: 'João Silva', company: 'B' }];

test('fontes são isoladas por conta e falhas opcionais não escondem diagnóstico e metas', async () => {
  const db = createDannaMockDb({
    assessments: [{ id: 'a1', user_id: 'u1', scores: { escuta_relacional: 75 }, created_at: '2026-10-01' }, { id: 'a2', user_id: 'u2', scores: { SECRET: 100 } }],
    ai_goals: [{ id: 'g1', user_id: 'u1', goal_text: 'Gerar valor', metric_type: 'interactions_count', baseline_value: 0, target_value: 10, archived: false }],
    calendar_connections: [{ id: 'c1', user_id: 'u1', provider: 'google', status: 'active' }],
  }, { plan_insights: true });
  const result = await loadDannaAppKnowledge(db, 'u1', { raw: { profile, contacts }, isPro: true });
  assert.equal(result.sources.insights.status, 'unavailable');
  assert.equal(result.sources.progress.status, 'empty');
  assert.equal(result.assessment.scores.escuta_relacional, 75);
  assert.equal(result.goals[0].goal_text, 'Gerar valor');
  assert.doesNotMatch(JSON.stringify(result), /SECRET/);
  for (const query of db.calls) assert.ok(query.scopes.some(([key, value]) => key === 'user_id' && value === 'u1'), query.table);
  assert.equal(db.writes.length, 0);
  assert.doesNotMatch(db.calls.find(q => q.table === 'calendar_connections').columns, /access_token|refresh_token|password/);
});

test('contexto de outra conta é recusado antes de qualquer consulta', async () => {
  const db = createDannaMockDb();
  await assert.rejects(loadDannaAppKnowledge(db, 'u1', { raw: { profile: { id: 'u2' } } }));
  assert.equal(db.calls.length, 0);
});

test('visão Empresa usa só agregados autorizados e canal service-role não chama RPCs de equipe', async () => {
  const db = createDannaMockDb({ get_org_team_overview: [{ first_name: 'SECRET-NAME', contact_email: 'SECRET-EMAIL', onboarding_completed: true }] });
  const adminProfile = { ...profile, org_role: 'admin', organization_id: 'org1' };
  const result = await loadDannaAppKnowledge(db, 'u1', { raw: { profile: adminProfile }, isPro: true });
  assert.equal(result.team.stats.total, 1);
  assert.doesNotMatch(JSON.stringify(result.team), /SECRET/);
  db.rpcs.length = 0;
  const server = await loadDannaAppKnowledge(db, 'u1', { raw: { profile: adminProfile }, allowOrganization: false });
  assert.equal(server.sources.team.status, 'restricted');
  assert.equal(db.rpcs.length, 0);
});

test('cache de IA mantém origem de sugestão, expira e não contorna PRO', async () => {
  const now = new Date('2026-10-12T12:00:00Z');
  const storage = { getItem: key => key.includes('insights') ? JSON.stringify({ data: ['Sugestão de IA'], ts: now.getTime() - 1000 }) : null };
  const db = createDannaMockDb();
  const pro = await loadDannaAppKnowledge(db, 'u1', { raw: { profile }, storage, now, isPro: true });
  assert.equal(pro.cachedSuggestions.insights.status, 'suggestion_only');
  const free = await loadDannaAppKnowledge(db, 'u1', { raw: { profile }, storage, now });
  assert.deepEqual(free.cachedSuggestions, {});
  assert.equal(free.sources.goals.status, 'restricted');
  const expired = await loadDannaAppKnowledge(db, 'u1', { raw: { profile }, storage, now: new Date(now.getTime() + 5 * 3600000), isPro: true });
  assert.equal(expired.cachedSuggestions.insights, undefined);
});

test('busca histórica encontra registro antigo fora dos 200 mais recentes', () => {
  const interactions = Array.from({ length: 250 }, (_, id) => ({ id, contact_id: 'joao', description: 'Conversa recente', created_at: '2026-10-10' }));
  interactions.push({ id: 'old', contact_id: 'ana', description: 'Projeto irrigação validado', created_at: '2024-02-01' });
  const result = selectDannaHistory('O que falei com Ana sobre irrigação em 2024?', contacts, interactions);
  assert.equal(result.records[0].id, 'old');
  assert.equal(result.coverage.matched, 1);
  const limited = selectDannaHistory('Minha rede', contacts, interactions);
  assert.equal(limited.coverage.loaded, 251);
  assert.equal(limited.coverage.returned, 80);
  assert.equal(limited.coverage.limited, true);
  assert.equal(buildNetworkOverview(contacts, interactions.concat(interactions), new Date(), true).sampleMayBeLimited, false);
});

test('nomes ambíguos exigem escolha; empresa permite distinguir homônimos', () => {
  const people = [{ id: '1', name: 'João Silva', company: 'A' }, { id: '2', name: 'João Silva', company: 'B' }];
  assert.equal(resolveDannaContact('João', people).contact, null);
  assert.equal(resolveDannaContact('João Silva', people).contact, null);
  assert.equal(resolveDannaContact('João Silva na B', people).contact.id, '2');
  assert.equal(resolveDannaContact('Joãozinho', people).contact, null);
});

test('navegação pede intenção explícita e respeita capacidades da conta', () => {
  assert.equal(detectDannaNavigation('Danna, abra minhas metas'), 'goals');
  assert.equal(detectDannaNavigation('Mostre meu diagnóstico'), 'report');
  assert.equal(detectDannaNavigation('Como está meu plano?'), null);
  assert.equal(dannaCapabilities().find(c => c.id === 'rehearsal').available, false);
  assert.equal(dannaCapabilities({ isPro: true }).find(c => c.id === 'company').available, false);
  assert.equal(projectDannaProfile(profile).stripe_customer_id, undefined);
});

test('ensaio em múltiplos turnos não usa captura e preserva objetivo até feedback', async () => {
  assert.equal(isDannaRehearsalRequest('Danna quero ensaiar uma conversa com Ana Lima'), true);
  assert.equal(isDannaRehearsalRequest('Ontem ensaiamos uma apresentação'), false);
  const requests = [];
  const options = { contacts, interactions: [], isPro: true, request: async data => {
    requests.push(data);
    return data.feedback ? { acerto: 'Clareza', ajuste: 'Escute', trecho: '', alternativa: 'Como vai?' } : { resposta: 'Pode explicar?' };
  } };
  let result = await advanceDannaRehearsal(null, 'Quero ensaiar com Ana Lima', options);
  assert.equal(result.state.stage, 'goal');
  result = await advanceDannaRehearsal(result.state, 'Quero pedir uma indicação', options);
  assert.equal(result.state.scenario, 'ajuda');
  result = await advanceDannaRehearsal(result.state, 'Conversei com você sobre um projeto', options);
  assert.equal(requests[0].messages[0].role, 'user');
  assert.equal(result.state.messages.length, 2);
  result = await advanceDannaRehearsal(result.state, 'finalizar ensaio', options);
  assert.equal(result.state.stage, 'finished');
  assert.equal(requests[1].feedback, true);
  const exit = await advanceDannaRehearsal(result.state, 'sair do ensaio', options);
  assert.equal(exit.state, null);
  assert.equal((await advanceDannaRehearsal(null, 'Registre minha conversa real com Ana', options)).handled, false);
});

test('ensaio não escolhe pessoa ambígua e não libera acesso sem PRO', async () => {
  const people = [{ id: '1', name: 'João A' }, { id: '2', name: 'João B' }];
  const result = await advanceDannaRehearsal(null, 'Quero ensaiar com João', { contacts: people, isPro: true });
  assert.equal(result.state.stage, 'person');
  assert.equal(result.state.contact, null);
  const free = await advanceDannaRehearsal(null, 'Quero ensaiar com João A', { contacts: people });
  assert.equal(free.state, null);
  assert.match(free.answer, /PRO/);
});

test('leitura do WhatsApp usa diagnóstico, motor central e dados da mesma conta sem escrever', async () => {
  const db = createDannaMockDb({ profiles: [profile], contacts, interactions: [],
    assessments: [{ id: 'assess', user_id: 'u1', scores: { escuta_relacional: 75 } }],
  });
  let prompt;
  const result = await answerDannaReadIntent({ intent: 'query_app' }, { userId: 'u1', question: 'Qual meu diagnóstico?', isPro: true, db,
    generate: async text => { prompt = text; return 'Seu diagnóstico registrado aponta escuta relacional.'; } });
  assert.equal(result.handled, true);
  assert.match(prompt, /relationship_intelligence/);
  assert.match(prompt, /escuta_relacional/);
  assert.doesNotMatch(prompt, /SECRET/);
  assert.equal(db.writes.length, 0);
  const blocked = await answerDannaReadIntent({ intent: 'briefing' }, { userId: 'u1', isPro: false, db });
  assert.match(blocked.answer, /PRO/);
  assert.equal((await answerDannaReadIntent({ intent: 'register_interaction' }, {})).handled, false);
});

test('prompt compartilhado declara limitações e não permite escritas fictícias', () => {
  const prompt = buildDannaReadPrompt({ question: 'Minha rede', appKnowledge: {}, history: { coverage: { limited: true } } });
  assert.match(prompt, /unavailable não significa vazio/);
  assert.match(prompt, /não apresente uma amostra como todo o histórico/);
  assert.match(prompt, /Não realize escritas/);
});

test('conteúdo gerado em tela é isolado por usuário, tem validade e preserva etiqueta de simulação', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  publishDannaWorkspace('u1', 'rehearsal_feedback', { person: 'Ana', feedback: 'Ajuste sua abertura' }, now);
  assert.equal(getDannaWorkspace('u1', now).rehearsal_feedback.kind, 'simulation');
  assert.deepEqual(getDannaWorkspace('u2', now), {});
  assert.deepEqual(getDannaWorkspace('u1', now + 5 * 3600000), {});
  clearDannaWorkspace('u1');
  assert.deepEqual(getDannaWorkspace('u1', now), {});
});

test('progresso de metas é calculado com IDs distintos da própria conta sem consultar view privilegiada', async () => {
  const db = createDannaMockDb({ ai_goals: [{ id: 'g1', user_id: 'u1', metric_type: 'interactions_count', baseline_value: 1, target_value: 5, archived: false }] });
  const result = await loadDannaAppKnowledge(db, 'u1', { isPro: true, raw: { profile, interactions: [{ id: '1' }, { id: '2' }, { id: '2' }] } });
  assert.equal(result.goals[0].current_value, 2);
  assert.equal(result.goals[0].progress_percentage, 25);
  assert.equal(db.calls.some(q => q.table === 'ai_goals_progress'), false);
});
