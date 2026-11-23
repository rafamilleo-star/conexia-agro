// api/agenda-push-cron.js
// Cron diário (08:00, horário de São Paulo). Para cada aparelho inscrito,
// envia um push com as tarefas de hoje e as atrasadas, se houver alguma.
// Push não depende de template da Meta nem da janela de 24 horas do WhatsApp.
// Só manda se a agenda do usuário tiver tarefas abertas com prazo até hoje.

import webpush from 'web-push';
import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contato@conexia.app';
const TZ = 'America/Sao_Paulo';

function hojeISO() {
  const base = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function montarPush(tarefas, hoje) {
  const atrasadas = tarefas.filter((t) => t.prazo < hoje).length;
  const paraHoje = tarefas.filter((t) => t.prazo === hoje).length;
  const partes = [];
  if (paraHoje) partes.push(`${paraHoje} para hoje`);
  if (atrasadas) partes.push(`${atrasadas} atrasada${atrasadas > 1 ? 's' : ''}`);
  const primeira = tarefas[0]?.titulo || '';
  return {
    title: 'Sua agenda de hoje',
    body: `${partes.join(' · ')}. Primeira: ${primeira}`.slice(0, 160),
    url: '/',
  };
}

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'não autorizado' });
    }
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return res.status(500).json({ ok: false, error: 'VAPID não configurado' });
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const hoje = hojeISO();
    const inscricoes = (await sb('push_subscriptions?select=id,user_id,endpoint,p256dh,auth', { method: 'GET' })) || [];
    const porUsuario = new Map();
    for (const i of inscricoes) {
      if (!porUsuario.has(i.user_id)) porUsuario.set(i.user_id, []);
      porUsuario.get(i.user_id).push(i);
    }

    let enviados = 0, semTarefas = 0, removidos = 0, falhas = 0;
    for (const [uid, aparelhos] of porUsuario) {
      const tarefas = (await sb(
        `tasks_agenda?user_id=eq.${uid}&status=neq.feita&prazo=lte.${hoje}&select=titulo,prazo&order=prazo.asc&limit=50`,
        { method: 'GET' }
      )) || [];
      if (tarefas.length === 0) { semTarefas++; continue; }

      const payload = JSON.stringify(montarPush(tarefas, hoje));
      for (const a of aparelhos) {
        try {
          await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, payload, { TTL: 3600 });
          enviados++;
        } catch (err) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await sb(`push_subscriptions?id=eq.${a.id}`, { method: 'DELETE', prefer: 'return=minimal' });
            removidos++;
          } else {
            falhas++;
            console.error('[agenda-push-cron] falha de envio', err?.statusCode, err?.body);
          }
        }
      }
    }

    return res.status(200).json({ ok: true, hoje, enviados, semTarefas, removidos, falhas });
  } catch (err) {
    console.error('[agenda-push-cron] erro:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
