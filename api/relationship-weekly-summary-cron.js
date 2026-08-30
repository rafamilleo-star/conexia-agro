// api/relationship-weekly-summary-cron.js
// Job: generate-weekly-summaries
//
// Roda todo dia (via Vercel Cron), mas só processa de fato os usuários para
// quem hoje é segunda-feira NO TIMEZONE DELES — assim funciona corretamente
// mesmo que todo o time esteja hoje em América/São_Paulo, sem travar a
// arquitetura num único fuso caso a base internacionalize no futuro.
//
// Não inventa dado quando não há informação suficiente — usa a mensagem
// "semana leve" nesse caso (ver messages.js).

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { sendProactiveNotification } from './_lib/relationshipAssistant/sendProactiveNotification.js';
import { weeklySummaryOpeningMessage, weeklySummaryBodyMessage } from './_lib/relationshipAssistant/messages.js';
import { computeWeeklyAttentionItems, computeNextBestActions } from './_lib/relationshipAssistant/actionEngine.js';
import { isMonday, localDateISO } from './_lib/relationshipAssistant/timeWindow.js';
import { computeWeeklyEvolution } from './_lib/relationshipAssistant/explainabilityEngine.js';
import { detectPatterns } from '../shared/relationshipPatternDetector.js';
import { computeObservedDimensions } from '../shared/dimensionObservation.js';
import { computeContactFrequencyStats } from '../shared/contactHealth.js';
import { buildFeedbackMap } from '../shared/alertsFeedback.js';
import { computeTeamStats, computeTeamAlerts } from '../shared/orgTeamStats.js';

const CRON_SECRET = process.env.CRON_SECRET || '';

// Janela de sinais para a Carta de Evolução ("Meu Perfil"). Independente do
// envio de WhatsApp acima — roda para todo usuário com assessment concluído,
// tenha ou não WhatsApp configurado, porque é uma feature do app, não do
// canal de notificação.
async function computeSignalsForWindow(userId, contactIds, startISO, endISO) {
  const [weekInteractions, newContacts, stepsCompleted] = await Promise.all([
    sb(`interactions?user_id=eq.${userId}&created_at=gte.${startISO}&created_at=lt.${endISO}&select=id,contact_id,created_at,value_generated`),
    sb(`contacts?user_id=eq.${userId}&created_at=gte.${startISO}&created_at=lt.${endISO}&select=id`),
    sb(`plan_step_completion?user_id=eq.${userId}&completed_at=gte.${startISO}&completed_at=lt.${endISO}&select=id`),
  ]);

  // Contatos com pelo menos uma interação com value_generated=true nesta
  // janela — usado abaixo para checar sobreposição com retomadas.
  const contactsComValor = new Set(
    (weekInteractions || []).filter(i => i.value_generated).map(i => i.contact_id)
  );

  const touchedIds = [...new Set((weekInteractions || []).map(i => i.contact_id).filter(Boolean))];
  let retomadas = 0;
  let retomadasComValor = 0;
  if (touchedIds.length) {
    const priorInteractions = await sb(
      `interactions?user_id=eq.${userId}&contact_id=in.(${touchedIds.join(',')})&created_at=lt.${startISO}&select=contact_id,created_at&order=created_at.desc`
    );
    const lastPriorByContact = {};
    for (const row of priorInteractions || []) {
      if (!lastPriorByContact[row.contact_id]) lastPriorByContact[row.contact_id] = row.created_at;
    }
    for (const cid of touchedIds) {
      const contact = (contactIds || []).find(c => c.id === cid);
      const priorAt = lastPriorByContact[cid];
      if (!contact || !priorAt) continue;
      const gapDays = (new Date(startISO) - new Date(priorAt)) / 86400000;
      if (gapDays > (contact.ideal_frequency_days || 30)) {
        retomadas++;
        if (contactsComValor.has(cid)) retomadasComValor++;
      }
    }
  }

  return {
    interactionsCount: weekInteractions?.length || 0,
    contactsEngaged: touchedIds.length,
    retomadas,
    novasConexoes: newContacts?.length || 0,
    metasConcluidas: stepsCompleted?.length || 0,
    interacoesComValor: (weekInteractions || []).filter(i => i.value_generated).length,
    retomadasComValor,
  };
}

