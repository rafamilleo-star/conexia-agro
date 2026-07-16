// api/stripe-webhook.js
// Recebe eventos da Stripe (checkout, ciclo de vida da assinatura, faturas)
// e mantém o status de assinatura PRO em sincronia no Supabase.
//
// Configuração necessária no Dashboard da Stripe:
//   1. Developers → Webhooks → Add endpoint
//   2. URL: https://conexia-agro-chi.vercel.app/api/stripe-webhook
//   3. Eventos a escutar:
//        - checkout.session.completed
//        - customer.subscription.created
//        - customer.subscription.updated
//        - customer.subscription.deleted
//        - invoice.payment_succeeded
//        - invoice.payment_failed
//   4. Copiar o "Signing secret" (whsec_...) para a env var STRIPE_WEBHOOK_SECRET no Vercel
//
// Variáveis de ambiente necessárias no Vercel:
//   STRIPE_SECRET_KEY      — chave secreta da Stripe (sk_live_... em produção)
//   STRIPE_WEBHOOK_SECRET  — signing secret do endpoint configurado acima
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY

import Stripe from 'stripe';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase ${opts.method || 'GET'} ${path} falhou: ${res.status} ${text}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

// Lê o corpo bruto da requisição sem deixar nada reprocessar/reserializar —
// a verificação de assinatura da Stripe exige os bytes exatamente como
// chegaram, senão a assinatura não bate (erro clássico "Webhook Error:
// No signatures found matching the expected signature").
async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Confirma que o event.id ainda não foi processado pra essa assinatura.
// A Stripe pode reentregar o mesmo evento mais de uma vez (é o comportamento
// documentado, não é bug) — isso evita reprocessar/gravar duas vezes por acaso.
// O upsert abaixo já seria seguro reaplicar de qualquer forma (é idempotente
// por natureza, mesmo sem essa checagem), mas isso deixa explícito e evita
// trabalho à toa.
async function alreadyProcessed(subscriptionId, eventId) {
  if (!subscriptionId || !eventId) return false;
  const rows = await sb(`stripe_subscriptions?stripe_subscription_id=eq.${subscriptionId}&select=last_processed_event_id&limit=1`);
  return rows?.[0]?.last_processed_event_id === eventId;
}

// Ativa o PRO no profile do usuário e grava/atualiza o registro de assinatura.
async function upsertSubscription({ userId, customerId, subscriptionId, priceId, status, currentPeriodEnd, cancelAtPeriodEnd, eventId }) {
  const isActive = status === 'active' || status === 'trialing';

  // 1) Registro de status da assinatura (histórico completo)
  const existing = await sb(`stripe_subscriptions?stripe_subscription_id=eq.${subscriptionId}&select=id`);
  if (existing?.length) {
    await sb(`stripe_subscriptions?stripe_subscription_id=eq.${subscriptionId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status, stripe_price_id: priceId, current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd, last_processed_event_id: eventId,
        updated_at: new Date().toISOString(),
      }),
    });
  } else {
    await sb('stripe_subscriptions', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId, status, current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd, last_processed_event_id: eventId,
      }),
    });
  }

  // 2) Estado "atual" no profile — é o que o app já lê hoje (isProUser)
  await sb(`profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      is_pro: isActive,
      plan: isActive ? 'pro' : 'free',
      pro_access_source: 'stripe',
      pro_expires_at: currentPeriodEnd,
      stripe_customer_id: customerId,
    }),
  });
}

// Para eventos que não têm o user_id direto (ex.: subscription.updated
// disparado bem depois do checkout inicial) — localiza o usuário pelo
// customer_id já associado numa assinatura anterior.
async function findUserIdByCustomerId(customerId) {
  const rows = await sb(`stripe_subscriptions?stripe_customer_id=eq.${customerId}&select=user_id&limit=1`);
  if (rows?.[0]?.user_id) return rows[0].user_id;
  const profiles = await sb(`profiles?stripe_customer_id=eq.${customerId}&select=id&limit=1`);
  return profiles?.[0]?.id || null;
}

