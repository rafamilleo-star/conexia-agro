import { contactProposal } from '../../../shared/contactCapture.js';
import { normalize } from '../../../shared/textNormalize.js';

export { normalize };


// ============================================================
// HELPERS
// ============================================================

function normalizeEmail(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function normalizeName(value) {
  return normalize(String(value || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value) {
  return normalizeName(value)
    .split(' ')
    .map(v => v.trim())
    .filter(v => v.length >= 3);
}

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}


// ============================================================
// ICS
// ============================================================

function unfold(icsText) {
  return String(icsText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (
        (line.startsWith(' ') || line.startsWith('\t')) &&
        lines.length
      ) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }

      return lines;
    }, []);
}


function extractName(line) {
  const cnMatch = line.match(/CN=([^;:]+)/i);

  if (cnMatch) {
    return cnMatch[1]
      .replace(/^"|"$/g, '')
      .trim();
  }

  const emailMatch =
    line.match(/mailto:([^;:\s]+)@/i);

  if (emailMatch) {
    return emailMatch[1]
      .replace(/[._-]/g, ' ')
      .trim();
  }

  return null;
}


function extractEmail(line) {
  const match =
    line.match(/mailto:([^;:\s]+@[^;:\s]+)/i);

  return match
    ? normalizeEmail(match[1])
    : null;
}


function parseDtstart(line) {
  const value =
    line
      .split(':')
      .slice(1)
      .join(':')
      .trim();

  if (!value) return null;

  const match =
    value.match(
      /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/
    );

  if (!match) return null;

  const [
    ,
    year,
    month,
    day,
    hour = '00',
    minute = '00',
    second = '00',
    utc
  ] = match;

  const iso =
    `${year}-${month}-${day}` +
    `T${hour}:${minute}:${second}` +
    `${utc ? 'Z' : ''}`;

  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}


// ============================================================
// PARSE ICS
// ============================================================

export function parseICSEvents(icsText) {
  const lines = unfold(icsText);

  const events = [];

  let current = null;

  for (const line of lines) {

    if (line.startsWith('BEGIN:VEVENT')) {
      current = {
        uid: null,
        summary: null,
        startISO: null,
        attendeeNames: [],
        attendees: [],
        organizer: null
      };

      continue;
    }

    if (line.startsWith('END:VEVENT')) {
      if (current) {
        events.push(current);
      }

      current = null;

      continue;
    }

    if (!current) continue;


    if (line.startsWith('UID')) {

      current.uid =
        line
          .split(':')
          .slice(1)
          .join(':')
          .trim() || null;


    } else if (line.startsWith('SUMMARY')) {

      current.summary =
        line
          .split(':')
          .slice(1)
          .join(':')
          .trim() || null;


    } else if (line.startsWith('DTSTART')) {

      current.startISO =
        parseDtstart(line);


    } else if (line.startsWith('ORGANIZER')) {

      const name =
        extractName(line);

      const email =
        extractEmail(line);

      current.organizer = {
        name,
        email
      };

      if (
        name &&
        !current.attendeeNames.includes(name)
      ) {
        current.attendeeNames.push(name);
      }


    } else if (line.startsWith('ATTENDEE')) {

      const name =
        extractName(line);

      const email =
        extractEmail(line);

      if (
        name &&
        !current.attendeeNames.includes(name)
      ) {
        current.attendeeNames.push(name);
      }

      if (name || email) {
        current.attendees.push({
          name,
          email
        });
      }
    }
  }

  return events;
}


// ============================================================
// CONTACT EMAILS
// ============================================================

function contactEmails(contact) {
  return unique([
    contact?.contact_email,
    contact?.email,
    contact?.work_email,
    contact?.personal_email
  ].map(normalizeEmail));
}


// ============================================================
// EVENT EMAILS
// ============================================================

function eventEmails(event) {
  return unique([
    ...(event?.attendees || [])
      .map(a => normalizeEmail(a?.email)),

    event?.organizer?.self
      ? null
      : normalizeEmail(
          event?.organizer?.email
        )
  ]);
}


// ============================================================
// EVENT NAMES
// ============================================================

function eventNames(event) {
  return unique([
    ...(event?.attendeeNames || []),

    ...(event?.attendees || [])
      .map(a => a?.name),

    event?.organizer?.self
      ? null
      : event?.organizer?.name

  ].map(normalizeName));
}


