// api/push-subscribe.js
// POST { subscription } com Authorization: Bearer <token Supabase>.
// Guarda o aparelho do usuário (endpoint de push) em push_subscriptions.
// Idempotente: o mesmo endpoint atualiza a linha em vez de duplicar.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { getUserIdFromAuthHeader } from './_lib/relationshipAssistant/oauthState.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

    const uid = await getUserIdFromAuthHeader(req.headers['authorization']);
    if (!uid) return res.status(401).json({ ok: false, error: 'Sessão inválida.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const sub = body.subscription;
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ ok: false, error: 'Assinatura inválida.' });

    await sb('push_subscriptions?on_conflict=endpoint', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({
        user_id: uid,
        endpoint,
        p256dh,
        auth,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[push-subscribe] erro:', err);
    return res.status(500).json({ ok: false, error: 'Não foi possível ativar os lembretes agora.' });
  }
}
