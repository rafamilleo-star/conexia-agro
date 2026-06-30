import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { Plus, Lightbulb, Loader } from 'lucide-react';
import { ActivationPlan } from './ActivationPlan';

interface Contact {
  id: string;
  name: string;
  relationship_type: string;
  last_interaction: string;
  interaction_count: number;
}

interface AssessmentScore {
  intencao_estrategica: number;
  escuta_relacional: number;
  presenca_mercado: number;
  reciprocidade_ativa: number;
  ritual_consistencia: number;
  confianca_autentica: number;
}

interface InteractionModalProps {
  contact: Contact;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (type: string, notes: string) => void;
}

const INTERACTION_TYPES = [
  { id: 'call', label: '📞 Ligação' },
  { id: 'message', label: '💬 Mensagem' },
  { id: 'meeting', label: '🤝 Reunião' },
  { id: 'email', label: '📧 Email' },
  { id: 'share', label: '📤 Compartilhei valor' }
];

const DIMENSION_LABELS: Record<keyof AssessmentScore, string> = {
  intencao_estrategica: 'Estratégia',
  escuta_relacional: 'Empatia',
  presenca_mercado: 'Presença',
  reciprocidade_ativa: 'Reciprocidade',
  ritual_consistencia: 'Consistência',
  confianca_autentica: 'Autenticidade'
};

