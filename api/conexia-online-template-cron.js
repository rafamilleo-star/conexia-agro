// api/conexia-online-template-cron.js
//
// CONÉXIA — disparo automático do template conexia_online
//
// IMPORTANTE:
// Este endpoint envia o template diretamente pela Graph API,
// no mesmo formato validado no Graph API Explorer.
//
// Regras:
// - máximo 5 tentativas por execução
// - não repete para quem já recebeu
// - respeita notification_log
// - respeita quiet hours
// - respeita limite diário
// - usa o template aprovado conexia_online
// - não altera o fluxo normal de respostas do WhatsApp

import {
  supabaseRest as sb,
  buildIdempotencyKey,
  alreadySent,
  dailyLimitReached,
  logScheduled,
  markSent,
  markFailed,
} from './_lib/relationshipAssistant/notificationLog.js';

import {
  isQuietHours,
  localDateISO,
} from './_lib/relationshipAssistant/timeWindow.js';


// =========================================================
// CONFIGURAÇÃO
// =========================================================

const META_WHATSAPP_TOKEN =
  process.env.META_WHATSAPP_TOKEN;

const META_PHONE_NUMBER_ID =
  process.env.META_PHONE_NUMBER_ID ||
  '1367865376400864';

const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION ||
  'v26.0';

const TEMPLATE_NAME =
  process.env.CONEXIA_ONLINE_TEMPLATE_NAME ||
  'conexia_online';

const TEMPLATE_LANGUAGE =
  process.env.CONEXIA_ONLINE_TEMPLATE_LANGUAGE ||
  'pt_BR';

const CRON_SECRET =
  process.env.CRON_SECRET ||
  '';

const BATCH_SIZE =
  Math.max(
    1,
    Math.min(
      5,
      Number(
        process.env.CONEXIA_ONLINE_TEMPLATE_BATCH_SIZE ||
        5
      )
    )
  );


// =========================================================
// NÚMERO
// =========================================================

function normalizePhone(value) {

  return String(value || '')
    .replace(/\D/g, '');
}


// =========================================================
// ENVIO DIRETO META
//
// Mesmo conceito da chamada validada no Graph API Explorer.
// =========================================================

