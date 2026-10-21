import { loadCaptureContacts, signedProposal } from './_lib/contactCapture.js';
import { suggestNewContactCandidatesFromEvent } from './_lib/relationshipAssistant/icsImport.js';

// api/relationship-calendar-sync-cron.js
// Job: sync-calendar-ics
//
// Captura Passiva via Calendário.
// Dois canais:
// 1. calendar_ics_url legado
// 2. Google Calendar via OAuth
//
// Além do processamento normal, registra:
// - última sincronização Google bem-sucedida
// - limpeza de last_error após sucesso
// - quantidade de eventos encontrados
// - resumo da execução no log

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import {
  calendarInteractionSuggestionMessage,
  calendarNewContactSuggestionMessage,
  preMeetingBriefingMessage
} from './_lib/relationshipAssistant/messages.js';

import {
  parseICSEvents,
  eventsInWindow,
  matchContactToEvent,
  suggestNewContactFromEvent
} from './_lib/relationshipAssistant/icsImport.js';

import {
  localDateISO,
  localDateISOFor
} from './_lib/relationshipAssistant/timeWindow.js';

import {
  listGoogleEvents,
  refreshGoogleAccessToken
} from './_lib/relationshipAssistant/googleCalendar.js';

import { buildContextCard } from '../shared/contextCard.js';

const LOOKAHEAD_HOURS = 36;

const CRON_SECRET = process.env.CRON_SECRET || '';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  'https://goopogicgwqqovmphqrj.supabase.co';

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;


// ─────────────────────────────────────────────────────────────
// PENDING ACTION
// ─────────────────────────────────────────────────────────────

async function setPendingAction(userId, intent, data) {

  await sb(
    `whatsapp_pending_actions?user_id=eq.${userId}`,
    {
      method: 'DELETE'
    }
  ).catch(() => {});

  await sb(
    'whatsapp_pending_actions',
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        intent,
        data: data || {}
      })
    }
  ).catch((e) =>
    console.error(
      '[relationship-calendar-sync-cron] falha ao gravar pending action:',
      e.message
    )
  );
}


// ─────────────────────────────────────────────────────────────
// ICS
// ─────────────────────────────────────────────────────────────

async function fetchICS(url) {

  try {

    const res = await fetch(
      url,
      {
        headers: {
          Accept: 'text/calendar'
        }
      }
    );

    if (!res.ok) return null;

    return await res.text();

  } catch (e) {

    console.error(
      '[relationship-calendar-sync-cron] falha ao buscar .ics:',
      e.message
    );

    return null;
  }
}


// ─────────────────────────────────────────────────────────────
// EVENTOS RECENTES
// ─────────────────────────────────────────────────────────────

