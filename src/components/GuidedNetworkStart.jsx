// src/components/GuidedNetworkStart.jsx
//
// Fluxo guiado de "Começar minha rede" — substitui o formulário completo de
// contato (20+ campos) no primeiro uso. Pede só o essencial, uma pessoa por
// vez, incentiva até 3 mas nunca obriga. Campos avançados continuam
// disponíveis depois, no perfil completo da pessoa (fluxo antigo, intacto).

import React, { useState } from 'react';
import { supabase } from '../utils/supabase';

const C = {
  card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#605850",
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
    padding: '10px 12px', color: C.txt, fontFamily: "'DM Sans'", fontSize: 13, marginBottom: 12,
  };
}

const GuidedNetworkStart = ({ userId, onFinish, onExit }) => {
  const [step, setStep] = useState(1); // 1..3
  const [form, setForm] = useState({ name: '', context: '', importance: 3, lastTalk: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [addedCount, setAddedCount] = useState(0);

  const reset = () => setForm({ name: '', context: '', importance: 3, lastTalk: '' });

  const savePerson = async () => {
    if (!form.name.trim() || saving) return;
    setSaving(true);
    setError(null);
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
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%' }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
          Pessoa {Math.min(addedCount + 1, 3)} de 3
        </div>
        <div style={{ height: 4, borderRadius: 2, background: '#ffffff10', marginBottom: 24 }}>
          <div style={{ height: 4, borderRadius: 2, background: C.gold, width: `${(addedCount / 3) * 100}%`, transition: 'width .3s' }} />
        </div>

        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: '0 0 16px' }}>
          {addedCount === 0 ? 'Quem é importante para você agora?' : 'Vamos adicionar mais alguém?'}
        </h2>

        <input style={inputStyle()} placeholder="Nome" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <input style={inputStyle()} placeholder="Contexto da relação (ex: cliente, colega, mentor...)" value={form.context} onChange={e => setForm(p => ({ ...p, context: e.target.value }))} />

        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 8 }}>Por que essa pessoa é importante neste momento?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {IMPORTANCE.map(opt => (
            <button key={opt.value} onClick={() => setForm(p => ({ ...p, importance: opt.value }))}
              style={{ background: form.importance === opt.value ? '#1A1508' : 'transparent', border: `1px solid ${form.importance === opt.value ? C.gold : C.brd}`, borderRadius: 8, padding: '7px 12px', fontFamily: "'DM Sans'", fontSize: 12, color: form.importance === opt.value ? C.gold : C.txM, cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>

        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 8 }}>Quando vocês conversaram pela última vez? <span style={{ color: C.txL }}>(opcional)</span></div>
        <input type="date" style={inputStyle()} value={form.lastTalk} onChange={e => setForm(p => ({ ...p, lastTalk: e.target.value }))} />

        {error && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.err, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button disabled={saving || !form.name.trim()} onClick={savePerson}
            style={{ flex: 1, background: C.gold, border: 'none', borderRadius: 10, padding: '12px 0', fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: '#0D0D0D', cursor: saving ? 'default' : 'pointer', opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : (addedCount >= 2 ? 'Concluir' : 'Adicionar e continuar')}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
          <button disabled={saving} onClick={() => onExit?.(addedCount)} style={{ background: 'none', border: 'none', color: C.txL, fontFamily: "'DM Sans'", fontSize: 12, cursor: 'pointer' }}>
            {addedCount > 0 ? 'Continuar depois' : 'Pular por agora'}
          </button>
          {addedCount > 0 && (
            <button disabled={saving} onClick={() => onFinish?.(addedCount)} style={{ background: 'none', border: 'none', color: C.gold, fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Já cadastrei o suficiente →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuidedNetworkStart;
