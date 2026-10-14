import { checkRateLimit } from './whatsapp-webhook.js';
import { getUserIdFromAuthHeader } from './_lib/relationshipAssistant/oauthState.js';
import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { loadCaptureContacts, signedProposal, saveCapture, googleCaptureToken, listGooglePeople, exportGoogleContact, extractContactPhoto } from './_lib/contactCapture.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ ok: false });
    const uid = await getUserIdFromAuthHeader(req.headers.authorization);
    if (!uid) return res.status(401).json({ ok: false, error: 'Sessão inválida.' });
    const profiles = await sb(`profiles?id=eq.${uid}&select=is_pro,plan,pro_expires_at`), p = profiles?.[0];
    if (!(p?.is_pro || (p?.plan === 'pro' && (!p.pro_expires_at || new Date(p.pro_expires_at) > new Date())))) return res.status(403).json({ ok: false, error: 'Captação inteligente é um recurso PRO.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    if (req.method === 'POST' && body.action === 'confirm') return res.json({ ok: true, ...await saveCapture(uid, body) });
    if (req.method === 'POST' && body.action === 'google_export') return res.json({ ok: true, ...await exportGoogleContact(uid, body.contactId) });
    const contacts = await loadCaptureContacts(uid);
    let candidates, source;
    if (req.method === 'GET') { candidates = await listGooglePeople(await googleCaptureToken(uid)); source = 'Contatos Google'; }
    else if (body.action === 'photo') {
      if (!(await checkRateLimit(uid))) throw new Error('Limite de leituras atingido. Tente mais tarde.');
      const base64 = String(body.base64 || '');
      if (base64.length > 4194304 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Foto inválida ou grande demais.');
      candidates = await extractContactPhoto(Buffer.from(base64, 'base64'), body.mimeType); source = 'foto';
    } else return res.status(400).json({ ok: false, error: 'Ação inválida.' });
    const byKey = new Map();
    for (const candidate of candidates) { const proposal = signedProposal(uid, candidate, contacts, source); if (proposal.kind !== 'known' && proposal.key) byKey.set(proposal.key, proposal); }
    return res.json({ ok: true, candidates: [...byKey.values()] });
  } catch (e) { return res.status(400).json({ ok: false, error: e.message }); }
}
