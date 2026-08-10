// api/calendar-oauth/google-callback.js
//
// GET, chamado pelo próprio Google após o usuário autorizar (ou negar) o
// consentimento. Troca o code por tokens, faz upsert em calendar_connections
// e redireciona de volta pra tela de configurações do app com um status na
// query string (?calendar=connected | ?calendar=error).

import { exchangeGoogleCode } from '../_lib/relationshipAssistant/googleCalendar.js';
import { verifyOAuthState } from '../_lib/relationshipAssistant/oauthState.js';
import { supabaseRest as sb } from '../_lib/relationshipAssistant/notificationLog.js';

// Pra onde volta depois do consentimento — a mesma origem do app.
const APP_URL = 'https://conexia-agro-chi.vercel.app';

export default async function handler(req, res) {
  const { code, state, error: googleError } = req.query || {};

  if (googleError) {
    return res.redirect(302, `${APP_URL}/?calendar=denied`);
  }

  try {
    const { uid } = verifyOAuthState(state);
    const tokens = await exchangeGoogleCode(code);

    if (!tokens.refresh_token) {
      // Acontece se o usuário já tinha autorizado antes e o Google não
      // reemite refresh_token — como sempre pedimos prompt=consent isso não
      // deveria ocorrer, mas se ocorrer é melhor falhar explicitamente do
      // que salvar uma conexão que vai expirar em 1h sem forma de renovar.
      console.error('[calendar-oauth/google-callback] sem refresh_token pra uid', uid);
      return res.redirect(302, `${APP_URL}/?calendar=error`);
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();

    await sb('calendar_connections?on_conflict=user_id,provider', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        user_id: uid,
        provider: 'google',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: expiresAt,
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      }),
    });

    return res.redirect(302, `${APP_URL}/?calendar=connected`);
  } catch (err) {
    console.error('[calendar-oauth/google-callback] erro:', err);
    return res.redirect(302, `${APP_URL}/?calendar=error`);
  }
}