async function processRecentEvents({
  profile,
  recentEvents,
  todayISO
}) {

  if (!recentEvents.length) {
    return {
      sent: false,
      hadEvents: false
    };
  }

  const contacts =
    await loadCaptureContacts(profile.id);


  for (const event of recentEvents) {

    const proposals =
      suggestNewContactCandidatesFromEvent(
        event,
        {
          selfNameHints: [
            profile.first_name,
            profile.name
          ].filter(Boolean)
        }
      )
        .map((c) =>
          signedProposal(
            profile.id,
            c,
            contacts,
            'Google Calendar'
          )
        )
        .filter((p) =>
          p.kind !== 'known'
        );


    // ─────────────────────────────────────────────
    // POSSÍVEL NOVO CONTATO
    // ─────────────────────────────────────────────

    if (proposals.length) {

      const item = proposals[0];
      const c = item.candidate;

      if (
        !c.name &&
        !item.matches.length
      ) {
        continue;
      }


      const options =
        item.matches
          .map(
            (m, i) =>
              `${i + 1}. ${m.name}${
                m.company
                  ? ' — ' + m.company
                  : ''
              }`
          )
          .join('\n');


      const text =
        `Encontrei na agenda: ${
          [
            c.name,
            c.contact_email
          ]
            .filter(Boolean)
            .join(' · ')
        }.\n` +

        (
          item.matches.length
            ? `Pode ser alguém da rede:\n${options}\nResponda ${
                item.matches.length === 1
                  ? 'MESMA'
                  : 'o número'
              } para completar apenas campos vazios.`
            : 'É relevante adicionar à sua rede? Responda SIM.'
        ) +

        (
          item.matches.length &&
          item.reason !== 'email_telefone'
            ? '\nSe é outra pessoa, responda NOVA.'
            : ''
        ) +

        '\nNÃO ignora. Não registrei uma interação.';


      const result =
        await sendProactiveNotification({
          profile,
          notificationType:
            'CALENDAR_NEW_CONTACT_SUGGESTION',
          scopeKey:
            `${event.uid || todayISO}:${item.key}`,
          text
        });


      if (result.sent) {

        await setPendingAction(
          profile.id,
          'capture_photo',
          {
            queue: [item]
          }
        );

        return {
          sent: true,
          hadEvents: true
        };
      }

      continue;
    }


    // ─────────────────────────────────────────────
    // CONTATO JÁ EXISTENTE
    // ─────────────────────────────────────────────

    const match =
      matchContactToEvent(
        event,
        contacts || []
      );


    if (match) {

      const jaRegistrada =
        await sb(
          `interactions?user_id=eq.${profile.id}` +
          `&contact_id=eq.${match.id}` +
          `&created_at=gte.${todayISO}T00:00:00` +
          `&select=id&limit=1`
        );


      if (jaRegistrada?.length) {
        continue;
      }


      const text =
        calendarInteractionSuggestionMessage({
          firstName:
            profile.first_name,

          contactName:
            match.name,

          eventSummary:
            event.summary
        });


      const result =
        await sendProactiveNotification({
          profile,

          notificationType:
            'CALENDAR_INTERACTION_SUGGESTION',

          scopeKey:
            event.uid ||
            `${match.id}:${todayISO}`,

          text
        });


      if (result.sent) {

        await setPendingAction(
          profile.id,
          'calendar_interaction_suggestion',
          {
            contact_id:
              match.id,

            contact_name:
              match.name,

            event_summary:
              event.summary || null
          }
        );


        return {
          sent: true,
          hadEvents: true
        };
      }

      continue;
    }
  }


  return {
    sent: false,
    hadEvents: true
  };
}


// ─────────────────────────────────────────────────────────────
// BRIEFING PRÉ-REUNIÃO
// ─────────────────────────────────────────────────────────────

async function processUpcomingEvents({
  profile,
  upcomingEvents
}) {

  if (!upcomingEvents.length) {

    return {
      sent: false,
      hadEvents: false
    };
  }


  const contacts =
    await sb(
      `contacts?user_id=eq.${profile.id}` +
      `&select=id,name,ideal_frequency_days,last_interaction_at,next_action,next_action_date,created_at`
    );


  for (const event of upcomingEvents) {

    const match =
      matchContactToEvent(
        event,
        contacts || []
      );


    if (!match) {
      continue;
    }


    const interactions =
      await sb(
        `interactions?user_id=eq.${profile.id}` +
        `&contact_id=eq.${match.id}` +
        `&select=contact_id,created_at,description`
      );


    const card =
      buildContextCard(
        match,
        interactions || [],
        new Date()
      );


    const eventDateLocal =
      localDateISOFor(
        new Date(event.startISO),
        profile.timezone
      );


    const todayLocal =
      localDateISO(
        profile.timezone
      );


    const tomorrowLocal =
      localDateISOFor(
        new Date(
          Date.now() +
          24 * 3600 * 1000
        ),
        profile.timezone
      );


    const eventWhen =
      eventDateLocal === todayLocal
        ? 'hoje'
        : eventDateLocal === tomorrowLocal
          ? 'amanhã'
          : null;


    const text =
      preMeetingBriefingMessage({

        firstName:
          profile.first_name,

        contactName:
          match.name,

        eventSummary:
          event.summary,

        eventWhen,

        card
      });


    const result =
      await sendProactiveNotification({

        profile,

        notificationType:
          'PRE_MEETING_BRIEFING',

        relationshipId:
          match.id,

        scopeKey:
          event.uid ||
          `${match.id}:${eventDateLocal}`,

        text
      });


    if (result.sent) {

      return {
        sent: true,
        hadEvents: true
      };
    }
  }


  return {
    sent: false,
    hadEvents: true
  };
}


