import { contactProposal } from '../../../shared/contactCapture.js';
import { normalize } from '../../../shared/textNormalize.js';

export { normalize };

// api/_lib/relationshipAssistant/icsImport.js
//
// Parser + inteligência de match dos eventos de calendário.
//
// ORDEM DE MATCH:
// 1. E-mail exato
// 2. Match já existente do contactProposal
// 3. Nome completo normalizado
// 4. Nome inequívoco
//
// REGRA:
// Nunca cria contato automaticamente.
// Se não houver segurança suficiente, retorna null e deixa
// o fluxo do CONÉXIA perguntar ao usuário.

// ─────────────────────────────────────────────────────────────
// NORMALIZAÇÃO
// ─────────────────────────────────────────────────────────────

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizeName(name) {
  return normalize(String(name || ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name) {
  return normalizeName(name)
    .split(' ')
    .filter(Boolean);
}


// ─────────────────────────────────────────────────────────────
// ICS — UNFOLD
// ─────────────────────────────────────────────────────────────

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


// ─────────────────────────────────────────────────────────────
// NOME / E-MAIL
// ─────────────────────────────────────────────────────────────

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
    line.match(
      /mailto:([^;:\s]+@[^;:\s]+)/i
    );

  return match
    ? normalizeEmail(match[1])
    : null;
}


// ─────────────────────────────────────────────────────────────
// DTSTART
// ─────────────────────────────────────────────────────────────

function parseDtstart(line) {
  const value =
    line
      .split(':')
      .slice(1)
      .join(':')
      .trim();

  if (!value) {
    return null;
  }

  const match =
    value.match(
      /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/
    );

  if (!match) {
    return null;
  }

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

  const date =
    new Date(iso);

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}


// ─────────────────────────────────────────────────────────────
// PARSER ICS
// ─────────────────────────────────────────────────────────────

export function parseICSEvents(icsText) {
  const lines =
    unfold(icsText);

  const events = [];

  let current = null;


  for (const line of lines) {

    if (
      line.startsWith(
        'BEGIN:VEVENT'
      )
    ) {

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


    if (
      line.startsWith(
        'END:VEVENT'
      )
    ) {

      if (current) {
        events.push(current);
      }

      current = null;

      continue;
    }


    if (!current) {
      continue;
    }


    if (
      line.startsWith('UID')
    ) {

      current.uid =
        line
          .split(':')
          .slice(1)
          .join(':')
          .trim() ||
        null;

    } else if (
      line.startsWith('SUMMARY')
    ) {

      current.summary =
        line
          .split(':')
          .slice(1)
          .join(':')
          .trim() ||
        null;

    } else if (
      line.startsWith('DTSTART')
    ) {

      current.startISO =
        parseDtstart(line);

    } else if (
      line.startsWith('ORGANIZER')
    ) {

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
        !current.attendeeNames.includes(
          name
        )
      ) {

        current.attendeeNames.push(
          name
        );
      }

    } else if (
      line.startsWith('ATTENDEE')
    ) {

      const name =
        extractName(line);

      const email =
        extractEmail(line);


      if (
        name &&
        !current.attendeeNames.includes(
          name
        )
      ) {

        current.attendeeNames.push(
          name
        );
      }


      if (
        name ||
        email
      ) {

        current.attendees.push({
          name,
          email
        });
      }
    }
  }


  return events;
}


// ─────────────────────────────────────────────────────────────
// EXTRAÇÃO DOS E-MAILS DO CONTATO
// ─────────────────────────────────────────────────────────────

function contactEmails(contact) {
  const possible = [
    contact?.email,
    contact?.contact_email,
    contact?.work_email,
    contact?.personal_email
  ];

  return possible
    .map(normalizeEmail)
    .filter(Boolean);
}


// ─────────────────────────────────────────────────────────────
// MATCH 1 — E-MAIL EXATO
// ─────────────────────────────────────────────────────────────

function matchByEmail(
  event,
  contacts
) {

  const eventEmails = [
    ...(event?.attendees || [])
      .map(
        attendee =>
          normalizeEmail(
            attendee?.email
          )
      ),

    normalizeEmail(
      event?.organizer?.email
    )
  ].filter(Boolean);


  if (!eventEmails.length) {
    return null;
  }


  const matches =
    (contacts || [])
      .filter(contact => {

        const emails =
          contactEmails(contact);

        return emails.some(
          email =>
            eventEmails.includes(
              email
            )
        );
      });


  // Só aceita se houver UM único contato.
  if (
    matches.length === 1
  ) {

    return matches[0];
  }


  return null;
}


// ─────────────────────────────────────────────────────────────
// MATCH 2 — CONTACT PROPOSAL EXISTENTE
// ─────────────────────────────────────────────────────────────

function matchByExistingProposal(
  event,
  contacts
) {

  const exactContacts =
    (event.attendees || [])
      .map(
        attendee =>
          contactProposal(
            attendee,
            contacts
          )
      )
      .filter(
        proposal =>
          proposal?.reason ===
            'email_telefone' &&
          proposal?.matches?.length === 1
      );


  if (
    !exactContacts.length
  ) {

    return null;
  }


  const id =
    exactContacts[0]
      .matches[0]
      .id;


  return (
    contacts || []
  ).find(
    contact =>
      contact.id === id
  ) || null;
}


// ─────────────────────────────────────────────────────────────
// NOMES PRESENTES NO EVENTO
// ─────────────────────────────────────────────────────────────

function eventCandidateNames(event) {
  const names = [
    ...(event?.attendeeNames || []),

    ...(event?.attendees || [])
      .map(
        attendee =>
          attendee?.name
      ),

    event?.organizer?.name
  ];


  return [
    ...new Set(
      names
        .map(normalizeName)
        .filter(Boolean)
    )
  ];
}


// ─────────────────────────────────────────────────────────────
// MATCH 3 — NOME COMPLETO NORMALIZADO
// ─────────────────────────────────────────────────────────────

function matchByFullName(
  event,
  contacts
) {

  const candidateNames =
    eventCandidateNames(
      event
    );


  if (
    !candidateNames.length
  ) {

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


        const tokens =
          nameTokens(
            contactName
          );


        // Aqui ainda exigimos
        // pelo menos nome + sobrenome.
        if (
          tokens.length < 2
        ) {

          return false;
        }


        return candidateNames.some(
          candidate =>

            candidate ===
              contactName ||

            candidate.includes(
              contactName
            ) ||

            contactName.includes(
              candidate
            )
        );
      });


  // Evita falso positivo.
  if (
    matches.length === 1
  ) {

    return matches[0];
  }


  return null;
}


