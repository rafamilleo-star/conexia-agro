import { useEffect, useRef, useState } from 'react';
import { C } from '../utils/theme.js';
import { REHEARSAL_SCENARIOS, REHEARSAL_STANCES, requestRehearsal } from '../lib/conversationRehearsal.js';

const field = { width: '100%', boxSizing: 'border-box', padding: 10, background: C.sf, color: C.txt, border: `1px solid ${C.brd}`, borderRadius: 8, fontFamily: "'DM Sans'", fontSize: 14 };
const button = { padding: '10px 14px', background: C.gD, color: C.gold, border: `1px solid ${C.gL}`, borderRadius: 8, cursor: 'pointer', fontFamily: "'DM Sans'", fontSize: 13 };

export default function ConversationRehearsal({ contact, interactions = [], onFeedback }) {
  const [open, setOpen] = useState(false);
  const [scenario, setScenario] = useState('retomar');
  const [stance, setStance] = useState('receptivo');
  const [goal, setGoal] = useState('');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const request = useRef(null);
  const transcriptEnd = useRef(null);
  const turns = messages.filter(m => m.role === 'user').length;
  const id = `rehearsal-${contact.id}`;

  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  useEffect(() => { if (messages.length) transcriptEnd.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);

  const reset = () => {
    request.current?.abort(); request.current = null;
    setStarted(false); setMessages([]); setDraft(''); setFeedback(null); setError(''); setBusy(false);
  };
  const run = async (review = false) => {
    if (request.current || (!review && !draft.trim()) || (review && !turns)) return;
    const next = review ? messages : [...messages, { role: 'user', text: draft.trim() }];
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError('');
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const result = await requestRehearsal({ contact, interactions, scenario, stance, goal, messages: next, feedback: review }, controller.signal);
      if (request.current !== controller) return;
      if (review) { setFeedback(result); onFeedback?.(result, goal); }
      else { setMessages([...next, { role: 'assistant', text: result.resposta }]); setDraft(''); }
    } catch (e) {
      if (request.current === controller) setError(e.name === 'AbortError' ? 'O ensaio demorou a responder. Tente novamente.' : e.message);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  };

  return (
    <section style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, marginBottom: 16, fontFamily: "'DM Sans'", color: C.txt }}>
      <button type="button" aria-expanded={open} aria-controls={id} style={button} onClick={() => { if (open) reset(); setOpen(!open); }}> {open ? 'Fechar ensaio' : 'Ensaiar conversa'} </button>
      {open && <div id={id}>
        <p style={{ fontSize: 13, color: C.txM, lineHeight: 1.6 }}>Pratique antes de falar com {contact.name}. As respostas são fictícias e não representam o que essa pessoa pensa. O ensaio não é registrado como interação.</p>
        {!started ? <form onSubmit={e => { e.preventDefault(); if (goal.trim()) setStarted(true); }}>
          <label htmlFor={`${id}-scenario`} style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>O que você quer praticar?</label>
          <select id={`${id}-scenario`} value={scenario} onChange={e => setScenario(e.target.value)} style={field}>{REHEARSAL_SCENARIOS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <label htmlFor={`${id}-stance`} style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Postura do interlocutor fictício</label>
          <select id={`${id}-stance`} value={stance} onChange={e => setStance(e.target.value)} style={field}>{REHEARSAL_STANCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <label htmlFor={`${id}-goal`} style={{ display: 'block', fontSize: 13, margin: '12px 0 6px' }}>Qual resultado você busca nessa conversa?</label>
          <textarea id={`${id}-goal`} value={goal} onChange={e => setGoal(e.target.value)} maxLength={500} required rows={2} placeholder="Ex.: retomar a relação e combinar uma conversa na próxima semana." style={field} />
          <button type="submit" disabled={!goal.trim()} style={{ ...button, marginTop: 12, opacity: goal.trim() ? 1 : 0.5 }}>Começar ensaio</button>
        </form> : <div>
          <div style={{ fontSize: 12, color: C.txM, marginBottom: 12 }}>Objetivo: {goal} · Até 5 respostas suas</div>
          <div role="log" aria-label="Conversa simulada" aria-live="polite" style={{ maxHeight: 340, overflowY: 'auto' }}>
            {!messages.length && <p style={{ fontSize: 14 }}>Como você abriria a conversa?</p>}
            {messages.map((m, index) => <div key={index} style={{ background: m.role === 'user' ? C.sf : C.gD, borderRadius: 8, padding: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: C.gold, marginBottom: 4 }}>{m.role === 'user' ? 'Você' : 'Interlocutor fictício'}</div>
              <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
            </div>)}
            <div ref={transcriptEnd} />
          </div>
          {!feedback && <>
            {turns < 5 && <form onSubmit={e => { e.preventDefault(); run(); }} style={{ marginTop: 12 }}>
              <label htmlFor={`${id}-reply`} style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>Sua resposta</label>
              <textarea id={`${id}-reply`} value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} maxLength={1200} rows={3} style={field} />
              <button type="submit" disabled={busy || !draft.trim()} style={{ ...button, marginTop: 8, opacity: busy || !draft.trim() ? 0.5 : 1 }}>{busy ? 'Aguarde...' : 'Enviar no ensaio'}</button>
            </form>}
            {turns > 0 && <button type="button" onClick={() => run(true)} disabled={busy} style={{ ...button, marginTop: 12 }}>{busy ? 'Aguarde...' : 'Finalizar e receber feedback'}</button>}
          </>}
          {feedback && <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 16, color: C.gold }}>Feedback deste ensaio</h3>
            {feedback.trecho && <blockquote style={{ margin: '12px 0', paddingLeft: 12, borderLeft: `2px solid ${C.gold}`, fontSize: 14 }}>“{feedback.trecho}”</blockquote>}
            {[['acerto', 'O que funcionou'], ['ajuste', 'O que ajustar'], ['alternativa', 'Uma abertura para experimentar']].map(([key, label]) => <div key={key} style={{ marginBottom: 12 }}><strong style={{ fontSize: 12, color: C.gold }}>{label}</strong><p style={{ fontSize: 14, lineHeight: 1.6, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{feedback[key]}</p></div>)}
            <p style={{ color: C.txM, fontSize: 12 }}>Esta análise é sobre sua prática, não uma previsão do resultado real.</p>
          </div>}
          <button type="button" onClick={reset} style={{ ...button, marginTop: 12 }}>Recomeçar</button>
        </div>}
        {error && <p role="alert" style={{ color: C.cor, fontSize: 13 }}>{error}</p>}
        {busy && <p role="status" style={{ color: C.txM, fontSize: 12 }}>Preparando resposta do ensaio...</p>}
      </div>}
    </section>
  );
}
