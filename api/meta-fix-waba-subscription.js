const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v22.0';
const TOKEN = process.env.META_WHATSAPP_TOKEN;

const BUSINESS_ID = '327531584788704';
const EXPECTED_PHONE_NUMBER_ID =
  process.env.META_PHONE_NUMBER_ID || '1367865376400864';

const EXPECTED_APP_ID = '938626318317786';

async function graph(path, options = {}) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      json?.error?.message || `Meta Graph HTTP ${response.status}`
    );

    error.details = {
      status: response.status,
      code: json?.error?.code,
      subcode: json?.error?.error_subcode,
      type: json?.error?.type,
      trace: json?.error?.fbtrace_id,
    };

    throw error;
  }

  return json;
}

async function getWabas(edge) {
  try {
    const result = await graph(
      `${BUSINESS_ID}/${edge}?fields=id,name&limit=100`
    );

    return Array.isArray(result?.data) ? result.data : [];
  } catch {
    return [];
  }
}

async function findCorrectWaba() {
  const owned = await getWabas('owned_whatsapp_business_accounts');
  const client = await getWabas('client_whatsapp_business_accounts');

  const candidates = [...owned, ...client];

  const unique = [
    ...new Map(candidates.map((item) => [item.id, item])).values(),
  ];

  for (const waba of unique) {
    const phones = await graph(
      `${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`
    );

    const matched = (phones?.data || []).find(
      (phone) =>
        String(phone.id) === String(EXPECTED_PHONE_NUMBER_ID)
    );

    if (matched) {
      return {
        waba,
        phone: matched,
      };
    }
  }

  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!TOKEN) {
    return res.status(500).json({
      ok: false,
      error: 'META_WHATSAPP_TOKEN não encontrado na Vercel',
    });
  }

  try {
    const found = await findCorrectWaba();

    if (!found) {
      return res.status(404).json({
        ok: false,
        stage: 'find_waba',
        businessId: BUSINESS_ID,
        expectedPhoneNumberId: EXPECTED_PHONE_NUMBER_ID,
        error: 'WABA do número real não encontrado',
      });
    }

    const before = await graph(
      `${found.waba.id}/subscribed_apps?fields=id,name&limit=100`
    );

    const alreadySubscribed = (before?.data || []).some(
      (app) => String(app.id) === String(EXPECTED_APP_ID)
    );

    let applyResult = null;

    if (!alreadySubscribed) {
      applyResult = await graph(
        `${found.waba.id}/subscribed_apps`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
    }

    const after = await graph(
      `${found.waba.id}/subscribed_apps?fields=id,name&limit=100`
    );

    const appSubscribed = (after?.data || []).some(
      (app) => String(app.id) === String(EXPECTED_APP_ID)
    );

    return res.status(200).json({
      ok: true,

      phone: {
        id: found.phone.id,
        number: found.phone.display_phone_number,
        name: found.phone.verified_name,
      },

      waba: {
        id: found.waba.id,
        name: found.waba.name,
      },

      appId: EXPECTED_APP_ID,

      alreadySubscribed,

      applyResult,

      appSubscribed,

      before: before?.data || [],
      after: after?.data || [],

      status: appSubscribed
        ? 'WABA VINCULADO AO APP I.Agro'
        : 'WABA AINDA NÃO VINCULADO',
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
      details: error.details || null,
    });
  }
}
