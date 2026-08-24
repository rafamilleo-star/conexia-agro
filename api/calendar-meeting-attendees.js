// api/calendar-meeting-attendees.js
//
// GET, chamado pelo frontend com Authorization: Bearer <supabase access
// token>. Traz a MESMA análise que o cron de calendário já faz (convidado
// de reunião que não bate com nenhum contato cadastrado) — mas dentro do
// app, sem depender do WhatsApp nem do limite de 1 mensagem automática/dia.
//
// Não persiste nada, não envia notificação — é leitura pura, sob demanda,
// pra Insights → Agenda (src/components/AbaIA.jsx). Reaproveita 100% da
// lógica de match/candidatos já usada pelo cron
// (api/_lib/relationshipAssistant/icsImport.js), pra nunca haver 2 fontes
// de verdade sobre "o que conta como convidado elegível".
//
// Janela: últimos 14 dias (reuniões que já rolaram) + próximos 7 dias
// (pra já cadastrar antes do encontro). Mais ampla que a do cron (24h)
// porque aqui é sob demanda, não uma notificação diária.
//
// SEGUNDA FONTE DE CANDIDATOS: muita gente (Rafael incluso) não usa o
// campo "Convidados" do Google — cria o evento sozinho e põe o nome da
// pessoa só no título ("1:1 Jo & Milleo", "Reunião Andrea Chaves UFPRE").
// Pra esses casos, os eventos SEM convidado estruturado passam por uma
// extração de nomes via Gemini (1 chamada batelada por load, não por
// evento) — e o resultado vem marcado com source:"titulo_ia" na resposta,
// pra UI deixar claro que é uma leitura de texto livre, não um convite
// confirmado (menos certeza, mostrado como tal, nunca disfarçado).

import { supabaseRest as sb } from './_lib/relationshipAssistant/notificationLog.js';
import { getUserIdFromAuthHeader } from './_lib/relationshipAssistant/oauthState.js';
import { listGoogleEvents, refreshGoogleAccessToken } from './_lib/relationshipAssistant/googleCalendar.js';
import { matchContactToEvent, suggestNewContactCandidatesFromEvent } from './_lib/relationshipAssistant/icsImport.js';
import { normalize } from '../shared/textNormalize.js';

const LOOKBACK_DAYS = 14;
const LOOKAHEAD_DAYS = 7;
const MAX_EVENTS_FOR_AI_EXTRACTION = 30; // teto de custo/latência por load
const GEMINI_KEY = process.env.GEMINI_API_KEY;

// Casa um nome extraído do título contra os contatos já cadastrados. Mais
// frouxo que matchContactToEvent (que exige nome completo batendo) porque
// título de agenda costuma trazer só o primeiro nome ("Jo" pra "João Paulo
// Marinho") — mas só casa por 1º nome se o 1º nome tiver 4+ letras, pra
// não gerar falso positivo tipo "Ana" batendo em qualquer "Ana".
function looseNameMatch(extractedName, contacts) {
  const n = normalize(extractedName);
  if (!n || n.length < 4) return null; // nome curto demais pra casar com segurança (ex: "Jo")
  for (const contact of contacts || []) {
    const cn = normalize(contact.name);
    if (!cn) continue;
    if (cn === n) return contact;
    const firstWord = n.split(' ')[0];
    const contactFirstWord = cn.split(' ')[0];
    if (firstWord.length >= 4 && firstWord === contactFirstWord) return contact;
    if (n.split(' ').length >= 2 && (cn.includes(n) || n.includes(cn))) return contact; // só substring com nome composto
  }
  return null;
}