// ─────────────────────────────────────────────────────────────
// MATCH 4 — NOME INEQUÍVOCO
// ─────────────────────────────────────────────────────────────
//
// Exemplo:
//
// Rede CONÉXIA:
// Rafael Milléo
// João Pereira
// Maria Souza
//
// Agenda:
// "Reunião João"
//
// Se existir apenas UM João na rede,
// podemos usar esse contato.
//
// Se houver:
// João Pereira
// João Silva
//
// NÃO casa.
// Danna pergunta.
// ─────────────────────────────────────────────────────────────

function matchByUniqueName(
  event,
  contacts
) {

  const candidateNames =
    eventCandidateNames(
      event
    );


  if (
    !candidateNames.length
  ) {

    return null;
  }


  for (
    const candidateName
    of candidateNames
  ) {

    const candidateTokens =
      nameTokens(
        candidateName
      );


    if (
      !candidateTokens.length
    ) {

      continue;
    }


    // Não usa palavras muito pequenas
    // como critério de identidade.

    const usefulTokens =
      candidateTokens
        .filter(
          token =>
            token.length >= 3
        );


    if (
      !usefulTokens.length
    ) {

      continue;
    }


    const possible =
      (contacts || [])
        .filter(contact => {

          const contactTokens =
            nameTokens(
              contact?.name
            );


          if (
            !contactTokens.length
          ) {

            return false;
          }


          return usefulTokens.some(
            token =>
              contactTokens.includes(
                token
              )
          );
        });


    // REGRA PRINCIPAL:
    // só aceita se for absolutamente
    // inequívoco dentro da rede.

    if (
      possible.length === 1
    ) {

      return possible[0];
    }
  }


  return null;
}


