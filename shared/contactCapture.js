const clean = v => String(v || '').trim().slice(0, 240);
export const nameKey = v => clean(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
export const emailKey = v => clean(v).toLowerCase();
export function phoneKey(v) {
  let n = clean(v).replace(/\D/g, '');
  if (n.length === 10 || n.length === 11) n = '55' + n;
  return n.length >= 8 && n.length <= 15 ? n : '';
}
export function captureFields(raw = {}) {
  const out = {};
  for (const k of ['name', 'company', 'role', 'city']) if (clean(raw[k])) out[k] = clean(raw[k]);
  const email = emailKey(raw.contact_email || raw.email);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.contact_email = email;
  const phone = phoneKey(raw.whatsapp || raw.phone);
  if (phone) out.whatsapp = '+' + phone;
  return out;
}
export function contactProposal(raw, contacts = []) {
  const candidate = captureFields(raw);
  const email = emailKey(candidate.contact_email), phone = phoneKey(candidate.whatsapp), name = nameKey(candidate.name);
  const exact = contacts.filter(c => (email && emailKey(c.contact_email) === email) || (phone && phoneKey(c.whatsapp) === phone));
  let matches = exact;
  let reason = exact.length ? 'email_telefone' : 'nome';
  if (!matches.length && name) matches = contacts.filter(c => nameKey(c.name) === name);
  if (!matches.length && name.split(' ').length >= 2) matches = contacts.filter(c => {
    const n = nameKey(c.name); return n.split(' ').length >= 2 && (n.startsWith(name + ' ') || name.startsWith(n + ' '));
  });
  const changes = {}, conflicts = {};
  if (matches.length === 1) for (const [key, value] of Object.entries(candidate)) {
    if (key === 'name') continue;
    if (!clean(matches[0][key])) changes[key] = value;
    else if ((key === 'whatsapp' ? phoneKey(matches[0][key]) !== phoneKey(value) : nameKey(matches[0][key]) !== nameKey(value))) conflicts[key] = { current: matches[0][key], proposed: value };
  }
  const kind = matches.length > 1 ? 'ambiguous' : matches.length === 1
    ? (reason === 'nome' || Object.keys(conflicts).length ? 'review' : Object.keys(changes).length ? 'enrich' : 'known') : 'new';
  return { candidate, kind, reason, changes, conflicts,
    matches: matches.map(c => ({ id: c.id, name: c.name, company: c.company, contact_email: c.contact_email, whatsapp: c.whatsapp })),
    key: email || phone || name };
}
