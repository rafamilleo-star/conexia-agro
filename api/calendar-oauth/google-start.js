// api/calendar-oauth/google-start.js
//
// GET, chamado pelo frontend com Authorization: Bearer <supabase access
// token>. Devolve { authUrl } pro frontend fazer window.location = authUrl.
// Não redireciona ele mesmo pra evitar problema de CORS/preflight — quem
// navega é o browser do usuário.

import { googleCalendarConfigured, buildGoogleAuthUrl } from '../_lib/relationshipAssistant/googleCalendar.js';
import { createOAuthState, getUserIdFromAuthHeader } from '../_lib/relationshipAssistant/oauthState.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' });

    if (!googleCalendarConfigured()) {
      return res.status(500).json({ ok: false, error: 'Google Calendar não configurado (faltam env vars GOOGLE_CALENDAR_*)' });
    }

    const uid = await getUserIdFromAuthHeader(req.headers['authorization']);
    if (!uid) return res.status(401).json({ ok: false, error: 'sessão inválida' });

    const state = createOAuthState({ uid, provider: 'google' });
    const authUrl = buildGoogleAuthUrl(state);

    return res.status(200).json({ ok: true, authUrl });
  } catch (err) {
    console.error('[calendar-oauth/google-start] erro:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
