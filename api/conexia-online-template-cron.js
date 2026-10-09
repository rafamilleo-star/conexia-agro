// api/conexia-online-template-cron.js
//
// Disparo automático e idempotente do template conexia_online.
//
// Regras:
//
// - WhatsApp cadastrado
// - onboarding concluído
// - notifications_enabled != false
// - whatsapp_opt_in != false
// - respeita quiet hours
// - respeita limite diário
// - nunca envia duas vezes para quem já recebeu
// - máximo de 5 TENTATIVAS por execução
// - retorna erro detalhado da Meta para diagnóstico

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
  getWhatsAppProvider,
} from './_lib/relationshipAssistant/whatsappSender.js';

import {
  isQuietHours,
  localDateISO,
} from './_lib/relationshipAssistant/timeWindow.js';


// =========================================================
// CONFIGURAÇÕES
// =========================================================

const CRON_SECRET =
  process.env.CRON_SECRET ||
  '';

const TEMPLATE_NAME =
  process.env.CONEXIA_ONLINE_TEMPLATE_NAME ||
  'conexia_online';

const TEMPLATE_LANGUAGE =
  process.env.CONEXIA_ONLINE_TEMPLATE_LANGUAGE ||
  'pt_BR';

const BATCH_SIZE =
  Math.max(
    1,
    Math.min(
      50,
      Number(
        process.env.CONEXIA_ONLINE_TEMPLATE_BATCH_SIZE ||
        5
      )
    )
  );


// =========================================================
// HANDLER
// =========================================================

export default async function handler(
  req,
  res
) {

  try {

    // =====================================================
    // SEGURANÇA DO CRON
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
    // CONFIGURAÇÕES OBRIGATÓRIAS
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


    const provider =
      getWhatsAppProvider();


    if (
      typeof provider
        ?.sendTemplate !==
      'function'
    ) {

      return res
        .status(200)
        .json({
          ok: false,

          error:
            'Provider atual não suporta template Meta',
        });
    }


    // =====================================================
    // BUSCA USUÁRIOS
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

    let enviados =
      0;

    let jaReceberam =
      0;

    let pulados =
      0;

    let falhas =
      0;

    let tentativas =
      0;

    const erros =
      [];


    // =====================================================
    // PROCESSAMENTO
    // =====================================================

    for (
      const profile of
      profiles || []
    ) {

      // ---------------------------------------------------
      // LIMITE REAL DE TENTATIVAS
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
      // NOTIFICAÇÕES DESATIVADAS
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
      // OPT-IN WHATSAPP
      // ---------------------------------------------------

      if (
        profile
          .whatsapp_opt_in ===
        false
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
      // IDEMPOTÊNCIA
      //
      // usuário que recebeu conexia_online_v1
      // nunca recebe de novo
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


      if (
        await alreadySent(
          idempotencyKey
        )
      ) {

        jaReceberam++;

        continue;
      }


      // ===================================================
      // LIMITE DE MENSAGEM AUTOMÁTICA DO DIA
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
      // A PARTIR DAQUI CONTA COMO TENTATIVA
      // ===================================================

      tentativas++;


      // ===================================================
      // LOG SCHEDULED
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


      } catch (logError) {

        falhas++;


        const detail = {
          profileId:
            profile.id,

          etapa:
            'notification_log',

          error:
            logError?.message ||
            'log_error',
        };


        erros.push(
          detail
        );


        console.error(
          '[conexia-online-template-cron] erro notification_log',
          JSON.stringify(detail)
        );


        continue;
      }


      // ===================================================
      // ENVIO DO TEMPLATE META
      // ===================================================

      const result =
        await provider
          .sendTemplate({
            number:
              profile.whatsapp,

            templateName:
              TEMPLATE_NAME,

            languageCode:
              TEMPLATE_LANGUAGE,
          });


      // ===================================================
      // FALHA META
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
              result.errorType,
            ]
              .filter(Boolean)
              .join(' | ')
          );
        }


        const detail = {

          profileId:
            profile.id,

          etapa:
            'meta',

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
          '[conexia-online-template-cron] falha Meta',
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


      console.log(
        '[conexia-online-template-cron] enviado',
        JSON.stringify({
          profileId:
            profile.id,

          providerMessageId:
            result
              .providerMessageId ||
            null,
        })
      );


      // pequena pausa entre envios
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            350
          )
      );
    }


    // =====================================================
    // RESPOSTA
    // =====================================================

    return res
      .status(200)
      .json({

        ok:
          falhas === 0,

        template:
          TEMPLATE_NAME,

        language:
          TEMPLATE_LANGUAGE,

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

        erros:
          erros.slice(
            0,
            5
          ),
      });


  } catch (err) {

    console.error(
      '[conexia-online-template-cron] erro geral:',
      err
    );


    return res
      .status(200)
      .json({

        ok: false,

        error:
          err?.message ||
          'unknown_error',
      });
  }
}
