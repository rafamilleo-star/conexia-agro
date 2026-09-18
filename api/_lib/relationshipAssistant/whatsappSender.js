// api/_lib/relationshipAssistant/whatsappSender.js
//
// Ponto único de envio de WhatsApp para o CONÉXIA.
// Provedores:
//   WHATSAPP_PROVIDER=webhook -> Twilio com Evolution como fallback
//   WHATSAPP_PROVIDER=meta    -> Meta WhatsApp Cloud API

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER =
  process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const EVO_URL = (
  process.env.EVOLUTION_API_URL ||
  'https://evolution-api-production-0c6a.up.railway.app'
).replace(/\/$/, '');

const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'conexia';

const WHATSAPP_PROVIDER =
  process.env.WHATSAPP_PROVIDER || 'webhook';

// ─────────────────────────────────────────────
// META WHATSAPP CLOUD API
// Aceita os dois nomes porque o projeto hoje usa
// nomenclaturas diferentes em arquivos distintos.
// ─────────────────────────────────────────────

const META_WHATSAPP_TOKEN =
  process.env.META_WHATSAPP_TOKEN;

const META_PHONE_NUMBER_ID =
  process.env.META_PHONE_NUMBER_ID ||
  process.env.META_WHATSAPP_PHONE_NUMBER_ID;

const META_GRAPH_API_VERSION =
  process.env.META_GRAPH_API_VERSION || 'v26.0';

// ─────────────────────────────────────────────
// NORMALIZAÇÃO DE NÚMERO
// ─────────────────────────────────────────────

function toE164(number) {
  const n = String(number || '').trim();

  return n.startsWith('+')
    ? n
    : `+${n}`;
}

function toDigits(number) {
  return String(number || '')
    .replace(/\D/g, '');
}

// ─────────────────────────────────────────────
// TWILIO
// ─────────────────────────────────────────────

async function sendViaTwilio(number, text) {

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return {
      ok: false,
      channel: 'twilio',
      error: 'twilio_not_configured',
    };
  }

  try {

    const auth = Buffer
      .from(
        `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`
      )
      .toString('base64');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',

        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: `whatsapp:${toE164(number)}`,
          Body: text,
        }).toString(),
      }
    );

    const data =
      await res.json().catch(() => ({}));

    if (!res.ok) {

      return {
        ok: false,
        channel: 'twilio',
        error:
          data?.message ||
          `http_${res.status}`,
      };
    }

    return {
      ok: true,
      channel: 'twilio',
      providerMessageId:
        data?.sid || null,
    };

  } catch (e) {

    return {
      ok: false,
      channel: 'twilio',
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// EVOLUTION API
// ─────────────────────────────────────────────

async function sendViaEvolution(number, text) {

  if (!EVO_KEY) {

    return {
      ok: false,
      channel: 'evolution',
      error: 'evolution_not_configured',
    };
  }

  try {

    const res = await fetch(
      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
          apikey: EVO_KEY,
        },

        body: JSON.stringify({
          number,
          text,
        }),
      }
    );

    if (!res.ok) {

      const body =
        await res.text().catch(() => '');

      return {
        ok: false,
        channel: 'evolution',
        error:
          body?.slice(0, 300) ||
          `http_${res.status}`,
      };
    }

    return {
      ok: true,
      channel: 'evolution',
      providerMessageId: null,
    };

  } catch (e) {

    return {
      ok: false,
      channel: 'evolution',
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// META WHATSAPP CLOUD API
// ─────────────────────────────────────────────

async function sendViaMeta(number, text) {

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
      error:
        'meta_phone_number_id_not_configured',
    };
  }

  const to = toDigits(number);

  if (!to) {

    return {
      ok: false,
      channel: 'meta',
      error: 'invalid_destination_number',
    };
  }

  try {

    const res = await fetch(
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
      await res.json().catch(() => ({}));

    if (!res.ok) {

      return {
        ok: false,
        channel: 'meta',

        error:
          data?.error?.message ||
          `meta_http_${res.status}`,

        errorCode:
          data?.error?.code || null,
      };
    }

    return {
      ok: true,
      channel: 'meta',

      providerMessageId:
        data?.messages?.[0]?.id ||
        null,
    };

  } catch (e) {

    return {
      ok: false,
      channel: 'meta',
      error: e.message,
    };
  }
}

// ─────────────────────────────────────────────
// PROVIDER ATUAL
// TWILIO -> EVOLUTION FALLBACK
// ─────────────────────────────────────────────

const WebhookWhatsAppProvider = {

  async sendMessage({
    number,
    text,
  }) {

    const twilioResult =
      await sendViaTwilio(
        number,
        text
      );

    if (twilioResult.ok) {
      return twilioResult;
    }

    const evolutionResult =
      await sendViaEvolution(
        number,
        text
      );

    if (evolutionResult.ok) {
      return evolutionResult;
    }

    return {
      ok: false,
      channel: 'webhook',

      error:
        twilioResult.error,

      fallbackError:
        evolutionResult.error,
    };
  },
};

// ─────────────────────────────────────────────
// META PROVIDER
// ─────────────────────────────────────────────

const MetaWhatsAppProvider = {

  async sendMessage({
    number,
    text,
  }) {

    return sendViaMeta(
      number,
      text
    );
  },
};

// ─────────────────────────────────────────────
// ESCOLHA DO PROVIDER
// ─────────────────────────────────────────────

export function getWhatsAppProvider() {

  return WHATSAPP_PROVIDER === 'meta'
    ? MetaWhatsAppProvider
    : WebhookWhatsAppProvider;
}

export {
  WebhookWhatsAppProvider,
  MetaWhatsAppProvider,
  toE164,
};
