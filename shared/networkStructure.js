// Descreve somente a rede cadastrada. Empresa igual NÃO implica vínculo entre contatos.
const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const missing = new Set(['', '-', '—', 'nao informado', 'nao informada', 'n/a', 'nenhuma']);

export function analyzeNetworkStructure(contacts = []) {
  const unique = [...new Map((Array.isArray(contacts) ? contacts : [])
    .filter(c => c && c.id != null).map(c => [c.id, c])).values()];
  const groups = new Map();
  let unknownCompany = 0;
  for (const contact of unique) {
    const key = normalized(contact.company);
    if (missing.has(key)) { unknownCompany++; continue; }
    if (!groups.has(key)) groups.set(key, { company: String(contact.company).trim(), contacts: [] });
    groups.get(key).contacts.push({ id: contact.id, name: contact.name || 'Contato sem nome' });
  }
  const companies = [...groups.values()].sort((a, b) => b.contacts.length - a.contacts.length || a.company.localeCompare(b.company));
  const knownCompany = unique.length - unknownCompany;
  const largest = companies[0];
  return {
    total: unique.length, knownCompany, unknownCompany, companyCount: companies.length,
    singleContactCompanies: companies.filter(group => group.contacts.length === 1),
    // Só sinaliza predominância com pelo menos 6 registros preenchidos.
    concentration: knownCompany >= 6 && largest?.contacts.length > knownCompany / 2 ? largest : null,
  };
}
