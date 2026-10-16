const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';
const TOKEN = process.env.META_WHATSAPP_TOKEN;

const BUSINESS_ID = '327531584788704';
const PHONE_ID = '1367865376400864';

async function graph(path, options = {}) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      json?.error?.message || `Meta Graph HTTP ${response.status}`
    );
  }

  return json;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    const owned = await graph(
      `${BUSINESS_ID}/owned_whatsapp_business_accounts?fields=id,name&limit=100`
    );

    let correctWaba = null;
    let correctPhone = null;

    for (const waba of owned.data || []) {
      const phones = await graph(
        `${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`
      );

      const phone = (phones.data || []).find(
        p => String(p.id) === String(PHONE_ID)
      );

      if (phone) {
        correctWaba = waba;
        correctPhone = phone;
        break;
      }
    }

    if (!correctWaba) {
      return res.status(404).json({
        ok: false,
        error: 'WABA do número real não encontrado',
        phoneId: PHONE_ID,
      });
    }

    const before = await graph(
      `${correctWaba.id}/subscribed_apps`
    );

    const subscribe = await graph(
      `${correctWaba.id}/subscribed_apps`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );

    const after = await graph(
      `${correctWaba.id}/subscribed_apps`
    );

    return res.status(200).json({
      ok: true,

      phone: correctPhone,

      waba: correctWaba,

      before: before.data || [],

      subscribe,

      after: after.data || [],

      status:
        subscribe?.success === true
          ? 'WABA ASSINADO COM SUCESSO'
          : 'VERIFICAR RESPOSTA DA META',
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}
