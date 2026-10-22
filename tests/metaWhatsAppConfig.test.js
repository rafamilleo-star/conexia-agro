import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_META_PHONE_NUMBER_ID,
  DEFAULT_META_WABA_ID,
  getMetaWhatsAppConfig,
  assertMetaWhatsAppConfig,
} from '../api/_lib/metaWhatsAppConfig.js';

async function withEnv(values, fn) {
  const names = [
    'META_WHATSAPP_TOKEN',
    'META_PHONE_NUMBER_ID',
    'META_WHATSAPP_PHONE_NUMBER_ID',
    'META_WABA_ID',
    'META_GRAPH_API_VERSION',
    'META_WEBHOOK_VERIFY_TOKEN',
    'WHATSAPP_PROVIDER',
  ];
  const original = Object.fromEntries(
    names.map(name => [name, process.env[name]])
  );

  for (const name of names) delete process.env[name];
  for (const [name, value] of Object.entries(values)) {
    if (value !== undefined) process.env[name] = value;
  }

  try {
    return await fn();
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
  };
}

test('Meta aceita os dois aliases, preserva a precedência e usa defaults conhecidos', () => {
  const primary = getMetaWhatsAppConfig({ META_PHONE_NUMBER_ID: 'primary' });
  assert.equal(primary.phoneNumberId, 'primary');
  assert.equal(primary.phoneNumberIdSource, 'META_PHONE_NUMBER_ID');

  const alias = getMetaWhatsAppConfig({ META_WHATSAPP_PHONE_NUMBER_ID: 'alias' });
  assert.equal(alias.phoneNumberId, 'alias');
  assert.equal(alias.phoneNumberIdSource, 'META_WHATSAPP_PHONE_NUMBER_ID');

  const same = getMetaWhatsAppConfig({
    META_PHONE_NUMBER_ID: 'same',
    META_WHATSAPP_PHONE_NUMBER_ID: 'same',
  });
  assert.equal(same.phoneNumberId, 'same');
  assert.equal(same.phoneNumberIdSource, 'META_PHONE_NUMBER_ID');

  const defaults = getMetaWhatsAppConfig({});
  assert.equal(defaults.phoneNumberId, DEFAULT_META_PHONE_NUMBER_ID);
  assert.equal(defaults.wabaId, DEFAULT_META_WABA_ID);
  assert.equal(defaults.phoneNumberIdConflict, null);
});

test('conflito entre aliases é detectado e nunca seleciona silenciosamente um número', () => {
  const config = getMetaWhatsAppConfig({
    META_PHONE_NUMBER_ID: 'primary',
    META_WHATSAPP_PHONE_NUMBER_ID: 'different',
  });

  assert.equal(config.phoneNumberId, 'primary');
  assert.deepEqual(config.phoneNumberIdConflict, {
    META_PHONE_NUMBER_ID: 'primary',
    META_WHATSAPP_PHONE_NUMBER_ID: 'different',
  });
  assert.throws(
    () => assertMetaWhatsAppConfig(config),
    /Conflito entre META_PHONE_NUMBER_ID e META_WHATSAPP_PHONE_NUMBER_ID/
  );
});