// ─────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────

export default async function handler(
  req,
  res
) {

  try {

    // ─────────────────────────────────────────────
    // SEGURANÇA DO CRON
    // ─────────────────────────────────────────────

    if (CRON_SECRET) {

      const auth =
        req.headers['authorization'] || '';

      if (
        auth !==
        `Bearer ${CRON_SECRET}`
      ) {

        return res
          .status(401)
          .json({
            ok: false,
            error: 'unauthorized'
          });
      }
    }


    if (!SUPABASE_SERVICE_KEY) {

      return res
        .status(200)
        .json({
          ok: false,
          error:
            'SUPABASE_SERVICE_KEY ausente'
        });
    }


    const untilISO =
      new Date().toISOString();


    const sinceISO =
      new Date(
        Date.now() -
        24 * 3600 * 1000
      ).toISOString();


    const lookaheadUntilISO =
      new Date(
        Date.now() +
        LOOKAHEAD_HOURS *
        3600 *
        1000
      ).toISOString();


    let sugestoesEnviadas = 0;
    let semMatch = 0;
    let semEvento = 0;
    let comErro = 0;
    let avaliados = 0;
    let briefingsEnviados = 0;


    // ─────────────────────────────────────────────
    // CANAL 1 — ICS LEGADO
    // ─────────────────────────────────────────────

    const perfisIcs =
      await sb(

        `profiles?` +
        `select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro,calendar_ics_url` +
        `&onboarding_completed=eq.true` +
        `&whatsapp=not.is.null` +
        `&is_pro=eq.true` +
        `&calendar_ics_url=not.is.null`

      );


    for (
      const profile
      of perfisIcs || []
    ) {

      avaliados++;


      try {

        const icsText =
          await fetchICS(
            profile.calendar_ics_url
          );


        if (!icsText) {

          comErro++;

          continue;
        }


        const allEvents =
          parseICSEvents(
            icsText
          );


        const recentEvents =
          eventsInWindow(
            allEvents,
            sinceISO,
            untilISO
          );


        const upcomingEvents =
          eventsInWindow(
            allEvents,
            new Date().toISOString(),
            lookaheadUntilISO
          );


        const todayISO =
          localDateISO(
            profile.timezone
          );


        const result =
          await processRecentEvents({
            profile,
            recentEvents,
            todayISO
          });


        if (!result.hadEvents) {
          semEvento++;
        }


        if (result.sent) {

          sugestoesEnviadas++;

        } else if (
          result.hadEvents
        ) {

          semMatch++;
        }


        const briefingResult =
          await processUpcomingEvents({
            profile,
            upcomingEvents
          });


        if (
          briefingResult.sent
        ) {

          briefingsEnviados++;
        }


      } catch (err) {

        console.error(
          '[relationship-calendar-sync-cron] erro no usuário (.ics)',
          profile.id,
          err
        );

        comErro++;
      }
    }


    // ─────────────────────────────────────────────
    // CANAL 2 — GOOGLE CALENDAR
    // ─────────────────────────────────────────────

    const rawGoogle =
      await sb(

        `calendar_connections?` +
        `select=user_id,access_token,refresh_token,token_expires_at,status` +
        `&provider=eq.google` +
        `&status=eq.active`

      );


    const googleRows = [];


    for (
      const row
      of rawGoogle || []
    ) {

      const profs =
        await sb(

          `profiles?` +
          `id=eq.${row.user_id}` +
          `&select=id,first_name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro` +
          `&onboarding_completed=eq.true` +
          `&whatsapp=not.is.null` +
          `&is_pro=eq.true`

        );


      if (profs?.[0]) {

        googleRows.push({
          ...row,
          profile:
            profs[0]
        });
      }
    }


    for (
      const conn
      of googleRows
    ) {

      const profile =
        conn.profile;


      avaliados++;


      try {

        let accessToken =
          conn.access_token;


        const expiraEm =
          conn.token_expires_at
            ? new Date(
                conn.token_expires_at
              ).getTime()
            : 0;


        // Renova token automaticamente
        // com 5 minutos de folga.

        if (
          !accessToken ||
          expiraEm -
          Date.now() <
          5 * 60 * 1000
        ) {

          const refreshed =
            await refreshGoogleAccessToken(
              conn.refresh_token
            );


          accessToken =
            refreshed.access_token;


          const novaExpiracao =
            new Date(
              Date.now() +
              (
                refreshed.expires_in ||
                3600
              ) *
              1000
            ).toISOString();


          await sb(

            `calendar_connections?` +
            `user_id=eq.${conn.user_id}` +
            `&provider=eq.google`,

            {
              method: 'PATCH',

              body:
                JSON.stringify({

                  access_token:
                    accessToken,

                  token_expires_at:
                    novaExpiracao,

                  updated_at:
                    new Date()
                      .toISOString()

                })
            }
          );
        }


        // ─────────────────────────────────────────
        // LEITURA REAL DO GOOGLE CALENDAR
        // ─────────────────────────────────────────

        const recentEvents =
          await listGoogleEvents(
            accessToken,
            sinceISO,
            untilISO
          );


        const upcomingEvents =
          await listGoogleEvents(
            accessToken,
            new Date().toISOString(),
            lookaheadUntilISO
          );


        // IMPORTANTE:
        // só marca como sincronizado depois que
        // as duas consultas ao Google tiveram sucesso.

        const syncTimestamp =
          new Date().toISOString();


        await sb(

          `calendar_connections?` +
          `user_id=eq.${conn.user_id}` +
          `&provider=eq.google`,

          {
            method: 'PATCH',

            body:
              JSON.stringify({

                last_synced_at:
                  syncTimestamp,

                last_error:
                  null,

                updated_at:
                  syncTimestamp

              })
          }
        );


        console.info(
          '[CONEXIA CALENDAR] Google sync OK',
          {
            userId:
              conn.user_id,

            recentEvents:
              recentEvents.length,

            upcomingEvents:
              upcomingEvents.length,

            syncedAt:
              syncTimestamp
          }
        );


        const todayISO =
          localDateISO(
            profile.timezone
          );


        const result =
          await processRecentEvents({
            profile,
            recentEvents,
            todayISO
          });


        if (
          !result.hadEvents
        ) {

          semEvento++;
        }


        if (result.sent) {

          sugestoesEnviadas++;

        } else if (
          result.hadEvents
        ) {

          semMatch++;
        }


        const briefingResult =
          await processUpcomingEvents({
            profile,
            upcomingEvents
          });


        if (
          briefingResult.sent
        ) {

          briefingsEnviados++;
        }


      } catch (err) {

        console.error(
          '[relationship-calendar-sync-cron] erro no usuário (google)',
          conn.user_id,
          err.message
        );


        comErro++;


        // Mantém o erro registrado para diagnóstico.
        // Se o refresh token foi revogado/inválido,
        // a conexão passa para status error.

        const invalidToken =
          err.code ===
            'GOOGLE_TOKEN_EXPIRED' ||
          /invalid_grant/i.test(
            err.message || ''
          );


        await sb(

          `calendar_connections?` +
          `user_id=eq.${conn.user_id}` +
          `&provider=eq.google`,

          {
            method: 'PATCH',

            body:
              JSON.stringify({

                ...(invalidToken
                  ? {
                      status:
                        'error'
                    }
                  : {}),

                last_error:
                  err.message ||
                  'Erro desconhecido na sincronização',

                updated_at:
                  new Date()
                    .toISOString()

              })
          }

        ).catch(() => {});
      }
    }


    // ─────────────────────────────────────────────
    // RESULTADO / MONITORAMENTO
    // ─────────────────────────────────────────────

    const resultado = {

      ok: true,

      avaliados,

      sugestoesEnviadas,

      briefingsEnviados,

      semMatch,

      semEvento,

      comErro

    };


    console.info(
      '[CONEXIA CALENDAR] Resultado da execução',
      resultado
    );


    return res
      .status(200)
      .json(
        resultado
      );


  } catch (err) {

    console.error(
      '[relationship-calendar-sync-cron] erro:',
      err
    );


    return res
      .status(200)
      .json({
        ok: false,
        error:
          err.message
      });
  }
}
