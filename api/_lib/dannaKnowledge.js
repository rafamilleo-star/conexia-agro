import { createClient } from '@supabase/supabase-js';
import { loadRelationshipData } from '../../shared/relationshipData.js';
import { computeRelationshipIntelligence } from '../../shared/relationshipIntelligence.js';
import { loadDannaAppKnowledge, selectDannaHistory, buildDannaReadPrompt } from '../../shared/dannaAppKnowledge.js';
import { resolveDannaContact } from '../../shared/dannaCapabilities.js';

export const DANNA_READ_INTENTS = new Set(['briefing', 'contact_coaching', 'query_last_interaction',
  'relationship_history_summary', 'query_data_simple', 'query_data_analysis', 'query_health',
  'query_next_actions', 'query_insights', 'query_contacts', 'query_app']);
const PRO_READ_INTENTS = new Set(['briefing', 'contact_coaching', 'query_last_interaction',
  'relationship_history_summary', 'query_data_analysis', 'query_insights']);
const PERSON_INTENTS = new Set(['briefing', 'contact_coaching', 'query_last_interaction', 'relationship_history_summary']);

// Chamado somente depois da validação do webhook e da resolução da conta pelo canal.
// Mesmo com service_role, cada consulta de registros usa o userId resolvido.
export async function answerDannaReadIntent(intent, { userId, question, isPro, generate, db: suppliedDb }) {
  if (!DANNA_READ_INTENTS.has(intent.intent)) return { handled: false };
  if (!userId) throw new Error('Conta não identificada.');
  if (PRO_READ_INTENTS.has(intent.intent) && !isPro) return { handled: true, answer: 'Essa análise é um recurso PRO. Você pode consultar seus contatos e próximos passos com os recursos disponíveis na conta.' };
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!suppliedDb && (!url || !key)) throw new Error('Contexto do CONÉXIA indisponível.');
  const db = suppliedDb || createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date();
  const raw = await loadRelationshipData(db, userId, now);
  const selected = resolveDannaContact(intent.contact_name, raw.contacts);
  if (PERSON_INTENTS.has(intent.intent) && !selected.contact) return { handled: true, answer: selected.candidates.length > 1
    ? `Qual pessoa: ${selected.candidates.map(c => [c.name, c.company].filter(Boolean).join(' — ')).join('; ')}? Diga o nome completo e a empresa.`
    : 'Diga o nome de uma pessoa cadastrada para eu consultar o histórico correto.' };
  const app = await loadDannaAppKnowledge(db, userId, { raw, isPro, allowOrganization: false, now });
  app.capabilities = app.capabilities.map(c => c.id === 'rehearsal' ? { ...c, available: false, availableIn: 'Danna do aplicativo' } : c);
  const intelligence = computeRelationshipIntelligence(raw, now);
  const prompt = buildDannaReadPrompt({ question, contacts: raw.contacts, intelligence, appKnowledge: app,
    history: selectDannaHistory(selected.contact ? `${question} Sobre ${selected.contact.name}` : question, raw.contacts, raw.interactions), channel: 'whatsapp',
    context: {
      events: raw.events.map(e => ({ person: raw.contacts.find(c => c.id === e.contact_id)?.name || null,
        type: e.type, at: e.scheduled_at, status: e.status, location: e.location, notes: e.notes })),
      memories: raw.memories.map(m => ({ person: raw.contacts.find(c => c.id === m.contact_id)?.name || null,
        content: m.content, summary: m.summary, confidence: m.confidence, validUntil: m.valid_until,
        confirmed: m.metadata?.confirmed === true, completed: m.metadata?.completed === true })),
    },
  });
  const answer = await generate(prompt, 700);
  return { handled: true, contactId: selected.contact?.id || null, answer: answer?.trim() || 'Não consegui produzir a análise agora. Seus registros continuam preservados; tente novamente.' };
}