test('provider padrão envia por Meta usando o ID default', async () => {
  await withEnv({ META_WHATSAPP_TOKEN: 'test-token' }, async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url: String(url), options });
      return response({ messages: [{ id: 'message-id' }] });
    };

    try {
      const { getWhatsAppProvider } = await import(
        '../api/_lib/relationshipAssistant/whatsappSender.js?meta-default-test'
      );
      const result = await getWhatsAppProvider().sendMessage({
        number: '+5511999999999',
        text: 'teste offline',
      });

      assert.equal(result.ok, true);
      assert.equal(result.channel, 'meta');
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.includes(
        `/v26.0/${DEFAULT_META_PHONE_NUMBER_ID}/messages`
      ));
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('provider legacy webhook retorna erro explícito e não chama Twilio/Evolution', async () => {
  await withEnv({
    META_WHATSAPP_TOKEN: 'test-token',
    WHATSAPP_PROVIDER: 'webhook',
  }, async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error('não deveria chamar transporte legacy');
    };

    try {
      const { getWhatsAppProvider } = await import(
        '../api/_lib/relationshipAssistant/whatsappSender.js?legacy-disabled-test'
      );
      const result = await getWhatsAppProvider().sendMessage({
        number: '+5511999999999',
        text: 'não enviar',
      });

      assert.equal(result.ok, false);
      assert.equal(result.error, 'legacy_whatsapp_provider_disabled');
      assert.match(result.configurationError, /WHATSAPP_PROVIDER=webhook/);
      assert.equal(calls, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

async function runDiagnosis(platformType, queryTag) {
  return withEnv({ META_WHATSAPP_TOKEN: 'test-token' }, async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async url => {
      const value = String(url);
      calls.push(value);
      if (value.includes('fields=is_on_biz_app,platform_type')) {
        return response({ is_on_biz_app: true, platform_type: platformType });
      }
      if (value.includes('/subscribed_apps')) {
        return response({ data: [] });
      }
      return response({
        id: DEFAULT_META_PHONE_NUMBER_ID,
        display_phone_number: '+55 11 98863-0785',
      });
    };

    try {
      const { default: handler } = await import(
        `../api/meta-fix-waba-subscription.js?${queryTag}`
      );
      const res = mockResponse();
      await handler({ method: 'GET' }, res);
      return { res, calls };
    } finally {
      global.fetch = originalFetch;
    }
  });
}

test('diagnóstico ON_PREMISE sinaliza não pronto e orienta provisionamento', async () => {
  const { res, calls } = await runDiagnosis('ON_PREMISE', 'on-premise-diagnosis-test');
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 3);
  assert.equal(res.body.coexistence_ready, false);
  assert.match(res.body.provisioning_guidance, /onboarding de coexistência/i);
  assert.match(res.body.provisioning_guidance, /não exclua, desregistre/i);
});

test('diagnóstico CLOUD_API sinaliza coexistência pronta sem orientação de conversão', async () => {
  const { res, calls } = await runDiagnosis('CLOUD_API', 'cloud-api-diagnosis-test');
  assert.equal(res.statusCode, 200);
  assert.equal(calls.length, 3);
  assert.equal(res.body.coexistence_ready, true);
  assert.equal(res.body.provisioning_guidance, null);
});

test('meta-fix aceita somente GET e não chama a Meta em POST', async () => {
  await withEnv({ META_WHATSAPP_TOKEN: 'test-token' }, async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => {
      calls++;
      throw new Error('não deveria consultar em POST');
    };

    try {
      const { default: handler } = await import(
        '../api/meta-fix-waba-subscription.js?post-method-test'
      );
      const res = mockResponse();
      await handler({ method: 'POST' }, res);
      assert.equal(res.statusCode, 405);
      assert.equal(calls, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('diagnóstico não declara pronto se a consulta Meta falhar mesmo contendo campos CLOUD_API', async () => {
  await withEnv({ META_WHATSAPP_TOKEN: 'test-token' }, async () => {
    const originalFetch = global.fetch;
    global.fetch = async () => response({
      is_on_biz_app: true,
      platform_type: 'CLOUD_API',
      error: { code: 2, message: 'upstream indisponível' },
    }, 500);
    try {
      const { default: handler } = await import(
        '../api/meta-fix-waba-subscription.js?upstream-error-diagnosis-test'
      );
      const res = mockResponse();
      await handler({ method: 'GET' }, res);
      assert.equal(res.body.coexistence_ready, false);
      assert.equal(res.body.coexistence.ok, false);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('provider desconhecido informa configuração inválida e não usa nenhum transporte', async () => {
  await withEnv({ WHATSAPP_PROVIDER: 'metaa' }, async () => {
    const originalFetch = global.fetch;
    let calls = 0;
    global.fetch = async () => { calls++; throw new Error('não chamar rede'); };
    try {
      const { getWhatsAppProvider } = await import(
        '../api/_lib/relationshipAssistant/whatsappSender.js?invalid-provider-test'
      );
      const provider = getWhatsAppProvider();
      const result = await provider.sendMessage({ number: '+5511999999999', text: 'teste' });
      const templateResult = await provider.sendTemplate({ number: '+5511999999999', templateName: 'test' });
      assert.equal(result.error, 'unsupported_whatsapp_provider');
      assert.equal(templateResult.error, 'unsupported_whatsapp_provider');
      assert.equal(calls, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

test('provider Meta normaliza caixa e espaços sem mudar de canal', async () => {
  await withEnv({ WHATSAPP_PROVIDER: ' Meta ', META_WHATSAPP_TOKEN: 'test-token' }, async () => {
    const originalFetch = global.fetch;
    const calls = [];
    global.fetch = async url => {
      calls.push(String(url));
      return response({ messages: [{ id: 'test-message' }] });
    };
    try {
      const { getWhatsAppProvider } = await import(
        '../api/_lib/relationshipAssistant/whatsappSender.js?normalized-provider-test'
      );
      const result = await getWhatsAppProvider().sendMessage({ number: '+5511999999999', text: 'teste' });
      assert.equal(result.channel, 'meta');
      assert.equal(result.ok, true);
      assert.equal(calls.length, 1);
      assert.ok(calls[0].startsWith('https://graph.facebook.com/'));
    } finally {
      global.fetch = originalFetch;
    }
  });
});