async function extractNamesFromTitles(events) {
  if (!GEMINI_KEY || !events.length) return {};
  const list = events.map((e, i) => `${i}. Título: "${e.summary || ''}"${e.description ? ` | Descrição: "${String(e.description).slice(0, 200)}"` : ''}`).join('\n');
  const prompt = `Estes são títulos de eventos de uma agenda profissional de agronegócio. Pra cada evento, identifique se o título/descrição menciona o NOME PRÓPRIO de uma pessoa específica com quem haverá ou houve uma reunião — não conte nomes de empresa, marca, projeto, cultura agrícola ou produto (ex: "BASF", "Melyra", "Cana", "Sphenophorus Zero" NÃO são pessoas, a menos que claramente prefixado como pessoa, ex: "Drª Andrea Chaves" É pessoa).

Eventos:
${list}

Responda APENAS um JSON válido, sem markdown, no formato: {"0": ["Nome Completo"], "1": [], "2": ["Nome1","Nome2"]} — uma entrada por índice de evento, mesmo se lista vazia. Nunca inclua nomes de empresa/projeto/cultura.`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 800, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    const data = await res.json().catch(() => null);
    const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean.match(/\{[\s\S]*\}/)?.[0] || '{}');
  } catch (err) {
    console.error('[calendar-meeting-attendees] extração de nomes via IA falhou:', err.message);
    return {};
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method not allowed' });

    const uid = await getUserIdFromAuthHeader(req.headers['authorization']);
    if (!uid) return res.status(401).json({ ok: false, error: 'sessão inválida' });

    const [profileRows, connRows] = await Promise.all([
      sb(`profiles?id=eq.${uid}&select=id,first_name,name,is_pro`),
      sb(`calendar_connections?user_id=eq.${uid}&provider=eq.google&status=eq.active&select=access_token,refresh_token,token_expires_at`),
    ]);
    const profile = profileRows?.[0];
    if (!profile) return res.status(404).json({ ok: false, error: 'perfil não encontrado' });
    if (!profile.is_pro) return res.status(200).json({ ok: true, connected: false, isPro: false, candidates: [] });

    const conn = connRows?.[0];
    if (!conn) return res.status(200).json({ ok: true, connected: false, isPro: true, candidates: [] });

    let accessToken = conn.access_token;
    const expiraEm = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
    if (!accessToken || expiraEm - Date.now() < 5 * 60 * 1000) {
      const refreshed = await refreshGoogleAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      const novaExpiracao = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString();
      await sb(`calendar_connections?user_id=eq.${uid}&provider=eq.google`, {
        method: 'PATCH',
        body: JSON.stringify({ access_token: accessToken, token_expires_at: novaExpiracao, updated_at: new Date().toISOString() }),
      }).catch(() => {});
    }

    const sinceISO = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const untilISO = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString();
    const [events, contacts] = await Promise.all([
      listGoogleEvents(accessToken, sinceISO, untilISO),
      sb(`contacts?user_id=eq.${uid}&select=id,name`),
    ]);

    const selfNameHints = [profile.first_name, profile.name].filter(Boolean);

    // Dedup por e-mail (ou nome normalizado, se não tiver e-mail) — a
    // mesma pessoa costuma aparecer em várias reuniões na janela.
    const byKey = new Map();
    const addCandidate = (name, email, event, source) => {
      const key = (email || name || '').toLowerCase().trim();
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, { name, email: email || null, source, meetings: [] });
      byKey.get(key).meetings.push({ summary: event.summary || null, startISO: event.startISO || null });
    };

    const eventsWithoutAttendees = [];
    for (const event of events || []) {
      if (matchContactToEvent(event, contacts || [])) continue; // já é contato — nada a perguntar
      const candidatosEstruturados = suggestNewContactCandidatesFromEvent(event, { selfNameHints });
      if (candidatosEstruturados.length) {
        candidatosEstruturados.forEach((c) => addCandidate(c.name, c.email, event, 'convidado_google'));
      } else if (!(event.attendees || []).length) {
        eventsWithoutAttendees.push(event); // candidato a extração por IA
      }
    }

    // Extração de nomes no título/descrição — só pros eventos que não
    // tinham convidado estruturado nenhum, até o teto de custo.
    const toExtract = eventsWithoutAttendees.slice(0, MAX_EVENTS_FOR_AI_EXTRACTION);
    const extracted = await extractNamesFromTitles(toExtract);
    toExtract.forEach((event, i) => {
      const names = extracted[String(i)] || [];
      for (const rawName of names) {
        const isSelf = selfNameHints.some((h) => normalize(rawName).includes(normalize(h)));
        if (isSelf) continue;
        if (looseNameMatch(rawName, contacts || [])) continue; // já é contato (match frouxo)
        addCandidate(rawName, null, event, 'titulo_ia');
      }
    });

    const candidates = Array.from(byKey.values()).sort((a, b) => {
      const da = a.meetings[0]?.startISO || '';
      const db = b.meetings[0]?.startISO || '';
      return db.localeCompare(da); // mais recente primeiro
    });

    return res.status(200).json({ ok: true, connected: true, isPro: true, candidates });
  } catch (err) {
    console.error('[calendar-meeting-attendees] erro:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
