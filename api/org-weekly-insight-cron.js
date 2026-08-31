// api/org-weekly-insight-cron.js
// Job: generate-org-weekly-insight
//
// Roda 1x/semana (Vercel Cron), depois do relationship-weekly-summary-cron
// já ter escrito o dimension_observation da semana de cada usuário.
// Pré-computa a análise de IA agregada de cada organização e guarda em
// org_ai_insights — o admin abre a aba "Empresa" e a análise já está lá,
// sem precisar clicar em "Gerar análise".
//
// Mesmo guardrail de privacidade de get_org_team_overview/get_org_team_trend:
// só gera análise pra organização com >=3 pessoas com dado naquela semana.
// A IA nunca recebe nome nem dado de nenhuma pessoa — só percentuais e
// totais agregados da equipe inteira.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://goopogicgwqqovmphqrj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET || '';

const DIMENSION_LABELS = {
  intencao_estrategica: 'Estratégia',
  escuta_relacional: 'Empatia',
  presenca_mercado: 'Presença',
  reciprocidade_ativa: 'Reciprocidade',
  ritual_consistencia: 'Consistência',
  confianca_autentica: 'Autenticidade',
};

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: opts.prefer || 'return=representation',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function logDebug(row) {
  if (!SUPABASE_SERVICE_KEY) return;
  try {
    await sb('ai_debug_log', { method: 'POST', prefer: 'return=minimal', body: JSON.stringify(row) });
  } catch (_) { /* logging nunca derruba o cron */ }
}

// Mesma fórmula de isoWeek usada em relationship-weekly-summary-cron.js —
// precisa bater com o número gravado em plan_insights.week.
function computeIsoWeek(now) {
  return Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));
}

