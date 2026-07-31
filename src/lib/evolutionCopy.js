// src/lib/evolutionCopy.js
//
// Microrresposta mostrada quando o usuário marca uma tarefa/meta do plano
// como concluída. Regras (mesmo espírito de api/_lib/relationshipAssistant/messages.js):
// - Nunca celebração de desempenho ("ótimo trabalho!", "parabéns!").
// - Nunca inventa contexto que não veio de dado real (ex.: nome de contato
//   específico) — o checklist do plano não é vinculado a um contato.
// - Fala de EFEITO relacional real, ancorado em atividade já registrada
//   (realProgress vindo de plan_progress), nunca em contagem de cliques.
// - Sem streak, sem número de "tarefas concluídas no total".

const FORBIDDEN_WORDS = ['parabéns', 'ótimo trabalho', 'você é', 'incrível', 'excelente trabalho'];

function safe(text) {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some(w => lower.includes(w)) ? 'Passo registrado.' : text;
}

// realProgress: { interactions_count, contacts_engaged } | null
export function buildTaskMicroresponse(realProgress) {
  const interacoes = realProgress?.interactions_count || 0;
  const contatos = realProgress?.contacts_engaged || 0;

  if (!interacoes && !contatos) {
    return safe('Passo registrado. Assim que você começar a registrar interações, isso passa a refletir na sua evolução.');
  }
  const partes = [];
  if (interacoes > 0) partes.push(`${interacoes} interaç${interacoes === 1 ? 'ão' : 'ões'} registrada${interacoes === 1 ? '' : 's'}`);
  if (contatos > 0) partes.push(`${contatos} contato${contatos === 1 ? '' : 's'} engajado${contatos === 1 ? '' : 's'}`);
  return safe(`Passo registrado — nesta fase você já soma ${partes.join(' e ')}.`);
}

export function buildMetaMicroresponse(realProgress) {
  const interacoes = realProgress?.interactions_count || 0;
  if (!interacoes) {
    return safe('Meta da semana marcada. Ela vai alimentar sua Carta de Evolução no Meu Perfil.');
  }
  return safe(`Meta da semana marcada — isso entra na sua Carta de Evolução, junto com as ${interacoes} interaç${interacoes === 1 ? 'ão' : 'ões'} já registrada${interacoes === 1 ? '' : 's'}.`);
}
