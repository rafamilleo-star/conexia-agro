const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';
const TOKEN = process.env.META_WHATSAPP_TOKEN;

const BUSINESS_ID = '327531584788704';
const PHONE_ID = '1367865376400864';

async function call(path) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
  });

  const json = await response.json().catch(() => ({}));

  return {
    status: response.status,
    ok: response.ok,
    data: json,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'META_WHATSAPP_TOKEN ausente',
    });
  }

  const phone = await call(
    `${PHONE_ID}?fields=id,display_phone_number,verified_name,quality_rating`
  );

  const owned = await call(
    `${BUSINESS_ID}/owned_whatsapp_business_accounts?fields=id,name&limit=100`
  );

  const client = await call(
    `${BUSINESS_ID}/client_whatsapp_business_accounts?fields=id,name&limit=100`
  );

  const me = await call(`me?fields=id,name`);

  return res.status(200).json({
    tokenIdentity: me,
    directPhoneLookup: phone,
    ownedWabas: owned,
    clientWabas: client,
  });
}
