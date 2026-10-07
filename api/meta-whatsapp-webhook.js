// api/meta-whatsapp-webhook.js
// CONÉXIA — WhatsApp Meta Cloud API v26.0
// Mantém toda a inteligência existente no whatsapp-webhook.js
// e troca somente a camada de transporte para Meta Cloud API.

import { handleIncomingMessage } from './whatsapp-webhook.js';

const META_WHATSAPP_TOKEN = process.env.META_WHATSAPP_TOKEN;

const META_PHONE_NUMBER_ID =
  process.env.META_PHONE_NUMBER_ID || '1367865376400864';

const META_WEBHOOK_VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN;

const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v26.0';

// ---------------------------------------------------------
// ENVIO DE MENSAGEM PELA META CLOUD API
// ---------------------------------------------------------

async function sendWhatsappMeta(
  number,
  text,
  phoneNumberId = META_PHONE_NUMBER_ID
) {
  if (!META_WHATSAPP_TOKEN) {
    throw new Error('META_WHATSAPP_TOKEN não configurado');
  }

  if (!phoneNumberId) {
    throw new Error(
      'META_PHONE_NUMBER_ID não configurado e metadata.phone_number_id ausente'
    );
  }

  const to = String(number || '')
    .replace(/\D/g, '');

  if (!to) {
    throw new Error('Número de destino inválido');
  }

  console.log(
    '[META WHATSAPP] Enviando resposta',
    'destino=****' + to.slice(-4),
    'phoneNumberId=' + phoneNumberId
  );

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',

      headers: {
        Authorization:
          `Bearer ${META_WHATSAPP_TOKEN}`,

        'Content-Type':
          'application/json',
      },

      body: JSON.stringify({
        messaging_product: 'whatsapp',

        recipient_type: 'individual',

        to,

        type: 'text',

        text: {
          preview_url: false,
          body: String(text || ''),
        },
      }),
    }
  );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {

    console.error(
      '[META WHATSAPP] Erro ao enviar:',
      response.status,
      JSON.stringify(data),
      'phoneNumberId=' + phoneNumberId
    );

    throw new Error(
      data?.error?.message ||
      `Meta WhatsApp HTTP ${response.status}`
    );
  }

  console.log(
    '[META WHATSAPP] Mensagem enviada:',
    data?.messages?.[0]?.id || 'sem-id'
  );

  return data;
}

// ---------------------------------------------------------
// WEBHOOK
// ---------------------------------------------------------

export default async function handler(req, res) {

  try {

    // -----------------------------------------------------
    // META WEBHOOK VERIFICATION
    // -----------------------------------------------------

    if (req.method === 'GET') {

      const mode =
        req.query?.['hub.mode'];

      const token =
        req.query?.['hub.verify_token'];

      const challenge =
        req.query?.['hub.challenge'];

      if (
        mode === 'subscribe' &&
        META_WEBHOOK_VERIFY_TOKEN &&
        token === META_WEBHOOK_VERIFY_TOKEN
      ) {

        console.log(
          '[META WHATSAPP] Webhook verificado'
        );

        return res
          .status(200)
          .send(challenge);
      }

      console.error(
        '[META WHATSAPP] Falha na verificação do webhook'
      );

      return res
        .status(403)
        .send('Forbidden');
    }

    // -----------------------------------------------------
    // SOMENTE POST
    // -----------------------------------------------------

    if (req.method !== 'POST') {

      return res
        .status(405)
        .json({
          ok: false,
          error: 'Method not allowed',
        });
    }

    const body =
      req.body || {};

    // Eventos que não são do WhatsApp Business
    if (
      body.object !==
      'whatsapp_business_account'
    ) {

      return res
        .status(200)
        .json({
          ok: true,
        });
    }

    const entries =
      Array.isArray(body.entry)
        ? body.entry
        : [];

    for (const entry of entries) {

      const changes =
        Array.isArray(entry?.changes)
          ? entry.changes
          : [];

      for (const change of changes) {

        if (
          change?.field !==
          'messages'
        ) {
          continue;
        }

        const value =
          change?.value || {};

        // -------------------------------------------------
        // CORREÇÃO PRINCIPAL
        //
        // O próprio webhook informa qual número Meta recebeu
        // a mensagem.
        //
        // A resposta DEVE sair por esse mesmo phone_number_id.
        // -------------------------------------------------

        const incomingPhoneNumberId =
          value?.metadata?.phone_number_id ||
          META_PHONE_NUMBER_ID;

        console.log(
          '[META WHATSAPP] Número Meta recebido:',
          incomingPhoneNumberId
        );

        const sendReplyFromIncomingNumber =
          (number, text) =>
            sendWhatsappMeta(
              number,
              text,
              incomingPhoneNumberId
            );

        const messages =
          Array.isArray(value.messages)
            ? value.messages
            : [];

        // Eventos de status também chegam aqui.
        // Se não houver messages, simplesmente ignora.
        if (!messages.length) {
          continue;
        }

        for (const message of messages) {

          const from =
            String(
              message?.from || ''
            )
              .replace(/\D/g, '');

          const messageId =
            message?.id
              ? `meta:${message.id}`
              : null;

          if (!from) {
            continue;
          }

          console.log(
            '[META WHATSAPP] Mensagem recebida:',
            '****' + from.slice(-4),
            messageId
          );

          // -----------------------------------------------
          // TEXTO
          // -----------------------------------------------

          if (
            message.type ===
            'text'
          ) {

            const text =
              message
                ?.text
                ?.body
                ?.trim();

            if (!text) {
              continue;
            }

            await handleIncomingMessage(
              from,
              text,
              sendReplyFromIncomingNumber,
              messageId
            );

            continue;
          }

          // -----------------------------------------------
          // BOTÃO
          // -----------------------------------------------

          if (
            message.type ===
            'button'
          ) {

            const text =
              message?.button?.text ||
              message?.button?.payload ||
              '';

            if (text) {

              await handleIncomingMessage(
                from,
                text,
                sendReplyFromIncomingNumber,
                messageId
              );
            }

            continue;
          }

          // -----------------------------------------------
          // LISTA / BOTÃO INTERATIVO
          // -----------------------------------------------

          if (
            message.type ===
            'interactive'
          ) {

            const interactive =
              message.interactive || {};

            const text =
              interactive
                ?.button_reply
                ?.title ||

              interactive
                ?.button_reply
                ?.id ||

              interactive
                ?.list_reply
                ?.title ||

              interactive
                ?.list_reply
                ?.id ||

              '';

            if (text) {

              await handleIncomingMessage(
                from,
                text,
                sendReplyFromIncomingNumber,
                messageId
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
          );
        }
      }
    }

    return res
      .status(200)
      .json({
        ok: true,
      });

  } catch (error) {

    console.error(
      '[META WHATSAPP] Erro no webhook:',
      error
    );

    return res
      .status(500)
      .json({
        ok: false,
        error:
          error?.message ||
          'Internal error',
      });
  }
}
