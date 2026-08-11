// api/_lib/relationshipAssistant/icsImport.js
//
// Parser .ics mínimo (RFC 5545) — só o suficiente para a Captura Passiva via
// Calendário: extrair SUMMARY, DTSTART e nomes de convidados (ATTENDEE/CN,
// ORGANIZER/CN) de cada VEVENT. Sem lib externa — função pura, sem I/O,
// testável isolada.
//
// Não tenta ser um parser .ics completo (não lida com timezone VTIMEZONE
// customizada, recorrência RRULE, etc.) — cobre o caso real: export .ics
// público do Google Calendar, que usa DTSTART em UTC (sufixo Z) ou local.

// RFC 5545: linhas dobradas em até 75 octetos, continuação começa com
// espaço ou tab. Precisa desdobrar antes de parsear linha a linha.
function unfold(icsText) {
  return String(icsText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

// Extrai o valor do parâmetro CN= de uma linha ATTENDEE/ORGANIZER, ou usa o
// e-mail (parte antes de @) como fallback quando não há CN.
function extractName(line) {
  const cnMatch = line.match(/CN=([^;:]+)/i);
  if (cnMatch) return cnMatch[1].replace(/^"|"$/g, '').trim();
  const emailMatch = line.match(/mailto:([^;:\s]+)@/i);
  if (emailMatch) return emailMatch[1].replace(/[._]/g, ' ').trim();
  return null;
}

function extractEmail(line) {
  const m = line.match(/mailto:([^;:\s]+@[^;:\s]+)/i);
  return m ? m[1].toLowerCase() : null;
}

// DTSTART pode vir como "20260807T140000Z" (UTC), "20260807T140000" (local,
// sem timezone confiável) ou "20260807" (dia inteiro). Retorna ISO string ou
// null se não der pra interpretar.
function parseDtstart(line) {
  const value = line.split(':').slice(1).join(':').trim();
  if (!value) return null;
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', s = '00', z] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? 'Z' : ''}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * @param {string} icsText
 * @returns {Array<{ uid: string|null, summary: string|null, startISO: string|null, attendeeNames: string[], attendees: Array<{name:string|null, email:string|null}>, organizer: {name:string|null, email:string|null}|null }>}
 */
export function parseICSEvents(icsText) {
  const lines = unfold(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = { uid: null, summary: null, startISO: null, attendeeNames: [], attendees: [], organizer: null };
      continue;
    }
    if (line.startsWith('END:VEVENT')) {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    if (line.startsWith('UID')) {
      current.uid = line.split(':').slice(1).join(':').trim() || null;
    } else if (line.startsWith('SUMMARY')) {
      current.summary = line.split(':').slice(1).join(':').trim() || null;
    } else if (line.startsWith('DTSTART')) {
      current.startISO = parseDtstart(line);
    } else if (line.startsWith('ORGANIZER')) {
      const name = extractName(line);
      const email = extractEmail(line);
      current.organizer = { name, email };
      if (name && !current.attendeeNames.includes(name)) current.attendeeNames.push(name);
    } else if (line.startsWith('ATTENDEE')) {
      const name = extractName(line);
      const email = extractEmail(line);
      if (name && !current.attendeeNames.includes(name)) current.attendeeNames.push(name);
      if (name || email) current.attendees.push({ name, email });
    }
  }

  return events;
}

import { normalize } from "../../../shared/textNormalize.js";
export { normalize };

// Match conservador por design (ver risco 2.3 do spec): só casa se o nome
// completo do contato aparecer inteiro no nome do convidado, ou vice-versa —
// nunca por primeiro nome isolado, pra evitar falso positivo (ex.: "João"
// sozinho não deve casar com qualquer "João" da agenda).
export function matchContactToEvent(event, contacts) {
  const candidateNames = [
    ...(event.attendeeNames || []),
    ...(event.summary ? [event.summary] : []),
  ].map(normalize).filter(Boolean);

  if (!candidateNames.length) return null;

  let best = null;
  for (const contact of contacts || []) {
    const contactName = normalize(contact.name);
    if (!contactName || contactName.split(' ').length < 2) continue; // exige nome completo
    const hit = candidateNames.some(
      (cand) => cand === contactName || cand.includes(contactName) || contactName.includes(cand)
    );
    if (hit) { best = contact; break; }
  }
  return best;
}

/**
 * Filtra eventos cujo DTSTART caiu dentro da janela [sinceISO, untilISO).
 * @param {Array} events
 * @param {string} sinceISO
 * @param {string} untilISO
 */
export function eventsInWindow(events, sinceISO, untilISO) {
  const since = new Date(sinceISO).getTime();
  const until = new Date(untilISO).getTime();
  return (events || []).filter((e) => {
    if (!e.startISO) return false;
    const t = new Date(e.startISO).getTime();
    return t >= since && t < until;
  });
}

// E-mails de sistema/automação — nunca sugerir como contato novo.
const AUTOMATED_EMAIL_PATTERNS = [
  /^no-?reply@/i,
  /^notifications?@/i,
  /calendar-notification@/i,
  /resource\.calendar\.google\.com$/i,
  /@group\.calendar\.google\.com$/i,
];

function isAutomatedEmail(email) {
  return !!email && AUTOMATED_EMAIL_PATTERNS.some((re) => re.test(email));
}

// Sugere UM convidado como "contato novo encontrado no calendário" — só
// quando o evento parece uma reunião real (poucos convidados, nome
// completo, e-mail não-automático), nunca pra webinar/palestra/lista de
// distribuição. Não considera o próprio dono do calendário (selfNameHints).
// Retorna { name, email } ou null.
export function suggestNewContactFromEvent(event, { selfNameHints = [] } = {}) {
  const hints = (selfNameHints || []).map(normalize).filter(Boolean);
  const candidatos = (event.attendees || []).filter((a) => {
    if (!a.name) return false;
    const n = normalize(a.name);
    if (n.split(' ').length < 2) return false; // exige nome completo
    if (isAutomatedEmail(a.email)) return false;
    if (hints.some((h) => n.includes(h))) return false; // é o próprio usuário
    return true;
  });

  // Só reunião pequena (1 a 4 convidados de verdade) — acima disso é sinal
  // de webinar/palestra/lista, não encontro individual.
  if (candidatos.length < 1 || candidatos.length > 4) return null;

  return candidatos[0];
}
