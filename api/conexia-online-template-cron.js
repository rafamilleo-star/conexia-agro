// api/conexia-online-template-cron.js
//
// Disparo automático e idempotente do template conexia_online.
// Funciona para a base atual e também para novos usuários.
//
// Regras:
// - WhatsApp cadastrado
// - onboarding concluído
// - notifications_enabled != false
// - whatsapp_opt_in != false
// - respeita quiet hours
// - respeita limite de 1 mensagem proativa/dia
// - envia uma única vez por usuário
// - lote pequeno para proteger qualidade do template

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


const CRON_SECRET =
  process.env.CRON_SECRET || '';

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


export default async function handler(
  req,
  res
) {

  try {

    // -----------------------------------------------------
    // SEGURANÇA
    // -----------------------------------------------------

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
            error: 'unauthorized',
          });
      }
    }


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


    // -----------------------------------------------------
    // BUSCA PERFIS
    // -----------------------------------------------------

    const profiles =
      await sb(
        `profiles?select=id,first_name,name,whatsapp,timezone,notifications_enabled,whatsapp_opt_in,onboarding_completed&whatsapp=not.is.null&onboarding_completed=eq.true&order=created_at.asc`
      );


    let enviados = 0;
    let jaReceberam = 0;
    let pulados = 0;
    let falhas = 0;


    for (
      const profile of
      profiles || []
    ) {

      // lote por execução
      if (
        enviados >=
        BATCH_SIZE
      ) {
        break;
      }


      if (
        !profile?.whatsapp
      ) {
        pulados++;
        continue;
      }


      if (
        profile
          .notifications_enabled ===
        false
      ) {
        pulados++;
        continue;
      }


      if (
        profile
          .whatsapp_opt_in ===
        false
      ) {
        pulados++;
        continue;
      }


      if (
        isQuietHours(
          profile.timezone
        )
      ) {
        pulados++;
        continue;
      }


      // ---------------------------------------------------
      // IDEMPOTÊNCIA: UMA VEZ NA VIDA POR USUÁRIO
      // ---------------------------------------------------

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


      // ---------------------------------------------------
      // NÃO BRIGA COM OUTRAS MENSAGENS PROATIVAS
      // ---------------------------------------------------

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


      // ---------------------------------------------------
      // LOG
      // ---------------------------------------------------

      const logRow =
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


      // ---------------------------------------------------
      // ENVIO
      // ---------------------------------------------------

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


      if (!result.ok) {

        falhas++;

        if (
          logRow?.id
        ) {

          await markFailed(
            logRow.id,
            result.error ||
            'template_send_failed'
          );
        }


        console.error(
          '[conexia-online-template-cron] falha',
          profile.id,
          result.error
        );

        continue;
      }


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


      // pequena pausa para não fazer rajada
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            350
          )
      );
    }


    return res
      .status(200)
      .json({
        ok:
          falhas === 0,

        template:
          TEMPLATE_NAME,

        batchSize:
          BATCH_SIZE,

        avaliados:
          profiles?.length ||
          0,

        enviados,
        jaReceberam,
        pulados,
        falhas,
      });


  } catch (err) {

    console.error(
      '[conexia-online-template-cron] erro:',
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
