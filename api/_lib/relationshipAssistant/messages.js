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

// reason/suggestedMessage vêm do actionEngine e NUNCA devem conter
// relationshipContext/notes cru — só texto seguro e genérico.
export function relationshipAttentionMessage({ firstName, contactName, reason }) {
  return `Separei uma relação que está próxima da frequência que você definiu: *${contactName}*.\n\n${reason}\n\nTalvez seja um bom momento para falar com ${contactName}.`;
}

export function nextBestActionMessage({ contactName, title, reason }) {
  return `${title}\n\n${reason}`;
}

export const CTAS = {
  onboarding: ['Continuar cadastro', 'Retomar no CONÉXIA'],
  inactivity: ['Ver minha próxima ação', 'Quem merece atenção?', 'Cadastrar alguém importante', 'Abrir o CONÉXIA'],
  weeklySummary: ['Ver minha semana no CONÉXIA'],
};

// Frases proibidas — usado em testes e como checagem defensiva antes de enviar
// (nunca deixar passar tom de cobrança acidental).
export const FORBIDDEN_PHRASES = [
  'você está há',
  'sem acessar',
  'precisa usar o aplicativo',
  'não perder seu progresso',
  'você está atrasado',
  'não cumpriu sua meta',
];

export function containsForbiddenTone(text) {
  const lower = (text || '').toLowerCase();
  return FORBIDDEN_PHRASES.some(p => lower.includes(p));
}
