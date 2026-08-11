// api/calendar-oauth/google-disconnect.js
//
// POST, chamado pelo frontend (Authorization: Bearer <supabase access
// token>) quando o usuário clica em "Desconectar" nas configurações.

import { getUserIdFromAuthHeader } from '../_lib/relationshipAssistant/oauthState.js';
import { supabaseRest as sb } from '../_lib/relationshipAssistant/notificationLog.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

    const uid = await getUserIdFromAuthHeader(req.headers['authorization']);
    if (!uid) return res.status(401).json({ ok: false, error: 'sessão inválida' });

    await sb(`calendar_connections?user_id=eq.${uid}&provider=eq.google`, { method: 'DELETE' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[calendar-oauth/google-disconnect] erro:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
