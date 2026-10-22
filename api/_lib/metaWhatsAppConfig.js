// api/_lib/metaWhatsAppConfig.js
// Configuração única do canal Meta WhatsApp Cloud API.

export const DEFAULT_META_PHONE_NUMBER_ID = '1367865376400864';
export const DEFAULT_META_WABA_ID = '1102584268830883';
export const DEFAULT_META_GRAPH_API_VERSION = 'v26.0';

function valueOf(value) {
  return String(value ?? '').trim();
}

export function getMetaWhatsAppConfig(env = process.env) {
  const phoneNumberId = valueOf(env.META_PHONE_NUMBER_ID);
  const whatsappPhoneNumberId = valueOf(env.META_WHATSAPP_PHONE_NUMBER_ID);
  const phoneNumberIdConflict =
    phoneNumberId &&
    whatsappPhoneNumberId &&
    phoneNumberId !== whatsappPhoneNumberId
      ? {
          META_PHONE_NUMBER_ID: phoneNumberId,
          META_WHATSAPP_PHONE_NUMBER_ID: whatsappPhoneNumberId,
        }
      : null;

  return {
    accessToken: valueOf(env.META_WHATSAPP_TOKEN),
    phoneNumberId:
      phoneNumberId ||
      whatsappPhoneNumberId ||
      DEFAULT_META_PHONE_NUMBER_ID,
    phoneNumberIdSource: phoneNumberId
      ? 'META_PHONE_NUMBER_ID'
      : whatsappPhoneNumberId
        ? 'META_WHATSAPP_PHONE_NUMBER_ID'
        : 'default',
    phoneNumberIdConflict,
    wabaId: valueOf(env.META_WABA_ID) || DEFAULT_META_WABA_ID,
    graphApiVersion:
      valueOf(env.META_GRAPH_API_VERSION) ||
      DEFAULT_META_GRAPH_API_VERSION,
    webhookVerifyToken: valueOf(env.META_WEBHOOK_VERIFY_TOKEN),
  };
}

export function assertMetaWhatsAppConfig(config) {
  if (config?.phoneNumberIdConflict) {
    throw new Error(
      'Conflito entre META_PHONE_NUMBER_ID e META_WHATSAPP_PHONE_NUMBER_ID; defina apenas um valor ou valores iguais.'
    );
  }

  return config;
}
