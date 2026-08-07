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
 * @returns {Array<{ uid: string|null, summary: string|null, startISO: string|null, attendeeNames: string[] }>}
 */
export function parseICSEvents(icsText) {
  const lines = unfold(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = { uid: null, summary: null, startISO: null, attendeeNames: [] };
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
    } else if (line.startsWith('ATTENDEE') || line.startsWith('ORGANIZER')) {
      const name = extractName(line);
      if (name && !current.attendeeNames.includes(name)) current.attendeeNames.push(name);
    }
  }

  return events;
}

// Normaliza pra comparação: minúsculas, sem acento, espaços colapsados.
function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

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