async function persistWeeklyEvolution(profile) {
  const now = new Date();
  const weekStartISO = new Date(now.getTime() - 7 * 86400000).toISOString();
  const weekEndISO = now.toISOString();
  const prevWeekStartISO = new Date(now.getTime() - 14 * 86400000).toISOString();

  // Busca os campos completos (não só id/ideal_frequency_days) porque o
  // pattern detector (Fase 5) precisa de proximity, relevância estratégica
  // e created_at — os mesmos campos que priorityEngine.js já usa.
  const [contacts, allInteractions] = await Promise.all([
    sb(`contacts?user_id=eq.${profile.id}&select=id,name,created_at,proximity,ideal_frequency_days,last_interaction_at,influencia_pessoas,gera_oportunidade,abre_portas,momento_atual`),
    sb(`interactions?user_id=eq.${profile.id}&select=contact_id,created_at,tags`),
  ]);

  const [currentSignals, previousSignals] = await Promise.all([
    computeSignalsForWindow(profile.id, contacts, weekStartISO, weekEndISO),
    computeSignalsForWindow(profile.id, contacts, prevWeekStartISO, weekStartISO),
  ]);

  const patterns = detectPatterns(contacts, allInteractions, now);
  const observedDimensions = computeObservedDimensions(contacts, allInteractions, now);
  const frequencyStats = computeContactFrequencyStats(contacts, now);

  const evolution = computeWeeklyEvolution({ currentSignals, previousSignals, events: [], patterns });

  // week: número ISO da semana — só para referência/orderação, não usado como
  // "fase do plano" (esse conceito já existe em plan_progress/plan_phases e
  // não é o mesmo campo).
  const isoWeek = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));

  await sb('plan_insights', {
    method: 'POST',
    body: JSON.stringify({
      user_id: profile.id,
      week: isoWeek,
      // Linha separada da 'weekly_evolution' — Perfil lê cada insight_type
      // pro seu próprio bloco (tendência geral vs. observação por
      // dimensão). Mesmo padrão de reaproveitar plan_insights sem
      // migration.
      insight_type: 'dimension_observation',
      title: 'Observação comportamental por dimensão',
      description: JSON.stringify(observedDimensions),
    }),
  });

  // Saúde de frequência por contato, agregada (nunca por contato
  // individual) — base pro admin ver "quantos contatos estão em dia /
  // esfriando / frios" sem nunca saber qual contato é.
  await sb('plan_insights', {
    method: 'POST',
    body: JSON.stringify({
      user_id: profile.id,
      week: isoWeek,
      insight_type: 'contact_frequency_health',
      title: 'Saúde de frequência de contato',
      description: JSON.stringify(frequencyStats),
    }),
  });

  await sb('plan_insights', {
    method: 'POST',
    body: JSON.stringify({
      user_id: profile.id,
      week: isoWeek,
      insight_type: 'weekly_evolution',
      title: evolution.trendLabel,
      description: evolution.explanation,
      // Diagnóstico: sinais brutos + padrões que influenciaram a tendência
      // desta semana. Não é exibido na UI hoje (Perfil só lê title/
      // description/recommendation), mas fica disponível pra auditar por
      // que uma semana foi classificada de um jeito.
      metric: JSON.stringify({ ...currentSignals, patterns: patterns.map(p => ({ type: p.type, confidence: p.confidence })) }),
      // Reaproveita a coluna já existente (antes sempre null) — elo
      // relação→oportunidade (Bloco 1), sem migration.
      recommendation: evolution.valueHighlight,
    }),
  });
}

