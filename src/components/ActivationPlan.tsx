import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { CheckCircle2, Circle } from 'lucide-react';

interface ActivationPlanProps {
  userId: string;
  phase: number;
  week: number;
}

interface PlanStep {
  step_number: number;
  title: string;
  description: string;
  completed: boolean;
}

const PLAN_STEPS: Record<number, any[]> = {
  1: [
    {
      step_number: 1,
      title: 'Mapear contatos',
      description: 'Construir a fundação da sua rede.\n→ Cadastre 10 contatos estratégicos\n→ Classifique cada um\n→ Defina frequência ideal\n→ Escreva notas sobre cada pessoa',
      meta: 'META: 10 contatos cadastrados'
    },
    {
      step_number: 2,
      title: 'Reativar relações',
      description: 'Reconectar com quem esfriou.\n→ Identifique 3 contatos com menor health\n→ Envie mensagem genuína para cada um\n→ Registre cada interação no CONÉXIA',
      meta: 'META: 3 contatos reativados'
    },
    {
      step_number: 3,
      title: 'Estabelecer ritual',
      description: 'Criar consistência em suas ações.\n→ Escolha 2 dias fixos na semana\n→ Dedique 30 minutos para contatos\n→ Registre todas as ações',
      meta: 'META: Padrão de 2 dias/semana'
    },
    {
      step_number: 4,
      title: 'Gerar valor',
      description: 'Nutrir sua rede com propósito.\n→ Envie 5 artigos/indicações úteis\n→ Sem pedir nada em troca\n→ Rastreie reações',
      meta: 'META: 5 envios de valor'
    }
  ]
};

export function ActivationPlan({ userId, phase, week }: ActivationPlanProps) {
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSteps = async () => {
      try {
        setLoading(true);
        const { data: completedData } = await supabase
          .from('plan_step_completion')
          .select('step_number')
          .eq('user_id', userId)
          .eq('phase', phase)
          .eq('week', week);

        const completedStepNumbers = new Set(
          completedData?.map((d: any) => d.step_number) || []
        );

        const phaseSteps = PLAN_STEPS[phase] || [];
        const mappedSteps = phaseSteps.map((step: any) => ({
          ...step,
          completed: completedStepNumbers.has(step.step_number)
        }));

        setSteps(mappedSteps);
      } catch (error) {
        console.error('Error loading plan steps:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSteps();

    const subscription = supabase
      .channel(`plan-steps-${userId}-${phase}-${week}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'plan_step_completion',
          filter: `user_id=eq.${userId}`
        },
        () => loadSteps()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [userId, phase, week]);

  const handleStepToggle = async (stepNumber: number, currentStatus: boolean) => {
    try {
      if (currentStatus) {
        await supabase
          .from('plan_step_completion')
          .delete()
          .eq('user_id', userId)
          .eq('phase', phase)
          .eq('week', week)
          .eq('step_number', stepNumber);
      } else {
        await supabase
          .from('plan_step_completion')
          .insert({
            user_id: userId,
            phase,
            week,
            step_number: stepNumber
          });
      }

      setSteps(
        steps.map((s) =>
          s.step_number === stepNumber
            ? { ...s, completed: !currentStatus }
            : s
        )
      );
    } catch (error) {
      console.error('Error updating step:', error);
    }
  };

  if (loading) {
    return <div className="text-gray-400 text-center py-8">Carregando plano...</div>;
  }

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercentage = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-yellow-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-yellow-600 text-sm">PROGRESSO DA SEMANA</p>
          <p className="text-yellow-600 font-bold">
            {completedCount}/{steps.length}
          </p>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-yellow-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.step_number}
            onClick={() => handleStepToggle(step.step_number, step.completed)}
            className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
              step.completed
                ? 'bg-green-900 bg-opacity-20 border-green-700'
                : 'bg-gray-900 border-gray-700 hover:border-yellow-600'
            }`}
          >
            <div className="flex items-start gap-3">
              {step.completed ? (
                <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              ) : (
                <Circle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              )}

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3
                    className={`font-bold text-sm ${
                      step.completed
                        ? 'text-green-400 line-through'
                        : 'text-white'
                    }`}
                  >
                    {step.step_number}. {step.title}
                  </h3>
                  {step.completed && (
                    <span className="text-xs text-green-400">✓ Concluído</span>
                  )}
                </div>

                <p
                  className={`text-xs whitespace-pre-line ${
                    step.completed
                      ? 'text-green-300 opacity-75'
                      : 'text-gray-400'
                  }`}
                >
                  {step.description}
                </p>

                <p
                  className={`text-xs mt-2 ${
                    step.completed ? 'text-green-400' : 'text-yellow-600'
                  }`}
                >
                  {step.meta}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-yellow-600 bg-opacity-10 border border-yellow-600 rounded-lg p-4 text-center">
        <p className="text-sm text-gray-300">
          {completedCount === steps.length
            ? '🎉 Semana concluída! Próximo passo: avançar de fase'
            : `${steps.length - completedCount} passos faltando`}
        </p>
      </div>
    </div>
  );
}
