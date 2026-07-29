// src/components/HomeToday.jsx
//
// Tela "Hoje" — substitui o antigo bloco de alertas empilhados da Home.
// Implementa os estados obrigatórios da jornada de ativação:
//   1) sem assessment concluído          -> continuar assessment
//   2) assessment ok, 0 contatos         -> começar minha rede
//   3) 1–2 contatos                      -> seguir construindo + 1ª orientação possível
//   4) contatos sem nenhuma interação    -> registrar uma conversa recente
//   5) dados suficientes                 -> motor único: 1 principal + até 2 secundárias
//   6) nada relevante agora              -> mensagem tranquila (nunca inventa pendência)
//
// E as 4 respostas humanas corrigidas de verdade (não só o texto do botão):
//   - Vale retomar            -> status 'accepted', abre a pessoa, não repete por 7 dias
//   - Está tudo bem assim     -> status 'dismissed', some IMEDIATAMENTE, supressão
//                                 escalando (14 / 60 / mudo)
//   - Conversamos recentemente -> pergunta quando (hoje/ontem/esta semana/escolher
//                                 data), cria uma interação REAL com essa data e
//                                 atualiza contacts.last_interaction_at com a mesma data
//   - Lembrar depois          -> pergunta quando (amanhã/próxima semana/escolher
//                                 data), suprime até essa data de verdade

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { computePriorities } from '../../shared/priorityEngine.js';
import { buildFeedbackMap, nextDismissSuppressionDays, addDays } from '../../shared/alertsFeedback.js';

const C = {
  card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#605850",
  gold: "#C9A84C", err: "#E05050",
};