// Monta a mesma forma de dado que get_org_team_overview() devolve pro front
// (id, first_name, onboarding_completed, dimension_observation, observation_history),
// mas direto via service key — a RPC não dá pra chamar daqui porque ela
// valida auth.uid() = admin, e o cron não tem sessão de usuário.
async function fetchOrgMembersOverview(organizationId) {
  const members = await sb(
    `profiles?organization_id=eq.${organizationId}&org_role=eq.membro&org_consent_status=eq.accepted&select=id,first_name,onboarding_completed`
  );
  if (!members || members.length === 0) return [];

  const ids = members.map((m) => m.id);
  const insights = await sb(
    `plan_insights?user_id=in.(${ids.join(',')})&insight_type=eq.dimension_observation&select=user_id,week,description&order=week.desc,created_at.desc`
  );

  const byUser = {};
  for (const row of insights || []) {
    if (!byUser[row.user_id]) byUser[row.user_id] = [];
    // order já vem desc por created_at — a primeira ocorrência de cada
    // semana é a mais recente, então ignora duplicatas da mesma semana.
    if (!byUser[row.user_id].some((r) => r.week === row.week)) {
      byUser[row.user_id].push({ week: row.week, description: row.description });
    }
  }

  return members.map((m) => {
    const rows = (byUser[m.id] || []).sort((a, b) => a.week - b.week);
    const last6 = rows.slice(-6);
    const latest = rows[rows.length - 1];
    return {
      id: m.id,
      first_name: m.first_name,
      onboarding_completed: m.onboarding_completed,
      dimension_observation: latest ? JSON.parse(latest.description) : null,
      observation_history: last6.map((r) => ({ week: r.week, observation: JSON.parse(r.description) })),
    };
  });
}

// Texto anexado ao resumo semanal do admin — mesma lógica de agregação da
// aba Empresa (shared/orgTeamStats.js), nunca lista contato/interação/
// conteúdo de conversa de ninguém, só o categórico já visível no app.
async function buildOrgTeamSummarySection(organizationId) {
  const members = await fetchOrgMembersOverview(organizationId);
  if (members.length === 0) return null;

  const stats = computeTeamStats(members);
  const alerts = computeTeamAlerts(members, stats);

  const lines = [
    '',
    '',
    `🏢 *Sua equipe* — ${stats.total} ${stats.total === 1 ? 'pessoa' : 'pessoas'}`,
    `Onboarding: ${stats.onboardingDone}/${stats.total} · Observação computada: ${stats.withObservation}/${stats.total}`,
  ];
  if (alerts.length > 0) {
    lines.push('Pontos de atenção:');
    alerts.forEach((a) => lines.push(`• ${a.text}`));
  } else {
    lines.push('Nenhum ponto de atenção agregado esta semana.');
  }
  lines.push('Abra o app pra ver o detalhe por pessoa.');

  return lines.join('\n');
}

