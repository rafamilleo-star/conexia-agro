import { createClient } from '@supabase/supabase-js';
import { loadRelationshipData } from '../shared/relationshipData.js';
import { computeRelationshipIntelligence } from '../shared/relationshipIntelligence.js';
// api/relationship-attention-cron.js
// Job: scan-relationships-needing-attention
//
// Para cada usuário PRO (recurso hoje gated como PRO, igual contact_coaching/
// query_insights no webhook — ver ENGENHARIA abaixo), calcula a ação de maior
// prioridade do dia e, se houver uma relevante, envia como RELATIONSHIP_ATTENTION.
// O limite de 1 mensagem automática/dia (em sendProactiveNotification) já
// impede que isso conflite com onboarding/inatividade/resumo semanal no
// mesmo dia — quem já recebeu algo hoje simplesmente não recebe este também.

import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { relationshipAttentionMessage } from './_lib/relationshipAssistant/messages.js';
import { localDateISO } from './_lib/relationshipAssistant/timeWindow.js';

const CRON_SECRET = process.env.CRON_SECRET || '';
// Só dispara mensagem proativa quando a prioridade calculada é alta o
// suficiente — evita notificar por qualquer coisa marginal.
const MIN_PRIORITY_TO_NOTIFY = Number(process.env.RELATIONSHIP_ATTENTION_MIN_PRIORITY || 85);

export default async function handler(req, res) {
  try {
    if (!CRON_SECRET) return res.status(503).json({ ok: false, error: 'CRON_SECRET ausente' });
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const db = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co',
      process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const perfis = [];
    for (let offset = 0; ; offset += 500) {
      const result = await db.from('profiles').select('*').eq('onboarding_completed', true)
        .eq('is_pro', true).not('whatsapp', 'is', null).order('id').range(offset, offset + 499);
      if (result.error) throw result.error;
      perfis.push(...(result.data || []));
      if (!result.data || result.data.length < 500) break;
    }
    const dryRun = req.query?.dry_run === '1';
    let enviados = 0, pulados = 0, semAcao = 0, falhas = 0, relevantes = 0;
    for (const profile of perfis) {
      try {
      const raw = await loadRelationshipData(db, profile.id);
      const intelligence = computeRelationshipIntelligence(raw);
      const top = intelligence.main ? { ...intelligence.main, priority: intelligence.main.score } : null;
      if (!top || top.priority < MIN_PRIORITY_TO_NOTIFY) { semAcao++; continue; }

      relevantes++;
      if (dryRun) continue;
      const todayISO = localDateISO(profile.timezone);
      const text = relationshipAttentionMessage({
        firstName: profile.first_name,
        contactName: top.contactName,
        reason: top.reason,
      });

      const result = await sendProactiveNotification({
        profile,
        notificationType: 'RELATIONSHIP_ATTENTION',
        relationshipId: top.relationshipId,
        scopeKey: `${top.recommendationId}:${todayISO}`,
        text,
      });
      if (result.sent) enviados++; else pulados++;
      } catch (error) { falhas++; console.error('[relationship-attention-cron] usuário:', profile.id, error.message); }
    }

    return res.status(200).json({ ok: falhas === 0, dryRun, avaliados: perfis.length, enviados, pulados, semAcao, relevantes, falhas });
  } catch (err) {
    console.error('[relationship-attention-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
