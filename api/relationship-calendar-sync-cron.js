import {
  loadCaptureContacts,
  signedProposal
} from './_lib/contactCapture.js';

import {
  suggestNewContactCandidatesFromEvent,
  matchContactToEvent,
  parseICSEvents,
  eventsInWindow
} from './_lib/relationshipAssistant/icsImport.js';

import {
  supabaseRest as sb
} from './_lib/relationshipAssistant/notificationLog.js';

import {
  sendProactiveNotification
} from './_lib/relationshipAssistant/sendProactiveNotification.js';

import {
  calendarInteractionSuggestionMessage,
  preMeetingBriefingMessage
} from './_lib/relationshipAssistant/messages.js';

import {
  localDateISO,
  localDateISOFor
} from './_lib/relationshipAssistant/timeWindow.js';

import {
  listGoogleEvents,
  refreshGoogleAccessToken
} from './_lib/relationshipAssistant/googleCalendar.js';

import {
  buildContextCard
} from '../shared/contextCard.js';


const LOOKAHEAD_HOURS = 36;

const CRON_SECRET =
  process.env.CRON_SECRET || '';

const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY;


// ============================================================
// PENDING ACTION
// ============================================================

async function setPendingAction(
  userId,
  intent,
  data
) {

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
  ).catch(error => {

    console.error(
      '[CONEXIA CALENDAR] pending action error',
      error.message
    );

  });
}


// ============================================================
// ICS
// ============================================================

async function fetchICS(url) {

  try {

    const response =
      await fetch(
        url,
        {
          headers: {
            Accept: 'text/calendar'
          }
        }
      );


    if (!response.ok) {
      return null;
    }


    return await response.text();

  } catch (error) {

    console.error(
      '[CONEXIA CALENDAR] ICS fetch error',
      error.message
    );


    return null;
  }
}


// ============================================================
// EVENT DIAGNOSTIC
// ============================================================

function eventDiagnostic(event) {

  return {

    uid:
      event?.uid || null,

    summary:
      event?.summary || null,

    startISO:
      event?.startISO || null,

    attendeeNames:
      event?.attendeeNames || [],

    attendees:
      (event?.attendees || [])
        .map(attendee => ({
          name:
            attendee?.name || null,

          email:
            attendee?.email || null
        })),

    organizer:
      event?.organizer
        ? {
            name:
              event.organizer.name || null,

            email:
              event.organizer.email || null,

            self:
              !!event.organizer.self
          }
        : null

  };
}


// ============================================================
// RECENT EVENTS
// ============================================================

