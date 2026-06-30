import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, ScatterChart, Scatter, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { TrendingUp, Users, MessageSquare, Zap, AlertCircle, Network } from 'lucide-react';

// Supabase client
const supabase = createClient(
  'https://goopogicgwqqovmphqrj.supabase.co',
  process.env.REACT_APP_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY_HERE'
);

export default function ConexiaDashboard({ userId }) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    kpis: {},
    dimensionTrends: [],
    topContacts: [],
    anomalies: [],
    dimensionCorrelations: [],
    recentInteractions: [],
    networkStats: {}
  });

  useEffect(() => {
    if (!userId) return;
    loadDashboardData();
  }, [userId]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load KPIs from dashboard_summary view
      const { data: summaryData, error: summaryError } = await supabase
        .from('dashboard_summary')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (summaryError) throw summaryError;

      // Load dimension trends
      const { data: trendsData, error: trendsError } = await supabase
        .from('dimension_trends')
        .select('*')
        .eq('period', 'week')
        .order('period_start', { ascending: false })
        .limit(30);

      if (trendsError) throw trendsError;

      // Load top contacts by influence
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .order('influencia_pessoas', { ascending: false })
        .limit(10);

      if (contactsError) throw contactsError;

      // Load anomalies
      const { data: anomaliesData, error: anomaliesError } = await supabase
        .from('anomalies')
        .select('*')
        .eq('user_id', userId)
        .eq('is_resolved', false)
        .order('detected_at', { ascending: false })
        .limit(10);

      if (anomaliesError) throw anomaliesError;

      // Load dimension correlations
      const { data: correlationsData, error: correlationsError } = await supabase
        .from('dimension_correlations')
        .select('*')
        .order('correlation_score', { ascending: false })
        .limit(15);

      if (correlationsError) throw correlationsError;

      // Load recent interactions
      const { data: interactionsData, error: interactionsError } = await supabase
        .from('interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15);

      if (interactionsError) throw interactionsError;

      // Calculate network stats
      const { data: networkData, error: networkError } = await supabase
        .from('people_network')
        .select('*')
        .eq('user_id', userId);

      if (networkError) throw networkError;

      setDashboardData({
        kpis: summaryData || {},
        dimensionTrends: trendsData || [],
        topContacts: contactsData || [],
        anomalies: anomaliesData || [],
        dimensionCorrelations: correlationsData || [],
        recentInteractions: interactionsData || [],
        networkStats: {
          totalPeople: networkData?.length || 0,
          avgCentrality: networkData?.reduce((sum, item) => sum + (item.centrality_score || 0), 0) / (networkData?.length || 1) || 0,
          totalDimensions: new Set(networkData?.flatMap(item => item.dimensions_discussed || [])).size || 0
        }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const { kpis, dimensionTrends, topContacts, anomalies, dimensionCorrelations, recentInteractions, networkStats } = dashboardData;

  // Transform data for charts
  const trendChartData = dimensionTrends
    .slice(0, 30)
    .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
    .map(item => ({
      date: new Date(item.period_start).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
      [item.dimension]: item.mentions_count,
      growth: item.growth_rate || 0
    }))
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.date === curr.date);
      if (existing) return [...acc.slice(0, -1), { ...existing, ...curr }];
      return [...acc, curr];
    }, []);

  const correlationChartData = dimensionCorrelations.map(item => ({
    name: `${item.dimension_a} ↔ ${item.dimension_b}`,
    correlation: parseFloat((item.correlation_score * 100).toFixed(1)),
    coMentions: item.co_mention_count
  }));

  const getSeverityColor = (severity) => {
    const colors = {
      1: 'bg-blue-100 text-blue-800',
      2: 'bg-yellow-100 text-yellow-800',
      3: 'bg-orange-100 text-orange-800',
      4: 'bg-red-100 text-red-800',
      5: 'bg-red-200 text-red-900'
    };
    return colors[severity] || colors[3];
  };

  const getTrendIndicator = (trend) => {
    const icons = {
      'up': '📈',
      'down': '📉',
      'stable': '➡️'
    };
    return icons[trend] || '—';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">CONÉXIA Analytics</h1>
          <p className="text-slate-600">Dashboard executivo de redes, dimensões e networking</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICard
            icon={<MessageSquare className="w-6 h-6" />}
            title="Capturas"
            value={kpis.total_captures || 0}
            subtitle="field captures"
            trend="+12%"
            color="blue"
          />
          <KPICard
            icon={<Users className="w-6 h-6" />}
            title="Contatos"
            value={kpis.total_contacts || 0}
            subtitle="na rede"
            trend="+5%"
            color="green"
          />
          <KPICard
            icon={<MessageSquare className="w-6 h-6" />}
            title="Interações"
            value={kpis.total_interactions || 0}
            subtitle="registradas"
            trend="+8%"
            color="purple"
          />
          <KPICard
            icon={<Zap className="w-6 h-6" />}
            title="Engajamento"
            value={Math.round(kpis.avg_engagement || 0)}
            subtitle="score médio"
            trend="+3%"
            color="orange"
          />
        </div>

        {/* Network Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pessoas na Rede</p>
                <p className="text-3xl font-bold text-gray-900">{networkStats.totalPeople}</p>
              </div>
              <Network className="w-10 h-10 text-indigo-500 opacity-50" />
            </div>
            <p className="text-xs text-gray-500 mt-3">Rede de influência ativa</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Dimensões Cobertas</p>
                <p className="text-3xl font-bold text-gray-900">{networkStats.totalDimensions}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-500 opacity-50" />
            </div>
            <p className="text-xs text-gray-500 mt-3">Áreas de influência</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-cyan-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Centralidade Média</p>
                <p className="text-3xl font-bold text-gray-900">{(networkStats.avgCentrality || 0).toFixed(1)}</p>
              </div>
              <Users className="w-10 h-10 text-cyan-500 opacity-50" />
            </div>
            <p className="text-xs text-gray-500 mt-3">Score de influência</p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Dimension Trends */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Tendências de Dimensões (30 dias)</h2>
            {trendChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                    cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                  <Legend />
                  {dimensionTrends.map((trend, idx) => (
                    <Line
                      key={idx}
                      type="monotone"
                      dataKey={trend.dimension}
                      stroke={`hsl(${idx * 60}, 70%, 50%)`}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">Sem dados disponíveis</p>
            )}
          </div>

          {/* Top Contacts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Contatos por Influência</h2>
            <div className="space-y-3">
              {topContacts.length > 0 ? (
                topContacts.map((contact, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{contact.name}</p>
                      <p className="text-xs text-gray-500">{contact.role || 'Contato'} • {contact.company}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{contact.influencia_pessoas || 0}</p>
                      <p className="text-xs text-gray-500">influência</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum contato registrado</p>
              )}
            </div>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Dimension Correlations */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Correlações entre Dimensões</h2>
            {correlationChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={correlationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '11px' }} angle={-45} textAnchor="end" />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} label={{ value: 'Correlação (%)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }}
                    formatter={(value) => `${value}%`}
                  />
                  <Bar dataKey="correlation" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">Sem dados de correlação</p>
            )}
          </div>

          {/* Anomalies */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Anomalias Detectadas</h2>
              {anomalies.length > 0 && <AlertCircle className="w-5 h-5 text-red-500" />}
            </div>
            <div className="space-y-3">
              {anomalies.length > 0 ? (
                anomalies.slice(0, 5).map((anomaly, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${getSeverityColor(anomaly.severity)}`}>
                    <p className="font-medium">{anomaly.anomaly_type}</p>
                    <p className="text-sm mt-1">{anomaly.description}</p>
                    <p className="text-xs mt-2 opacity-75">
                      {new Date(anomaly.detected_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">✓ Nenhuma anomalia detectada</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Interactions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Interações Recentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Tipo</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Descrição</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Sentimento</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Data</th>
                </tr>
              </thead>
              <tbody>
                {recentInteractions.length > 0 ? (
                  recentInteractions.slice(0, 8).map((interaction, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {interaction.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-600">{interaction.description?.substring(0, 40)}...</td>
                      <td className="py-3 px-3">
                        <span className={`text-sm font-medium ${
                          interaction.sentiment === 'positive' ? 'text-green-600' :
                          interaction.sentiment === 'negative' ? 'text-red-600' :
                          'text-yellow-600'
                        }`}>
                          {interaction.sentiment}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-500 text-xs">
                        {new Date(interaction.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-500">
                      Nenhuma interação registrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 py-6 border-t border-gray-200">
          <p>Dashboard CONÉXIA v2.0 • Última atualização: {new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </div>
    </div>
  );
}

// KPI Card Component
function KPICard({ icon, title, value, subtitle, trend, color }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600'
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg border-l-4 p-6 shadow-md hover:shadow-lg transition`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <div className="opacity-50">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">{subtitle}</span>
        <span className="text-xs font-semibold text-green-600">{trend}</span>
      </div>
    </div>
  );
}
