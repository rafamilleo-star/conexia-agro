// CONEXIA V2: entrada por relevancia, seguindo os tokens oficiais de marca.
// Alteracao restrita a apresentacao/navegacao; sem gravacoes diretas.
import React, { useState } from 'react';
import {
  ArrowLeft, ArrowRight, Brain as BrainCircuit, CalendarDays,
  CheckCircle2 as ClipboardList, MessageCircle, Users as Network, Plus, Sparkles,
  Target, Users as UserRound, Users, Info, CheckCircle2 as ListChecks,
} from 'lucide-react';
import ConexiaEssential from './ConexiaEssential';
import useRelationshipIntelligence from '../lib/useRelationshipIntelligence.js';
import { C } from '../utils/theme';
import marca from '../assets/brand/conexia_icone_transparente.svg';

const FONT = "'DM Sans', sans-serif";
const SERIF = "'Cormorant Garamond', Georgia, serif";
const BORDER = '1px solid ' + C.brd;
const GOLD_BORDER = '1px solid ' + C.gL;

const TOOLS = [
  { id: 'pessoas', name: 'Pessoas', caption: 'Sua rede', Icon: Users },
  { id: 'teia', name: 'Teia', caption: 'Conexoes', Icon: Network },
  { id: 'danna', name: 'Danna', caption: 'Assistente', Icon: BrainCircuit },
  { id: 'whatsapp', name: 'WhatsApp', caption: 'Danna no zap', Icon: MessageCircle },
  { id: 'diagnostico', name: 'Diagnostico', caption: 'Seu perfil', Icon: ClipboardList },
  { id: 'insights', name: 'Insights', caption: 'Sua leitura', Icon: Target },
  { id: 'plano', name: 'Meu plano', caption: '4 semanas', Icon: ListChecks },
  { id: 'agenda', name: 'Agenda', caption: 'Compromissos', Icon: CalendarDays },
  { id: 'perfil', name: 'Meu perfil', caption: 'Minha conta', Icon: UserRound },
];

const button = {
  fontFamily: FONT, cursor: 'pointer', borderRadius: 10, minHeight: 44,
  padding: '10px 14px', fontWeight: 700, fontSize: 13,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
};
const primary = { ...button, border: GOLD_BORDER, background: C.gold, color: C.bg };
const secondary = { ...button, border: GOLD_BORDER, background: C.gD, color: C.gold };
const quiet = { ...button, border: BORDER, background: C.sf, color: C.txt };

function personLabel(person, main) {
  return person?.name || main?.contactName || 'Pessoa da sua rede';
}