async function processRecentEvents({
  profile,
  recentEvents,
  todayISO
}) {

  if (!recentEvents.length) {

    return {
      sent: false,
      hadEvents: false,
      matched: false,
      reason: 'no_events'
    };
  }


  const contacts =
    await loadCaptureContacts(
      profile.id
    );


  console.info(
    '[CONEXIA CALENDAR] recent contacts loaded',
    {
      userId:
        profile.id,

      contacts:
        contacts?.length || 0
    }
  );


  for (const event of recentEvents) {

    console.info(
      '[CONEXIA CALENDAR] recent event',
      eventDiagnostic(event)
    );


    // ========================================================
    // PRIMEIRO: VERIFICA SE JÁ EXISTE NA REDE
    //
    // IMPORTANTE:
    // antes o sistema tentava sugerir "novo contato"
    // antes de fazer o match.
    //
    // Agora a prioridade correta é:
    //
    // EXISTENTE -> interação
    // NÃO EXISTENTE -> sugestão de cadastro
    // ========================================================

    const match =
      matchContactToEvent(
        event,
        contacts || []
      );


    if (match) {

      console.info(
        '[CONEXIA CALENDAR] MATCH EXISTENTE',
        {
          event:
            event.summary || null,

          contactId:
            match.id,

          contactName:
            match.name
        }
      );


      const jaRegistrada =
        await sb(

          `interactions?` +
          `user_id=eq.${profile.id}` +
          `&contact_id=eq.${match.id}` +
          `&created_at=gte.${todayISO}T00:00:00` +
          `&select=id` +
          `&limit=1`

        );


      if (jaRegistrada?.length) {

        console.info(
          '[CONEXIA CALENDAR] match encontrado mas interação já registrada',
          {
            contact:
              match.name
          }
        );


        return {
          sent: false,
          hadEvents: true,
          matched: true,
          reason:
            'interaction_already_registered'
        };
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


      console.info(
        '[CONEXIA CALENDAR] interaction notification result',
        {
          contact:
            match.name,

          sent:
            !!result?.sent,

          result
        }
      );


      if (result?.sent) {

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
          hadEvents: true,
          matched: true,
          reason:
            'interaction_suggestion_sent'
        };
      }


      // MUITO IMPORTANTE:
      // encontrou o contato, mas a notificação
      // não foi enviada.
      //
      // Isso NÃO é semMatch.

      return {
        sent: false,
        hadEvents: true,
        matched: true,
        reason:
          'notification_not_sent'
      };
    }


    // ========================================================
    // NÃO ENCONTROU CONTATO EXISTENTE
    // AGORA SIM PROCURA CANDIDATO NOVO
    // ========================================================

    const candidates =
      suggestNewContactCandidatesFromEvent(

        event,

        {
          selfNameHints: [
            profile.first_name,
            profile.name
          ].filter(Boolean)
        }

      );


    const proposals =
      candidates

        .map(candidate =>
          signedProposal(
            profile.id,
            candidate,
            contacts,
            'Google Calendar'
          )
        )

        .filter(proposal =>
          proposal.kind !== 'known'
        );


    if (proposals.length) {

      const item =
        proposals[0];

      const candidate =
        item.candidate;


      console.info(
        '[CONEXIA CALENDAR] candidato novo',
        {
          event:
            event.summary || null,

          candidate:
            candidate,

          possibleMatches:
            item.matches?.map(
              match => ({
                id:
                  match.id,

                name:
                  match.name
              })
            ) || []
        }
      );


      if (
        !candidate?.name &&
        !item.matches?.length
      ) {

        continue;
      }


      const options =
        (item.matches || [])

          .map(
            (match, index) =>
              `${index + 1}. ${match.name}${
                match.company
                  ? ` — ${match.company}`
                  : ''
              }`
          )

          .join('\n');


      const identification =
        [
          candidate?.name,
          candidate?.contact_email ||
          candidate?.email
        ]
          .filter(Boolean)
          .join(' · ');


      const text =
        `Encontrei na agenda: ${identification}.\n` +

        (
          item.matches?.length

            ? `Pode ser alguém da sua rede:\n${options}\n` +
              `Responda ${
                item.matches.length === 1
                  ? 'MESMA'
                  : 'o número'
              } para confirmar.`

            : 'Essa pessoa é relevante para sua rede? Responda SIM para adicionar.'
        ) +

        (
          item.matches?.length &&
          item.reason !== 'email_telefone'

            ? '\nSe for outra pessoa, responda NOVA.'

            : ''
        ) +

        '\nNÃO ignora. Nenhuma interação foi registrada automaticamente.';


      const result =
        await sendProactiveNotification({

          profile,

          notificationType:
            'CALENDAR_NEW_CONTACT_SUGGESTION',

          scopeKey:
            `${event.uid || todayISO}:${item.key}`,

          text
        });


      console.info(
        '[CONEXIA CALENDAR] new contact notification result',
        {
          sent:
            !!result?.sent,

          result
        }
      );


      if (result?.sent) {

        await setPendingAction(

          profile.id,

          'capture_photo',

          {
            queue: [item]
          }

        );


        return {
          sent: true,
          hadEvents: true,
          matched: false,
          newContactCandidate: true,
          reason:
            'new_contact_suggestion_sent'
        };
      }


      return {
        sent: false,
        hadEvents: true,
        matched: false,
        newContactCandidate: true,
        reason:
          'new_contact_notification_not_sent'
      };
    }


    console.info(
      '[CONEXIA CALENDAR] evento sem match',
      eventDiagnostic(event)
    );
  }


  return {
    sent: false,
    hadEvents: true,
    matched: false,
    reason:
      'no_match'
  };
}


// ============================================================
// UPCOMING EVENTS / PRE-MEETING BRIEFING
// ============================================================

