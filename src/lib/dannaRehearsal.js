import { resolveDannaContact } from '../../shared/dannaCapabilities.js';
import { requestRehearsal } from './conversationRehearsal.js';

const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function isDannaRehearsalRequest(text) {
  const line = normalize(text).replace(/^danna[, ]+/, '');
  return /^(?:(?:eu |quero |vamos |pode |me |preciso |gostaria de |ajude a |ajuda a )*)(?:ensaiar|ensaie|simular|simule|treinar|treine|praticar|pratique)\b/.test(line) ||
    /^(?:quero |vamos |pode |me )?(?:fazer |iniciar |comecar |abrir )?(?:um |o )?ensaio\b/.test(line);
}

function contactFromLine(text, contacts, activePerson) {
  const match = /\bcom\s+(.+?)(?:\s+para\b|\s+sobre\b|[.!?]|$)/i.exec(text);
  if (match) return resolveDannaContact(match[1].replace(/^(o|a)\s+/i, ''), contacts);
  return resolveDannaContact(activePerson, contacts);
}

const scenarioFor = text => /indicac|ajuda|pedir/.test(normalize(text)) ? 'ajuda' : /dificil|feedback|negoci|conflito/.test(normalize(text)) ? 'dificil' : 'retomar';

// Este estado não escreve no banco nem entra na memória de conversas reais.
export async function advanceDannaRehearsal(state, text, { contacts = [], interactions = [], activePerson = null, isPro = false, signal, request = requestRehearsal } = {}) {
  const line = String(text || '').trim();
  const n = normalize(line);
  if (!state && !isDannaRehearsalRequest(line)) return { handled: false };
  if (/^(?:danna[, ]+)?(?:sair do ensaio|cancelar ensaio|encerrar ensaio|voltar a conversa|voltar para a conversa|voltar ao normal|tchau|encerrar|cancelar)[.! ]*$/.test(n)) {
    return { handled: true, state: null, answer: 'Ensaio encerrado. Voltamos à conversa real; nada do exercício foi registrado como interação.' };
  }
  if (!isPro) return { handled: true, state: null, answer: 'O ensaio é um recurso PRO. Posso ajudar a preparar a conversa com os recursos disponíveis na sua conta.' };
  if (!state || isDannaRehearsalRequest(line)) {
    const found = contactFromLine(line, contacts, activePerson);
    const stance = /cetico/.test(n) ? 'cetico' : /sem tempo/.test(n) ? 'sem_tempo' : 'receptivo';
    state = { stage: found.contact ? 'goal' : 'person', contact: found.contact, scenario: 'retomar', stance, goal: '', messages: [], feedback: null };
    return { handled: true, state, answer: found.contact
      ? `Vamos ensaiar uma situação fictícia antes de falar com ${found.contact.name}. Qual resultado você busca nessa conversa?`
      : found.candidates.length > 1 ? `Encontrei mais de uma pessoa: ${found.candidates.map(c => [c.name, c.company].filter(Boolean).join(' — ')).join('; ')}. Diga o nome completo de quem você quer.`
        : 'Com quem você quer ensaiar? Diga o nome de uma pessoa da sua rede.' };
  }
  if (state.stage === 'person') {
    const found = resolveDannaContact(line.replace(/^(?:com |o |a )+/i, ''), contacts);
    if (!found.contact) return { handled: true, state, answer: found.candidates.length > 1
      ? `Qual destas pessoas: ${found.candidates.map(c => [c.name, c.company].filter(Boolean).join(' — ')).join('; ')}?`
      : 'Não encontrei uma pessoa única com esse nome. Diga o nome completo cadastrado.' };
    return { handled: true, state: { ...state, contact: found.contact, stage: 'goal' }, answer: `Qual resultado você busca na conversa com ${found.contact.name}?` };
  }
  if (state.stage === 'goal') {
    if (line.length < 5) return { handled: true, state, answer: 'Diga em uma frase o que você quer alcançar nessa conversa.' };
    return { handled: true, state: { ...state, stage: 'practice', goal: line.slice(0, 500), scenario: scenarioFor(line) },
      answer: 'Certo. Vou interpretar um interlocutor fictício. Como você abriria a conversa?' };
  }
  if (/^(?:recomecar|recomeca|novo ensaio)[.! ]*$/.test(n)) {
    return { handled: true, state: { ...state, stage: 'practice', messages: [], feedback: null }, answer: 'Vamos tentar novamente. Como você abriria a conversa?' };
  }
  if (state.stage === 'finished') return { handled: true, state, answer: 'O ensaio terminou. Diga “recomeçar” para tentar outra abordagem ou “sair do ensaio” para voltar à conversa real.' };
  const review = /^(?:finalizar|finaliza|finalizar ensaio|finalizar e receber feedback|feedback|me de feedback|avaliar|como fui)[.!? ]*$/.test(n);
  const count = state.messages.filter(m => m.role === 'user').length;
  if (review && !count) return { handled: true, state, answer: 'Pratique pelo menos uma resposta antes de pedir o feedback.' };
  const feedback = review || count >= 5;
  const messages = feedback ? state.messages : [...state.messages, { role: 'user', text: line.slice(0, 1200) }];
  const result = await request({ contact: state.contact, interactions, scenario: state.scenario, stance: state.stance, goal: state.goal, messages, feedback }, signal);
  if (feedback) return { handled: true, state: { ...state, stage: 'finished', feedback: result },
    answer: `No ensaio: ${result.acerto} Ajuste sugerido: ${result.ajuste} Uma abertura possível: ${result.alternativa} Essa leitura é sobre sua prática, não uma previsão da pessoa real. Diga “sair do ensaio” para voltar.` };
  const next = { ...state, messages: [...messages, { role: 'assistant', text: result.resposta }] };
  return { handled: true, state: next, answer: result.resposta + (count === 4 ? ' Agora você pode pedir o feedback.' : '') };
}
