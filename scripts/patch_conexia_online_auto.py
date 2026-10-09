from pathlib import Path
import json

SENDER = Path("api/_lib/relationshipAssistant/whatsappSender.js")
CRON = Path("api/conexia-online-template-cron.js")
VERCEL = Path("vercel.json")

sender = SENDER.read_text(encoding="utf-8")

# =========================================================
# 1. ADICIONA ENVIO DE TEMPLATE META
# =========================================================

marker = """// ─────────────────────────────────────────────
// PROVIDER ATUAL
// TWILIO -> EVOLUTION FALLBACK
// ─────────────────────────────────────────────"""

template_code = r"""
// ─────────────────────────────────────────────
// META TEMPLATE MESSAGE
// Usado para mensagens business-initiated fora da janela de 24h.
// ─────────────────────────────────────────────

async function sendTemplateViaMeta(
  number,
  templateName,
  languageCode = 'pt_BR'
) {

  if (!META_WHATSAPP_TOKEN) {
    return {
      ok: false,
      channel: 'meta',
      error: 'meta_token_not_configured',
    };
  }

  if (!META_PHONE_NUMBER_ID) {
    return {
      ok: false,
      channel: 'meta',
      error: 'meta_phone_number_id_not_configured',
    };
  }

  const to =
    toDigits(number);

  if (!to) {
    return {
      ok: false,
      channel: 'meta',
      error: 'invalid_destination_number',
    };
  }

  try {

    const res =
      await fetch(
        `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',

          headers: {
            Authorization:
              `Bearer ${META_WHATSAPP_TOKEN}`,

            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            messaging_product:
              'whatsapp',

            recipient_type:
              'individual',

            to,

            type:
              'template',

            template: {
              name:
                templateName,

              language: {
                code:
                  languageCode,
              },
            },
          }),
        }
      );

    const data =
      await res
        .json()
        .catch(() => ({}));

    if (!res.ok) {

      return {
        ok: false,
        channel: 'meta',

        error:
          data?.error?.message ||
          `meta_http_${res.status}`,

        errorCode:
          data?.error?.code ||
          null,
      };
    }

    return {
      ok: true,
      channel: 'meta',

      providerMessageId:
        data
          ?.messages
          ?.[0]
          ?.id ||
        null,
    };

  } catch (e) {

    return {
      ok: false,
      channel: 'meta',
      error:
        e.message,
    };
  }
}

"""

if template_code not in sender:
    if marker not in sender:
        raise Exception("Não achei ponto de inserção em whatsappSender.js")
    sender = sender.replace(
        marker,
        template_code + "\n" + marker
    )

# =========================================================
# 2. ADICIONA sendTemplate NO META PROVIDER
# =========================================================

old_provider = """const MetaWhatsAppProvider = {

  async sendMessage({
    number,
    text,
  }) {

    return sendViaMeta(
      number,
      text
    );
  },
};"""

new_provider = """const MetaWhatsAppProvider = {

  async sendMessage({
    number,
    text,
  }) {

    return sendViaMeta(
      number,
      text
    );
  },

  async sendTemplate({
    number,
    templateName,
    languageCode = 'pt_BR',
  }) {

    return sendTemplateViaMeta(
      number,
      templateName,
      languageCode
    );
  },
};"""

if old_provider not in sender:
    raise Exception("Não achei MetaWhatsAppProvider para atualizar")

sender = sender.replace(
    old_provider,
    new_provider
)

SENDER.write_text(
    sender,
    encoding="utf-8"
)

# =========================================================
# 3. CRON AUTOMÁTICO
# =========================================================

cron_code = r"""// api/conexia-online-template-cron.js
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
"""

CRON.write_text(
    cron_code,
    encoding="utf-8"
)

# =========================================================
# 4. ADICIONA CRON NO VERCEL.JSON
# =========================================================

data = json.loads(
    VERCEL.read_text(
        encoding="utf-8"
    )
)

crons = data.setdefault(
    "crons",
    []
)

new_cron = {
    "path":
        "/api/conexia-online-template-cron",
    "schedule":
        "30 */6 * * *"
}

if not any(
    c.get("path") ==
    new_cron["path"]
    for c in crons
):
    crons.append(
        new_cron
    )

VERCEL.write_text(
    json.dumps(
        data,
        ensure_ascii=False,
        indent=2
    ) + "\n",
    encoding="utf-8"
)

print(
    "✅ Automação conexia_online criada com sucesso."
)
print(
    "✅ Lote padrão: 5 usuários a cada 6 horas."
)
print(
    "✅ Anti-duplicidade ativada."
)
print(
    "✅ Novos usuários serão incluídos automaticamente."
)
