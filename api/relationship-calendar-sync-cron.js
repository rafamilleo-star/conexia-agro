// api/relationship-calendar-sync-cron.js
// Job: sync-calendar-ics
//
// Captura Passiva via Calendário (Bloco 2 + extensão de contato novo). Roda
// 1x/dia. Dois canais possíveis por usuário PRO:
//
//   1. Legado: `calendar_ics_url` cadastrado (link secreto .ics, sem OAuth)
//      — mantido pra quem já configurou, sem forçar remigração.
//   2. Novo: linha ativa em `calendar_connections` (provider='google',
//      status='active') — conectado via OAuth (api/calendar-oauth/*),
//      sem copiar/colar nada.
//
// As duas fontes produzem eventos no MESMO formato (uid, summary, startISO,
// attendeeNames, attendees, organizer — ver icsImport.js e
// googleCalendar.js), então o resto do pipeline é idêntico:
//
//   - se o convidado casa com um contato existente -> pergunta se registra
//     a interação (CALENDAR_INTERACTION_SUGGESTION);
//   - se não casa com ninguém, mas o evento parece uma reunião real
//     (poucos convidados, nome completo, e-mail não-automático) -> pergunta
//     se cadastra a pessoa E já registra a conversa, numa única pergunta
//     (CALENDAR_NEW_CONTACT_SUGGESTION) — sem criar tela de cadastro nova.
//
// As duas respostas (sim/não) são tratadas em whatsapp-webhook.js via
// whatsapp_pending_actions (mesmo mecanismo já usado por
// register_contact_missing_name).
//
// Feature PRO — mesmo gate de is_pro=true já usado em
// relationship-attention-cron.js.

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { calendarInteractionSuggestionMessage, calendarNewContactSuggestionMessage } from './_lib/relationshipAssistant/messages.js';
import { parseICSEvents, eventsInWindow, matchContactToEvent, suggestNewContactFromEvent } from './_lib/relationshipAssistant/icsImport.js';
import { localDateISO } from './_lib/relationshipAssistant/timeWindow.js';
import { listGoogleEvents, refreshGoogleAccessToken } from './_lib/relationshipAssistant/googleCalendar.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Mesmo padrão de whatsapp_pending_actions já usado em whatsapp-webhook.js —
// duplicado aqui (função pequena) em vez de importado, seguindo o mesmo
// padrão de sb() local já repetido em notificationLog.js/outros crons.
async function setPendingAction(userId, intent, data) {
  await sb(`whatsapp_pending_actions?user_id=eq.${userId}`, { method: 'DELETE' }).catch(() => {});
  await sb('whatsapp_pending_actions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, intent, data: data || {} }),
  }).catch((e) => console.error('[relationship-calendar-sync-cron] falha ao gravar pending action:', e.message));
}

async function fetchICS(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'text/calendar' } });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error('[relationship-calendar-sync-cron] falha ao buscar .ics:', e.message);
    return null;
  }
}

