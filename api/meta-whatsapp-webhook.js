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

async function sendWhatsappMeta(number, text) {
  if (!META_WHATSAPP_TOKEN) {
    throw new Error('META_WHATSAPP_TOKEN não configurado');
  }

  if (!META_PHONE_NUMBER_ID) {
    throw new Error('META_PHONE_NUMBER_ID não configurado');
  }

  const to = String(number || '').replace(/\D/g, '');

  if (!to) {
    throw new Error('Número de destino inválido');
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(
      '[META WHATSAPP] Erro ao enviar:',
      response.status,
      JSON.stringify(data)
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
      const mode = req.query?.['hub.mode'];
      const token = req.query?.['hub.verify_token'];
      const challenge = req.query?.['hub.challenge'];

      if (
        mode === 'subscribe' &&
        META_WEBHOOK_VERIFY_TOKEN &&
        token === META_WEBHOOK_VERIFY_TOKEN
      ) {
        console.log('[META WHATSAPP] Webhook verificado');

        return res.status(200).send(challenge);
      }

      console.error('[META WHATSAPP] Falha na verificação do webhook');

      return res.status(403).send('Forbidden');
    }

    // -----------------------------------------------------
    // SOMENTE POST DEPOIS DA VERIFICAÇÃO
    // -----------------------------------------------------

    if (req.method !== 'POST') {
      return res.status(405).json({
        ok: false,
        error: 'Method not allowed',
      });
    }

    const body = req.body || {};

    // Meta espera HTTP 200 mesmo para eventos que não usamos.
    if (body.object !== 'whatsapp_business_account') {
      return res.status(200).json({ ok: true });
    }

    const entries = Array.isArray(body.entry)
      ? body.entry
      : [];

    for (const entry of entries) {

      const changes = Array.isArray(entry?.changes)
        ? entry.changes
        : [];

      for (const change of changes) {

        if (change?.field !== 'messages') {
          continue;
        }

        const value = change?.value || {};

        const messages = Array.isArray(value.messages)
          ? value.messages
          : [];

        if (!messages.length) {
          continue;
        }

        for (const message of messages) {

          const from = String(message?.from || '')
            .replace(/\D/g, '');

          const messageId = message?.id
            ? `meta:${message.id}`
            : null;

          if (!from) {
            continue;
          }

          // -----------------------------------------------
          // TEXTO NORMAL
          // -----------------------------------------------

          if (message.type === 'text') {

            const text = message?.text?.body?.trim();

            if (!text) {
              continue;
            }

            console.log(
              '[META WHATSAPP] Mensagem recebida:',
              '****' + from.slice(-4),
              messageId
            );

            await handleIncomingMessage(
              from,
              text,
              sendWhatsappMeta,
              messageId
            );

            continue;
          }

          // -----------------------------------------------
          // BOTÃO
          // -----------------------------------------------

          if (message.type === 'button') {

            const text =
              message?.button?.text ||
              message?.button?.payload ||
              '';

            if (text) {
              await handleIncomingMessage(
                from,
                text,
                sendWhatsappMeta,
                messageId
              );
            }

            continue;
          }

          // -----------------------------------------------
          // RESPOSTA DE LISTA / BOTÃO INTERATIVO
          // -----------------------------------------------

          if (message.type === 'interactive') {

            const interactive = message.interactive || {};

            const text =
              interactive?.button_reply?.title ||
              interactive?.button_reply?.id ||
              interactive?.list_reply?.title ||
              interactive?.list_reply?.id ||
              '';

            if (text) {
              await handleIncomingMessage(
                from,
                text,
                sendWhatsappMeta,
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

    return res.status(200).json({
      ok: true,
    });

  } catch (error) {

    console.error(
      '[META WHATSAPP] Erro no webhook:',
      error
    );

    // Para erro real de processamento usamos 500,
    // permitindo diagnóstico no Vercel.
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Internal error',
    });
  }
}