function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ── Mini seletor de data para "Conversamos recentemente" / "Lembrar depois" ── */
function DateChoicePopover({ options, onPick, onCancel, busy }) {
  const [customDate, setCustomDate] = useState('');
  return (
    <div style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {options.map(opt => (
          <button key={opt.label} disabled={busy} onClick={() => onPick(opt.dateISO)} style={chipStyle}>{opt.label}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
          style={{ background: 'transparent', border: `1px solid ${C.brd}`, borderRadius: 6, padding: '6px 8px', color: C.txt, fontFamily: "'DM Sans'", fontSize: 12 }} />
        <button disabled={busy || !customDate} onClick={() => onPick(customDate)} style={chipStyle}>Confirmar data</button>
        <button disabled={busy} onClick={onCancel} style={{ ...chipStyle, border: 'none', color: C.txL }}>Cancelar</button>
      </div>
    </div>
  );
}

const chipStyle = {
  background: 'transparent', border: `1px solid ${C.brd}`, color: C.txM,
  borderRadius: 8, padding: '6px 12px', fontFamily: "'DM Sans'", fontSize: 12, cursor: 'pointer',
};

function PriorityCard({ action, isMain, busy, onAccept, onDismiss, onLogRecent, onSnooze }) {
  const [open, setOpen] = useState(null); // null | 'log' | 'snooze'
  const [error, setError] = useState(null);

  const wrap = async (fn) => {
    setError(null);
    const res = await fn();
    if (res?.error) setError('Não consegui salvar sua resposta agora. Tenta de novo?');
    else setOpen(null);
  };

  return (
    <div style={{ background: C.sf, border: `1px solid ${isMain ? C.gold + '40' : C.brd}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: isMain ? 20 : 17, color: C.txt, fontWeight: 600 }}>{action.title}</div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginTop: 4 }}>{action.reason}</div>

      {error && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.err, marginTop: 6 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <button disabled={busy} onClick={() => wrap(() => onAccept(action))} style={{ ...chipStyle, border: `1px solid ${C.gold}`, color: C.gold, fontWeight: 600 }}>Vale retomar</button>
        <button disabled={busy} onClick={() => wrap(() => onDismiss(action))} style={chipStyle}>Está tudo bem assim</button>
        <button disabled={busy} onClick={() => setOpen(open === 'log' ? null : 'log')} style={chipStyle}>Conversamos recentemente</button>
        <button disabled={busy} onClick={() => setOpen(open === 'snooze' ? null : 'snooze')} style={chipStyle}>Lembrar depois</button>
      </div>

      {open === 'log' && (
        <DateChoicePopover
          busy={busy}
          options={[
            { label: 'Hoje', dateISO: todayISO() },
            { label: 'Ontem', dateISO: addDays(todayISO(), -1).toISOString().slice(0, 10) },
            { label: 'Esta semana', dateISO: addDays(todayISO(), -3).toISOString().slice(0, 10) },
          ]}
          onPick={(dateISO) => wrap(() => onLogRecent(action, dateISO))}
          onCancel={() => setOpen(null)}
        />
      )}

      {open === 'snooze' && (
        <DateChoicePopover
          busy={busy}
          options={[
            { label: 'Amanhã', dateISO: addDays(todayISO(), 1).toISOString().slice(0, 10) },
            { label: 'Próxima semana', dateISO: addDays(todayISO(), 7).toISOString().slice(0, 10) },
          ]}
          onPick={(dateISO) => wrap(() => onSnooze(action, dateISO))}
          onCancel={() => setOpen(null)}
        />
      )}
    </div>
  );
}

const HomeToday = ({
  userId, contacts, interactions, assessmentCompleted, firstName,
  onOpenContact, onStartAssessment, onStartNetwork, onQuickLogInteraction,
}) => {
  const [alertRows, setAlertRows] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [busyId, setBusyId] = useState(null); // trava contra duplo clique por cartão
  const [loadError, setLoadError] = useState(false);

  const loadAlerts = useCallback(async () => {
    if (!userId) return;
    setLoadingAlerts(true);
    setLoadError(false);
    const { data, error } = await supabase.from('alerts')
      .select('contact_id,status,created_at,metadata')
      .eq('user_id', userId);
    if (error) { setLoadError(true); setLoadingAlerts(false); return; }
    setAlertRows(data || []);
    setLoadingAlerts(false);
  }, [userId]);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const trackedRef = useRef({});
  const trackOnce = useCallback((eventType, metadata) => {
    if (!userId || trackedRef.current[eventType]) return;
    trackedRef.current[eventType] = true;
    supabase.from('page_events').insert({ user_id: userId, event_type: eventType, tab_name: 'dash', metadata: metadata || null }).then(() => {}, () => {});
  }, [userId]);

  const contactsCount = contacts?.length || 0;
  const anyInteraction = (interactions?.length || 0) > 0;

  useEffect(() => {
    if (loadingAlerts) return;
    const { main } = computePriorities(contacts, loadError ? {} : buildFeedbackMap(alertRows), todayISO());
    if (main) trackOnce('first_recommendation_viewed', { actionType: main.actionType });
    // "Ativação completa" (Seção 12 do briefing): assessment concluído + ao
    // menos 1 pessoa + já viu uma recomendação + já tem 1 interação real.
    if (assessmentCompleted && contactsCount >= 1 && anyInteraction) trackOnce('activation_completed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAlerts, contactsCount, anyInteraction, assessmentCompleted]);


  // ── Estado 1: assessment não concluído ──
  if (!assessmentCompleted) {
    return (
      <HomeShell title={`Bom ver você, ${firstName || ''}.`}>
        <BigCTA text="Seu diagnóstico relacional ainda não foi concluído. Ele é o ponto de partida para tudo que vem depois." cta="Continuar diagnóstico" onClick={onStartAssessment} />
      </HomeShell>
    );
  }

  // ── Estado 2: 0 contatos ──
  if (contactsCount === 0) {
    const handleStart = () => {
      trackOnce('start_network_clicked_home');
      onStartNetwork?.();
    };
    return (
      <HomeShell title={`Sua rede começa aqui, ${firstName || ''}.`}>
        <BigCTA text="Cadastre as primeiras pessoas importantes para você começar a receber orientações reais." cta="Começar minha rede" onClick={handleStart} />
      </HomeShell>
    );
  }

  const feedbackMap = loadingAlerts || loadError ? {} : buildFeedbackMap(alertRows);
  const { main, secondary } = computePriorities(contacts, feedbackMap, todayISO());
  const cards = [main, ...secondary].filter(Boolean);

  // ── Estado 3: 1–2 contatos, ainda construindo a rede ──
  if (contactsCount < 3) {
    return (
      <HomeShell title={`Sua rede está começando, ${firstName || ''}.`}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 14 }}>
          Você já cadastrou {contactsCount} {contactsCount === 1 ? 'pessoa' : 'pessoas'}. Duas ou três já são suficientes para eu começar a te ajudar de verdade.
        </div>
        {cards.length > 0 ? (
          <RecommendationList cards={cards} busyId={busyId} setBusyId={setBusyId} userId={userId} contacts={contacts}
            alertRows={alertRows} onOpenContact={onOpenContact} reload={loadAlerts} onQuickLogInteraction={onQuickLogInteraction} />
        ) : (
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 14 }}>
            Ainda estou te conhecendo. Quer registrar quando foi a última vez que você falou com alguém que já cadastrou?
          </div>
        )}
        <Btn onClick={onStartNetwork}>+ Adicionar outra pessoa</Btn>
      </HomeShell>
    );
  }

  // ── Estado 4: tem contatos, mas nenhuma interação registrada ainda ──
  if (!anyInteraction) {
    const target = contacts[0];
    return (
      <HomeShell title={`Hoje, ${firstName || ''}`}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 14 }}>
          Sua rede já tem gente importante cadastrada. Agora registre uma conversa recente para eu entender melhor o seu ritmo.
        </div>
        {target && (
          <Btn onClick={() => onQuickLogInteraction?.(target.id)}>Registrar conversa com {target.name}</Btn>
        )}
      </HomeShell>
    );
  }

  // ── Estado 5/6: dados suficientes — recomendação principal ou tranquilidade ──
  return (
    <HomeShell title={`Hoje, ${firstName || ''}`}>
      {loadError && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.err, marginBottom: 10 }}>
          Não consegui carregar suas respostas anteriores agora — algumas recomendações já respondidas podem aparecer de novo até isso ser corrigido.
        </div>
      )}
      {cards.length === 0 ? (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM }}>
          Por aqui está tudo tranquilo. Sua rede não precisa virar uma lista de tarefas.
        </div>
      ) : (
        <RecommendationList cards={cards} busyId={busyId} setBusyId={setBusyId} userId={userId} contacts={contacts}
          alertRows={alertRows} onOpenContact={onOpenContact} reload={loadAlerts} onQuickLogInteraction={onQuickLogInteraction} />
      )}
    </HomeShell>
  );
};

function RecommendationList({ cards, busyId, setBusyId, userId, contacts, alertRows, onOpenContact, reload, onQuickLogInteraction }) {
  const withGuard = (action, fn) => async () => {
    if (busyId) return { error: null }; // já tem algo em voo — ignora clique duplicado
    setBusyId(action.recommendationId);
    try {
      const result = await fn();
      return result || {};
    } finally {
      setBusyId(null);
      reload();
    }
  };

  const insertAlert = async (action, status, metadata) => {
    const { error } = await supabase.from('alerts').insert({
      user_id: userId,
      contact_id: action.relationshipId,
      title: action.title,
      description: action.reason,
      status,
      metadata: metadata || {},
    });
    supabase.from('page_events').insert({
      user_id: userId, event_type: `suggestion_${status}`, tab_name: 'dash',
      metadata: { actionType: action.actionType },
    }).then(() => {}, () => {});
    return { error };
  };

  const onAccept = (action) => withGuard(action, async () => {
    const { error } = await insertAlert(action, 'accepted', { recommendationId: action.recommendationId, actionType: action.actionType, origin: 'home' });
    if (!error) onOpenContact?.(action.relationshipId);
    return { error };
  })();

  const onDismiss = (action) => withGuard(action, async () => {
    const previousDismissals = (alertRows || []).filter(
      r => r.contact_id === action.relationshipId && r.status === 'dismissed'
    ).length;
    const days = nextDismissSuppressionDays(previousDismissals);
    const suppressUntil = addDays(new Date(), days).toISOString();
    return insertAlert(action, 'dismissed', { recommendationId: action.recommendationId, actionType: action.actionType, origin: 'home', suppressUntil });
  })();

  const onLogRecent = (action, dateISO) => withGuard(action, async () => {
    const chosenAt = new Date(dateISO + 'T12:00:00').toISOString();
    const { error: itError } = await supabase.from('interactions').insert({
      user_id: userId, contact_id: action.relationshipId, type: 'mensagem',
      description: 'Conversa recente confirmada a partir de uma recomendação em "Hoje".',
      sentiment: 'positivo', tags: [], value_generated: false, created_at: chosenAt,
    });
    if (itError) return { error: itError };
    const { error: ctError } = await supabase.from('contacts')
      .update({ last_interaction_at: chosenAt, next_action: null, next_action_date: null })
      .eq('id', action.relationshipId).eq('user_id', userId);
    if (ctError) return { error: ctError };
    return insertAlert(action, 'logged', { recommendationId: action.recommendationId, actionType: action.actionType, origin: 'home', chosenDate: dateISO });
  })();

  const onSnooze = (action, dateISO) => withGuard(action, async () => {
    const suppressUntil = new Date(dateISO + 'T00:00:00').toISOString();
    return insertAlert(action, 'snoozed', { recommendationId: action.recommendationId, actionType: action.actionType, origin: 'home', suppressUntil });
  })();

  return cards.map((a, i) => (
    <PriorityCard
      key={a.recommendationId}
      action={a}
      isMain={i === 0}
      busy={busyId === a.recommendationId}
      onAccept={onAccept}
      onDismiss={onDismiss}
      onLogRecent={onLogRecent}
      onSnooze={onSnooze}
    />
  ));
}

function HomeShell({ title, children }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.gold, fontWeight: 700, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function BigCTA({ text, cta, onClick }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, marginBottom: 16, lineHeight: 1.6 }}>{text}</div>
      <Btn onClick={onClick} primary>{cta}</Btn>
    </div>
  );
}

function Btn({ onClick, children, primary }) {
  return (
    <button onClick={onClick} style={{
      background: primary ? C.gold : 'transparent',
      color: primary ? '#0D0D0D' : C.gold,
      border: `1px solid ${C.gold}`, borderRadius: 10, padding: '12px 20px',
      fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, cursor: 'pointer',
    }}>{children}</button>
  );
}

export default HomeToday;
