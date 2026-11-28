import React, { useMemo, useState } from 'react';
import {
  Users, Brain, MessageCircle, CalendarDays, Target,
  ArrowRight, Sparkles, CheckCircle2, Clock3,
} from 'lucide-react';
import ConexiaEssential from './ConexiaEssential';
import { computeRelationshipIntelligence } from '../../shared/relationshipIntelligence.js';

const COLORS = {
  bg: '#080F23', panel: '#111C37', ink: '#F4F5FF',
  muted: '#ADBAD5', purple: '#8E67FF', border: '#2B3653',
};

const tiles = [
  { id: 'pessoas', title: 'Pessoas', subtitle: 'Seus contatos', icon: Users, color: '#8358F6' },
  { id: 'teia', title: 'Teia', subtitle: 'Mapa da rede', icon: Target, color: '#4775ED' },
  { id: 'danna', title: 'Danna', subtitle: 'Sua assistente', icon: Brain, color: '#A156E8' },
  { id: 'whatsapp', title: 'WhatsApp', subtitle: 'Danna no celular', icon: MessageCircle, color: '#179B68' },
  { id: 'diagnostico', title: 'Diagnóstico', subtitle: 'Perfil relacional', icon: Sparkles, color: '#E7A13D' },
  { id: 'insights', title: 'Insights', subtitle: 'Inteligência da rede', icon: Brain, color: '#5C7EF3' },
  { id: 'plano', title: 'Meu plano', subtitle: 'Próximas etapas', icon: CheckCircle2, color: '#B067EA' },
  { id: 'agenda', title: 'Agenda', subtitle: 'Acompanhar ações', icon: CalendarDays, color: '#E88E66' },
  { id: 'perfil', title: 'Meu perfil', subtitle: 'Dados e ajustes', icon: Users, color: '#6795A8' },
];

const buttonBase = {
  border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  WebkitTapHighlightColor: 'transparent',
};

