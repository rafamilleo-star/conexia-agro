import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const C = {
  bg: "#0D0D0D", card: "#141414", sf: "#1A1A1A", brd: "#2A2A2A",
  txt: "#F0EDE8", txM: "#A09890", txL: "#605850",
  gold: "#C9A84C", gD: "#1A1508", gL: "#C9A84C40",
  grn: "#4CAF7A", grnD: "#0A1F12", amb: "#E8A020", cor: "#E05050",
  w06: "rgba(255,255,255,0.06)",
};

const dSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999;

const KPICard = ({ icon, label, value, sub, subColor }) => (
  <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20 }}>
    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
      {icon} {label}
    </div>
    <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, color: C.txt, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: subColor || C.txM, marginTop: 8 }}>{sub}</div>}
  </div>
);

const ConexiaDashboard = ({ userId }) => {
  const [contacts, setContacts] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setLoading(true);
      const [{ data: cts }, { data: its }, { data: asr }] = await Promise.all([
        supabase.from('contacts').select('*').eq('user_id', userId),
        supabase.from('interactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('assessment_results').select('*').eq('user_id', userId).maybeSingle(),
      ]);
      setContacts(cts || []);
      setInteractions(its || []);
      setAssessment(asr);
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM }}>Carregando analytics...</div>
      </div>
    );
  }

  // KPIs reais
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter(c => c.status === 'active').length;
  const interactionsThisWeek = interactions.filter(i => dSince(i.created_at) <= 7).length;
  const interactionsThisMonth = interactions.filter(i => dSince(i.created_at) <= 30).length;
  const avgHealth = totalContacts > 0
    ? Math.round(contacts.reduce((s, c) => s + (c.health_score || 0), 0) / totalContacts)
    : 0;
  const cooling = contacts.filter(c => (c.health_score || 0) < 40 && (c.health_score || 0) > 0);
  const noAction = contacts.filter(c => !c.next_action && c.status === 'active');

  // Top contatos por health
  const topContacts = [...contacts]
    .filter(c => c.health_score > 0)
    .sort((a, b) => (b.health_score || 0) - (a.health_score || 0))
    .slice(0, 5);

  // Distribuição por categoria
  const catCount = {};
  contacts.forEach(c => { catCount[c.category || 'outro'] = (catCount[c.category || 'outro'] || 0) + 1; });
  const catData = Object.entries(catCount).map(([k, v]) => ({ name: k, value: v }));

  // Interações por tipo
  const typeCount = {};
  interactions.forEach(i => { typeCount[i.type || 'outro'] = (typeCount[i.type || 'outro'] || 0) + 1; });
  const typeData = Object.entries(typeCount).map(([k, v]) => ({ name: k, value: v }));

  // Dimensões do assessment
  const dimData = assessment ? [
    { name: 'Estratégia', value: Math.round((assessment.intencao_estrategica || 0) * 10) },
    { name: 'Escuta', value: Math.round((assessment.escuta_relacional || 0) * 10) },
    { name: 'Presença', value: Math.round((assessment.presenca_mercado || 0) * 10) },
    { name: 'Reciproc.', value: Math.round((assessment.reciprocidade_ativa || 0) * 10) },
    { name: 'Consistência', value: Math.round((assessment.ritual_consistencia || 0) * 10) },
    { name: 'Confiança', value: Math.round((assessment.confianca_autentica || 0) * 10) },
  ] : [];

  // Alertas reais
  const alerts = [];
  cooling.slice(0, 3).forEach(c => {
    const days = dSince(c.last_interaction_at);
    alerts.push({ icon: '⏳', color: C.amb, title: `${c.name} esfriando`, msg: `${days} dias sem contato` });
  });
  noAction.slice(0, 2).forEach(c => {
    alerts.push({ icon: '📋', color: C.txL, title: `${c.name} sem próxima ação`, msg: 'Defina o próximo passo' });
  });

  const healthColor = avgHealth >= 70 ? C.grn : avgHealth >= 40 ? C.amb : C.cor;
  const healthLabel = avgHealth >= 70 ? 'Rede saudável' : avgHealth >= 40 ? 'Atenção necessária' : 'Rede em risco';

  return (
    <div style={{ padding: '0 0 32px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: '0 0 4px' }}>Analytics</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, margin: 0 }}>Dados reais da sua rede · atualizado agora</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        <KPICard icon="👥" label="Contatos" value={totalContacts} sub={`${activeContacts} ativos`} />
        <KPICard icon="⚡" label="Interações esta semana" value={interactionsThisWeek} sub={`${interactionsThisMonth} no mês`} />
        <KPICard icon="💚" label="Saúde média" value={`${avgHealth}%`} sub={healthLabel} subColor={healthColor} />
        <KPICard icon="⚠️" label="Esfriando" value={cooling.length} sub={cooling.length > 0 ? 'Precisam de atenção' : 'Tudo ok'} subColor={cooling.length > 0 ? C.amb : C.grn} />
      </div>

      {/* Dimensões do assessment */}
      {dimData.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>
            Suas 6 Dimensões Relacionais
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dimData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.brd} />
              <XAxis dataKey="name" tick={{ fill: C.txM, fontSize: 11, fontFamily: "'DM Sans'" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: C.txL, fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8, fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}
                cursor={{ fill: C.w06 }}
              />
              <Bar dataKey="value" fill={C.gold} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {assessment?.profile_name && (
            <div style={{ marginTop: 12, fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>
              Perfil: <span style={{ color: C.gold, fontWeight: 600 }}>{assessment.profile_name}</span>
              {assessment.overall_score && <span style={{ color: C.txL }}> · Score geral: {Math.round(assessment.overall_score * 10)}/100</span>}
            </div>
          )}
        </div>
      )}

      {/* Distribuição por categoria */}
      {catData.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
              Contatos por categoria
            </div>
            {catData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, textTransform: 'capitalize' }}>{d.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: Math.max(20, (d.value / totalContacts) * 80), height: 6, background: C.gold, borderRadius: 3, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, fontWeight: 600, minWidth: 16, textAlign: 'right' }}>{d.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
              Tipos de interação
            </div>
            {typeData.length > 0 ? typeData.map((d, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, textTransform: 'capitalize' }}>{d.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: Math.max(20, (d.value / interactions.length) * 80), height: 6, background: C.grn, borderRadius: 3, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, fontWeight: 600, minWidth: 16, textAlign: 'right' }}>{d.value}</span>
                </div>
              </div>
            )) : (
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>Nenhuma interação registrada ainda.</div>
            )}
          </div>
        </div>
      )}

      {/* Top contatos */}
      {topContacts.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
            Top contatos por saúde
          </div>
          {topContacts.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: i < topContacts.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt }}>{c.name}</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, textTransform: 'capitalize' }}>{c.category || '—'} · {c.company || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: (c.health_score || 0) >= 70 ? C.grn : (c.health_score || 0) >= 40 ? C.amb : C.cor }}>
                  {Math.round(c.health_score || 0)}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>health</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alertas reais */}
      {alerts.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
            ⚠️ Alertas da sua rede
          </div>
          {alerts.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < alerts.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
              <span style={{ fontSize: 16 }}>{a.icon}</span>
              <div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: a.color }}>{a.title}</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{a.msg}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {totalContacts === 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, marginBottom: 6 }}>Nenhum dado ainda</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>Cadastre contatos e registre interações para ver seus analytics aqui.</div>
        </div>
      )}
    </div>
  );
};

export default ConexiaDashboard;
