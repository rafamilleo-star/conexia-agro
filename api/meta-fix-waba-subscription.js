const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v26.0';
const TOKEN = process.env.META_WHATSAPP_TOKEN;

const PHONE_ID = '1367865376400864';
const WABA_ID = '1102584268830883';

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

  return res.status(200).json({
    phone,
    coexistence,
    subscriptions,
  });
}