function InteractionModal({ contact, isOpen, onClose, onSubmit }: InteractionModalProps) {
  const [selectedType, setSelectedType] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedType) return;
    setLoading(true);
    await onSubmit(selectedType, notes);
    setSelectedType('');
    setNotes('');
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold text-white mb-4">Registrar interação com {contact.name}</h3>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-400 mb-2">Tipo de interação:</p>
            <div className="grid grid-cols-2 gap-2">
              {INTERACTION_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-3 rounded-lg border-2 transition text-sm ${
                    selectedType === type.id
                      ? 'bg-yellow-600 bg-opacity-20 border-yellow-600 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-yellow-600'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-400 mb-2">Notas (opcional):</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="O que vocês conversaram? Qual foi o contexto?"
              className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white text-sm placeholder-gray-600"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-2 rounded transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedType || loading}
              className="flex-1 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-black font-bold py-2 rounded transition"
            >
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIInsights({ userId }: { userId: string }) {
  const [insights, setInsights] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const generateInsights = async () => {
      try {
        setLoading(true);
        setError('');

        // Buscar dados reais do usuário
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId);

        const { data: profileData } = await supabase
          .from('profiles')
          .select('assessment_scores')
          .eq('id', userId)
          .single();

        const { data: interactions } = await supabase
          .from('interactions')
          .select('*')
          .eq('user_id', userId)
          .order('interaction_date', { ascending: false })
          .limit(10);

        // Preparar dados para enviar à IA
        const contactsByType = contacts?.reduce((acc: Record<string, number>, c: any) => {
          acc[c.relationship_type] = (acc[c.relationship_type] || 0) + 1;
          return acc;
        }, {});

        const recentInteractionTypes = interactions?.reduce((acc: Record<string, number>, i: any) => {
          acc[i.interaction_type] = (acc[i.interaction_type] || 0) + 1;
          return acc;
        }, {});

        const scores: AssessmentScore = profileData?.assessment_scores || {
          intencao_estrategica: 0,
          escuta_relacional: 0,
          presenca_mercado: 0,
          reciprocidade_ativa: 0,
          ritual_consistencia: 0,
          confianca_autentica: 0
        };

        const lowestDimension = Object.entries(scores).sort(([,a], [,b]) => a - b)[0];
        const highestDimension = Object.entries(scores).sort(([,a], [,b]) => b - a)[0];

        // Chamar Claude API para gerar insights
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': import.meta.env.VITE_CLAUDE_API_KEY || ''
          },
          body: JSON.stringify({
            model: 'claude-opus-4-6',
            max_tokens: 500,
            messages: [
              {
                role: 'user',
                content: `Você é um assessor estratégico de networking. Analise esses dados reais do usuário e gere 2-3 insights ESPECÍFICOS e ACIONÁVEIS (máx 2 linhas cada):

CONTATOS: ${contacts?.length || 0} cadastrados
- Por tipo: ${JSON.stringify(contactsByType)}

INTERAÇÕES RECENTES (últimas 10): 
- Por tipo: ${JSON.stringify(recentInteractionTypes)}

DIMENSÕES RELACIONAIS (escala 0-10):
- ${DIMENSION_LABELS[lowestDimension[0] as keyof AssessmentScore]}: ${lowestDimension[1]}/10 (MAIS BAIXA)
- ${DIMENSION_LABELS[highestDimension[0] as keyof AssessmentScore]}: ${highestDimension[1]}/10 (mais forte)

GERE insights que:
1. Identifiquem um gap real nos dados
2. Sugiram UMA ação concreta (não genérica)
3. Conectem aos dados e às dimensões

Formato: [emoji] Insight · Ação (máx 2 linhas por insight)
Máximo 3 insights. Direto ao ponto.`
              }
            ]
          })
        });

        if (!response.ok) {
          throw new Error('Erro ao gerar insights com IA');
        }

        const data = await response.json();
        const insightText = data.content[0]?.text || 'Não foi possível gerar insights no momento.';
        setInsights(insightText);
      } catch (err) {
        console.error('Error generating insights:', err);
        setError('Erro ao gerar insights');
      } finally {
        setLoading(false);
      }
    };

    generateInsights();
  }, [userId]);

  return (
    <div className="bg-gradient-to-br from-yellow-600/5 to-yellow-500/5 border border-yellow-600/30 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-bold text-yellow-500 mb-3">💡 Insights Inteligentes</h3>
          
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              Analisando seus dados...
            </div>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : (
            <div className="space-y-2 text-sm text-gray-300 whitespace-pre-line">
              {insights}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NewLiveDashboard({ userId }: { userId: string }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const { data } = await supabase
          .from('contacts')
          .select('*')
          .eq('user_id', userId)
          .order('last_interaction', { ascending: false });

        setContacts(data || []);
      } catch (error) {
        console.error('Error loading contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadContacts();

    const subscription = supabase
      .channel(`contacts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`
        },
        () => loadContacts()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const handleInteractionSubmit = async (type: string, notes: string) => {
    if (!selectedContact) return;

    try {
      await supabase.from('interactions').insert({
        user_id: userId,
        contact_id: selectedContact.id,
        interaction_type: type,
        notes: notes || null,
        interaction_date: new Date().toISOString()
      });

      setShowModal(false);
      setSelectedContact(null);
    } catch (error) {
      console.error('Error registering interaction:', error);
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-20">Carregando dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold">Dashboard de Ativação</h1>
            <p className="text-gray-400 mt-2">Seus contatos e progresso em tempo real</p>
          </div>
        </div>

        {/* Plano de Ativação - VIVO */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">📋 Plano de Ativação</h2>
          <ActivationPlan userId={userId} phase={1} week={1} />
        </div>

        {/* Insights com IA - VIVO */}
        <AIInsights userId={userId} />

        {/* Contatos - REAIS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">👥 Seus Contatos</h2>
            <span className="text-sm text-gray-400">{contacts.length} contatos</span>
          </div>

          {contacts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-12 text-center">
              <p className="text-gray-400 mb-4">Nenhum contato ainda. Comece a cadastrar contatos no seu plano.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {contacts.map(contact => (
                <div
                  key={contact.id}
                  className="bg-gray-900 border border-gray-700 hover:border-yellow-600 rounded-lg p-4 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-white">{contact.name}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Tipo: <span className="text-gray-300">{contact.relationship_type}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {contact.interaction_count} interações
                        {contact.last_interaction && ` • Última: ${new Date(contact.last_interaction).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedContact(contact);
                        setShowModal(true);
                      }}
                      className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-2 px-4 rounded transition text-sm flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Ação
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal */}
        <InteractionModal
          contact={selectedContact || { id: '', name: '', relationship_type: '', last_interaction: '', interaction_count: 0 }}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSubmit={handleInteractionSubmit}
        />
      </div>
    </div>
  );
}