export default function ConexiaV2Hub({
  firstName = '', userId, contacts = [], interactions = [], isPro = false,
  hasVoiceAccess = false, whatsappEnabled = false, onNavigate,
  onUpdated, onFirstPerson, onPerson,
}) {
  const [subpage, setSubpage] = useState('inicio');
  const displayName = String(firstName).trim().split(/\s+/)[0] || 'você';
  const pendingCount = contacts.filter((c) => Boolean(c?.next_action ?? c?.nextAction)).length;

  const recommendation = useMemo(() => {
    try { return computeRelationshipIntelligence({ contacts, interactions })?.main ?? null; }
    catch { return null; }
  }, [contacts, interactions]);

  const recommended = contacts.find((c) =>
    c.id === (recommendation?.relationshipId ?? recommendation?.contactId)
  );

  const enter = (id) => {
    if (id === 'preparar' || id === 'registrar' || id === 'ciclo') {
      setSubpage(id);
      return;
    }
    onNavigate?.(id);
  };

  if (subpage !== 'inicio') {
    return (
      <div style={{ maxWidth: 850, margin: '0 auto' }}>
        <ConexiaEssential
          key={subpage}
          userId={userId}
          contacts={contacts}
          interactions={interactions}
          isPro={isPro}
          onUpdated={onUpdated}
          onFirstPerson={onFirstPerson}
          onPerson={onPerson}
          onBack={() => setSubpage('inicio')}
          initialMode={
            subpage === 'preparar'
              ? 'prepare'
              : subpage === 'registrar' ? 'register' : 'home'
          }
        />
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 1080,
      margin: '0 auto',
      padding: 'clamp(18px, 4vw, 32px)',
      borderRadius: 26,
      background: COLORS.bg,
      backgroundImage: 'radial-gradient(circle at 90% 0%, rgba(141,100,255,.24), transparent 35%), radial-gradient(circle at 5% 65%, rgba(45,83,191,.15), transparent 34%)',
      border: "1px solid " + COLORS.border,
      color: COLORS.ink,
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div aria-hidden="true" style={{
            width: 42, height: 42,
            display: 'grid', placeItems: 'center',
            borderRadius: 13,
            background: 'linear-gradient(135deg,#A46DFF,#4257D8)',
            fontSize: 25, fontWeight: 800,
          }}>∞</div>
          <div>
            <strong style={{ fontSize: 18, letterSpacing: '.06em' }}>CONÉXIA</strong>
            <div style={{ fontSize: 10, color: COLORS.muted }}>INTELIGÊNCIA RELACIONAL</div>
          </div>
        </div>
        <span style={{
          borderRadius: 30,
          border: "1px solid " + COLORS.border,
          color: '#CDC4FF',
          padding: '7px 11px',
          fontSize: 11,
        }}>PRÉVIA V2</span>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#CDC4FF', fontSize: 13, marginBottom: 8 }}>
          Olá, {displayName} 👋
        </div>
        <h1 style={{
          fontSize: 'clamp(26px, 5vw, 38px)',
          lineHeight: 1.12,
          margin: '0 0 12px',
          fontWeight: 800,
        }}>
          Sua rede de relacionamentos.
          <span style={{ display: 'block', color: '#AD93FF' }}>Tudo ao seu alcance.</span>
        </h1>
        <p style={{ color: COLORS.muted, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          Escolha o que quer fazer. O CONÉXIA leva você diretamente para a ferramenta certa.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}>
        <button type="button" onClick={() => enter('preparar')}
          style={{
            ...buttonBase,
            textAlign: 'left',
            padding: 20,
            borderRadius: 18,
            color: '#FFFFFF',
            background: 'linear-gradient(135deg,#8654F7,#5047D8)',
            boxShadow: '0 12px 36px rgba(79,57,180,.25)',
          }}>
          <Sparkles size={27} aria-hidden="true" />
          <div style={{ fontSize: 17, fontWeight: 800, margin: '16px 0 5px' }}>
            Preparar uma conversa
          </div>
          <div style={{ fontSize: 12, opacity: .93, lineHeight: 1.45 }}>
            Veja o histórico e o que vale lembrar antes de conversar.
          </div>
          <ArrowRight size={19} style={{ marginTop: 12 }} aria-hidden="true" />
        </button>

        <button type="button" onClick={() => enter('registrar')}
          style={{
            ...buttonBase,
            textAlign: 'left',
            padding: 20,
            borderRadius: 18,
            color: COLORS.ink,
            background: COLORS.panel,
            border: '1px solid #455078',
          }}>
          <MessageCircle size={27} color="#AD93FF" aria-hidden="true" />
          <div style={{ fontSize: 17, fontWeight: 800, margin: '16px 0 5px' }}>
            Registrar conversa
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.45 }}>
            Guarde o combinado e não perca o próximo passo.
          </div>
          <ArrowRight size={19} color="#AD93FF" style={{ marginTop: 12 }} aria-hidden="true" />
        </button>
      </div>

      {(recommended || pendingCount > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginTop: 14,
          padding: '11px 16px',
          background: 'rgba(255,255,255,.06)',
          borderRadius: 12,
          border: "1px solid " + COLORS.border,
        }}>
          <Clock3 size={17} color="#B9A3FF" aria-hidden="true" />
          <span style={{ fontSize: 12, color: COLORS.muted, flex: 1 }}>
            {recommended
              ? "Para olhar agora: " + recommended.name
              : String(pendingCount) + " compromisso(s) em aberto"}
          </span>
          <button type="button" onClick={() => enter('ciclo')}
            style={{
              ...buttonBase,
              background: 'transparent',
              color: '#D7CAFF',
              fontWeight: 700,
              fontSize: 12,
            }}>
            Ver ação →
          </button>
        </div>
      )}

      <section style={{ marginTop: 30 }} aria-label="Ferramentas do CONÉXIA">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 14,
        }}>
          <h2 style={{ fontSize: 17, margin: 0 }}>Suas ferramentas</h2>
          <span style={{ color: COLORS.muted, fontSize: 12 }}>Toque para entrar</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
          gap: 11,
        }}>
          {tiles.map((tile) => {
            const Icon = tile.icon;
            const subtitle =
              tile.id === 'whatsapp' && !whatsappEnabled
                ? 'Configurar acesso'
                : tile.subtitle;

            return (
              <button key={tile.id} type="button" onClick={() => enter(tile.id)}
                style={{
                  ...buttonBase,
                  textAlign: 'left',
                  background: '#FFFFFF',
                  color: '#14203A',
                  minHeight: 142,
                  padding: 16,
                  borderRadius: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  boxShadow: '0 8px 22px rgba(1,4,18,.12)',
                }}>
                <div style={{
                  width: 46, height: 46,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 14,
                  background: tile.color + "1F",
                  color: tile.color,
                  marginBottom: 'auto',
                }}>
                  <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
                </div>
                <strong style={{ fontSize: 14, marginTop: 13 }}>
                  {tile.title}
                </strong>
                <span style={{
                  fontSize: 11,
                  color: '#60708B',
                  marginTop: 3,
                  lineHeight: 1.25,
                }}>
                  {subtitle}
                </span>
              </button>
            );
          })}

          {hasVoiceAccess && (
            <button type="button" onClick={() => enter('danna-voz')}
              style={{
                ...buttonBase,
                textAlign: 'left',
                background: '#FFFFFF',
                color: '#14203A',
                minHeight: 142,
                padding: 16,
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}>
              <div style={{
                width: 46, height: 46,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 14,
                background: '#AD93FF33',
                color: '#8156E9',
                marginBottom: 'auto',
              }}>
                <MessageCircle size={24} strokeWidth={2.2} aria-hidden="true" />
              </div>
              <strong style={{ fontSize: 14, marginTop: 13 }}>Danna por voz</strong>
              <span style={{ fontSize: 11, color: '#60708B', marginTop: 3 }}>
                Conversa ao vivo
              </span>
            </button>
          )}
        </div>
      </section>

      <div style={{
        color: '#8393AF',
        fontSize: 11,
        lineHeight: 1.5,
        marginTop: 23,
        textAlign: 'center',
      }}>
        Prévia de navegação: as páginas antigas podem acessar o banco real.
        Não salve alterações durante este teste.
      </div>
    </div>
  );
}
