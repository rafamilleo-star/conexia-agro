// api/_lib/relationshipAssistant/messages.js
//
// Templates de mensagem para o Assistente de Inteligência Relacional.
// Regra dura, sem exceção: nunca tom de cobrança, nunca citar "dias sem
// acessar", nunca inferir rotina/cargo/família/saúde sem dado explícito.
// Nunca incluir relationshipContext/notes privadas no texto.

function greet(firstName) {
  return firstName ? `, ${firstName}` : '';
}

export function onboardingReminderMessage(firstName, step /* 'first' | 'second' */) {
  if (step === 'second') {
    return `Oi${greet(firstName)}! Posso te fazer uma pergunta?\n\nQuantas vezes você já pensou em falar com alguém importante, mas a correria passou na frente?\n\nFoi justamente para ajudar nesses momentos que nasceu o CONÉXIA. Seu cadastro continua salvo.`;
  }
  return `Ei${greet(firstName)}! Você chegou tão perto. Bora continuar?\n\nAqui você consegue organizar quem realmente importa, lembrar das histórias e interações e perceber quem merece sua atenção neste momento.\n\nSeu cadastro está salvo. É só continuar de onde parou.`;
}

// Etapa diferente do onboarding: aqui a pessoa JÁ terminou o cadastro (nome,
// WhatsApp, empresa etc.) — falta só o assessment relacional que gera o
// perfil/arquétipo. Mensagem não repete "seu cadastro está salvo" porque
// isso já não é verdade nessa etapa; seria inventar/confundir o que falta.
export function assessmentReminderMessage(firstName, step /* 'first' | 'second' */) {
  if (step === 'second') {
    return `Oi${greet(firstName)}! Só faltam algumas perguntas rápidas pra eu te mostrar seu perfil relacional completo.\n\nLeva poucos minutos, e a partir dele eu já consigo te ajudar de verdade com sugestões pra sua rede.`;
  }
  return `Ei${greet(firstName)}! Seu cadastro no CONÉXIA já está pronto — falta só um passo: as perguntas que revelam seu perfil relacional.\n\nBora terminar? É rápido, e é a partir daí que eu passo a te dar sugestões personalizadas de verdade.`;
}

export function inactivityCheckInMessage(firstName) {
  return `E aí${greet(firstName)}, como você está?\n\nPassei para lembrar que você é importante para nós — e também para te incentivar a não deixar de lado quem é importante para você.\n\nPosso te ajudar a escolher sua próxima ação?`;
}

export function weeklySummaryOpeningMessage(firstName) {
  return `Bom dia${greet(firstName)}! Como você está?\n\nBora começar a semana?\n\nPreparei um resumo das suas relações para te ajudar a focar no que realmente importa.`;
}

// items: array de até 3 strings já formatadas (ex.: "Carlos está próximo da
// frequência que você definiu."). suggestion: 1 frase, ou null.
export function weeklySummaryBodyMessage({ firstName, weekInteractionsCount, items, suggestion }) {
  if (!items?.length && !weekInteractionsCount) {
    return `Essa semana ainda está leve por aqui.\n\nQue tal escolher uma pessoa importante e começar com uma mensagem simples: "Como você está?"`;
  }
  const intro = weekInteractionsCount
    ? `Na última semana, você registrou ${weekInteractionsCount} interaç${weekInteractionsCount === 1 ? 'ão' : 'ões'} importante${weekInteractionsCount === 1 ? '' : 's'}.\n\n`
    : '';
  const lista = (items || []).slice(0, 3).map((item, i) => `${i + 1}. ${item}`).join('\n');
  const sugestao = suggestion ? `\n\nMinha sugestão para hoje: ${suggestion}` : '';
  return `${intro}Para esta semana:\n\n${lista}${sugestao}`;
}

// reason vem do priorityEngine (shared/priorityEngine.js, via actionEngine.js)
// e NUNCA deve conter relationshipContext/notes cru — só texto seguro e
// genérico. O `reason` já vem formulado com contexto próprio, então a
// mensagem não repete informação — só apresenta quem é.
export function relationshipAttentionMessage({ firstName, contactName, reason }) {
  return `Separei uma pessoa que talvez mereça sua atenção: *${contactName}*.\n\n${reason}`;
}

export function nextBestActionMessage({ contactName, title, reason }) {
  return `${title}\n\n${reason}`;
}

// eventSummary vem direto do título do evento no calendário do usuário — não
// filtrado por IA, então mantém o texto original entre aspas em vez de
// tentar reformular (evita inventar contexto que não está no evento).
export function calendarInteractionSuggestionMessage({ firstName, contactName, eventSummary }) {
  const evento = eventSummary ? ` "${eventSummary}"` : '';
  return `Oi${greet(firstName)}! Vi no seu calendário${evento} com *${contactName}* hoje.\n\nQuer que eu registre isso como uma interação? Responde *sim* ou *não*.`;
}

// Convidado sem match em nenhum contato existente — sugere cadastrar E
// registrar a interação em uma única pergunta (sem criar tela nova).
export function calendarNewContactSuggestionMessage({ firstName, contactName, eventSummary }) {
  const evento = eventSummary ? ` "${eventSummary}"` : '';
  return `Oi${greet(firstName)}! Você teve uma reunião${evento} com *${contactName}* hoje, mas não encontrei essa pessoa na sua rede.\n\nQuer que eu já cadastre e registre essa conversa? Responde *sim* ou *não*.`;
}

export const CTAS = {
  onboarding: ['Continuar cadastro', 'Retomar no CONÉXIA'],
  inactivity: ['Ver minha próxima ação', 'Quem merece atenção?', 'Cadastrar alguém importante', 'Abrir o CONÉXIA'],
  weeklySummary: ['Ver minha semana no CONÉXIA'],
  // Respostas humanas ao RELATIONSHIP_ATTENTION — cada uma ensina o motor de
  // prioridade (ver shared/alertsFeedback.js). Reconhecer essas frases no
  // classificador de intenção do webhook segue sendo um passo seguinte,
  // ainda não conectado.
  relationshipAttention: ['Vale retomar', 'Está tudo bem assim', 'Conversamos recentemente', 'Lembrar depois'],
};

// Frases proibidas — usado em testes e como checagem defensiva antes de enviar
// (nunca deixar passar tom de cobrança ou linguagem técnica de CRM/scoring).
export const FORBIDDEN_PHRASES = [
  'você está há',
  'sem acessar',
  'precisa usar o aplicativo',
  'não perder seu progresso',
  'você está atrasado',
  'não cumpriu sua meta',
  'você sumiu',
  'você ignorou',
  'você precisa',
  'deveria ter feito',
  'vínculo inativo',
  'relação fria',
  'reciprocidade caiu',
  'health score',
  'engajamento',
  'centralidade',
  'nó crítico',
];

export function containsForbiddenTone(text) {
  const lower = (text || '').toLowerCase();
  return FORBIDDEN_PHRASES.some(p => lower.includes(p));
}