async function sendTemplateDirect(
  number
) {

  if (!META_WHATSAPP_TOKEN) {

    return {
      ok: false,
      error:
        'META_WHATSAPP_TOKEN ausente',
    };
  }


  if (!META_PHONE_NUMBER_ID) {

    return {
      ok: false,
      error:
        'META_PHONE_NUMBER_ID ausente',
    };
  }


  const to =
    normalizePhone(
      number
    );


  if (!to) {

    return {
      ok: false,
      error:
        'Número inválido',
    };
  }


  // -------------------------------------------------------
  // PARÂMETROS NO FORMATO GRAPH API
  // -------------------------------------------------------

  const params =
    new URLSearchParams();


  params.set(
    'messaging_product',
    'whatsapp'
  );


  params.set(
    'recipient_type',
    'individual'
  );


  params.set(
    'to',
    to
  );


  params.set(
    'type',
    'template'
  );


  params.set(
    'template',
    JSON.stringify({
      name:
        TEMPLATE_NAME,

      language: {
        code:
          TEMPLATE_LANGUAGE,
      },
    })
  );


  // Token enviado no header Authorization (não no corpo),
  // para não vazar em logs de URL/corpo.
  const url =
    `https://graph.facebook.com/` +
    `${META_GRAPH_API_VERSION}/` +
    `${META_PHONE_NUMBER_ID}/messages`;


  try {

    const response =
      await fetch(
        url,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/x-www-form-urlencoded',
            'Authorization':
              `Bearer ${META_WHATSAPP_TOKEN}`,
          },

          body:
            params.toString(),
        }
      );


    const raw =
      await response
        .text()
        .catch(() => '');


    let data =
      {};


    try {

      data =
        raw
          ? JSON.parse(raw)
          : {};

    } catch {

      data = {
        raw,
      };
    }


    // -----------------------------------------------------
    // ERRO META
    // -----------------------------------------------------

    if (!response.ok) {

      const metaError =
        data?.error ||
        {};


      return {
        ok: false,

        httpStatus:
          response.status,

        error:
          metaError?.message ||
          `Meta HTTP ${response.status}`,

        errorCode:
          metaError?.code ||
          null,

        errorSubcode:
          metaError?.error_subcode ||
          null,

        errorType:
          metaError?.type ||
          null,

        errorData:
          metaError?.error_data ||
          null,

        errorDetails:
          metaError?.error_user_msg ||
          metaError?.details ||
          null,

        fbtraceId:
          metaError?.fbtrace_id ||
          null,
      };
    }


    // -----------------------------------------------------
    // META ACEITOU
    // -----------------------------------------------------

    const message =
      data
        ?.messages
        ?.[0] ||
      {};


    const contact =
      data
        ?.contacts
        ?.[0] ||
      {};


    return {
      ok: true,

      providerMessageId:
        message?.id ||
        null,

      messageStatus:
        message?.message_status ||
        'accepted',

      waId:
        contact?.wa_id ||
        null,

      input:
        contact?.input ||
        to,
    };


  } catch (error) {

    return {
      ok: false,

      error:
        error?.message ||
        'Falha de conexão com Meta',

      errorType:
        'fetch_exception',
    };
  }
}


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  req,
  res
) {

  try {

    // =====================================================
    // PROTEÇÃO DO CRON
    // =====================================================

    if (CRON_SECRET) {

      const auth =
        req.headers?.authorization ||
        '';


      if (
        auth !==
        `Bearer ${CRON_SECRET}`
      ) {

        return res
          .status(401)
          .json({
            ok: false,
            error:
              'unauthorized',
          });
      }
    }


    // =====================================================
    // CONFIGURAÇÃO
    // =====================================================

    if (
      !process.env
        .SUPABASE_SERVICE_KEY
    ) {

      return res
        .status(200)
        .json({
          ok: false,

          error:
            'SUPABASE_SERVICE_KEY ausente',
        });
    }


    if (
      !META_WHATSAPP_TOKEN
    ) {

      return res
        .status(200)
        .json({
          ok: false,

          error:
            'META_WHATSAPP_TOKEN ausente',
        });
    }


    // =====================================================
    // PERFIS
    // =====================================================

    const profiles =
      await sb(
        'profiles' +
        '?select=' +
        'id,' +
        'first_name,' +
        'name,' +
        'whatsapp,' +
        'timezone,' +
        'notifications_enabled,' +
        'whatsapp_opt_in,' +
        'onboarding_completed,' +
        'created_at' +

        '&whatsapp=not.is.null' +
        '&onboarding_completed=eq.true' +
        '&order=created_at.asc'
      );


    // =====================================================
    // CONTADORES
    // =====================================================

    let tentativas =
      0;

    let enviados =
      0;

    let jaReceberam =
      0;

    let pulados =
      0;

    let falhas =
      0;


    const erros =
      [];

    const sucessos =
      [];


    // =====================================================
    // PROCESSAMENTO
    // =====================================================

    for (
      const profile of
      profiles || []
    ) {

      // ---------------------------------------------------
      // LIMITE ABSOLUTO DE 5 TENTATIVAS
      // ---------------------------------------------------

      if (
        tentativas >=
        BATCH_SIZE
      ) {

        break;
      }


      // ---------------------------------------------------
      // WHATSAPP
      // ---------------------------------------------------

      if (
        !profile?.whatsapp
      ) {

        pulados++;

        continue;
      }


      // ---------------------------------------------------
      // NOTIFICAÇÕES
      // ---------------------------------------------------

      if (
        profile
          .notifications_enabled ===
        false
      ) {

        pulados++;

        continue;
      }


      // ---------------------------------------------------
      // OPT-IN
      // Mensagem de marketing: exige consentimento explícito.
      // Quem não tem opt-in registrado (null/undefined) é pulado.
      // ---------------------------------------------------

      if (
        profile
          .whatsapp_opt_in !==
        true
      ) {

        pulados++;

        continue;
      }


      // ---------------------------------------------------
      // QUIET HOURS
      // ---------------------------------------------------

      if (
        isQuietHours(
          profile.timezone
        )
      ) {

        pulados++;

        continue;
      }


      // ===================================================
      // CHAVE ÚNICA
      // ===================================================

      const idempotencyKey =
        buildIdempotencyKey({
          userId:
            profile.id,

          notificationType:
            'CONEXIA_ONLINE_ANNOUNCEMENT',

          scopeKey:
            'conexia_online_v1',
        });


      // ===================================================
      // JÁ RECEBEU
      // ===================================================

      if (
        await alreadySent(
          idempotencyKey
        )
      ) {

        jaReceberam++;

        continue;
      }


      // ===================================================
      // LIMITE DIÁRIO
      // ===================================================

      const localDate =
        localDateISO(
          profile.timezone
        );


      if (
        await dailyLimitReached(
          profile.id,
          localDate
        )
      ) {

        pulados++;

        continue;
      }


      // ===================================================
      // CONTA TENTATIVA
      // ===================================================

      tentativas++;


      // ===================================================
      // LOG
      // ===================================================

      let logRow =
        null;


      try {

        logRow =
          await logScheduled({
            userId:
              profile.id,

            notificationType:
              'CONEXIA_ONLINE_ANNOUNCEMENT',

            channel:
              'whatsapp',

            content:
              `template:${TEMPLATE_NAME}`,

            idempotencyKey,
          });


      } catch (error) {

        falhas++;


        erros.push({
          profileId:
            profile.id,

          etapa:
            'notification_log',

          error:
            error?.message ||
            'notification_log_error',
        });


        continue;
      }


      // ===================================================
      // ENVIA DIRETO PARA META
      // ===================================================

      const result =
        await sendTemplateDirect(
          profile.whatsapp
        );


      // ===================================================
      // FALHA
      // ===================================================

      if (
        !result.ok
      ) {

        falhas++;


        if (
          logRow?.id
        ) {

          await markFailed(
            logRow.id,

            [
              result.error,
              result.errorCode,
              result.errorSubcode,
            ]
              .filter(Boolean)
              .join(' | ')
          );
        }


        const detail = {

          profileId:
            profile.id,

          etapa:
            'meta_direct',

          httpStatus:
            result.httpStatus ||
            null,

          error:
            result.error ||
            null,

          errorCode:
            result.errorCode ||
            null,

          errorSubcode:
            result.errorSubcode ||
            null,

          errorType:
            result.errorType ||
            null,

          errorData:
            result.errorData ||
            null,

          errorDetails:
            result.errorDetails ||
            null,

          fbtraceId:
            result.fbtraceId ||
            null,
        };


        erros.push(
          detail
        );


        console.error(
          '[CONEXIA ONLINE META ERROR]',
          JSON.stringify(detail)
        );


        continue;
      }


      // ===================================================
      // SUCESSO
      // ===================================================

      if (
        logRow?.id
      ) {

        await markSent(
          logRow.id,

          result
            .providerMessageId
        );
      }


      enviados++;


      sucessos.push({

        profileId:
          profile.id,

        messageStatus:
          result.messageStatus,

        waId:
          result.waId,

        providerMessageId:
          result.providerMessageId,
      });


      console.log(
        '[CONEXIA ONLINE META OK]',
        JSON.stringify({
          profileId:
            profile.id,

          messageStatus:
            result.messageStatus,

          waId:
            result.waId,

          providerMessageId:
            result.providerMessageId,
        })
      );


      // ---------------------------------------------------
      // PEQUENA PAUSA
      // ---------------------------------------------------

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            400
          )
      );
    }


    // =====================================================
    // RESULTADO
    // =====================================================

    return res
      .status(200)
      .json({

        ok:
          falhas === 0,

        mode:
          'meta_graph_direct',

        template:
          TEMPLATE_NAME,

        language:
          TEMPLATE_LANGUAGE,

        phoneNumberId:
          META_PHONE_NUMBER_ID,

        batchSize:
          BATCH_SIZE,

        avaliados:
          profiles?.length ||
          0,

        tentativas,

        enviados,

        jaReceberam,

        pulados,

        falhas,

        sucessos:
          sucessos.slice(
            0,
            5
          ),

        erros:
          erros.slice(
            0,
            5
          ),
      });


  } catch (error) {

    console.error(
      '[CONEXIA ONLINE ERRO GERAL]',
      error
    );


    return res
      .status(200)
      .json({

        ok: false,

        error:
          error?.message ||
          'unknown_error',
      });
  }
}