function buildPrompt({ memberCount, perDimPct, activity }) {
  const dimLines = Object.entries(perDimPct)
    .map(([dim, p]) => `- ${DIMENSION_LABELS[dim] || dim}: ${p.evoluindo}% evoluindo, ${p.estavel}% estável, ${p.perdendo_intensidade}% perdendo intensidade`)
    .join('\n');
  const activityLine = activity
    ? `\nAtividade da equipe: ${activity.totalContacts} contatos na carteira somada, ${activity.totalLast30d} interações nos últimos 30 dias (${activity.totalInteractions} no histórico total), ${activity.totalCooling} contas esfriando (60+ dias sem interação).`
    : '';
  return `Você é um consultor de inteligência relacional (metodologia CONÉXIA) analisando o estado agregado e ANÔNIMO de uma equipe comercial de agronegócio, medido em 6 dimensões relacionais e em volume de atividade. Você não recebe nome nem dado de nenhuma pessoa — só percentuais e totais da equipe inteira.

Dados desta semana (${memberCount} pessoas com dado comportamental computado):
${dimLines}
${activityLine}

Escreva uma análise executiva curta para o gestor da equipe, em português, tom consultivo e direto, 4 a 6 frases corridas (sem bullet points, sem markdown):
1. Qual é o padrão mais forte da equipe e o que isso indica sobre como ela constrói relações.
2. Qual dimensão merece atenção e por que isso importa comercialmente.
3. Cruze com a atividade: se há contas esfriando ou baixa atividade recente, comente o risco disso combinado com o padrão comportamental.
4. Uma recomendação prática e específica de ação para a próxima semana.
Não invente números além dos fornecidos. Não mencione nomes — você não tem acesso a nenhum.`;
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(data)}`);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers['authorization'] || '';
    if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  if (!SUPABASE_SERVICE_KEY) return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
  if (!GEMINI_KEY) return res.status(200).json({ ok: false, error: 'GEMINI_API_KEY ausente' });

  const isoWeek = computeIsoWeek(new Date());
  const results = { processed: 0, skipped: 0, errors: 0 };

  try {
    const orgs = await sb('organizations?select=id,name');

    for (const org of orgs || []) {
      try {
        const members = await sb(
          `profiles?organization_id=eq.${org.id}&org_role=eq.membro&org_consent_status=eq.accepted&select=id`
        );
        if (!members || members.length < 3) { results.skipped++; continue; }
        const memberIds = members.map((m) => m.id);
        const idsList = memberIds.join(',');

        const [insights, contacts, interactions] = await Promise.all([
          sb(`plan_insights?user_id=in.(${idsList})&insight_type=eq.dimension_observation&select=user_id,week,description&order=week.desc`),
          sb(`contacts?user_id=in.(${idsList})&select=user_id,last_interaction_at,last_interaction`),
          sb(`interactions?user_id=in.(${idsList})&select=user_id,created_at,value_generated`),
        ]);

        // Última observação por usuário (a primeira ocorrência já é a mais
        // recente, por causa do order=week.desc acima).
        const latestByUser = {};
        for (const row of insights || []) {
          if (!latestByUser[row.user_id]) latestByUser[row.user_id] = row;
        }
        const dimRows = Object.values(latestByUser);
        if (dimRows.length < 3) { results.skipped++; continue; }

        const perDim = {};
        for (const row of dimRows) {
          let obs = {};
          try { obs = JSON.parse(row.description) || {}; } catch { obs = {}; }
          for (const [dim, entry] of Object.entries(obs)) {
            const state = entry?.state;
            if (!perDim[dim]) perDim[dim] = { evoluindo: 0, estavel: 0, perdendo_intensidade: 0, total: 0 };
            if (perDim[dim][state] !== undefined) perDim[dim][state] += 1;
            perDim[dim].total += 1;
          }
        }
        const perDimPct = {};
        for (const [dim, c] of Object.entries(perDim)) {
          perDimPct[dim] = {
            evoluindo: c.total ? Math.round((c.evoluindo / c.total) * 100) : 0,
            estavel: c.total ? Math.round((c.estavel / c.total) * 100) : 0,
            perdendo_intensidade: c.total ? Math.round((c.perdendo_intensidade / c.total) * 100) : 0,
          };
        }

        const now = Date.now();
        const cooling60 = now - 60 * 86400000;
        const last30 = now - 30 * 86400000;
        const contactsByUser = {};
        for (const c of contacts || []) {
          contactsByUser[c.user_id] = contactsByUser[c.user_id] || { total: 0, cooling: 0 };
          contactsByUser[c.user_id].total += 1;
          const lastAt = c.last_interaction_at || c.last_interaction;
          if (!lastAt || new Date(lastAt).getTime() < cooling60) contactsByUser[c.user_id].cooling += 1;
        }
        let totalContacts = 0, totalCooling = 0;
        for (const v of Object.values(contactsByUser)) { totalContacts += v.total; totalCooling += v.cooling; }

        let totalInteractions = 0, totalLast30d = 0;
        for (const i of interactions || []) {
          totalInteractions += 1;
          if (i.created_at && new Date(i.created_at).getTime() > last30) totalLast30d += 1;
        }

        const prompt = buildPrompt({
          memberCount: dimRows.length,
          perDimPct,
          activity: { totalContacts, totalCooling, totalInteractions, totalLast30d },
        });
        const insightText = await callGemini(prompt);
        if (!insightText) { results.errors++; continue; }

        await sb(`org_ai_insights?on_conflict=organization_id,week`, {
          method: 'POST',
          prefer: 'resolution=merge-duplicates,return=minimal',
          body: JSON.stringify({
            organization_id: org.id,
            week: isoWeek,
            insight_text: insightText,
            member_count: dimRows.length,
          }),
        });
        results.processed++;
      } catch (orgErr) {
        results.errors++;
        await logDebug({
          endpoint: 'org-weekly-insight-cron',
          ok: false,
          http_status: 500,
          finish_reason: 'org_exception',
          text_length: 0,
          prompt_preview: `org=${org.id}`,
          response_preview: orgErr.message,
          raw_gemini: null,
        });
      }
    }

    return res.status(200).json({ ok: true, week: isoWeek, ...results });
  } catch (error) {
    await logDebug({
      endpoint: 'org-weekly-insight-cron',
      ok: false,
      http_status: 500,
      finish_reason: 'exception',
      text_length: 0,
      prompt_preview: '',
      response_preview: error.message,
      raw_gemini: null,
    });
    return res.status(500).json({ ok: false, error: error.message });
  }
}