// ─────────────────────────────────────────────────────────────
// MATCH PRINCIPAL
// ─────────────────────────────────────────────────────────────

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


  // 1 — E-MAIL EXATO

  const emailMatch =
    matchByEmail(
      event,
      contacts
    );


  if (emailMatch) {

    return emailMatch;
  }


  // 2 — MECANISMO JÁ EXISTENTE
  // DO CONÉXIA

  const existingMatch =
    matchByExistingProposal(
      event,
      contacts
    );


  if (existingMatch) {

    return existingMatch;
  }


  // 3 — NOME COMPLETO

  const fullNameMatch =
    matchByFullName(
      event,
      contacts
    );


  if (fullNameMatch) {

    return fullNameMatch;
  }


  // 4 — NOME INEQUÍVOCO

  const uniqueNameMatch =
    matchByUniqueName(
      event,
      contacts
    );


  if (uniqueNameMatch) {

    return uniqueNameMatch;
  }


  // Segurança:
  // dúvida = não casa.

  return null;
}


// ─────────────────────────────────────────────────────────────
// EVENTOS DENTRO DA JANELA
// ─────────────────────────────────────────────────────────────

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

    if (
      !event.startISO
    ) {

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


// ─────────────────────────────────────────────────────────────
// E-MAILS AUTOMÁTICOS
// ─────────────────────────────────────────────────────────────

const AUTOMATED_EMAIL_PATTERNS = [

  /^no-?reply@/i,

  /^notifications?@/i,

  /calendar-notification@/i,

  /resource\.calendar\.google\.com$/i,

  /@group\.calendar\.google\.com$/i

];


function isAutomatedEmail(
  email
) {

  return (
    !!email &&
    AUTOMATED_EMAIL_PATTERNS
      .some(
        regex =>
          regex.test(
            email
          )
      )
  );
}


// ─────────────────────────────────────────────────────────────
// NOVOS CONTATOS ENCONTRADOS NO EVENTO
// ─────────────────────────────────────────────────────────────

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


  const candidatos =
    (event.attendees || [])
      .filter(attendee => {

        if (
          !attendee.name &&
          !attendee.email
        ) {

          return false;
        }


        const name =
          normalizeName(
            attendee.name
          );


        // Sem e-mail exige nome completo.

        if (
          !attendee.email &&
          nameTokens(name).length < 2
        ) {

          return false;
        }


        // Nunca transforma robô/sistema
        // em contato.

        if (
          isAutomatedEmail(
            attendee.email
          )
        ) {

          return false;
        }


        // Remove o próprio usuário
        // da lista de candidatos.

        if (
          hints.some(
            hint =>
              name.includes(
                hint
              ) ||
              hint.includes(
                name
              )
          )
        ) {

          return false;
        }


        return true;
      });


  if (
    candidatos.length < 1
  ) {

    return [];
  }


  return candidatos;
}


// ─────────────────────────────────────────────────────────────
// COMPATIBILIDADE COM FLUXO EXISTENTE
// ─────────────────────────────────────────────────────────────

export function suggestNewContactFromEvent(
  event,
  {
    selfNameHints = []
  } = {}
) {

  const candidatos =
    suggestNewContactCandidatesFromEvent(
      event,
      {
        selfNameHints
      }
    );


  return (
    candidatos[0] ||
    null
  );
}
