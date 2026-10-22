import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const FIXED_NOW = '2025-03-15T15:00:00.000Z';
const RealDate = globalThis.Date;
const originalFetch = globalThis.fetch;

process.env.SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_KEY = 'service-key-for-test';
process.env.META_WHATSAPP_TOKEN = 'meta-token-for-test';
process.env.META_PHONE_NUMBER_ID = 'phone-number-id-for-test';
process.env.META_GRAPH_API_VERSION = 'v20.0';
process.env.WHATSAPP_PROVIDER = 'meta';
process.env.CRON_SECRET = 'cron-secret-for-test';

globalThis.Date = class FixedDate extends RealDate {
  constructor(...args) {
    super(args.length ? args[0] : FIXED_NOW);
  }

  static now() {
    return RealDate.parse(FIXED_NOW);
  }
};

const { default: handler } = await import('../api/whatsapp-reminder-cron.js?whatsapp-reminder-meta-tests');

const baseProfile = {
  id: 'user-1',
  whatsapp: '+5511999999999',
  first_name: 'Pessoa',
  name: 'Pessoa Teste',
  is_pro: true,
  plan: 'pro',
  pro_expires_at: null,
  whatsapp_trial_started_at: null,
  timezone: 'UTC',
  notifications_enabled: true,
  weekly_summary_enabled: true,
  whatsapp_opt_in: true,
};

const pendingContact = {
  id: 'contact-1',
  user_id: 'user-1',
  name: 'Contato Teste',
  next_action: 'Ligar',
  next_action_date: '2025-03-15',
};

let scenario;

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeResponseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function request() {
  return { headers: { authorization: 'Bearer cron-secret-for-test' } };
}

function installFetch({ metaStatus = 200, optIn = true } = {}) {
  scenario = {
    calls: [],
    contactPatches: [],
    notificationLogPatches: [],
    metaCalls: [],
    profile: { ...baseProfile, whatsapp_opt_in: optIn },
  };

  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || 'GET';
    scenario.calls.push({ url, method, options });

    if (url.includes('/rest/v1/contacts?') && url.includes('next_action_date=lte.')) {
      return jsonResponse([pendingContact]);
    }
    if (url.includes('/rest/v1/contacts?') && url.includes('birthday=not.is.null')) {
      return jsonResponse([]);
    }
    if (url.includes('/rest/v1/profiles?')) {
      return jsonResponse([scenario.profile]);
    }
    if (url.includes('/rest/v1/notification_log')) {
      if (method === 'POST') return jsonResponse([{ id: 'notification-log-1' }]);
      if (method === 'PATCH') {
        scenario.notificationLogPatches.push({ url, options });
        return jsonResponse([]);
      }
      return jsonResponse([]);
    }
    if (url.includes('/rest/v1/contacts?id=eq.')) {
      scenario.contactPatches.push({ url, options });
      return jsonResponse([]);
    }
    if (url.startsWith('https://graph.facebook.com/')) {
      scenario.metaCalls.push({ url, options });
      if (metaStatus !== 200) {
        return jsonResponse({ error: { message: 'Meta provider failure for test', code: 131000 } }, metaStatus);
      }
      return jsonResponse({ messages: [{ id: 'wamid.test-success' }] });
    }

    throw new Error(`Unexpected fetch in offline test: ${method} ${url}`);
  };
}

beforeEach(() => {
  installFetch();
});

after(() => {
  globalThis.fetch = originalFetch;
  globalThis.Date = RealDate;
});

test('envia lembrete pela Meta e marca next_action somente após sent=true', async () => {
  const response = makeResponseRecorder();
  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    enviados: 1,
    falhas: 0,
    falhas_por_motivo: {},
  });
  assert.equal(scenario.metaCalls.length, 1);
  assert.equal(scenario.contactPatches.length, 1);
  assert.equal(scenario.notificationLogPatches.length, 1);

  const metaRequest = scenario.metaCalls[0];
  assert.match(metaRequest.url, /graph\.facebook\.com\/v20\.0\/phone-number-id-for-test\/messages$/);
  assert.equal(metaRequest.options.headers.Authorization, 'Bearer meta-token-for-test');
  assert.equal(metaRequest.options.body.includes('Ligar'), true);
  assert.equal(scenario.calls.some(({ url }) => url.includes('twilio.com')), false);
  assert.equal(scenario.calls.some(({ url }) => url.includes('evolution')), false);

  const profileQuery = scenario.calls.find(({ url }) => url.includes('/rest/v1/profiles?'))?.url;
  assert.match(profileQuery, /timezone,notifications_enabled,weekly_summary_enabled,whatsapp_opt_in/);

  const scheduled = scenario.calls.find(({ url, method }) => url.endsWith('/rest/v1/notification_log') && method === 'POST');
  const scheduledBody = JSON.parse(scheduled.options.body);
  assert.equal(scheduledBody.notification_type, 'NEXT_BEST_ACTION');
  assert.equal(scheduledBody.idempotency_key, 'NEXT_BEST_ACTION:user-1:next-action:contact-1:2025-03-15');
});

test('falha Meta retorna 500, não marca contato e não faz fallback', async () => {
  installFetch({ metaStatus: 400 });
  const response = makeResponseRecorder();
  await handler(request(), response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.enviados, 0);
  assert.equal(response.body.falhas, 1);
  assert.equal(response.body.falhas_por_motivo.provider_failed, 1);
  assert.equal(scenario.metaCalls.length, 1);
  assert.equal(scenario.contactPatches.length, 0);
  assert.equal(scenario.calls.some(({ url }) => url.includes('twilio.com')), false);
  assert.equal(scenario.calls.some(({ url }) => url.includes('evolution')), false);
  assert.equal(scenario.notificationLogPatches.length, 1);
});

test('opt-out é respeitado, informa a razão e não tenta Meta nem marca contato', async () => {
  installFetch({ optIn: false });
  const response = makeResponseRecorder();
  await handler(request(), response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    ok: true,
    enviados: 0,
    falhas: 1,
    falhas_por_motivo: { no_opt_in: 1 },
  });
  assert.equal(scenario.metaCalls.length, 0);
  assert.equal(scenario.contactPatches.length, 0);
  assert.equal(scenario.notificationLogPatches.length, 0);
});
