import { useEffect, useRef, useState } from 'react';
import { supabase } from '../utils/supabase';
import { C } from '../utils/theme.js';

async function request(path, body, signal) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Entre novamente no Conexia.');
  const response = await fetch(path, { method: body ? 'POST' : 'GET', signal,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'Não foi possível concluir.');
  return data;
}
export default function ContactCaptureCard({ userId, isPro, compact = false }) {
  const [items, setItems] = useState([]), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [names, setNames] = useState({}), [targets, setTargets] = useState({}), [exportGoogle, setExportGoogle] = useState(false);
  const [limit, setLimit] = useState(12), [ignored, setIgnored] = useState({});
  const active = useRef(0), controller = useRef(null);
  const key = `conexia_capture_ignored_${userId}`;
  useEffect(() => {
    try { setIgnored(JSON.parse(localStorage.getItem(key) || '{}')); } catch { setIgnored({}); }
    return () => { active.current++; controller.current?.abort(); };
  }, [key]);
  async function run(operation) {
    const turn = ++active.current; controller.current?.abort(); controller.current = new AbortController();
    setBusy(true); setMessage('');
    try { await operation(controller.current.signal, () => turn === active.current); }
    catch (e) { if (turn === active.current && e.name !== 'AbortError') setMessage(e.message); }
    finally { if (turn === active.current) setBusy(false); }
  }
  function load() {
    run(async (signal, alive) => {
      const results = await Promise.allSettled([request('/api/calendar-meeting-attendees', null, signal), request('/api/contact-capture', null, signal)]);
      if (!alive()) return;
      const all = new Map(), errors = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const item of r.value.candidates || []) if (item.token) all.set(item.source + ':' + item.key, item);
        } else if (r.reason?.name !== 'AbortError') errors.push(r.reason.message);
      }
      setItems([...all.values()]); setMessage(errors.join(' '));
    });
  }
  useEffect(() => { if (userId && isPro && !compact) load(); }, [userId, isPro, compact]);
  function ignore(id) {
    setIgnored(prev => { const next = { ...prev, [id]: true }; try { localStorage.setItem(key, JSON.stringify(next)); } catch {} return next; });
  }
  function photo(file) {
    if (!file) return;
    run(async (signal, alive) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) throw new Error('Envie JPG, PNG ou WebP de até 3 MB.');
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
      const data = await request('/api/contact-capture', { action: 'photo', base64, mimeType: file.type }, signal);
      if (alive()) { setItems(prev => [...data.candidates, ...prev.filter(p => !data.candidates.some(c => c.key === p.key))]); setMessage(data.candidates.length ? 'Confira os dados antes de salvar.' : 'Nenhum contato novo ou complemento legível nesta foto.'); }
    });
  }
  function confirm(item, id, newPerson = false) {
    run(async (signal, alive) => {
      const targetId = newPerson ? null : targets[id] || (item.matches.length === 1 ? item.matches[0].id : null);
      if (!newPerson && item.matches.length > 1 && !targetId) throw new Error('Escolha qual pessoa corresponde a esses dados.');
      const saved = await request('/api/contact-capture', { action: 'confirm', token: item.token, targetId, newPerson, name: names[id] }, signal);
      if (!alive()) return;
      setItems(prev => prev.filter(p => !(p.key === item.key && p.source === item.source)));
      window.dispatchEvent(new CustomEvent('conexia-contacts-changed', { detail: { userId } }));
      let text = saved.action === 'created' ? 'Pessoa cadastrada na sua rede.' : saved.action === 'enriched' ? 'Cadastro completado; dados existentes preservados.' : 'Cadastro já estava atualizado.';
      if (exportGoogle) {
        try { const result = await request('/api/contact-capture', { action: 'google_export', contactId: saved.contact.id }, signal); text += ' ' + result.message; }
        catch (e) { text += ' Salvo no Conexia. Google: ' + e.message; }
      }
      if (alive()) setMessage(text);
    });
  }
  const button = { padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.brd}`, background: C.card, color: C.txt, cursor: 'pointer' };
  if (!isPro) return null;
  const visible = items.filter(p => !ignored[p.source + ':' + p.key]);
  return <details open={!compact} style={{ margin: '16px 0', padding: 14, border: `1px solid ${C.brd}`, borderRadius: 12, color: C.txt, background: C.card }}>
    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Pessoas encontradas · foto, agenda e Google</summary>
    <p style={{ fontSize: 12 }}>Você decide quem entra na rede. Possíveis correspondências completam apenas campos vazios, após confirmação.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button style={button} disabled={busy} onClick={load}>Buscar pessoas</button>
      <button style={button} disabled={busy} onClick={() => run(async signal => { const data = await request('/api/calendar-oauth/google-start?contacts=1', null, signal); window.location.assign(data.authUrl); })}>Autorizar Contatos do Google</button>
      <label style={button}>Enviar foto<input aria-label="Foto de cartão ou contato" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} style={{ display: 'none' }} onChange={e => { photo(e.target.files?.[0]); e.target.value = ''; }} /></label>
    </div>
    <label style={{ display: 'block', marginTop: 12, fontSize: 12 }}><input type="checkbox" checked={exportGoogle} onChange={e => setExportGoogle(e.target.checked)} /> Salvar também nos Contatos do Google ao confirmar</label>
    {busy && <p role="status">Processando…</p>}
    {message && <p role="status" style={{ fontSize: 12 }}>{message}</p>}
    {visible.slice(0, limit).map(item => {
      const id = item.source + ':' + item.key, c = item.candidate;
      return <article key={id} style={{ borderTop: `1px solid ${C.brd}`, paddingTop: 12, marginTop: 12 }}>
        <strong>{c.name || c.contact_email || 'Contato da foto'}</strong><small style={{ display: 'block' }}>Origem: {item.source}</small>
        <p style={{ fontSize: 12 }}>{[c.contact_email, c.whatsapp, c.company, c.role].filter(Boolean).join(' · ')}</p>
        {item.matches.length > 0 && <><p style={{ fontSize: 12 }}>É a mesma pessoa? {[...item.matches.map(m => [m.name, m.company].filter(Boolean).join(' — '))].join('; ')}</p>
          {item.matches.length > 1 && <select aria-label="Escolha a pessoa existente" value={targets[id] || ''} onChange={e => setTargets(prev => ({ ...prev, [id]: e.target.value }))}><option value="">Escolha a pessoa</option>{item.matches.map(m => <option key={m.id} value={m.id}>{m.name} · {m.company || m.contact_email || m.whatsapp || m.id.slice(0, 8)}</option>)}</select>}
          {Object.keys(item.changes || {}).length > 0 && <p style={{ fontSize: 12 }}>Completar: {Object.values(item.changes).join(' · ')}</p>}
          {Object.keys(item.conflicts || {}).length > 0 && <p style={{ fontSize: 12 }}>Há informações diferentes. Os campos já preenchidos serão preservados; revise-os no cadastro.</p>}
        </>}
        {!c.name && <input aria-label="Nome do novo contato" placeholder="Nome da pessoa" value={names[id] || ''} onChange={e => setNames(prev => ({ ...prev, [id]: e.target.value }))} />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={button} disabled={busy} onClick={() => confirm(item, id)}>{item.matches.length ? 'Mesma pessoa · completar' : 'Adicionar à rede'}</button>
          {item.matches.length > 0 && item.reason !== 'email_telefone' && <button style={button} disabled={busy} onClick={() => confirm(item, id, true)}>É outra pessoa · cadastrar</button>}
          <button style={button} disabled={busy} onClick={() => ignore(id)}>Não relevante</button>
        </div>
      </article>;
    })}
    {visible.length > limit && <button style={button} onClick={() => setLimit(n => n + 12)}>Mostrar mais ({visible.length - limit})</button>}
  </details>;
}
