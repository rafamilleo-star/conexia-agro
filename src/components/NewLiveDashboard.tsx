import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, TrendingUp, X } from 'lucide-react';

interface UserPlan {
  id: string;
  target_dimension: string;
  target_dimension_score: number;
  phase: number;
  week: number;
}

interface PlanPhase {
  phase: number;
  week_start: number;
  week_end: number;
  title: string;
  description: string;
  objective: string;
  target_interactions: number;
}

interface PlanProgress {
  phase: number;
  week: number;
  interactions_count: number;
  contacts_engaged: number;
  target_interactions: number;
  progress_percentage: number;
  status: 'completed' | 'on_track' | 'partial' | 'behind';
}

interface Contact {
  id: string;
  name: string;
  company: string;
  interaction_count: number;
  last_interaction: string;
  engagement_status: 'active' | 'recent' | 'inactive';
  days_since_last_contact: number;
}

interface WeeklyStats {
  total_interactions: number;
  contacts_engaged: number;
  frequency_days: number;
}

interface ContactPattern {
  day_name: string;
  day_of_week: number;
  interaction_count: number;
}

interface Insight {
  id: string;
  insight_type: 'positive' | 'warning' | 'action';
  title: string;
  description: string;
  metric?: string;
  recommendation: string;
}

export function NewLiveDashboard() {
  const [userId, setUserId] = useState<string>('');
  const [plan, setPlan] = useState<UserPlan | null>(null);
  const [phases, setPhases] = useState<PlanPhase[]>([]);
  const [progress, setProgress] = useState<PlanProgress[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [stats, setStats] = useState<WeeklyStats | null>(null);
  const [pattern, setPattern] = useState<ContactPattern[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [interactionText, setInteractionText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        const { data: planData } = await supabase
          .from('user_plans')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (planData) setPlan(planData);

        const { data: phasesData } = await supabase
          .from('plan_phases')
          .select('*')
          .eq('user_id', userId)
          .order('phase');

        setPhases(phasesData || []);

        const { data: progressData } = await supabase
          .from('user_progress_vs_goal')
          .select('*')
          .eq('user_id', userId);

        setProgress(progressData || []);

        const { data: contactsData } = await supabase
          .from('contact_interaction_history')
          .select('*')
          .eq('user_id', userId)
          .order('interaction_count', { ascending: false })
          .limit(5);

        setContacts(contactsData || []);

        const { data: statsData } = await supabase
          .from('user_weekly_stats')
          .select('*')
          .eq('user_id', userId)
          .single();

        setStats(statsData || { total_interactions: 0, contacts_engaged: 0, frequency_days: 0 });

        const { data: patternData } = await supabase
          .from('contact_pattern_by_day')
          .select('*')
          .eq('user_id', userId)
          .order('day_of_week');

        setPattern(patternData || []);

        const { data: insightsData } = await supabase
          .from('plan_insights')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(3);

        setInsights(insightsData || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const handleSaveInteraction = async () => {
    if (!selectedContact || !interactionText.trim() || !userId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('interactions')
        .insert({
          user_id: userId,
          contact_id: selectedContact.id,
          description: interactionText,
        });

      if (!error) {
        setInteractionText('');
        setSelectedContact(null);
        // Refresh data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error saving interaction:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-gold">Carregando seu dashboard...</div>
      </div>
    );
  }

  const currentPhase = progress.find(p => p.phase === plan?.phase && p.week === plan?.week);

  return (
    <div className="min-h-screen bg-black text-white p-4 pb-24">
      {/* HEADER */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg bg-gold flex items-center justify-center">
            <span className="text-black font-bold text-lg">C</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">CONÉXIA</h1>
            <p className="text-sm text-gray-400">Dashboard Pessoal</p>
          </div>
        </div>
      </div>

      {/* PLANO ATUAL */}
      {plan && (
        <div className="mb-6 border border-gold rounded-xl p-4 bg-opacity-5 bg-gold">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-gold mb-1">📋 SEU PLANO</h2>
              <p className="text-sm text-gray-300">
                Semanas {plan.week}-{plan.week + 1} • Fase {plan.phase} de 3
              </p>
            </div>
            <span className="text-2xl font-bold text-gold">
              {currentPhase?.progress_percentage || 0}%
            </span>
          </div>

          <div className="mb-4">
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gold transition-all duration-300"
                style={{ width: `${currentPhase?.progress_percentage || 0}%` }}
              />
            </div>
          </div>

          {phases[plan.phase - 1] && (
            <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
              <p className="font-bold text-gold text-sm mb-1">
                {phases[plan.phase - 1].title}
              </p>
              <p className="text-xs text-gray-400">
                {phases[plan.phase - 1].objective}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Meta: {phases[plan.phase - 1].target_interactions} interações
              </p>
            </div>
          )}
        </div>
      )}

      {/* STATS GRID */}
      {stats && (
        <div className="grid grid-cols-4 gap-2 mb-6">
          <div className="bg-gray-900 border border-gold rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gold">{stats.total_interactions}</p>
            <p className="text-xs text-gray-400">Interações</p>
            <p className="text-xs text-gray-500">semana</p>
          </div>
          <div className="bg-gray-900 border border-gold rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gold">{stats.contacts_engaged}</p>
            <p className="text-xs text-gray-400">Contatos</p>
            <p className="text-xs text-gray-500">engajados</p>
          </div>
          <div className="bg-gray-900 border border-gold rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gold">
              {Math.round(stats.frequency_days || 0)}d
            </p>
            <p className="text-xs text-gray-400">Frequência</p>
            <p className="text-xs text-gray-500">média</p>
          </div>
          <div className="bg-gray-900 border border-gold rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gold">
              {stats.total_interactions > 0 ? '↑' : '→'}
            </p>
            <p className="text-xs text-gray-400">Tendência</p>
            <p className="text-xs text-green-400">+20%</p>
          </div>
        </div>
      )}

      {/* PADRÃO DE CONTATO */}
      <div className="mb-6 border border-gray-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gold mb-3">📊 Padrão (últimas 2 semanas)</h3>
        <div className="flex items-end justify-between h-20 gap-1">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((day, idx) => {
            const dayData = pattern.find(p => p.day_of_week === idx);
            const count = dayData?.interaction_count || 0;
            const maxCount = Math.max(...pattern.map(p => p.interaction_count || 0), 5);
            const height = (count / maxCount) * 100;

            return (
              <div key={day} className="flex-1 flex flex-col items-center">
                <div className="w-full bg-gold rounded-sm" style={{ height: `${Math.max(height, 2)}px` }} />
                <p className="text-xs text-gray-400 mt-1">{day}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTATOS COM PROGRESSO - AGORA CLICÁVEIS */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gold mb-3">👥 Contatos com Progresso</h3>
        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="text-gray-500 text-sm p-4 text-center">
              Adicione contatos para começar a rastrear progresso
            </div>
          ) : (
            contacts.map(contact => (
              <div 
                key={contact.id} 
                className="bg-gray-900 border border-gray-700 rounded-lg p-3 cursor-pointer hover:border-gold transition-colors"
                onClick={() => setSelectedContact(contact)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm text-gold hover:text-white transition-colors">
                      {contact.name}
                    </p>
                    <p className="text-xs text-gray-400">{contact.company}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      contact.engagement_status === 'active'
                        ? 'bg-green-900 text-green-400'
                        : contact.engagement_status === 'recent'
                        ? 'bg-yellow-900 text-yellow-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {contact.days_since_last_contact}d
                  </span>
                </div>
                <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${(contact.interaction_count / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {contact.interaction_count} interações
                </p>
                <button className="mt-2 w-full bg-gold text-black text-xs font-bold py-1 rounded hover:bg-yellow-500 transition-colors">
                  + Registrar ação
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* INSIGHTS COM CTAs */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gold mb-3">💡 Insights desta Semana</h3>
        <div className="space-y-3">
          {insights.length === 0 ? (
            <div className="text-gray-500 text-sm p-4 text-center">
              Continue registrando para gerar insights
            </div>
          ) : (
            insights.map(insight => (
              <div
                key={insight.id}
                className={`rounded-lg p-3 border ${
                  insight.insight_type === 'positive'
                    ? 'bg-green-900 bg-opacity-20 border-green-700'
                    : insight.insight_type === 'warning'
                    ? 'bg-yellow-900 bg-opacity-20 border-yellow-700'
                    : 'bg-gold bg-opacity-10 border-gold'
                }`}
              >
                <div className="flex items-start gap-2">
                  {insight.insight_type === 'positive' && (
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  )}
                  {insight.insight_type === 'warning' && (
                    <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                  )}
                  {insight.insight_type === 'action' && (
                    <TrendingUp className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-sm mb-1">{insight.title}</p>
                    <p className="text-xs text-gray-300 mb-2">{insight.description}</p>
                    <p className="text-xs text-gray-400">→ {insight.recommendation}</p>
                    {insight.metric && (
                      <p className="text-xs text-gold font-bold mt-1">{insight.metric}</p>
                    )}
                    <button className="mt-2 text-xs bg-gold text-black px-3 py-1 rounded font-bold hover:bg-yellow-500 transition-colors">
                      Tomar ação
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PRÓXIMAS FASES */}
      <div className="border border-gray-700 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400 mb-2">📋 Próximas Semanas</h3>
        {phases
          .slice(plan?.phase || 0)
          .map(phase => (
            <div key={phase.phase} className="text-xs text-gray-500">
              <p className="font-bold mb-1">Semanas {phase.week_start}-{phase.week_end}: {phase.title}</p>
              <p className="text-gray-600">{phase.objective}</p>
            </div>
          ))}
      </div>

      {/* MODAL - REGISTRAR INTERAÇÃO */}
      {selectedContact && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gold rounded-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gold">Registrar ação com {selectedContact.name}</h3>
              <button
                onClick={() => {
                  setSelectedContact(null);
                  setInteractionText('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              value={interactionText}
              onChange={(e) => setInteractionText(e.target.value)}
              placeholder="O que você fez? (ex: ligação, reunião, envio de documento...)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-white text-sm mb-4 focus:border-gold focus:outline-none"
              rows={4}
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedContact(null);
                  setInteractionText('');
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInteraction}
                disabled={saving || !interactionText.trim()}
                className="flex-1 bg-gold hover:bg-yellow-500 disabled:opacity-50 text-black py-2 rounded font-bold transition-colors"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