export default async function handler(req, res) {
  try {
    if (CRON_SECRET) {
      const auth = req.headers['authorization'] || '';
      if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ ok: false, error: 'unauthorized' });
    }
    if (!process.env.SUPABASE_SERVICE_KEY) {
      return res.status(200).json({ ok: false, error: 'SUPABASE_SERVICE_KEY ausente' });
    }

    const perfis = await sb(
      `profiles?select=id,first_name,whatsapp,timezone,notifications_enabled,weekly_summary_enabled,whatsapp_opt_in,organization_id,org_role&onboarding_completed=eq.true&whatsapp=not.is.null&weekly_summary_enabled=eq.true`
    );

    const elegiveis = (perfis || []).filter(p => isMonday(p.timezone));

    let enviados = 0, pulados = 0;
    for (const profile of elegiveis) {
      const todayISO = localDateISO(profile.timezone);
      const weekAgoISO = new Date(Date.now() - 7 * 86400000).toISOString();

      const [contacts, interactions, fullInteractions, alerts] = await Promise.all([
        sb(`contacts?user_id=eq.${profile.id}&select=id,name,created_at,proximity,ideal_frequency_days,last_interaction_at,next_action,next_action_date,birthday,influencia_pessoas,gera_oportunidade,abre_portas,momento_atual`),
        sb(`interactions?user_id=eq.${profile.id}&created_at=gte.${weekAgoISO}&select=id`),
        // Histórico completo (sem filtro de data) — é o que o momentum
        // precisa pra calcular o ritmo real de cada relação. Separado da
        // busca acima porque aquela é só a contagem da semana, usada no
        // texto do resumo.
        sb(`interactions?user_id=eq.${profile.id}&select=contact_id,created_at`),
        // FASE 0: mesma fonte de supressão que Home e painel usam.
        sb(`alerts?user_id=eq.${profile.id}&select=contact_id,status,created_at,metadata`),
      ]);

      const feedbackMap = buildFeedbackMap(alerts || []);
      const items = computeWeeklyAttentionItems(contacts, fullInteractions, feedbackMap);
      const actions = computeNextBestActions(contacts, fullInteractions, feedbackMap);
      const suggestion = actions[0]?.suggestedMessage
        ? `mande uma mensagem simples para ${actions[0].contactName} perguntando como ${actions[0].contactName ? 'ele/ela' : 'a pessoa'} está.`
        : null;

      const abertura = weeklySummaryOpeningMessage(profile.first_name);
      const corpo = weeklySummaryBodyMessage({
        firstName: profile.first_name,
        weekInteractionsCount: interactions?.length || 0,
        items,
        suggestion,
      });
      let text = `${abertura}\n\n${corpo}`;

      // Seção de equipe pro admin de organização — anexada na MESMA mensagem
      // (nunca um segundo envio), porque sendProactiveNotification só permite
      // 1 mensagem automática por dia por pessoa. Um cron separado pra isso
      // colidiria com esse limite e às vezes nem sairia.
      if (profile.org_role === 'admin' && profile.organization_id) {
        try {
          const orgSection = await buildOrgTeamSummarySection(profile.organization_id);
          if (orgSection) text += orgSection;
        } catch (err) {
          console.error('[relationship-weekly-summary-cron] resumo de equipe falhou para admin', profile.id, err);
        }
      }

      const result = await sendProactiveNotification({
        profile,
        notificationType: 'WEEKLY_RELATIONSHIP_SUMMARY',
        scopeKey: todayISO, // no máximo 1 resumo por dia local — evita duplicar se o cron rodar 2x na mesma segunda
        text,
      });
      if (result.sent) enviados++; else pulados++;
    }

    // --- Carta de Evolução (Meu Perfil) ---------------------------------
    // Loop independente do envio de WhatsApp acima: roda para qualquer
    // usuário com assessment concluído, com ou sem WhatsApp configurado.
    // Erro aqui nunca deve afetar o envio de WhatsApp (já rodou acima) nem
    // derrubar o cron inteiro — por isso try/catch por usuário.
    let evolucoesCalculadas = 0, evolucoesComErro = 0;
    const perfisEvolucao = await sb(
      `profiles?select=id,timezone&assessment_completed=eq.true`
    );
    const elegiveisEvolucao = (perfisEvolucao || []).filter(p => isMonday(p.timezone));
    for (const profile of elegiveisEvolucao) {
      try {
        await persistWeeklyEvolution(profile);
        evolucoesCalculadas++;
      } catch (err) {
        console.error('[relationship-weekly-summary-cron] evolução falhou para', profile.id, err);
        evolucoesComErro++;
      }
    }

    return res.status(200).json({ ok: true, elegiveis: elegiveis.length, enviados, pulados, evolucoesCalculadas, evolucoesComErro });
  } catch (err) {
    console.error('[relationship-weekly-summary-cron] erro:', err);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
