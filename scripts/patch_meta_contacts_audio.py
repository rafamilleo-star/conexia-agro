from pathlib import Path

META_FILE = Path("api/meta-whatsapp-webhook.js")
WA_FILE = Path("api/whatsapp-webhook.js")

meta = META_FILE.read_text(encoding="utf-8")
wa = WA_FILE.read_text(encoding="utf-8")

# =========================================================
# 1. META WEBHOOK — IMPORT
# =========================================================

meta = meta.replace(
    "import { handleIncomingMessage } from './whatsapp-webhook.js';",
    "import { handleIncomingMessage, handleSharedContactData } from './whatsapp-webhook.js';"
)

# =========================================================
# 2. GEMINI KEY
# =========================================================

meta = meta.replace(
    """const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v26.0';""",
    """const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v26.0';

const GEMINI_KEY =
  process.env.GEMINI_API_KEY;"""
)

# =========================================================
# 3. DOWNLOAD + TRANSCRIÇÃO DE ÁUDIO META
# =========================================================

marker = """// ---------------------------------------------------------
// WEBHOOK
// ---------------------------------------------------------"""

helpers = r"""
// ---------------------------------------------------------
// DOWNLOAD DE MÍDIA DA META
// ---------------------------------------------------------

async function downloadMetaMedia(mediaId) {

  if (!META_WHATSAPP_TOKEN) {
    throw new Error('META_WHATSAPP_TOKEN não configurado');
  }

  const infoRes = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
      },
    }
  );

  const info =
    await infoRes.json().catch(() => ({}));

  if (!infoRes.ok || !info?.url) {
    throw new Error(
      info?.error?.message ||
      `Falha ao obter mídia Meta HTTP ${infoRes.status}`
    );
  }

  const mediaRes =
    await fetch(
      info.url,
      {
        headers: {
          Authorization:
            `Bearer ${META_WHATSAPP_TOKEN}`,
        },
      }
    );

  if (!mediaRes.ok) {
    throw new Error(
      `Falha ao baixar mídia Meta HTTP ${mediaRes.status}`
    );
  }

  const buffer =
    Buffer.from(
      await mediaRes.arrayBuffer()
    );

  return {
    buffer,
    mimeType:
      info?.mime_type ||
      mediaRes.headers.get('content-type') ||
      'audio/ogg',
  };
}


// ---------------------------------------------------------
// TRANSCRIÇÃO DE ÁUDIO
// ---------------------------------------------------------

async function transcribeMetaAudio(mediaId) {

  if (!GEMINI_KEY) {
    throw new Error(
      'GEMINI_API_KEY não configurada'
    );
  }

  const {
    buffer,
    mimeType,
  } =
    await downloadMetaMedia(mediaId);

  if (
    buffer.length >
    15 * 1024 * 1024
  ) {
    throw new Error(
      'Áudio maior que 15 MB'
    );
  }

  const response =
    await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    'Transcreva exatamente este áudio em português. ' +
                    'Retorne somente a transcrição. ' +
                    'Não explique nada. Preserve nomes, empresas, datas e números.',
                },
                {
                  inlineData: {
                    mimeType,
                    data:
                      buffer.toString('base64'),
                  },
                },
              ],
            },
          ],

          generationConfig: {
            temperature: 0,
            maxOutputTokens: 1200,

            thinkingConfig: {
              thinkingBudget: 0,
            },
          },
        }),
      }
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {

    throw new Error(
      data?.error?.message ||
      `Gemini HTTP ${response.status}`
    );
  }

  const text =
    data
      ?.candidates
      ?.[0]
      ?.content
      ?.parts
      ?.map(
        (part) =>
          part?.text || ''
      )
      ?.join(' ')
      ?.trim();

  return text || '';
}

"""

if helpers not in meta:
    meta = meta.replace(
        marker,
        helpers + "\n" + marker
    )


# =========================================================
# 4. META — CONTACTS + AUDIO
# =========================================================

old = """          // -----------------------------------------------
          // OUTROS TIPOS
          // -----------------------------------------------

          console.log(
            '[META WHATSAPP] Tipo ainda não tratado:',
            message.type
          );"""

