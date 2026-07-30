// src/components/GuidedNetworkStart.jsx
//
// Fluxo guiado de "Começar minha rede" — substitui o formulário completo de
// contato (20+ campos) no primeiro uso. Pede só o essencial, uma pessoa por
// vez, incentiva até 3 mas nunca obriga. Campos avançados continuam
// disponíveis depois, no perfil completo da pessoa (fluxo antigo, intacto).

import React, { useState } from 'react';
import { supabase } from '../utils/supabase';
import { MOTION, TYPE } from '../utils/theme';

const C = {
  card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#8C8074", // txL corrigido: era 2,64:1 sobre C.card, agora 4,5–4,8:1
  gold: "#C9A84C", err: "#E05050",
};

const IMPORTANCE = [
  { value: 2, label: 'Importante' },
  { value: 3, label: 'Muito importante' },
  { value: 4, label: 'Essencial agora' },
  { value: 5, label: 'Prioridade máxima' },
];

function inputStyle() {
  return {
    width: '100%', background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8,
    padding: '10px 12px', color: C.txt, fontFamily: "'DM Sans'", fontSize: TYPE.body, marginBottom: 12,
  };
}

const GuidedNetworkStart = ({ userId, onFinish, onExit }) => {
  const [step, setStep] = useState(1); // 1..3
  const [form, setForm] = useState({ name: '', context: '', importance: 3, lastTalk: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [addedCount, setAddedCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [savedPeople, setSavedPeople] = useState([]); // [{id, name, context, importance, lastTalk}]
  const [editingId, setEditingId] = useState(null);

  const reset = () => setForm({ name: '', context: '', importance: 3, lastTalk: '' });

  const editPrevious = () => {
    const last = savedPeople[savedPeople.length - 1];
    if (!last) return;
    setEditingId(last.id);
    setForm({ name: last.name, context: last.context, importance: last.importance, lastTalk: last.lastTalk || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
  };

  const savePerson = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);

    // ── Editando a pessoa anterior (voltou pelo "Corrigir a anterior") ──
    if (editingId) {
      const { error: updError } = await supabase.from('contacts').update({
        name: form.name.trim(),
        category: form.context.trim() || null,
        proximity: form.importance,
      }).eq('id', editingId).eq('user_id', userId);

      if (updError) { setError('Não consegui salvar a correção agora. Tenta de novo?'); setSaving(false); return; }

      setSavedPeople(list => list.map(p => p.id === editingId ? { ...p, name: form.name.trim(), context: form.context.trim(), importance: form.importance } : p));
      setEditingId(null);
      setSaving(false);
      reset();
      return;
    }

    const { data: newContact, error: ctError } = await supabase.from('contacts').insert({
      user_id: userId,
      name: form.name.trim(),
      category: form.context.trim() || null,
      proximity: form.importance,
      ideal_frequency_days: 30,
      last_interaction_at: form.lastTalk || null,
    }).select().single();

    if (ctError) { setError('Não consegui salvar essa pessoa agora. Tenta de novo?'); setSaving(false); return; }

    if (form.lastTalk && newContact) {
      await supabase.from('interactions').insert({
        user_id: userId, contact_id: newContact.id, type: 'mensagem',
        description: 'Última conversa informada no cadastro inicial.',
        sentiment: 'positivo', tags: [], value_generated: false,
        created_at: new Date(form.lastTalk + 'T12:00:00').toISOString(),
      }).then(() => {}, () => {});
    }

    supabase.from('page_events').insert({
      user_id: userId,
      event_type: addedCount === 0 ? 'first_contact_added' : (addedCount === 2 ? 'third_contact_added' : 'contact_added'),
      tab_name: 'startNetwork',
    }).then(() => {}, () => {});

    setSavedPeople(list => [...list, { id: newContact.id, name: form.name.trim(), context: form.context.trim(), importance: form.importance, lastTalk: form.lastTalk }]);
    setSaving(false);
    const nextCount = addedCount + 1;
    setAddedCount(nextCount);
    reset();
    if (step >= 3 || nextCount >= 3) {
      onFinish?.(nextCount);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative' }}>
      <button
        onClick={() => setShowHelp(s => !s)}
        title="Dicas desta tela"
        aria-label="Dicas desta tela"
        style={{ position: 'fixed', bottom: 20, right: 20, width: 44, height: 44, borderRadius: '50%', background: C.gold, border: 'none', boxShadow: '0 4px 14px #00000040', fontSize: 20, cursor: 'pointer', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >💡</button>
      {showHelp && (
        <div style={{ position: 'fixed', bottom: 74, right: 20, maxWidth: 280, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, zIndex: 9998, boxShadow: '0 8px 24px #00000060' }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.caption, fontWeight: 700, color: C.gold, marginBottom: 6 }}>🫂 Cadastro guiado</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.body, color: C.txM, lineHeight: 1.5 }}>
            Uma pessoa de cada vez, só o essencial. Você pode pular a qualquer momento — nada aqui é obrigatório, e dá pra completar o resto depois no perfil de cada pessoa.
          </div>
          <button onClick={() => setShowHelp(false)} style={{ marginTop: 10, background: 'none', border: 'none', color: C.txL, fontFamily: "'DM Sans'", fontSize: TYPE.micro, cursor: 'pointer' }}>Fechar</button>
        </div>
      )}
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.micro, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Pessoa {Math.min(addedCount + 1, 3)} de 3
        </div>
        <div style={{ height: 4, borderRadius: 2, background: '#ffffff10', marginBottom: 24 }}>
          <div style={{ height: 4, borderRadius: 2, background: C.gold, width: `${(addedCount / 3) * 100}%`, transition: `width ${MOTION.slow}` }} />
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: TYPE.title, fontWeight: 700, color: C.txt, margin: '0 0 16px' }}>
          {editingId ? 'Corrigindo essa pessoa' : (addedCount === 0 ? 'Quem é importante para você agora?' : 'Vamos adicionar mais alguém?')}
        </h2>

        <input style={inputStyle()} placeholder="Nome" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input style={inputStyle()} placeholder="Contexto da relação (ex: cliente, colega, mentor...)" value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))} />

        <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.txM, marginBottom: 8 }}>Por que essa pessoa é importante neste momento?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {IMPORTANCE.map(opt => (
            <button key={opt.value} onClick={() => setForm(p => ({ ...p, importance: opt.value }))}
              style={{ background: form.importance === opt.value ? '#1A1508' : 'transparent', border: `1px solid ${form.importance === opt.value ? C.gold : C.brd}`, borderRadius: 8, padding: '7px 12px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: form.importance === opt.value ? C.gold : C.txM, cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>

        {!editingId && (
          <>
            <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.txM, marginBottom: 8 }}>Quando vocês conversaram pela última vez? <span style={{ color: C.txL }}>(opcional)</span></div>
            <input type="date" style={inputStyle()} value={form.lastTalk} onChange={e => setForm(p => ({ ...p, lastTalk: e.target.value }))} />
          </>
        )}

        {error && <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.err, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button disabled={saving || !form.name.trim()} onClick={savePerson}
            style={{ flex: 1, background: C.gold, border: 'none', borderRadius: 10, padding: '12px 0', minHeight: 44, fontFamily: "'DM Sans'", fontSize: TYPE.caption, fontWeight: 700, color: '#0D0D0D', cursor: saving ? 'default' : 'pointer', opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : (editingId ? 'Salvar correção' : (addedCount >= 2 ? 'Concluir' : 'Adicionar e continuar'))}
          </button>
          {editingId && (
            <button disabled={saving} onClick={cancelEdit}
              style={{ background: 'none', border: `1px solid ${C.brd}`, borderRadius: 10, padding: '0 16px', minHeight: 44, display: 'inline-flex', alignItems: 'center', fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.txM, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
        </div>

        {!editingId && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <button disabled={saving} onClick={() => onExit?.(addedCount)} style={{ background: 'none', border: 'none', color: C.txL, fontFamily: "'DM Sans'", fontSize: TYPE.caption, cursor: 'pointer' }}>
                {addedCount > 0 ? 'Continuar depois' : 'Pular por agora'}
              </button>
              {addedCount > 0 && (
                <button disabled={saving} onClick={editPrevious} style={{ background: 'none', border: 'none', color: C.txM, fontFamily: "'DM Sans'", fontSize: TYPE.caption, cursor: 'pointer' }}>
                  ← Corrigir {savedPeople[savedPeople.length - 1]?.name || 'a anterior'}
                </button>
              )}
            </div>
            {addedCount > 0 && (
              <button disabled={saving} onClick={() => onFinish?.(addedCount)} style={{ background: 'none', border: 'none', color: C.gold, fontFamily: "'DM Sans'", fontSize: TYPE.caption, fontWeight: 600, cursor: 'pointer' }}>
                Já cadastrei o suficiente →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GuidedNetworkStart;
