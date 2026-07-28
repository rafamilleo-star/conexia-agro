// src/components/RelationshipAssistantPanel.jsx
//
// Seção "Como posso te ajudar hoje?" do Assistente de Inteligência Relacional.
// Mesma lógica de priorização usada pelos crons em
// api/_lib/relationshipAssistant/actionEngine.js — mantida aqui em espelho
// (funções puras, sem process.env nem chamadas de rede) para não acoplar o
// bundle do frontend ao diretório api/. Se mudar a regra de priorização lá,
// espelhe a mudança aqui.
//
// Propositalmente mostra poucas coisas: só a próxima ação, até 3 relações que
// merecem atenção, e um atalho para registrar interação — nada de lista longa
// de tarefas acumuladas.

import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

const C = {
  bg: "#0D0D0D", card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#605850",
  gold: "#C9A84C", gD: "#1A1508",
};

function daysSince(dateStr) {
  if (!dateStr) return null;
  return (Date.now() - new Date(dateStr).getTime()) / 86400000;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  return (new Date(dateStr + 'T00:00:00').getTime() - Date.now()) / 86400000;
}

// Espelho de evaluateContact() em api/_lib/relationshipAssistant/actionEngine.js
function evaluateContact(contact) {
  const importancia = contact.proximity || 0;
  const freqDias = contact.ideal_frequency_days || null;
  const diasDesdeUltima = daysSince(contact.last_interaction_at);

  if (contact.next_action && contact.next_action_date) {
    const diasAte = daysUntil(contact.next_action_date);
    if (diasAte !== null && diasAte < 0) {
      return { actionType: 'OVERDUE_ACTION', title: `Ação pendente com ${contact.name}`, reason: `Você marcou "${contact.next_action}" e o prazo já passou.`, priority: 95 + Math.min(5, Math.abs(diasAte)) };
    }
    if (diasAte !== null && diasAte >= 0 && diasAte <= 3) {
      return { actionType: 'UPCOMING_ACTION', title: `Ação próxima com ${contact.name}`, reason: `"${contact.next_action}" está previsto para breve.`, priority: 80 - diasAte };
    }
  }
  if (importancia >= 4 && !contact.last_interaction_at) {
    return { actionType: 'RECONNECT_NO_HISTORY', title: `Que tal falar com ${contact.name}?`, reason: `Você marcou essa relação como importante, mas ainda não há interação registrada.`, priority: 88 };
  }
  if (freqDias && diasDesdeUltima !== null && diasDesdeUltima >= freqDias) {
    const atraso = diasDesdeUltima - freqDias;
    return { actionType: 'RECONNECT', title: `Que tal falar com ${contact.name}?`, reason: `Faz algum tempo desde a última interação e você marcou essa relação como importante.`, priority: 60 + importancia * 5 + Math.min(20, atraso) };
  }
  return null;
}

function computeNextBestActions(contacts) {
  return (contacts || [])
    .map(c => { const e = evaluateContact(c); return e ? { relationshipId: c.id, contactName: c.name, ...e } : null; })
    .filter(Boolean)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
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
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('contacts')
        .select('id,name,proximity,ideal_frequency_days,last_interaction_at,next_action,next_action_date')
        .eq('user_id', userId);
      if (mounted) { setContacts(data || []); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [userId]);

  const actions = computeNextBestActions(contacts);

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