new = r"""          // -----------------------------------------------
          // CONTATO COMPARTILHADO
          // -----------------------------------------------

          if (
            message.type ===
            'contacts'
          ) {

            const sharedContacts =
              Array.isArray(
                message?.contacts
              )
                ? message.contacts
                : [];

            if (
              !sharedContacts.length
            ) {

              await sendReplyFromIncomingNumber(
                from,
                'Recebi o contato, mas não consegui ler os dados. Tenta compartilhar novamente.'
              );

              continue;
            }

            await handleSharedContactData(
              from,
              sharedContacts,
              sendReplyFromIncomingNumber,
              messageId
            );

            continue;
          }


          // -----------------------------------------------
          // ÁUDIO
          // -----------------------------------------------

          if (
            message.type ===
            'audio'
          ) {

            const mediaId =
              message?.audio?.id;

            if (!mediaId) {

              await sendReplyFromIncomingNumber(
                from,
                'Recebi seu áudio, mas não consegui acessar o arquivo. Tenta enviar novamente.'
              );

              continue;
            }

            try {

              const transcript =
                await transcribeMetaAudio(
                  mediaId
                );

              if (!transcript) {

                await sendReplyFromIncomingNumber(
                  from,
                  'Ouvi seu áudio, mas não consegui entender. Pode tentar novamente?'
                );

                continue;
              }

              console.log(
                '[META WHATSAPP] Áudio transcrito:',
                transcript.slice(0, 180)
              );

              await handleIncomingMessage(
                from,
                transcript,
                sendReplyFromIncomingNumber,
                messageId
              );

            } catch (error) {

              console.error(
                '[META WHATSAPP] Erro no áudio:',
                error
              );

              await sendReplyFromIncomingNumber(
                from,
                'Recebi seu áudio, mas tive um problema para transcrever agora. Tenta novamente em instantes.'
              );
            }

            continue;
          }


          // -----------------------------------------------
          // OUTROS TIPOS
          // -----------------------------------------------

          console.log(
            '[META WHATSAPP] Tipo ainda não tratado:',
            message.type
          );"""

if old not in meta:
    raise Exception(
        "Não achei o bloco OUTROS TIPOS no meta-whatsapp-webhook.js"
    )

meta = meta.replace(
    old,
    new
)


# =========================================================
# 5. WHATSAPP WEBHOOK — HANDLER CONTATO META
# =========================================================

marker2 = """// Cria o contato de fato — reaproveitado tanto no cadastro direto (1 mensagem
// com dados suficientes) quanto no fluxo de esclarecimento (nome veio depois)."""