function shortDate(value) {
  if (!value) return '';
  const date = new Date(String(value).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

export default function ConexiaV2Hub({
  firstName = '', userId, contacts = [], interactions = [], isPro = false,
  hasVoiceAccess = false, whatsappEnabled = false, onNavigate,
  onUpdated, onFirstPerson, onPerson,
}) {
  const [subpage, setSubpage] = useState('inicio');
  const [activeContactId, setActiveContactId] = useState(null);
  const [expandedWhy, setExpandedWhy] = useState(false);
  const intel = useRelationshipIntelligence(userId, contacts, interactions);
  const main = intel.main || null;
  const secondaryDecisions = (intel.secondary || []).slice(0, 2);
  const selectedPerson = contacts.find((c) => String(c.id) === String(main?.contactId));
  const label = personLabel(selectedPerson, main);
  const greeting = String(firstName).trim().split(/\s+/)[0] || 'você';
  const hasPriority = Boolean(main && main.contactId);
  const realReason = typeof main?.reason === 'string' ? main.reason.trim() : '';
  const realAction = typeof main?.nextMove === 'string' ? main.nextMove.trim() : '';
  const companyLine = [selectedPerson?.role, selectedPerson?.company].filter(Boolean).join(' · ');
  const registeredAction = selectedPerson?.next_action || selectedPerson?.nextAction || '';
  const dueDate = shortDate(selectedPerson?.next_action_date || selectedPerson?.nextActionDate);

  function goToCycle(mode, contactId) {
    setActiveContactId(contactId || null);
    setSubpage(mode);
  }

  function chooseTool(id) {
    if (id === 'danna' && hasVoiceAccess) onNavigate?.('danna-voz');
    else onNavigate?.(id);
  }

  if (subpage !== 'inicio') {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', color: C.txt, fontFamily: FONT }}>
        <button type="button" onClick={() => setSubpage('inicio')} style={{ ...secondary, marginBottom: 14 }}>
          <ArrowLeft size={17} /> Inicio V2
        </button>
        <ConexiaEssential
          key={`${subpage}-${activeContactId || 'livre'}`}
          userId={userId}
          contacts={contacts}
          interactions={interactions}
          isPro={isPro}
          initialContactId={activeContactId}
          initialMode={subpage === 'preparar' ? 'prepare' : 'register'}
          onUpdated={onUpdated}
          onFirstPerson={onFirstPerson}
          onPerson={onPerson}
          onBack={() => setSubpage('inicio')}
        />
      </div>
    );
  }

  return (
    <div style={{
      color: C.txt, background: C.bg, fontFamily: FONT,
      width: '100%', maxWidth: 1040, margin: '0 auto', boxSizing: 'border-box',
      borderRadius: 14, padding: 'clamp(14px, 3vw, 28px)',
    }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 25 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={marca} alt="" aria-hidden="true" style={{ width: 39, height: 39, objectFit: 'contain' }} />
          <div>
            <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 700, letterSpacing: '.02em', lineHeight: 1 }}>CONÉXIA</div>
            <div style={{ fontSize: 9, color: C.txM, letterSpacing: '.11em', marginTop: 3 }}>INTELIGÊNCIA RELACIONAL</div>
          </div>
        </div>
        <div style={{ color: C.gold, fontSize: 10, border: GOLD_BORDER, padding: '6px 9px', borderRadius: 18, whiteSpace: 'nowrap' }}>PRÉVIA V2</div>
      </header>

      <div style={{ marginBottom: 19 }}>
        <div style={{ color: C.txM, fontSize: 13, marginBottom: 3 }}>Olá, {greeting}.</div>
        <h1 style={{ color: C.txt, font: `700 clamp(26px, 5vw, 36px)/1.12 ${SERIF}`, margin: 0 }}>
          Seu próximo movimento importa.
        </h1>
      </div>

      {/* Destaque absoluto: primeiro a pessoa, a evidência e o próximo passo. */}
      <section aria-label="Pessoa que merece sua atenção" style={{
        border: GOLD_BORDER, borderRadius: 16, padding: 'clamp(18px, 4vw, 26px)',
        background: `linear-gradient(145deg, ${C.gD} 0%, ${C.card} 52%, ${C.card} 100%)`,
        boxShadow: '0 8px 28px rgba(0,0,0,.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: '.10em', textTransform: 'uppercase' }}>
          <Target size={16} aria-hidden="true" /> SUA ATENÇÃO HOJE
        </div>

        {!intel.complete ? (
          <p style={{ color: C.txM, margin: '20px 0' }}>Analisando sua rede e o histórico disponível...</p>
        ) : hasPriority ? (
          <>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(34px, 6vw, 49px)', lineHeight: 1, margin: '16px 0 5px', fontWeight: 700, color: C.txt }}>
              {label}
            </h2>
            {companyLine && <p style={{ color: C.txM, fontSize: 13, margin: '5px 0 18px' }}>{companyLine}</p>}
            {realReason && (
              <p style={{ fontSize: 14, color: C.txt, lineHeight: 1.65, margin: companyLine ? '0 0 16px' : '12px 0 16px', maxWidth: 740 }}>
                {realReason}
              </p>
            )}
            {realAction && (
              <div style={{ borderLeft: `3px solid ${C.gold}`, padding: '5px 0 5px 13px', margin: '12px 0 16px' }}>
                <div style={{ fontSize: 10, color: C.gold, fontWeight: 800, letterSpacing: '.09em', marginBottom: 5 }}>PRÓXIMO MOVIMENTO</div>
                <div style={{ color: C.txt, fontSize: 14, lineHeight: 1.5 }}>{realAction}</div>
              </div>
            )}
            {!realReason && !realAction && <p style={{ color: C.txM, lineHeight: 1.5 }}>Esta pessoa apareceu como prioridade no seu radar relacional.</p>}
            {registeredAction && (
              <div style={{ background: C.sf, borderRadius: 9, border: BORDER, padding: 11, marginBottom: 16 }}>
                <div style={{ color: C.txM, fontSize: 11, marginBottom: 4 }}>Compromisso já registrado{dueDate ? ` · ${dueDate}` : ''}</div>
                <div style={{ color: C.txt, fontSize: 13 }}>{registeredAction}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
              <button type="button" style={primary} onClick={() => goToCycle('preparar', main.contactId)}>
                <Sparkles size={17} /> Preparar conversa <ArrowRight size={16} />
              </button>
              <button type="button" style={secondary} onClick={() => goToCycle('registrar', main.contactId)}>
                <MessageCircle size={16} /> Registrar contato
              </button>
              <button type="button" style={quiet} onClick={() => onPerson?.(main.contactId)}>
                <UserRound size={16} /> Ver pessoa
              </button>
            </div>
            <button type="button" onClick={() => setExpandedWhy((s) => !s)}
              style={{ border: 0, background: 'transparent', color: C.txM, cursor: 'pointer', fontSize: 12, marginTop: 16, padding: '4px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
              <Info size={14} /> {expandedWhy ? 'Ocultar critério' : 'Por que esta pessoa?'}
            </button>
            {expandedWhy && <p style={{ color: C.txM, fontSize: 12, lineHeight: 1.55, margin: '4px 0 0' }}>
              {realReason || 'O radar prioriza sinais registrados no histórico da sua rede, como compromissos, frequência e momento do relacionamento. Não prevê resultados.'}
            </p>}
          </>
        ) : (
          <div style={{ marginTop: 15 }}>
            <h2 style={{ fontFamily: SERIF, color: C.txt, fontSize: 29, margin: '0 0 7px' }}>A próxima pessoa ainda não apareceu.</h2>
            <p style={{ color: C.txM, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
              {intel.error
                ? 'Não foi possível consultar todas as informações da rede agora.'
                : contacts.length === 0
                  ? 'Cadastre uma pessoa para começar seu histórico relacional.'
                  : 'Ainda não há evidências suficientes para indicar uma pessoa com segurança.'}
            </p>
            <button type="button" style={primary} onClick={() => contacts.length ? chooseTool('pessoas') : onFirstPerson?.()}>
              {contacts.length ? 'Abrir minha rede' : 'Adicionar primeira pessoa'} <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>

      {/* Outras prioridades: no máximo duas, sem competir com a principal. */}
      {intel.complete && secondaryDecisions.length > 0 && (
        <section style={{ marginTop: 22 }} aria-label="Outras relações para acompanhar">
          <div style={{ color: C.txM, fontSize: 12, letterSpacing: '.02em', marginBottom: 10 }}>OUTRAS RELAÇÕES NO RADAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))', gap: 10 }}>
            {secondaryDecisions.map((item) => (
              <button type="button" key={item.recommendationId || item.contactId}
                onClick={() => onPerson?.(item.contactId)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', border: BORDER, background: C.card, borderRadius: 11, padding: 14, color: C.txt, cursor: 'pointer' }}>
                <span style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 14, fontFamily: FONT }}>{item.contactName}</strong>
                  {item.nextMove && <span style={{ display: 'block', fontSize: 12, color: C.txM, marginTop: 4, lineHeight: 1.4 }}>{item.nextMove}</span>}
                </span>
                <ArrowRight size={16} color={C.gold} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Ferramentas: navegação complementar, não a mensagem principal. */}
      <section style={{ marginTop: 30 }} aria-label="Ferramentas do CONÉXIA">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 }}>
          <h2 style={{ fontFamily: SERIF, color: C.txt, fontSize: 26, margin: 0 }}>Suas ferramentas</h2>
          <span style={{ fontSize: 11, color: C.txL }}>Toque para entrar</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: 10 }}>
          {TOOLS.map(({ id, name, caption, Icon }) => (
            <button key={id} type="button" onClick={() => chooseTool(id)}
              style={{ minHeight: 105, padding: '12px 7px', borderRadius: 12, border: BORDER, background: C.card, color: C.txt, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', textAlign: 'center' }}>
              <Icon color={C.gold} size={23} strokeWidth={1.8} aria-hidden="true" />
              <strong style={{ color: C.txt, font: `600 12px/1.15 ${FONT}` }}>{name}</strong>
              <span style={{ color: C.txM, font: `400 10px/1.2 ${FONT}` }}>{caption}</span>
            </button>
          ))}
        </div>
      </section>

      <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => goToCycle('preparar', main?.contactId || null)} style={quiet}>
          <Sparkles size={16} color={C.gold} /> Preparar outra conversa
        </button>
        <button type="button" onClick={() => goToCycle('registrar', main?.contactId || null)} style={quiet}>
          <Plus size={16} color={C.gold} /> Registrar interação
        </button>
      </div>

      <footer style={{ marginTop: 30, textAlign: 'center', color: C.txL, fontSize: 11, lineHeight: 1.5 }}>
        CONÉXIA · by I.Agro · Prévia de navegação. Não salve alterações neste ambiente.
      </footer>
    </div>
  );
}