// ============================================================
// 1 — EXACT EMAIL
// ============================================================

function matchExactEmail(
  event,
  contacts
) {

  const emails =
    eventEmails(event);

  if (!emails.length) {
    return null;
  }

  const matches =
    (contacts || [])
      .filter(contact => {

        const cEmails =
          contactEmails(contact);

        return cEmails.some(
          email =>
            emails.includes(email)
        );
      });

  return matches.length === 1
    ? matches[0]
    : null;
}


// ============================================================
// 2 — EXISTING CONEXIA PROPOSAL
// ============================================================

function matchExistingProposal(
  event,
  contacts
) {

  const proposals =
    (event?.attendees || [])

      .map(attendee =>
        contactProposal(
          attendee,
          contacts
        )
      )

      .filter(proposal =>
        proposal?.reason ===
          'email_telefone' &&
        proposal?.matches?.length === 1
      );


  if (!proposals.length) {
    return null;
  }


  const ids =
    unique(
      proposals.map(
        proposal =>
          proposal.matches[0]?.id
      )
    );


  // Se diferentes convidados apontarem
  // para contatos diferentes, não escolhe.

  if (ids.length !== 1) {
    return null;
  }


  return (
    contacts || []
  ).find(
    contact =>
      contact.id === ids[0]
  ) || null;
}


// ============================================================
// 3 — FULL NAME
// ============================================================

function matchFullName(
  event,
  contacts
) {

  const names =
    eventNames(event);

  if (!names.length) {
    return null;
  }


  const matches =
    (contacts || [])
      .filter(contact => {

        const contactName =
          normalizeName(
            contact?.name
          );

        if (!contactName) {
          return false;
        }


        const contactTokens =
          tokens(contactName);

        if (
          contactTokens.length < 2
        ) {
          return false;
        }


        return names.some(
          eventName => {

            const eventTokens =
              tokens(eventName);

            if (
              eventTokens.length < 2
            ) {
              return false;
            }


            if (
              eventName === contactName
            ) {
              return true;
            }


            const common =
              contactTokens.filter(
                token =>
                  eventTokens.includes(token)
              );


            // Nome + sobrenome em comum.

            return common.length >= 2;
          }
        );
      });


  return matches.length === 1
    ? matches[0]
    : null;
}


// ============================================================
// 4 — SUMMARY
//
// Exemplo:
//
// contato:
// João Pereira
//
// reunião:
// "Alinhamento João Pereira"
// "Reunião com João Pereira"
// "João Pereira - Café"
// ============================================================

function matchSummary(
  event,
  contacts
) {

  const summary =
    normalizeName(
      event?.summary
    );

  if (!summary) {
    return null;
  }


  const summaryTokens =
    tokens(summary);


  const scored =
    (contacts || [])
      .map(contact => {

        const name =
          normalizeName(
            contact?.name
          );

        const contactTokens =
          tokens(name);


        if (!contactTokens.length) {

          return {
            contact,
            score: 0
          };
        }


        // Nome completo aparece no título.

        if (
          name.length >= 5 &&
          summary.includes(name)
        ) {

          return {
            contact,
            score: 100
          };
        }


        const common =
          contactTokens.filter(
            token =>
              summaryTokens.includes(token)
          );


        // Nome + sobrenome.

        if (common.length >= 2) {

          return {
            contact,
            score: 80
          };
        }


        // Apenas um token.
        // Só será usado se for totalmente
        // inequívoco na rede.

        if (common.length === 1) {

          return {
            contact,
            score: 40
          };
        }


        return {
          contact,
          score: 0
        };
      });


  const bestScore =
    Math.max(
      0,
      ...scored.map(
        item => item.score
      )
    );


  if (!bestScore) {
    return null;
  }


  const best =
    scored.filter(
      item =>
        item.score === bestScore
    );


  // Só aceita se UM contato tiver
  // a melhor pontuação.

  if (best.length !== 1) {
    return null;
  }


  return best[0].contact;
}


// ============================================================
// 5 — UNIQUE PERSON NAME
//
// Caso Google entregue:
//
// Rafael
//
// E na rede exista somente:
//
// Rafael Milléo
//
// pode casar.
//
// Mas se existirem:
//
// Rafael Milléo
// Rafael Souza
//
// não casa.
// ============================================================

