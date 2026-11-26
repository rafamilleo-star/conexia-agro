import test from 'node:test';
import assert from 'node:assert/strict';
import { escolhaConversa } from '../api/_lib/contactCapture.js';

test('escolhaConversa reconhece interação, tarefa e não', () => {
  assert.equal(escolhaConversa('INTERAÇÃO'), 'interacao');
  assert.equal(escolhaConversa('interacao.'), 'interacao');
  assert.equal(escolhaConversa('Tarefa'), 'tarefa');
  assert.equal(escolhaConversa('não'), 'nao');
  assert.equal(escolhaConversa('NAO'), 'nao');
});

test('escolhaConversa devolve null para respostas fora do esperado', () => {
  assert.equal(escolhaConversa('sim'), null);
  assert.equal(escolhaConversa('talvez amanhã'), null);
  assert.equal(escolhaConversa(''), null);
});

process.env.SUPABASE_SERVICE_KEY = 'capture-test-key';
process.env.GEMINI_API_KEY = 'capture-test-gemini';
const { handleIncomingPhoto, handleIncomingMessage } = await import('../api/whatsapp-webhook.js');
const uid = '11111111-1111-4111-a111-111111111111';
const numero = '554399111718';

function mockSupabase({ conversa, contacts, writes, pendingRef, whatsapp = null }) {
  return async (url, options = {}) => {
    const u = String(url), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null;
    let data = [];
    if (u.includes('generativelanguage')) {
      data = { candidates: [{ content: { parts: [{ text: JSON.stringify({ contacts: [{ name: 'Daniel Houzenhouse', company: 'SUMITOMO', ...(whatsapp ? { whatsapp } : {}) }], conversa }) }] } }] };
    } else if (u.includes('/profiles?')) data = [{ id: uid, name: 'Dono Conta', is_pro: true, whatsapp: numero }];
    else if (u.includes('/whatsapp_pending_actions')) {
      if (method === 'POST') { pendingRef.value = body; data = [body]; }
      else if (method === 'DELETE') pendingRef.value = null;
      else data = pendingRef.value ? [pendingRef.value] : [];
    } else if (u.includes('/contacts?')) {
      if (method === 'PATCH') { writes.push({ table: 'contacts', body }); Object.assign(contacts[0], body); }
      data = contacts;
    } else if (u.includes('/interactions')) { writes.push({ table: 'interactions', body }); data = [body]; }
    else if (u.includes('/tasks_agenda')) { writes.push({ table: 'tasks_agenda', body }); data = [body]; }
    else if (u.includes('whatsapp_rate_limits')) data = [{ count: 0 }];
    else if (u.includes('whatsapp_processed_messages')) data = [];
    else throw new Error('Unexpected URL ' + u);
    return new Response(JSON.stringify(data));
  };
}

async function fluxoFoto({ escolha, conversa }) {
  const original = global.fetch, replies = [], writes = [], pendingRef = { value: null };
  const contacts = [{ id: 'daniel', name: 'Daniel Houzenhouse', company: 'SUMITOMO', whatsapp: null }];
  global.fetch = mockSupabase({ conversa, contacts, writes, pendingRef });
  const reply = async (_, text) => replies.push(text);
  try {
    await handleIncomingPhoto(numero, async () => ({ buffer: Buffer.alloc(20), mimeType: 'image/png' }), reply, 'photo-' + escolha);
    await handleIncomingMessage(numero, 'MESMA', reply, 'confirm-' + escolha);
    await handleIncomingMessage(numero, escolha, reply, 'choice-' + escolha);
    return { replies, writes, pending: pendingRef.value };
  } finally { global.fetch = original; }
}

test('print com conversa pergunta interação ou tarefa e grava a escolha', async () => {
  const r = await fluxoFoto({ escolha: 'INTERAÇÃO', conversa: 'Daniel foi promovido a gerente de inteligência da LATAM.' });
  assert.match(r.replies.find(t => /\*interação\* ou \*tarefa\*/.test(t)), /Daniel/);
  const inter = r.writes.find(w => w.table === 'interactions');
  assert.ok(inter, 'deveria gravar interação');
  assert.equal(inter.body.contact_id, 'daniel');
  assert.match(inter.body.description, /gerente de inteligência/);
  assert.equal(r.pending, null);
});

test('escolha TAREFA cria item na agenda e não cria interação', async () => {
  const r = await fluxoFoto({ escolha: 'TAREFA', conversa: 'Daniel foi promovido a gerente de inteligência da LATAM.' });
  assert.equal(r.writes.some(w => w.table === 'interactions'), false);
  const tarefa = r.writes.find(w => w.table === 'tasks_agenda');
  assert.ok(tarefa, 'deveria criar tarefa');
  assert.equal(tarefa.body.origem, 'whatsapp');
  assert.match(tarefa.body.titulo, /^Conversa com Daniel Houzenhouse:/);
});

test('sem conversa na imagem, o fluxo segue como antes e não pergunta nada', async () => {
  const original = global.fetch, replies = [], writes = [], pendingRef = { value: null };
  const contacts = [{ id: 'daniel', name: 'Daniel Houzenhouse', company: 'SUMITOMO', whatsapp: null }];
  global.fetch = mockSupabase({ conversa: '', contacts, writes, pendingRef });
  const reply = async (_, text) => replies.push(text);
  try {
    await handleIncomingPhoto(numero, async () => ({ buffer: Buffer.alloc(20), mimeType: 'image/png' }), reply, 'photo-sem');
    await handleIncomingMessage(numero, 'MESMA', reply, 'confirm-sem');
    assert.equal(replies.some(t => /\*interação\* ou \*tarefa\*/.test(t)), false);
    assert.equal(pendingRef.value, null);
  } finally { global.fetch = original; }
});

test('pessoa já cadastrada com o mesmo telefone recebe a pergunta da conversa direto', async () => {
  const original = global.fetch, replies = [], writes = [], pendingRef = { value: null };
  const contacts = [{ id: 'daniel', name: 'Daniel Houzenhouse', company: 'SUMITOMO', whatsapp: '+5543999000000' }];
  global.fetch = mockSupabase({ conversa: 'Daniel foi promovido.', contacts, writes, pendingRef, whatsapp: '+5543999000000' });
  const reply = async (_, text) => replies.push(text);
  try {
    await handleIncomingPhoto(numero, async () => ({ buffer: Buffer.alloc(20), mimeType: 'image/png' }), reply, 'photo-known');
    assert.match(replies[0], /já está na sua rede/);
    assert.match(replies[0], /\*interação\* ou \*tarefa\*/);
    assert.equal(pendingRef.value.intent, 'photo_conversation_choice');
    assert.equal(pendingRef.value.data.contact_id, 'daniel');
  } finally { global.fetch = original; }
});