// Processa a lista de eventos recentes de UM usuário (já filtrados pra
// janela de 24h) e manda no máximo 1 sugestão — compartilhado pelos dois
// canais (.ics legado e Google OAuth).
async function processRecentEvents({ profile, recentEvents, todayISO }) {
  if (!recentEvents.length) return { sent: false, hadEvents: false };

  const contacts = await sb(`contacts?user_id=eq.${profile.id}&select=id,name`);

  for (const event of recentEvents) {
    const match = matchContactToEvent(event, contacts || []);

    if (match) {
      // Já existe interação registrada com esse contato hoje? Não sugere de
      // novo — evita pergunta redundante se o usuário já registrou
      // manualmente ou por outra via.
      const jaRegistrada = await sb(
        `interactions?user_id=eq.${profile.id}&contact_id=eq.${match.id}&created_at=gte.${todayISO}T00:00:00&select=id&limit=1`
      );
      if (jaRegistrada?.length) continue;

      const text = calendarInteractionSuggestionMessage({
        firstName: profile.first_name,
        contactName: match.name,
        eventSummary: event.summary,
      });
      const result = await sendProactiveNotification({
        profile,
        notificationType: 'CALENDAR_INTERACTION_SUGGESTION',
        scopeKey: event.uid || `${match.id}:${todayISO}`,
        text,
      });
      if (result.sent) {
        await setPendingAction(profile.id, 'calendar_interaction_suggestion', {
          contact_id: match.id,
          contact_name: match.name,
          event_summary: event.summary || null,
        });
        return { sent: true, hadEvents: true };
      }
      continue;
    }

    // Sem match — tenta sugerir CONTATO NOVO (convidado real, reunião
    // pequena, e-mail não-automático; nunca o próprio dono do calendário).
    const candidato = suggestNewContactFromEvent(event, {
      selfNameHints: [profile.first_name].filter(Boolean),
    });
    if (!candidato) continue;

    const text = calendarNewContactSuggestionMessage({
      firstName: profile.first_name,
      contactName: candidato.name,
      eventSummary: event.summary,
    });
    const result = await sendProactiveNotification({
      profile,
      notificationType: 'CALENDAR_NEW_CONTACT_SUGGESTION',
      scopeKey: event.uid || `${candidato.email || candidato.name}:${todayISO}`,
      text,
    });
    if (result.sent) {
      await setPendingAction(profile.id, 'calendar_new_contact_suggestion', {
        contact_name: candidato.name,
        contact_email: candidato.email || null,
        event_summary: event.summary || null,
      });
      return { sent: true, hadEvents: true };
    }
  }

  return { sent: false, hadEvents: true };
}

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const untilISO = new Date().toISOString();
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    let sugestoesEnviadas = 0, semMatch = 0, semEvento = 0, comErro = 0, avaliados = 0;

    // ── Canal 1: legado .ics ────────────────────────────────────────────
    const perfisIcs = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro,calendar_ics_url&onboarding_completed=eq.true&whatsapp=not.is.null&is_pro=eq.true&calendar_ics_url=not.is.null`
    );

    for (const profile of perfisIcs || []) {
      avaliados++;
      try {
        const icsText = await fetchICS(profile.calendar_ics_url);
        if (!icsText) { comErro++; continue; }

        const allEvents = parseICSEvents(icsText);
        const recentEvents = eventsInWindow(allEvents, sinceISO, untilISO);
        const todayISO = localDateISO(profile.timezone);

        const result = await processRecentEvents({ profile, recentEvents, todayISO });
        if (!result.hadEvents) { semEvento++; continue; }
        if (result.sent) sugestoesEnviadas++; else semMatch++;
      } catch (err) {
        console.error('[relationship-calendar-sync-cron] erro no usuário (.ics)', profile.id, err);
        comErro++;
      }
    }

    // ── Canal 2: Google Calendar via OAuth ──────────────────────────────
    const rawGoogle = await sb(`calendar_connections?select=user_id,access_token,refresh_token,token_expires_at,status&provider=eq.google&status=eq.active`);
    const googleRows = [];
    for (const row of rawGoogle || []) {
      const profs = await sb(`profiles?id=eq.${row.user_id}&select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro&onboarding_completed=eq.true&whatsapp=not.is.null&is_pro=eq.true`);
      if (profs?.[0]) googleRows.push({ ...row, profile: profs[0] });
    }

    for (const conn of googleRows) {
      const profile = conn.profile;
      avaliados++;

      try {
        let accessToken = conn.access_token;
        const expiraEm = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
        // Renova com 5 min de folga.
        if (!accessToken || expiraEm - Date.now() < 5 * 60 * 1000) {
          const refreshed = await refreshGoogleAccessToken(conn.refresh_token);
          accessToken = refreshed.access_token;
          const novaExpiracao = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
          await sb(`calendar_connections?user_id=eq.${conn.user_id}&provider=eq.google`, {
            method: 'PATCH',
            body: JSON.stringify({ access_token: accessToken, token_expires_at: novaExpiracao, updated_at: new Date().toISOString() }),
          });
        }

        const recentEvents = await listGoogleEvents(accessToken, sinceISO, untilISO);
        const todayISO = localDateISO(profile.timezone);

        const result = await processRecentEvents({ profile, recentEvents, todayISO });
        if (!result.hadEvents) { semEvento++; continue; }
        if (result.sent) sugestoesEnviadas++; else semMatch++;
      } catch (err) {
        console.error('[relationship-calendar-sync-cron] erro no usuário (google)', conn.user_id, err.message);
        comErro++;
        // Token revogado pelo usuário direto no Google, ou refresh_token
        // inválido — marca a conexão como erro em vez de tentar de novo
        // amanhã e falhar de novo silenciosamente.
        if (err.code === 'GOOGLE_TOKEN_EXPIRED' || /invalid_grant/i.test(err.message || '')) {
          await sb(`calendar_connections?user_id=eq.${conn.user_id}&provider=eq.google`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'error', last_error: err.message, updated_at: new Date().toISOString() }),
          }).catch(() => {});
        }
      }
    }

    return res.status(200).json({ ok: true, avaliados, sugestoesEnviadas, semMatch, semEvento, comErro });
  } catch (err) {
    console.error('[relationship-calendar-sync-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