function matchUniquePersonName(
  event,
  contacts
) {

  const names =
    eventNames(event);


  for (const eventName of names) {

    const eventTokens =
      tokens(eventName);


    for (const token of eventTokens) {

      const possible =
        (contacts || [])
          .filter(contact => {

            const contactTokens =
              tokens(
                contact?.name
              );

            return contactTokens.includes(
              token
            );
          });


      if (
        possible.length === 1
      ) {

        return possible[0];
      }
    }
  }


  return null;
}


// ============================================================
// MAIN MATCH
// ============================================================

export function matchContactToEvent(
  event,
  contacts
) {

  if (
    !event ||
    !Array.isArray(contacts) ||
    !contacts.length
  ) {

    return null;
  }


  // ----------------------------------------------------------
  // 1 — EMAIL
  // ----------------------------------------------------------

  const email =
    matchExactEmail(
      event,
      contacts
    );

  if (email) {
    return email;
  }


  // ----------------------------------------------------------
  // 2 — EXISTING CONEXIA MATCHER
  // ----------------------------------------------------------

  const existing =
    matchExistingProposal(
      event,
      contacts
    );

  if (existing) {
    return existing;
  }


  // ----------------------------------------------------------
  // 3 — FULL NAME
  // ----------------------------------------------------------

  const fullName =
    matchFullName(
      event,
      contacts
    );

  if (fullName) {
    return fullName;
  }


  // ----------------------------------------------------------
  // 4 — EVENT TITLE
  // ----------------------------------------------------------

  const summary =
    matchSummary(
      event,
      contacts
    );

  if (summary) {
    return summary;
  }


  // ----------------------------------------------------------
  // 5 — UNIQUE NAME
  // ----------------------------------------------------------

  const uniqueName =
    matchUniquePersonName(
      event,
      contacts
    );

  if (uniqueName) {
    return uniqueName;
  }


  // ----------------------------------------------------------
  // SEGURANÇA
  // ----------------------------------------------------------

  return null;
}


// ============================================================
// WINDOW
// ============================================================

export function eventsInWindow(
  events,
  sinceISO,
  untilISO
) {

  const since =
    new Date(
      sinceISO
    ).getTime();

  const until =
    new Date(
      untilISO
    ).getTime();


  return (
    events || []
  ).filter(event => {

    if (!event.startISO) {
      return false;
    }

    const time =
      new Date(
        event.startISO
      ).getTime();

    return (
      time >= since &&
      time < until
    );
  });
}


// ============================================================
// AUTOMATED EMAIL
// ============================================================

const AUTOMATED_EMAIL_PATTERNS = [
  /^no-?reply@/i,
  /^notifications?@/i,
  /calendar-notification@/i,
  /resource\.calendar\.google\.com$/i,
  /@group\.calendar\.google\.com$/i
];


function isAutomatedEmail(email) {

  return (
    !!email &&
    AUTOMATED_EMAIL_PATTERNS
      .some(pattern =>
        pattern.test(email)
      )
  );
}


// ============================================================
// NEW CONTACT CANDIDATES
// ============================================================

export function suggestNewContactCandidatesFromEvent(
  event,
  {
    selfNameHints = []
  } = {}
) {

  const hints =
    (selfNameHints || [])
      .map(normalizeName)
      .filter(Boolean);


  const candidates =
    (event?.attendees || [])
      .filter(attendee => {

        if (
          !attendee?.name &&
          !attendee?.email
        ) {
          return false;
        }


        const name =
          normalizeName(
            attendee?.name
          );


        if (
          !attendee?.email &&
          tokens(name).length < 2
        ) {
          return false;
        }


        if (
          isAutomatedEmail(
            attendee?.email
          )
        ) {
          return false;
        }


        if (
          hints.some(hint =>
            name &&
            (
              name.includes(hint) ||
              hint.includes(name)
            )
          )
        ) {
          return false;
        }


        return true;
      });


  return candidates;
}


// ============================================================
// LEGACY COMPATIBILITY
// ============================================================

export function suggestNewContactFromEvent(
  event,
  {
    selfNameHints = []
  } = {}
) {

  const candidates =
    suggestNewContactCandidatesFromEvent(
      event,
      {
        selfNameHints
      }
    );


  return candidates[0] || null;
}
