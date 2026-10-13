import { C } from '../utils/theme.js';

export default function DannaRehearsalView({ session, answer, busy, onCommand }) {
  return <section style={{ fontFamily: "'DM Sans'", color: C.txt }}>
    <h2 style={{ fontSize: 21, color: C.gold, marginTop: 0 }}>Ensaio com a Danna</h2>
    <p style={{ fontSize: 13, color: C.txM, lineHeight: 1.6 }}>Situação fictícia para praticar. Não representa o pensamento da pessoa e não entra no histórico de interações.</p>
    {session?.contact && <p style={{ fontSize: 14 }}>Preparação para falar com <strong>{session.contact.name}</strong></p>}
    {session?.goal && <p style={{ fontSize: 13, color: C.txM }}>Objetivo: {session.goal}</p>}
    <div role="log" aria-label="Ensaio de conversa" style={{ maxHeight: 320, overflowY: 'auto' }}>
      {(session?.messages || []).map((m, i) => <div key={i} style={{ padding: 12, marginBottom: 8, borderRadius: 8, background: m.role === 'user' ? C.sf : C.gD }}>
        <strong style={{ fontSize: 11, color: C.gold }}>{m.role === 'user' ? 'Você no ensaio' : 'Interlocutor fictício'}</strong>
        <p style={{ fontSize: 14, lineHeight: 1.6, margin: '4px 0', whiteSpace: 'pre-wrap' }}>{m.text}</p>
      </div>)}
    </div>
    <p aria-live="polite" style={{ fontSize: 14, lineHeight: 1.6 }}>{answer}</p>
    {session?.feedback?.trecho && <blockquote style={{ margin: '12px 0', color: C.txM }}>“{session.feedback.trecho}”</blockquote>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {session?.stage === 'practice' && <button type="button" disabled={busy || !session.messages.length} onClick={() => onCommand('finalizar ensaio')} style={{ padding: 10, background: C.gD, border: `1px solid ${C.gL}`, color: C.gold, borderRadius: 8 }}>Receber feedback</button>}
      {session?.stage === 'finished' && <button type="button" disabled={busy} onClick={() => onCommand('recomeçar')} style={{ padding: 10, background: C.gD, border: `1px solid ${C.gL}`, color: C.gold, borderRadius: 8 }}>Recomeçar</button>}
      <button type="button" onClick={() => onCommand('sair do ensaio')} style={{ padding: 10, background: C.sf, border: `1px solid ${C.brd}`, color: C.txt, borderRadius: 8 }}>Voltar à conversa real</button>
    </div>
  </section>;
}
