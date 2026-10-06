function safeText(value, max = 500) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function decisionLine(item, index) {
  if (!item) return null;

  const why = safeText(item.reason, 360);
  const nextMove = safeText(
    item.nextMove || item.title,
    260
  );

  return [
    `${index + 1}. ${safeText(item.contactName, 120)}`,
    `Motivo: ${why}`,
    `Próximo movimento: ${nextMove}`,
    `Confiança: ${Number(item.confidence || 0).toFixed(2)}`,
    `Tipo: ${safeText(item.actionType, 100)}`,
  ].join('\n');
}

function recentInteractionLine(item) {
  const person =
    safeText(
      item.contact_name ||
        item.contactName ||
        item.contacts?.name,
      100
    ) || 'Pessoa não identificada';

  const description = safeText(
    item.description || item.notes,
    280
  );

  const createdAt =
    item.created_at || item.createdAt || null;

  return [
    `- ${person}`,
    createdAt ? `em ${createdAt}` : '',
    description ? `— ${description}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function eventLine(item) {
  const person =
    safeText(
      item.contact_name ||
        item.contactName ||
        item.contacts?.name,
      100
    ) || 'Pessoa não identificada';

  const title = safeText(
    item.title || item.description || item.event_type,
    180
  );

  return [
    `- ${person}`,
    item.scheduled_at
      ? `em ${item.scheduled_at}`
      : '',
    title ? `— ${title}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildDannaRelationshipContext({
  intelligence,
  recentInteractions = [],
  upcomingEvents = [],
  userName = '',
} = {}) {
  const decisions =
    intelligence?.decisions?.slice(0, 3) || [];

  const lines = [];

  lines.push(
    'CONTEXTO RELACIONAL ATUAL DO CONÉXIA'
  );

  if (userName) {
    lines.push(`Usuário: ${safeText(userName, 100)}`);
  }

  lines.push(
    `Data de referência: ${
      intelligence?.today || 'não informada'
    }`
  );

  lines.push(
    `Fuso: ${
      intelligence?.timezone || 'America/Sao_Paulo'
    }`
  );

  lines.push('');

  if (decisions.length) {
    lines.push(
      'PRIORIDADES CALCULADAS PELO CÉREBRO CENTRAL:'
    );

    decisions.forEach((item, index) => {
      const line = decisionLine(item, index);

      if (line) {
        lines.push(line);
        lines.push('');
      }
    });
  } else {
    lines.push(
      'PRIORIDADES CALCULADAS PELO CÉREBRO CENTRAL: nenhuma ação com evidência suficiente agora.'
    );
    lines.push('');
  }

  if (recentInteractions.length) {
    lines.push('INTERAÇÕES RECENTES:');

    recentInteractions
      .slice(0, 8)
      .forEach(item => {
        lines.push(recentInteractionLine(item));
      });

    lines.push('');
  }

  if (upcomingEvents.length) {
    lines.push('AGENDA RELACIONAL PRÓXIMA:');

    upcomingEvents
      .slice(0, 8)
      .forEach(item => {
        lines.push(eventLine(item));
      });

    lines.push('');
  }

  lines.push(
    'REGRAS PARA A DANNA:',
    '- Use as prioridades acima como fonte principal para responder quem merece atenção agora.',
    '- Nunca invente relacionamento, evento, promessa, data, empresa, cargo ou histórico.',
    '- Se a evidência for insuficiente, diga claramente que não há dados suficientes.',
    '- Não transforme silêncio em culpa. Explique a oportunidade relacional.',
    '- Quando sugerir uma ação, explique primeiro por que essa pessoa merece atenção agora.',
    '- Priorize no máximo três pessoas.',
    '- Se o usuário registrar uma interação com alguém que ainda não existe na rede, salve o relato primeiro e só depois pergunte se deseja adicionar a pessoa.',
    '- Quando houver compromisso futuro explícito, preserve pessoa, data, contexto e próximo movimento.',
    '- O cérebro central decide a prioridade; a Danna interpreta, explica e conversa.'
  );

  return lines.join('\n');
}

export default buildDannaRelationshipContext;
