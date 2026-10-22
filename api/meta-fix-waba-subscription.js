import {
  getMetaWhatsAppConfig,
  assertMetaWhatsAppConfig,
} from './_lib/metaWhatsAppConfig.js';

const META_CONFIG = getMetaWhatsAppConfig();
const GRAPH_VERSION = META_CONFIG.graphApiVersion;
const TOKEN = META_CONFIG.accessToken;
const PHONE_ID = META_CONFIG.phoneNumberId;
const WABA_ID = META_CONFIG.wabaId;

async function call(path) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed; diagnóstico somente GET',
    });
  }

  try {
    assertMetaWhatsAppConfig(META_CONFIG);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }

  const [
    phone,
    coexistence,
    subscriptions
  ] = await Promise.all([
    call(
      `${PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating`
    ),

    call(
      `${PHONE_ID}?fields=is_on_biz_app,platform_type`
    ),

    call(
      `${WABA_ID}/subscribed_apps`
    ),
  ]);

  const isOnBizApp =
    coexistence.data?.is_on_biz_app === true;
  const platformType =
    coexistence.data?.platform_type;
  const coexistenceReady =
    phone.ok &&
    coexistence.ok &&
    subscriptions.ok &&
    isOnBizApp &&
    platformType === 'CLOUD_API';
  const provisioningGuidance =
    isOnBizApp &&
    platformType === 'ON_PREMISE'
      ? 'A coexistência ainda não está provisionada para CLOUD_API. Conclua ou repare o onboarding de coexistência pelo Meta Business Suite (Caixa de entrada > WhatsApp) ou Embedded Signup. Preserve o WhatsApp Business do celular: não exclua, desregistre nem force o registro convencional do número. Este endpoint apenas consulta o estado e não executa reparos.'
      : null;

  return res.status(200).json({
    phone,
    coexistence,
    subscriptions,
    coexistence_ready: coexistenceReady,
    provisioning_guidance: provisioningGuidance,
  });
}
