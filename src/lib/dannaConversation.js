const normalize = value =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export function resolveDannaSpokenName(
  preferences,
  profile,
  fallback = ""
) {
  const preferred = String(
    preferences?.preferred_name || ""
  ).trim();

  const full = String(
    profile?.first_name || profile?.name || fallback
  ).trim();

  const first = full.split(/\s+/)[0] || "";

  const surname = full
    .split(/\s+/)
    .slice(1)
    .some(part => normalize(part) === normalize(preferred));

  return (
    preferred && !surname ? preferred : first
  ).split(/\s+/)[0] || "";
}

export function isNetworkQuestion(text) {
  return /\b(minha rede|toda (?:a )?rede|rede inteira|saude da rede|saude dos meus relacionamentos|visao geral|panorama da rede|conjunto das relacoes|todos os contatos|minhas relacoes|meus relacionamentos)\b/.test(
    normalize(text)
  );
}

export function buildNetworkOverview(
  contacts = [],
  interactions = [],
  now = new Date()
) {
  const end = now.getTime();
  const start = end - 30 * 86400000;

  const rows = contacts.map(contact => {
    const records = interactions.filter(
      item => item.contact_id === contact.id
    );

    const recent = records.filter(item => {
      const at = Date.parse(item.created_at);

      return (
        Number.isFinite(at) &&
        at >= start &&
        at <= end
      );
    });

    return {
      id: contact.id,
      person: contact.name,
      recordsInLoadedSample: records.length,
      recordsInLast30Days: recent.length,
      nextAction: contact.next_action || null,
      nextActionDate: contact.next_action_date || null,
    };
  });

  const recentTotal = rows.reduce(
    (sum, row) => sum + row.recordsInLast30Days,
    0
  );

  return {
    totalContactsLoaded: rows.length,

    contactsWithRecentRecords: rows.filter(
      row => row.recordsInLast30Days > 0
    ).length,

    contactsWithoutRecentRecords: rows.filter(
      row => row.recordsInLast30Days === 0
    ).length,

    recentLinkedRecords: recentTotal,
    sampleLimit: 500,
    sampleMayBeLimited: interactions.length >= 500,
    people: rows,

    interpretation:
      "Ausência de registro não comprova ausência de contato " +
      "nem deterioração da relação. Frequência, sozinha, " +
      "não define prioridade. Não há nota de saúde validada.",
  };
}

export function extractPendingPersonName(text) {
  const line = String(text || "")
    .trim()
    .replace(/[.!?]+$/, "");

  const candidate = line
    .replace(
      /^(?:(?:o )?nome (?:dele|dela|da pessoa) (?:e|é)|(?:ele|ela) (?:e|é|se chama)|(?:pode )?(?:adicionar|cadastrar))\s+/i,
      ""
    )
    .trim();

  if (
    !candidate ||
    candidate.length > 100 ||
    candidate.split(/\s+/).length > 6
  ) {
    return null;
  }

  if (
    /[?\d]/.test(candidate) ||
    /\b(reuniao|reunião|rede|saude|saúde|hoje|ontem|quero|preciso|como|porque|por que|fale|conte|salvar|registrar|sim|nao|não)\b/i.test(
      candidate
    )
  ) {
    return null;
  }

  return candidate;
}
