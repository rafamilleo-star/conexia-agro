import test from 'node:test';
import assert from 'node:assert/strict';
import { captureFields, contactProposal } from '../shared/contactCapture.js';
import { signCapture, verifyCapture, saveCapture, listGooglePeople, extractContactPhoto } from '../api/_lib/contactCapture.js';
import { suggestNewContactCandidatesFromEvent } from '../api/_lib/relationshipAssistant/icsImport.js';
import calendarHandler from '../api/calendar-meeting-attendees.js';

process.env.SUPABASE_SERVICE_KEY = 'capture-test-key';
process.env.GEMINI_API_KEY = 'capture-test-gemini';
const { handleIncomingPhoto, handleIncomingMessage } = await import('../api/whatsapp-webhook.js');
const uid = '11111111-1111-4111-a111-111111111111';
test('Zeca sem e-mail recebe proposta de complemento, sem duplicação automática', () => {
  const p = contactProposal({ name: 'Zeca Barbosa', email: 'ZECA@exemplo.com' }, [{ id: 'z', name: 'Zeca Barbosa', whatsapp: '+5543999999999' }]);
  assert.equal(p.kind, 'review'); assert.equal(p.matches[0].id, 'z'); assert.equal(p.changes.contact_email, 'zeca@exemplo.com');
});
test('homônimos e identificadores conflitantes exigem escolha', () => {
  const contacts = [{ id: 'a', name: 'Zeca Barbosa', contact_email: 'a@x.com' }, { id: 'b', name: 'Zeca Barbosa', whatsapp: '+5543999999999' }];
  assert.equal(contactProposal({ name: 'Zeca Barbosa' }, contacts).kind, 'ambiguous');
  assert.equal(contactProposal({ email: 'a@x.com', phone: '+5543999999999' }, contacts).matches.length, 2);
  assert.equal(contactProposal({ name: 'Zeca' }, contacts).matches.length, 0);
});
test('confirmação assinada recusa outra conta, adulteração e expiração', () => {
  const token = signCapture(uid, { name: 'Zeca', email: 'z@x.com', user_id: 'outro' }, 'foto');
  assert.equal(verifyCapture(uid, token).candidate.user_id, undefined);
  assert.throws(() => verifyCapture('outro', token));
  assert.throws(() => verifyCapture(uid, token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')));
  const now = Date.now; Date.now = () => now() + 4000000;
  try { assert.throws(() => verifyCapture(uid, token)); } finally { Date.now = now; }
});
test('complemento preserva campos preenchidos e usa condição contra corrida', async () => {
  const writes = [], contacts = [{ id: 'z', name: 'Zeca Barbosa', company: 'Empresa atual', whatsapp: '+5543999999999' }];
  const rest = async (path, opts) => { if (path === 'read') return contacts; writes.push({ path, data: JSON.parse(opts.body) }); return [{ id: 'z' }]; };
  const token = signCapture(uid, { name: 'Zeca Barbosa', company: 'Empresa diferente', email: 'z@x.com' }, 'agenda');
  await assert.rejects(saveCapture(uid, { token }, rest));
  const result = await saveCapture(uid, { token, targetId: 'z' }, rest);
  assert.equal(result.action, 'enriched'); assert.equal(writes.length, 1); assert.equal(writes[0].data.company, undefined);
  assert.ok(writes[0].path.includes('user_id=eq.' + uid)); assert.ok(writes[0].path.includes('contact_email.is.null'));
  await assert.rejects(saveCapture(uid, { token, targetId: 'foreign' }, rest));
});
test('cadastro repetido com mesmo comprovante usa mesma chave e não registra interação', async () => {
  const contacts = [], paths = [], rest = async (path, opts) => { if (path === 'read') return contacts; paths.push(path); const row = JSON.parse(opts.body); contacts.push(row); return [row]; };
  const token = signCapture(uid, { name: 'Nova Pessoa' }, 'foto');
  const first = await saveCapture(uid, { token }, rest);
  const second = await saveCapture(uid, { token, newPerson: true }, rest);
  assert.equal(first.contact.id, second.contact.id); assert.equal(paths.length, 1); assert.equal(paths[0], 'contacts');
});
test('agenda inclui cada participante e e-mails sem nome; ignora robôs', () => {
  const attendees = [{ name: 'Já Cadastrado', email: 'a@x.com' }, { email: 'nova@x.com' }, { name: 'Notificação Google', email: 'noreply@x.com' }];
  assert.equal(suggestNewContactCandidatesFromEvent({ attendees }).length, 2);
});
test('Contatos Google percorre todas as páginas e foto rejeita formato ou tamanho inválido', async () => {
  const original = global.fetch; const calls = [];
  global.fetch = async url => { calls.push(String(url)); return new Response(JSON.stringify(calls.length === 1 ? { connections: [{ names: [{ displayName: 'A' }] }], nextPageToken: 'next' } : { connections: [{ names: [{ displayName: 'B' }] }] })); };
  try { assert.equal((await listGooglePeople('test')).length, 2); assert.ok(calls[1].includes('pageToken=next')); }
  finally { global.fetch = original; }
  await assert.rejects(extractContactPhoto(Buffer.alloc(10), 'text/html'));
  await assert.rejects(extractContactPhoto(Buffer.alloc(3145729), 'image/png'));
  assert.equal(captureFields({ name: 'Pessoa', email: 'inválido', user_id: 'x' }).contact_email, undefined);
});
test('API da agenda não pula convidado novo quando já há um conhecido', async () => {
  const original = global.fetch; let result;
  global.fetch = async url => {
    const u = String(url); let data;
    if (u.includes('/auth/v1/user')) data = { id: uid };
    else if (u.includes('/profiles?')) data = [{ id: uid, is_pro: true, name: 'Dono Conta' }];
    else if (u.includes('/calendar_connections?')) data = [{ access_token: 'token', token_expires_at: new Date(Date.now() + 3600000).toISOString() }];
    else if (u.includes('/contacts?')) { assert.ok(u.includes('user_id=eq.' + uid)); data = [{ id: 'known', name: 'Pessoa Conhecida', contact_email: 'known@x.com' }]; }
    else if (u.includes('/calendar/v3/')) data = { items: [{ id: 'e', summary: 'Reunião', start: { dateTime: new Date().toISOString() }, attendees: [{ displayName: 'Pessoa Conhecida', email: 'known@x.com' }, { displayName: 'Pessoa Nova', email: 'new@x.com' }] }] };
    else throw new Error('Unexpected URL ' + u);
    return new Response(JSON.stringify(data));
  };
  const response = { status(n) { this.code = n; return this; }, json(data) { result = data; return this; } };
  try { await calendarHandler({ method: 'GET', headers: { authorization: 'Bearer test' } }, response); assert.equal(result.ok, true); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].candidate.contact_email, 'new@x.com'); }
  finally { global.fetch = original; }
});
test('foto WhatsApp só escreve após MESMA e completa e-mail sem alterar telefone', async () => {
  const original = global.fetch; let pending = null; const replies = [], writes = [];
  const contacts = [{ id: 'z', name: 'Zeca Barbosa', whatsapp: '+5543999999999' }];
  global.fetch = async (url, options = {}) => {
    const u = String(url), method = options.method || 'GET', body = options.body ? JSON.parse(options.body) : null; let data = [];
    if (u.includes('generativelanguage')) data = { candidates: [{ content: { parts: [{ text: JSON.stringify({ contacts: [{ name: 'Zeca Barbosa', email: 'zeca@x.com' }] }) }] } }] };
    else if (u.includes('/profiles?')) data = [{ id: uid, name: 'Dono Conta', is_pro: true, whatsapp: '554399111718' }];
    else if (u.includes('/whatsapp_pending_actions')) {
      if (method === 'POST') { pending = body; data = [pending]; }
      else if (method === 'DELETE') pending = null;
      else data = pending ? [pending] : [];
    } else if (u.includes('/contacts?')) {
      if (method === 'PATCH') { writes.push(body); Object.assign(contacts[0], body); }
      data = contacts;
    } else if (u.includes('whatsapp_rate_limits')) data = [{ count: 0 }];
    else if (u.includes('whatsapp_processed_messages')) data = [];
    else throw new Error('Unexpected URL ' + u);
    return new Response(JSON.stringify(data));
  };
  try {
    await handleIncomingPhoto('554399111718', async () => ({ buffer: Buffer.alloc(20), mimeType: 'image/png' }), async (_, text) => replies.push(text), 'photo-1');
    assert.equal(writes.length, 0); assert.equal(pending.intent, 'capture_photo'); assert.match(replies[0], /MESMA/);
    await handleIncomingMessage('554399111718', 'MESMA', async (_, text) => replies.push(text), 'confirmation-1');
    assert.equal(writes.length, 1); assert.equal(contacts[0].contact_email, 'zeca@x.com'); assert.equal(contacts[0].whatsapp, '+5543999999999'); assert.equal(pending, null);
  } finally { global.fetch = original; }
});
