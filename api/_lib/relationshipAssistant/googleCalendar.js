// api/_lib/relationshipAssistant/googleCalendar.js
//
// Integração OAuth com Google Calendar — substitui o fluxo manual de colar
// o link .ics público. Fluxo:
//
//   1. Frontend chama GET /api/calendar-oauth/google-start (com o access
//      token da sessão Supabase) -> recebe a URL de consentimento do Google.
//   2. Usuário autoriza no Google -> Google redireciona pro nosso callback
//      com ?code=...&state=...
//   3. Callback troca o code por access_token + refresh_token e grava em
//      calendar_connections.
//   4. relationship-calendar-sync-cron.js usa o refresh_token pra pegar um
//      access_token válido a cada execução e listar eventos, normalizando
//      pro mesmo formato que parseICSEvents() já produz — assim o resto do
//      pipeline (eventsInWindow, matchContactToEvent,
//      suggestNewContactFromEvent) não muda nada.
//
// Não usa nenhuma lib externa (googleapis) — só fetch, pra não engordar o
// bundle de funções serverless. São 3 chamadas REST simples.

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || '';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export function googleCalendarConfigured() {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

export function buildGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',   // exige refresh_token
    prompt: 'consent',        // garante refresh_token mesmo se o usuário já autorizou antes
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function exchangeGoogleCode(code) {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`google token exchange falhou: ${data.error_description || data.error || res.status}`);
  return data; // { access_token, refresh_token, expires_in, ... }
}

export async function refreshGoogleAccessToken(refreshToken) {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`google token refresh falhou: ${data.error_description || data.error || res.status}`);
  return data; // { access_token, expires_in, ... } — refresh_token não vem de novo, mantém o que já temos
}

// Lista eventos do calendário primário entre sinceISO/untilISO e normaliza
// pro mesmo shape do parseICSEvents() em icsImport.js:
//   { uid, summary, startISO, attendeeNames, attendees: [{name,email}], organizer }
export async function listGoogleEvents(accessToken, sinceISO, untilISO) {
  const params = new URLSearchParams({
    timeMin: sinceISO,
    timeMax: untilISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const res = await fetch(`${EVENTS_ENDPOINT}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    const err = new Error('google access token expirado/inválido');
    err.code = 'GOOGLE_TOKEN_EXPIRED';
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`google events falhou: ${data.error?.message || res.status}`);

  return (data.items || []).map((ev) => {
    const attendees = (ev.attendees || [])
      .filter((a) => !a.self) // exclui o próprio dono do calendário
      .map((a) => ({ name: a.displayName || null, email: a.email ? a.email.toLowerCase() : null }));
    const attendeeNames = attendees.map((a) => a.name).filter(Boolean);
    const organizer = ev.organizer
      ? { name: ev.organizer.displayName || null, email: ev.organizer.email ? ev.organizer.email.toLowerCase() : null }
      : null;
    if (organizer?.name && !organizer.self && !attendeeNames.includes(organizer.name)) {
      attendeeNames.push(organizer.name);
    }
    const startISO = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
    return {
      uid: ev.id || null,
      summary: ev.summary || null,
      startISO: startISO ? new Date(startISO).toISOString() : null,
      attendeeNames,
      attendees,
      organizer,
    };
  });
}