// Antifraude: um client_reference_id só é aceito se corresponder a um usuário
// real do Supabase. Sem isso, alguém poderia em tese forjar um checkout com
// um client_reference_id qualquer torcendo pra ativar PRO em outra conta —
// na prática o pagamento em si sempre é real (é a Stripe verificando), mas
// não custa nada confirmar que o destino da ativação existe de verdade antes
// de escrever qualquer coisa.
async function isValidUserId(userId) {
  if (!userId) return false;
  const rows = await sb(`profiles?id=eq.${userId}&select=id&limit=1`);
  return !!rows?.[0]?.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET não configurados no Vercel.');
    // Responde 200 pra Stripe não ficar re-tentando indefinidamente enquanto a config não sai do lugar,
    // mas registra o erro claramente nos logs — nada disso deveria acontecer em produção configurada.
    return res.status(200).json({ ok: false, error: 'webhook não configurado' });
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const signature = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] assinatura inválida:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.client_reference_id;
        if (!userId) {
          console.error('[stripe-webhook] checkout.session.completed sem client_reference_id — não sei associar a nenhum usuário. session:', session.id);
          break;
        }
        if (!(await isValidUserId(userId))) {
          console.error('[stripe-webhook] client_reference_id não corresponde a nenhum usuário real do Supabase — ignorando por segurança. userId recebido:', userId, 'session:', session.id);
          break;
        }
        if (session.mode !== 'subscription' || !session.subscription) {
          console.warn('[stripe-webhook] checkout.session.completed fora do fluxo de assinatura, ignorando. session:', session.id);
          break;
        }
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        if (await alreadyProcessed(subscription.id, event.id)) { console.log('[stripe-webhook] evento já processado, ignorando:', event.id); break; }
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        await upsertSubscription({
          userId,
          customerId: session.customer,
          subscriptionId: subscription.id,
          priceId,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          eventId: event.id,
        });
        break;
      }

      // subscription.created cobre o caso raro de uma assinatura nascer fora
      // do fluxo de checkout (ex.: criada manualmente no Dashboard da Stripe).
      // Se o customer ainda não tiver passado por um checkout.session.completed
      // antes, não vamos achar o usuário — e está tudo bem, é esperado: nesse
      // caso o checkout.session.completed (que chega separadamente) resolve.
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        if (await alreadyProcessed(subscription.id, event.id)) { console.log('[stripe-webhook] evento já processado, ignorando:', event.id); break; }
        const userId = await findUserIdByCustomerId(subscription.customer);
        if (!userId) {
          console.error('[stripe-webhook] não encontrei o usuário do Supabase pra este customer_id:', subscription.customer, '— assinatura:', subscription.id, '— evento:', event.type);
          break;
        }
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : subscription.status;
        await upsertSubscription({
          userId,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          priceId,
          status,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          eventId: event.id,
        });
        break;
      }

      // invoice.payment_succeeded — sinal mais preciso de renovação: confirma
      // que a cobrança realmente passou e atualiza current_period_end.
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription) break; // fatura avulsa, não é de assinatura — ignora
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        if (await alreadyProcessed(subscription.id, event.id)) { console.log('[stripe-webhook] evento já processado, ignorando:', event.id); break; }
        const userId = await findUserIdByCustomerId(subscription.customer);
        if (!userId) {
          console.error('[stripe-webhook] invoice.payment_succeeded sem usuário correspondente. customer:', subscription.customer);
          break;
        }
        const priceId = subscription.items?.data?.[0]?.price?.id || null;
        await upsertSubscription({
          userId,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
          priceId,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null,
          cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
          eventId: event.id,
        });
        break;
      }

      // invoice.payment_failed — NÃO derruba o PRO na hora. A Stripe já tem
      // tentativa automática de nova cobrança (dunning); só registramos o
      // status pra você acompanhar. Se todas as tentativas falharem de vez,
      // a Stripe emite customer.subscription.updated com status=past_due/
      // unpaid (ou subscription.deleted, dependendo da config), e aí sim o
      // PRO é desativado pelo case correspondente acima.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;
        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const userId = await findUserIdByCustomerId(subscription.customer);
        if (!userId) {
          console.error('[stripe-webhook] invoice.payment_failed sem usuário correspondente. customer:', subscription.customer);
          break;
        }
        console.warn('[stripe-webhook] pagamento falhou — usuário:', userId, '— assinatura:', subscription.id, '— próxima tentativa automática pela Stripe.');
        // Só atualiza o status no histórico (stripe_subscriptions), sem tocar em profiles.is_pro.
        await sb(`stripe_subscriptions?stripe_subscription_id=eq.${subscription.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: subscription.status, last_processed_event_id: event.id, updated_at: new Date().toISOString() }),
        }).catch((e) => console.error('[stripe-webhook] falha ao registrar invoice.payment_failed:', e.message));
        break;
      }

      default:
        // Outros eventos não estão na lista que configuramos no Dashboard da Stripe — não deveriam chegar aqui.
        break;
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[stripe-webhook] erro processando evento', event.type, ':', e.message);
    // Diferente do webhook do WhatsApp: aqui retornamos erro (500) de propósito.
    // A Stripe re-tenta automaticamente entregas que não recebem 2xx (por até
    // alguns dias, com backoff) — é exatamente o comportamento que queremos se
    // uma falha transitória do Supabase impedir a gravação: sem isso, um
    // pagamento real poderia nunca ativar o PRO, silenciosamente.
    return res.status(500).json({ received: false, error: e.message });
  }
}
