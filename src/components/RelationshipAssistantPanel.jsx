// src/components/RelationshipAssistantPanel.jsx
//
// Seção "Como posso te ajudar hoje?" do Assistente de Inteligência Relacional.
//
// FASE 0 (consolidação, ago/2026): este componente tinha sua própria cópia de
// evaluateContact()/computeNextBestActions(), documentada como "espelho" de
// api/_lib/relationshipAssistant/actionEngine.js — mas o espelho tinha
// divergido de fato (não usava relevância estratégica, não usava momentum,
// não respeitava supressão de alerts, fórmula de score diferente). Isso
// reintroduzia exatamente o problema que actionEngine.js já documenta ter
// corrigido uma vez (Home vs. WhatsApp divergentes).
//
// Correção: este componente agora importa shared/priorityEngine.js
// DIRETAMENTE — o mesmo import que src/App.jsx já usa para calcular
// relevância (`calculateRelevanceCanonical`). Nenhuma lógica de priorização
// vive mais neste arquivo. Se a regra mudar em shared/priorityEngine.js, este
// painel muda junto, sem precisar de espelho manual.
//
// Também busca `alerts` e monta o feedbackMap (shared/alertsFeedback.js) —
// mesma fonte que HomeToday.jsx usa — para que uma recomendação dispensada
// na Home não reapareça aqui.

import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { computePriorities } from '../../shared/priorityEngine.js';
import { buildFeedbackMap } from '../../shared/alertsFeedback.js';

const C = {
  bg: "#0D0D0D", card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#605850",
  gold: "#C9A84C", gD: "#1A1508",
};

// Campos que shared/priorityEngine.js precisa para calcular candidatos —
// mesmo conjunto que HomeToday.jsx busca. Ver buildContactCandidates() em
// shared/priorityEngine.js para a lista completa de campos consumidos.
const CONTACT_FIELDS =
  'id,name,proximity,ideal_frequency_days,last_interaction_at,next_action,next_action_date,' +
  'birthday,created_at,influencia_pessoas,gera_oportunidade,abre_portas,momento_atual';

// Mesma construção de "hoje" que HomeToday.jsx usa (todayISO() lá) — mantém
// os dois pontos de entrada usando exatamente a mesma referência de data,
// para não introduzir uma divergência de fuso horário entre Home e este
// painel em cima da mesma correção.
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const ActionCard = ({ action, onQuickAction }) => (
  <div style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, color: C.txt, fontWeight: 600 }}>{action.title}</div>
    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginTop: 4 }}>{action.reason}</div>
    <button
      onClick={() => onQuickAction?.(action)}
      style={{
        marginTop: 10, background: 'transparent', border: `1px solid ${C.gold}`, color: C.gold,
        borderRadius: 8, padding: '6px 14px', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}
    >
      Registrar interação
    </button>
  </div>
);

const RelationshipAssistantPanel = ({ userId, onOpenContact }) => {
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      setLoading(true);

      // Mesmas 3 fontes que HomeToday.jsx usa para o mesmo cálculo —
      // buscadas em paralelo.
      const [{ data: contacts }, { data: interactions }, { data: alerts }] = await Promise.all([
        supabase.from('contacts').select(CONTACT_FIELDS).eq('user_id', userId),
        supabase.from('interactions').select('contact_id,created_at').eq('user_id', userId),
        supabase.from('alerts').select('contact_id,status,created_at,metadata').eq('user_id', userId),
      ]);

      if (!mounted) return;

      const feedbackMap = buildFeedbackMap(alerts || []);
      const { main, secondary } = computePriorities(
        contacts || [],
        feedbackMap,
        todayISO(),
        interactions || []
      );

      setActions([main, ...secondary].filter(Boolean));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [userId]);

  if (loading) return null;

  return (
    <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.gold, fontWeight: 700, marginBottom: 4 }}>
        Como posso te ajudar hoje?
      </div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 16 }}>
        Poucas coisas, com prioridade clara — sem lista acumulada.
      </div>

      {actions.length === 0 && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM }}>
          Essa semana ainda está leve por aqui. Que tal escolher uma pessoa importante e começar com uma mensagem simples: "Como você está?"
        </div>
      )}

      {actions.map(a => (
        <ActionCard key={a.relationshipId} action={a} onQuickAction={() => onOpenContact?.(a.relationshipId)} />
      ))}
    </div>
  );
};

export default RelationshipAssistantPanel;
