// api/_lib/relationshipAssistant/whatsappSender.js
//
// Ponto único de envio de WhatsApp para o Assistente de Inteligência Relacional.
// Unifica a lógica que hoje está duplicada em api/whatsapp-webhook.js e
// api/whatsapp-reminder-cron.js (Twilio como canal principal, Evolution API
// como fallback). Isso NÃO substitui o envio de resposta reativa do webhook
// (que continua como está, pra não arriscar regressão ali) — é usado apenas
// pelas novas rotinas proativas (onboarding, inatividade, resumo semanal,
// atenção, próxima ação).
//
// Troca de provedor por variável de ambiente, sem tocar em regra de negócio:
//   WHATSAPP_PROVIDER=webhook  -> usa Twilio/Evolution (implementação atual)
//   WHATSAPP_PROVIDER=meta     -> usa MetaWhatsAppProvider (stub, não ativo)

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

const EVO_URL = (process.env.EVOLUTION_API_URL || 'https://evolution-api-production-0c6a.up.railway.app').replace(/\/$/, '');
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE || 'conexia';

const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'webhook';

// Garante E.164 ("+55...") — no banco a maioria está salva só em dígitos.
function toE164(number) {
  const n = String(number || '').trim();
  return n.startsWith('+') ? n : `+${n}`;
}

async function sendViaTwilio(number, text) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return { ok: false, channel: 'twilio', error: 'twilio_not_configured' };
  }
  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: TWILIO_WHATSAPP_NUMBER,
          To: `whatsapp:${toE164(number)}`,
          Body: text,
        }).toString(),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, channel: 'twilio', error: data?.message || `http_${res.status}` };
    }
    return { ok: true, channel: 'twilio', providerMessageId: data?.sid || null };
  } catch (e) {
    return { ok: false, channel: 'twilio', error: e.message };
  }
}

async function sendViaEvolution(number, text) {
  if (!EVO_KEY) {
    return { ok: false, channel: 'evolution', error: 'evolution_not_configured' };
  }
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${EVO_INSTANCE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: EVO_KEY },
      body: JSON.stringify({ number, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, channel: 'evolution', error: body?.slice(0, 300) || `http_${res.status}` };
    }
    return { ok: true, channel: 'evolution', providerMessageId: null };
  } catch (e) {
    return { ok: false, channel: 'evolution', error: e.message };
  }
}

// WebhookWhatsAppProvider: implementação atual (Twilio -> fallback Evolution).
// Interface: sendMessage({ number, text }) => Promise<{ ok, channel, providerMessageId?, error? }>
const WebhookWhatsAppProvider = {
  async sendMessage({ number, text }) {
    const twilioResult = await sendViaTwilio(number, text);
    if (twilioResult.ok) return twilioResult;
    const evoResult = await sendViaEvolution(number, text);
    if (evoResult.ok) return evoResult;
    // Ambos falharam: devolve o erro do canal principal, mas registra os dois.
    return { ok: false, channel: 'webhook', error: twilioResult.error, fallbackError: evoResult.error };
  },
};

// MetaWhatsAppProvider: estrutura preparada, ainda NÃO ativa. Requer templates
// aprovados pela Meta (HSM) antes de qualquer envio proativo funcionar de
// verdade — proatividade fora da janela de 24h exige template aprovado.
// Implementação intencionalmente não-funcional até a migração ser decidida.
const MetaWhatsAppProvider = {
  async sendMessage({ number, text }) {
    return {
      ok: false,
      channel: 'meta',
      error: 'meta_provider_not_implemented',
    };
  },
};

export function getWhatsAppProvider() {
  return WHATSAPP_PROVIDER === 'meta' ? MetaWhatsAppProvider : WebhookWhatsAppProvider;
}

export { WebhookWhatsAppProvider, MetaWhatsAppProvider, toE164 };  
