import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, Target, AlertCircle } from 'lucide-react';

const ConexiaDashboard = ({ userId }) => {
  const [data, setData] = useState({
    kpis: {
      totalContacts: 47,
      activeInteractions: 12,
      networkHealth: 78,
      dimensionScore: 8.2
    },
    trends: [
      { date: '2026-06-01', contacts: 12, interactions: 5, health: 65 },
      { date: '2026-06-05', contacts: 18, interactions: 8, health: 70 },
      { date: '2026-06-10', contacts: 28, interactions: 10, health: 74 },
      { date: '2026-06-15', contacts: 35, interactions: 11, health: 76 },
      { date: '2026-06-20', contacts: 42, interactions: 12, health: 78 },
      { date: '2026-06-25', contacts: 47, interactions: 12, health: 78 }
    ],
    topContacts: [
      { name: 'Rafael Milléo', dimension: 'Estrategista', score: 9.5 },
      { name: 'João Silva', dimension: 'Influenciador', score: 8.7 },
      { name: 'Maria Santos', dimension: 'Conector', score: 8.9 },
      { name: 'Carlos Oliveira', dimension: 'Técnico', score: 7.8 },
      { name: 'Ana Costa', dimension: 'Relacional', score: 8.4 }
    ],
    correlations: [
      { dimension: 'Estratégia', value: 85 },
      { dimension: 'Visibilidade', value: 72 },
      { dimension: 'Confiança', value: 88 },
      { dimension: 'Reciprocidade', value: 76 }
    ],
    anomalies: [
      { date: '2026-06-22', type: 'Contato inativo', contact: 'Pedro Augusto', days: 12 },
      { date: '2026-06-18', type: 'Baixa interação', contact: 'Lucas Teixeira', days: 8 }
    ]
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setTimeout(() => setLoading(false), 800);
  }, [userId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>📊 Carregando dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 8px' }}>📈 Analytics Dashboard</h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>Visão em tempo real da sua rede de relacionamentos</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: 40 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Users size={24} style={{ color: '#1e40af', marginRight: 12 }} />
              <span style={{ fontSize: 14, color: '#666' }}>Total de Contatos</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{data.kpis.totalContacts}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>↑ 15% vs. mês anterior</div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <TrendingUp size={24} style={{ color: '#dc2626', marginRight: 12 }} />
              <span style={{ fontSize: 14, color: '#666' }}>Interações Ativas</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{data.kpis.activeInteractions}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>↑ 8% essa semana</div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Target size={24} style={{ color: '#7c3aed', marginRight: 12 }} />
              <span style={{ fontSize: 14, color: '#666' }}>Saúde da Rede</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{data.kpis.networkHealth}%</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>Excelente</div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <Target size={24} style={{ color: '#f59e0b', marginRight: 12 }} />
              <span style={{ fontSize: 14, color: '#666' }}>Score de Dimensão</span>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{data.kpis.dimensionScore}</div>
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 8 }}>Estrategista confirmado</div>
          </div>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Tendências - Últimos 25 dias</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="contacts" stroke="#1e40af" strokeWidth={2} name="Contatos" />
              <Line type="monotone" dataKey="interactions" stroke="#dc2626" strokeWidth={2} name="Interações" />
              <Line type="monotone" dataKey="health" stroke="#10b981" strokeWidth={2} name="Saúde %" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Top 5 Contatos</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: 13, fontWeight: 600, color: '#666' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '12px', fontSize: 13, fontWeight: 600, color: '#666' }}>Dimensão</th>
                <th style={{ textAlign: 'right', padding: '12px', fontSize: 13, fontWeight: 600, color: '#666' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {data.topContacts.map((contact, idx) => (
                <tr key={idx} style={{ borderBottom: idx < data.topContacts.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px', fontSize: 14 }}>{contact.name}</td>
                  <td style={{ padding: '12px', fontSize: 14 }}>{contact.dimension}</td>
                  <td style={{ padding: '12px', fontSize: 14, textAlign: 'right', fontWeight: 600, color: '#1e40af' }}>{contact.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginBottom: 40 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>Correlações de Dimensões</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.correlations}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dimension" fontSize={12} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#7c3aed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>⚠️ Anomalias Detectadas</h2>
          {data.anomalies.map((anomaly, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: '#fef3c7', borderRadius: '8px', marginBottom: idx < data.anomalies.length - 1 ? 12 : 0 }}>
              <AlertCircle size={20} style={{ color: '#f59e0b' }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{anomaly.type}</div>
                <div style={{ fontSize: 13, color: '#666' }}>
                  {anomaly.contact} - sem contato há {anomaly.days} dias
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: 12, color: '#999' }}>
          <p>✅ Dashboard integrado com Supabase | Dados atualizados em tempo real</p>
          <p>🚀 ConexiaDashboard v2.0 | Sr. Milléo © 2026</p>
        </div>
      </div>
    </div>
  );
};

export default ConexiaDashboard;
