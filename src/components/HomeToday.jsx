import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

import useRelationshipIntelligence from '../lib/useRelationshipIntelligence.js';

function firstName(name = '') {
  return String(name).trim().split(/\s+/)[0] || '';
}

function scoreLabel(score = 0) {
  if (score >= 110) return 'atenção imediata';
  if (score >= 95) return 'alta prioridade';
  if (score >= 80) return 'vale olhar hoje';
  return 'oportunidade';
}

function actionIcon(type) {
  if (type === 'birthday') return CalendarDays;
  if (
    type === 'overdue_next_action' ||
    type === 'upcoming_next_action' ||
    type === 'tracked_commitment'
  ) {
    return Clock3;
  }
  if (type === 'event_preparation' || type === 'event_followup') {
    return CalendarDays;
  }
  if (
    type === 'frequency_exceeded' ||
    type === 'strategic_relationship_cooling'
  ) {
    return Users;
  }
  return Target;
}

function DecisionCard({
  item,
  principal = false,
  onOpenContact,
  onTalkToDanna,
}) {
  if (!item) return null;

  const Icon = actionIcon(item.actionType);

  return (
    <article
      className={[
        'rounded-3xl border p-5 transition',
        principal
          ? 'border-violet-300/40 bg-violet-500/10'
          : 'border-white/10 bg-white/[0.035]',
      ].join(' ')}
    >
      <div className="flex items-start gap-4">
        <div
          className={[
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
            principal
              ? 'bg-violet-500/20 text-violet-200'
              : 'bg-white/10 text-white/80',
          ].join(' ')}
        >
          <Icon size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {principal && (
              <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">
                Primeiro olhar
              </span>
            )}

            <span className="text-xs text-white/45">
              {scoreLabel(item.score)}
            </span>

            {item.confidence >= 0.9 && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-300/80">
                <CheckCircle2 size={12} />
                evidência forte
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold leading-snug text-white">
            {item.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-white/65">
            {item.reason}
          </p>

          {item.nextMove && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-3.5">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/40">
                <ArrowRight size={13} />
                Próximo movimento
              </div>

              <p className="text-sm leading-5 text-white/80">
                {item.nextMove}
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {typeof onOpenContact === 'function' && (
              <button
                type="button"
                onClick={() => onOpenContact(item.contactId)}
                className="rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
              >
                Abrir {firstName(item.contactName)}
              </button>
            )}

            {typeof onTalkToDanna === 'function' && (
              <button
                type="button"
                onClick={() => onTalkToDanna(item)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-400"
              >
                <MessageCircle size={15} />
                Falar com Danna
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function HomeToday({
  user,
  contacts = [],
  interactions = [],
  alerts = [],
  onOpenContact,
  onTalkToDanna,
}) {
  const userId = user?.id || user?.user_id || null;

  const intelligence = useRelationshipIntelligence(
    userId,
    contacts,
    interactions,
    alerts
  );

  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);

    window.dispatchEvent(
      new Event('conexia:relationship-changed')
    );

    window.setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }

  const main = intelligence.main;
  const secondary = intelligence.secondary || [];
  const total = intelligence.decisions?.length || 0;

  return (
    <section className="w-full">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-violet-300">
            <Brain size={17} />
            Inteligência relacional
          </div>

          <h2 className="text-xl font-semibold text-white">
            Quem merece sua atenção agora?
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">
            O CONÉXIA cruza sua rede, histórico, compromissos e agenda
            para sugerir o próximo movimento com contexto.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/10 hover:text-white"
          aria-label="Atualizar inteligência relacional"
        >
          <RefreshCw
            size={17}
            className={refreshing ? 'animate-spin' : ''}
          />
        </button>
      </div>

      {!intelligence.complete && userId && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55">
          <RefreshCw size={16} className="animate-spin" />
          Lendo sua rede completa…
        </div>
      )}

      {intelligence.error && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3">
          <AlertTriangle
            size={17}
            className="mt-0.5 shrink-0 text-amber-300"
          />

          <div>
            <p className="text-sm font-medium text-amber-100">
              Não consegui atualizar toda a inteligência da rede.
            </p>

            <p className="mt-1 text-xs leading-5 text-amber-100/60">
              {intelligence.error}
            </p>
          </div>
        </div>
      )}

      {main ? (
        <div className="space-y-3">
          <DecisionCard
            item={main}
            principal
            onOpenContact={onOpenContact}
            onTalkToDanna={onTalkToDanna}
          />

          {secondary.map((item) => (
            <DecisionCard
              key={item.recommendationId}
              item={item}
              onOpenContact={onOpenContact}
              onTalkToDanna={onTalkToDanna}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <Sparkles size={20} />
            </div>

            <div>
              <h3 className="font-semibold text-white">
                Nenhuma ação forte apareceu agora.
              </h3>

              <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                Isso não significa que sua rede está “resolvida”.
                Significa apenas que, com os dados disponíveis, o
                CONÉXIA não encontrou evidência suficiente para
                recomendar uma abordagem específica hoje.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/35">
        <span>
          {intelligence.coverage?.contacts || 0} contatos analisados
        </span>

        <span>
          {intelligence.coverage?.interactions || 0} interações
        </span>

        <span>
          {intelligence.coverage?.memories || 0} memórias relacionais
        </span>

        <span>
          {intelligence.coverage?.events || 0} eventos
        </span>

        {total > 0 && (
          <span>
            {total} {total === 1 ? 'prioridade' : 'prioridades'} agora
          </span>
        )}
      </div>
    </section>
  );
}
