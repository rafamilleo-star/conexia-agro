// api/_lib/relationshipAssistant/timeWindow.js
//
// Regras de "hora certa": não enviar de madrugada, respeitar timezone do
// usuário, saber se hoje é segunda-feira no fuso dele.

const QUIET_HOURS_START = 22; // 22h
const QUIET_HOURS_END = 8;    // 08h — antes disso é madrugada

function partsInTimezone(timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Sao_Paulo',
    hour: 'numeric', hour12: false,
    weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
  return parts;
}

export function isQuietHours(timezone) {
  const { hour } = partsInTimezone(timezone);
  const h = Number(hour);
  return h >= QUIET_HOURS_START || h < QUIET_HOURS_END;
}

export function isMonday(timezone) {
  const { weekday } = partsInTimezone(timezone);
  return weekday === 'Mon';
}

// YYYY-MM-DD no fuso do usuário, para uma data qualquer — usado para
// comparar "hoje"/"amanhã" em texto (ver preMeetingBriefingMessage) e como
// base de localDateISO abaixo.
export function localDateISOFor(date, timezone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// YYYY-MM-DD no fuso do usuário — usado como "scopeKey" de idempotência e
// para filtrar dailyLimitReached corretamente por dia local, não UTC.
export function localDateISO(timezone) {
  return localDateISOFor(new Date(), timezone);
}
