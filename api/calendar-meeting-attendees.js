// api/calendar-meeting-attendees.js
//
// GET, chamado pelo frontend com Authorization: Bearer <supabase access
// token>. Traz a MESMA análise que o cron de calendário já faz (convidado
// de reunião que não bate com nenhum contato cadastrado) — mas dentro do
// app, sem depender do WhatsApp nem do limite de 1 mensagem automática/dia.
//
// Não persiste nada, não envia notificação — é leitura pura, sob demanda,
// pra Insights → Agenda (src/components/AbaIA.jsx). Reaproveita 100% da
// lógica de match/candidatos já usada pelo cron
// (api/_lib/relationshipAssistant/icsImport.js), pra nunca haver 2 fontes
// de verdade sobre "o que conta como convidado elegível".
//
// Janela: últimos 14 dias (reuniões que já rolaram) + próximos 7 dias
// (pra já cadastrar antes do encontro). Mais ampla que a do cron (24h)
// porque aqui é sob demanda, não uma notificação diária.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { getUserIdFromAuthHeader } from './_lib/relationshipAssistant/oauthState.js';
import { listGoogleEvents, refreshGoogleAccessToken } from './_lib/relationshipAssistant/googleCalendar.js';
import { matchContactToEvent, suggestNewContactCandidatesFromEvent } from './_lib/relationshipAssistant/icsImport.js';

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 7;

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' });

    const uid = await getUserIdFromAuthHeader(req.headers['authorization']);
    if (!uid) return res.status(401).json({ ok: false, error: 'sessão inválida' });

    const [profileRows, connRows] = await Promise.all([
      sb(`profiles?id=eq.${uid}&select=id,first_name,name,is_pro`),
      sb(`calendar_connections?user_id=eq.${uid}&provider=eq.google&status=eq.active&select=access_token,refresh_token,token_expires_at`),
    ]);
    const profile = profileRows?.[0];
    if (!profile) return res.status(404).json({ ok: false, error: 'perfil não encontrado' });
    if (!profile.is_pro) return res.status(200).json({ ok: true, connected: false, isPro: false, candidates: [] });

    const conn = connRows?.[0];
    if (!conn) return res.status(200).json({ ok: true, connected: false, isPro: true, candidates: [] });

    let accessToken = conn.access_token;
    const expiraEm = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (!accessToken || expiraEm - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshGoogleAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const novaExpiracao = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      await sb(`calendar_connections?user_id=eq.${uid}&provider=eq.google`, {
        method: 'PATCH',
        body: JSON.stringify({ access_token: accessToken, token_expires_at: novaExpiracao, updated_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    const sinceISO = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const untilISO = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString();
    const [events, contacts] = await Promise.all([
      listGoogleEvents(accessToken, sinceISO, untilISO),
      sb(`contacts?user_id=eq.${uid}&select=id,name`),
    ]);

    const selfNameHints = [profile.first_name, profile.name].filter(Boolean);

    // Dedup por e-mail (ou nome normalizado, se não tiver e-mail) — a
    // mesma pessoa costuma aparecer em várias reuniões na janela.
    const byKey = new Map();
    for (const event of events || []) {
      if (matchContactToEvent(event, contacts || [])) continue; // já é contato — nada a perguntar
      const candidatos = suggestNewContactCandidatesFromEvent(event, { selfNameHints });
      for (const c of candidatos) {
        const key = (c.email || c.name || '').toLowerCase().trim();
        if (!key) continue;
        if (!byKey.has(key)) {
          byKey.set(key, { name: c.name, email: c.email || null, meetings: [] });
        }
        byKey.get(key).meetings.push({ summary: event.summary || null, startISO: event.startISO || null });
      }
    }

    const candidates = Array.from(byKey.values()).sort((a, b) => {
      const da = a.meetings[0]?.startISO || '';
      const db = b.meetings[0]?.startISO || '';
      return db.localeCompare(da); // mais recente primeiro
    });

    return res.status(200).json({ ok: true, connected: true, isPro: true, candidates });
  } catch (err) {
    console.error('[calendar-meeting-attendees] erro:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