async function processUpcomingEvents({
  profile,
  upcomingEvents
}) {

  if (!upcomingEvents.length) {

    return {
      sent: false,
      hadEvents: false,
      matched: false,
      reason:
        'no_upcoming_events'
    };
  }


  // ==========================================================
  // CORREÇÃO:
  //
  // Usa loadCaptureContacts aqui também.
  //
  // Assim o briefing recebe exatamente o mesmo shape
  // de contato do fluxo recente, incluindo dados utilizados
  // pelo matcher (email / telefone / nome etc.).
  //
  // Antes essa função fazia uma query reduzida que não
  // carregava email.
  // ==========================================================

  const contacts =
    await loadCaptureContacts(
      profile.id
    );


  console.info(
    '[CONEXIA CALENDAR] upcoming contacts loaded',
    {
      userId:
        profile.id,

      contacts:
        contacts?.length || 0
    }
  );


  for (const event of upcomingEvents) {

    console.info(
      '[CONEXIA CALENDAR] upcoming event',
      eventDiagnostic(event)
    );


    const match =
      matchContactToEvent(
        event,
        contacts || []
      );


    if (!match) {

      console.info(
        '[CONEXIA CALENDAR] upcoming sem match',
        {
          event:
            event.summary || null
        }
      );

      continue;
    }


    console.info(
      '[CONEXIA CALENDAR] PRE-MEETING MATCH',
      {
        event:
          event.summary || null,

        contactId:
          match.id,

        contactName:
          match.name
      }
    );


    const interactions =
      await sb(

        `interactions?` +
        `user_id=eq.${profile.id}` +
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
        new Date(
          event.startISO
        ),
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


    console.info(
      '[CONEXIA CALENDAR] briefing notification result',
      {
        contact:
          match.name,

        sent:
          !!result?.sent,

        result
      }
    );


    if (result?.sent) {

      return {
        sent: true,
        hadEvents: true,
        matched: true,
        reason:
          'briefing_sent'
      };
    }


    return {
      sent: false,
      hadEvents: true,
      matched: true,
      reason:
        'briefing_notification_not_sent'
    };
  }


  return {
    sent: false,
    hadEvents: true,
    matched: false,
    reason:
      'upcoming_no_match'
  };
}


// ============================================================
// HANDLER
// ============================================================

export default async function handler(
  req,
  res
) {

  try {

    // ========================================================
    // SECURITY
    // ========================================================

    if (CRON_SECRET) {

      const auth =
        req.headers.authorization || '';


      if (
        auth !==
        `Bearer ${CRON_SECRET}`
      ) {

        return res
          .status(401)
          .json({
            ok: false,
            error:
              'unauthorized'
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


    // ========================================================
    // WINDOWS
    // ========================================================

    const now =
      new Date();


    const untilISO =
      now.toISOString();


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


    // ========================================================
    // COUNTERS
    // ========================================================

    let avaliados = 0;

    let sugestoesEnviadas = 0;

    let briefingsEnviados = 0;

    let semEvento = 0;

    let semMatch = 0;

    let matchesEncontrados = 0;

    let notificacoesBloqueadas = 0;

    let novosContatosDetectados = 0;

    let comErro = 0;


    // ========================================================
    // CHANNEL 1 — LEGACY ICS
    // ========================================================

    const perfisIcs =
      await sb(

        `profiles?` +
        `select=id,first_name,name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro,calendar_ics_url` +
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
            untilISO,
            lookaheadUntilISO
          );


        const todayISO =
          localDateISO(
            profile.timezone
          );


        const recentResult =
          await processRecentEvents({
            profile,
            recentEvents,
            todayISO
          });


        if (!recentResult.hadEvents) {

          semEvento++;

        } else {

          if (recentResult.matched) {

            matchesEncontrados++;

          } else if (
            recentResult.reason ===
            'no_match'
          ) {

            semMatch++;
          }


          if (
            recentResult.newContactCandidate
          ) {

            novosContatosDetectados++;
          }


          if (
            recentResult.reason ===
              'notification_not_sent' ||
            recentResult.reason ===
              'new_contact_notification_not_sent'
          ) {

            notificacoesBloqueadas++;
          }
        }


        if (recentResult.sent) {

          sugestoesEnviadas++;
        }


        const briefingResult =
          await processUpcomingEvents({
            profile,
            upcomingEvents
          });


        if (briefingResult.matched) {

          matchesEncontrados++;
        }


        if (
          briefingResult.reason ===
          'briefing_notification_not_sent'
        ) {

          notificacoesBloqueadas++;
        }


        if (briefingResult.sent) {

          briefingsEnviados++;
        }


      } catch (error) {

        console.error(
          '[CONEXIA CALENDAR] ICS user error',
          profile.id,
          error
        );


        comErro++;
      }
    }


    // ========================================================
    // CHANNEL 2 — GOOGLE CALENDAR
    // ========================================================

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

      const profiles =
        await sb(

          `profiles?` +
          `id=eq.${row.user_id}` +
          `&select=id,first_name,name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,is_pro` +
          `&onboarding_completed=eq.true` +
          `&whatsapp=not.is.null` +
          `&is_pro=eq.true`

        );


      if (profiles?.[0]) {

        googleRows.push({
          ...row,
          profile:
            profiles[0]
        });
      }
    }


    for (
      const connection
      of googleRows
    ) {

      const profile =
        connection.profile;


      avaliados++;


      try {

        let accessToken =
          connection.access_token;


        const expiresAt =
          connection.token_expires_at
            ? new Date(
                connection.token_expires_at
              ).getTime()
            : 0;


        // ====================================================
        // REFRESH TOKEN
        // ====================================================

        if (
          !accessToken ||
          expiresAt -
          Date.now() <
          5 * 60 * 1000
        ) {

          const refreshed =
            await refreshGoogleAccessToken(
              connection.refresh_token
            );


          accessToken =
            refreshed.access_token;


          const newExpiration =
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
            `user_id=eq.${connection.user_id}` +
            `&provider=eq.google`,

            {
              method:
                'PATCH',

              body:
                JSON.stringify({

                  access_token:
                    accessToken,

                  token_expires_at:
                    newExpiration,

                  updated_at:
                    new Date()
                      .toISOString()

                })
            }

          );
        }


        // ====================================================
        // GOOGLE EVENTS
        // ====================================================

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


        console.info(
          '[CONEXIA CALENDAR] GOOGLE EVENTS',
          {
            userId:
              connection.user_id,

            recentCount:
              recentEvents.length,

            upcomingCount:
              upcomingEvents.length,

            recent:
              recentEvents.map(
                eventDiagnostic
              ),

            upcoming:
              upcomingEvents.map(
                eventDiagnostic
              )
          }
        );


        // ====================================================
        // SYNC STATUS
        // ====================================================

        const syncTimestamp =
          new Date().toISOString();


        await sb(

          `calendar_connections?` +
          `user_id=eq.${connection.user_id}` +
          `&provider=eq.google`,

          {
            method:
              'PATCH',

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


        // ====================================================
        // RECENT
        // ====================================================

        const todayISO =
          localDateISO(
            profile.timezone
          );


        const recentResult =
          await processRecentEvents({
            profile,
            recentEvents,
            todayISO
          });


        if (!recentResult.hadEvents) {

          semEvento++;

        } else {

          if (recentResult.matched) {

            matchesEncontrados++;

          } else if (
            recentResult.reason ===
            'no_match'
          ) {

            semMatch++;
          }


          if (
            recentResult.newContactCandidate
          ) {

            novosContatosDetectados++;
          }


          if (
            recentResult.reason ===
              'notification_not_sent' ||
            recentResult.reason ===
              'new_contact_notification_not_sent'
          ) {

            notificacoesBloqueadas++;
          }
        }


        if (recentResult.sent) {

          sugestoesEnviadas++;
        }


        // ====================================================
        // UPCOMING
        // ====================================================

        const briefingResult =
          await processUpcomingEvents({
            profile,
            upcomingEvents
          });


        if (briefingResult.matched) {

          matchesEncontrados++;
        }


        if (
          briefingResult.reason ===
          'briefing_notification_not_sent'
        ) {

          notificacoesBloqueadas++;
        }


        if (briefingResult.sent) {

          briefingsEnviados++;
        }


      } catch (error) {

        console.error(
          '[CONEXIA CALENDAR] GOOGLE ERROR',
          connection.user_id,
          error
        );


        comErro++;


        const invalidToken =

          error.code ===
            'GOOGLE_TOKEN_EXPIRED' ||

          /invalid_grant/i.test(
            error.message || ''
          );


        await sb(

          `calendar_connections?` +
          `user_id=eq.${connection.user_id}` +
          `&provider=eq.google`,

          {
            method:
              'PATCH',

            body:
              JSON.stringify({

                ...(invalidToken
                  ? {
                      status:
                        'error'
                    }
                  : {}),

                last_error:
                  error.message ||
                  'Erro desconhecido na sincronização',

                updated_at:
                  new Date()
                    .toISOString()

              })
          }

        ).catch(() => {});
      }
    }


    // ========================================================
    // FINAL RESULT
    // ========================================================

    const result = {

      ok: true,

      avaliados,

      sugestoesEnviadas,

      briefingsEnviados,

      matchesEncontrados,

      novosContatosDetectados,

      notificacoesBloqueadas,

      semMatch,

      semEvento,

      comErro

    };


    console.info(
      '[CONEXIA CALENDAR] FINAL',
      result
    );


    return res
      .status(200)
      .json(result);


  } catch (error) {

    console.error(
      '[CONEXIA CALENDAR] FATAL',
      error
    );


    return res
      .status(200)
      .json({
        ok: false,
        error:
          error.message
      });
  }
}