handler = r"""
// =========================================================
// CONTATO COMPARTILHADO — META CLOUD API
// =========================================================

export async function handleSharedContactData(
  number,
  sharedContacts,
  sendReply,
  messageId = null
) {

  if (!SUPABASE_SERVICE_KEY) {

    await sendReply(
      number,
      '⚠️ Assistente ainda não configurado.'
    );

    return;
  }


  const normalized =
    normalizePhone(number);

  const variants =
    waVariants(normalized);


  const profiles =
    await sb(
      `profiles?whatsapp=in.(${variants.join(',')})&select=id,name,first_name,is_pro,plan,pro_expires_at,whatsapp,whatsapp_trial_started_at`
    );


  const profile =
    profiles?.[0];


  if (!profile) {

    await sendReply(
      number,
      '👋 Não encontrei sua conta vinculada a este número. Cadastre seu WhatsApp no CONÉXIA.'
    );

    return;
  }


  const userId =
    profile.id;


  if (
    await alreadyProcessedMessage(
      messageId,
      userId
    )
  ) {
    return;
  }


  if (
    !(await checkRateLimit(userId))
  ) {

    await sendReply(
      number,
      '⏳ Muitas mensagens foram enviadas. Tente novamente daqui a pouco.'
    );

    return;
  }


  const isPro =
    !!profile.is_pro ||
    (
      profile.plan === 'pro' &&
      (
        !profile.pro_expires_at ||
        new Date(
          profile.pro_expires_at
        ) >
        new Date()
      )
    );


  if (!isPro) {

    const days =
      profile
        .whatsapp_trial_started_at

        ? (
            Date.now() -
            new Date(
              profile.whatsapp_trial_started_at
            ).getTime()
          ) /
          86400000

        : 0;


    if (days > 10) {

      await sendReply(
        number,
        'Seu período gratuito do WhatsApp terminou. Ative o PRO para continuar.'
      );

      return;
    }
  }


  const incoming =
    Array.isArray(
      sharedContacts
    )
      ? sharedContacts
      : [];


  const existing =
    await sb(
      `contacts?user_id=eq.${userId}&select=id,name,whatsapp`
    );


  const added = [];
  const duplicates = [];


  for (
    const raw of incoming
  ) {


    const name =

      raw
        ?.name
        ?.formatted_name

      ||

      [
        raw?.name?.first_name,
        raw?.name?.middle_name,
        raw?.name?.last_name,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();


    const phoneEntry =

      (raw?.phones || [])
        .find(
          p => p?.wa_id
        )

      ||

      raw?.phones?.[0];


    const phone =
      normalizePhone(
        phoneEntry?.wa_id ||
        phoneEntry?.phone ||
        ''
      );


    const company =
      raw?.org?.company ||
      null;


    const role =
      raw?.org?.title ||
      null;


    const email =
      raw
        ?.emails
        ?.[0]
        ?.email ||
      null;


    if (!name) {
      continue;
    }


    const duplicateName =
      findExistingContactByName(
        existing,
        name
      );


    const duplicatePhone =
      phone

        ? existing.find(
            c =>
              normalizePhone(
                c?.whatsapp
              ) ===
              phone
          )

        : null;


    const duplicate =
      duplicateName ||
      duplicatePhone;


    if (duplicate) {

      duplicates.push(
        duplicate.name ||
        name
      );

      continue;
    }


    const created =
      await createContactFromWhatsapp(
        userId,
        {

          contact_name:
            name,

          company,

          role,

          how_met:
            'Contato compartilhado via WhatsApp',

          contact_email:
            email,

          whatsapp:
            phone || null,
        }
      );


    if (!created) {
      continue;
    }


    existing.push({
      id:
        created.id,

      name:
        created.name,

      whatsapp:
        phone,
    });


    added.push({
      name:
        created.name,

      phone,

      company,

      role,
    });
  }


  const lines = [];


  if (
    added.length === 1
  ) {

    const item =
      added[0];


    const details =
      [
        item.role,
        item.company,
      ]
        .filter(Boolean)
        .join(' na ');


    lines.push(
      `✅ *${item.name}* cadastrado na sua rede.`
    );


    if (details) {

      lines.push(
        `${details}`
      );
    }


    if (
      item.phone
    ) {

      lines.push(
        `📞 ${item.phone}`
      );
    }
  }


  if (
    added.length > 1
  ) {

    lines.push(
      `✅ ${added.length} contatos cadastrados na sua rede.`
    );


    added.forEach(
      item => {

        lines.push(
          `• ${item.name}`
        );
      }
    );
  }


  if (
    duplicates.length
  ) {

    lines.push(
      `ℹ️ Já estava(m) cadastrado(s): ${duplicates.join(', ')}`
    );
  }


  if (
    !added.length &&
    !duplicates.length
  ) {

    lines.push(
      'Recebi o contato, mas não encontrei dados suficientes para cadastrar.'
    );
  }


  if (
    added.length
  ) {

    lines.push(
      '',
      'Quando conversar com essa pessoa, é só me contar por aqui que eu registro a interação.'
    );
  }


  await sendReply(
    number,
    lines.join('\n')
  );
}

"""

if handler not in wa:

    if marker2 not in wa:
        raise Exception(
            "Não achei ponto de inserção no whatsapp-webhook.js"
        )

    wa = wa.replace(
        marker2,
        handler + "\n" + marker2
    )


# =========================================================
# SALVAR
# =========================================================

META_FILE.write_text(
    meta,
    encoding="utf-8"
)

WA_FILE.write_text(
    wa,
    encoding="utf-8"
)

print(
    "✅ META corrigida: contatos + áudio."
)
