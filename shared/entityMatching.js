/**
 * CONÉXIA — Entity Matching (Fase 2, fundação do Radar, ago/2026)
 *
 * Responde: "este sinal externo pertence realmente à pessoa cadastrada?"
 *
 * Princípios (seção 3.4-3.9 do spec do Radar, auditados antes desta
 * implementação):
 * - IDENTIDADE PROGRESSIVA: nunca depende de LinkedIn/Instagram informado.
 *   Usa qualquer subconjunto de evidências disponíveis — nome, empresa,
 *   cargo, cidade/estado, e-mail, telefone, redes quando existirem.
 * - Nunca usa CPF (não existe em nenhuma tabela do CONÉXIA, e este módulo
 *   não introduz o campo).
 * - Resultado é uma FAIXA categórica (CONFIRMED/HIGH/MEDIUM/LOW), nunca um
 *   score numérico 0-100 — decisão consciente do spec, para não parecer uma
 *   métrica de precisão que o sistema não tem.
 * - Quanto menos evidência, mais conservador: LOW nunca vira fato pro
 *   usuário e nunca alimenta shared/priorityEngine.js.
 *
 * Este módulo NÃO decide se um sinal é relevante nem gera texto para o
 * usuário — só resolve "de quem é isso". Reaproveita a mesma normalização
 * de nome que api/_lib/relationshipAssistant/icsImport.js já usa
 * (shared/textNormalize.js) — nunca duas réguas de "mesmo nome" divergentes
 * no sistema. matchContactToEvent() em icsImport.js continua existindo e
 * funcionando exatamente como antes — este módulo é uma CAMADA NOVA ao
 * lado dela, para o caso mais amplo (múltiplas fontes, múltiplas
 * evidências), não uma substituição.
 */

import { normalize } from "./textNormalize.js";

export const CONFIDENCE = {
  CONFIRMED: "CONFIRMED",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

// Ordem de força — usada só internamente para decidir o "melhor candidato"
// quando há mais de um contato com alguma evidência.
const CONFIDENCE_RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CONFIRMED: 3 };

function namesMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  // Mesma regra conservadora do icsImport.js: exige nome completo (2+
  // palavras) de pelo menos um dos lados, nunca casa por primeiro nome
  // isolado.
  if (na.split(" ").length < 2 && nb.split(" ").length < 2) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function fieldsMatch(a, b) {
  if (!a || !b) return false;
  return normalize(a) === normalize(b);
}

/**
 * Avalia um único candidato (contato) contra as evidências de um sinal.
 *
 * @param {object} signalEvidence Evidências de IDENTIDADE extraídas do sinal
 *   — qualquer subconjunto de: { name, company, role, city, stateCode,
 *   email, phone, linkedin, instagram, website, userConfirmedContactId }.
 *
 *   IMPORTANTE — identidade vs. conteúdo do sinal: para um sinal do tipo
 *   "mudança de cargo/emprego", o CARGO NOVO (e às vezes a empresa nova) é
 *   o CONTEÚDO do sinal, não uma evidência de identidade — comparar o cargo
 *   novo contra o cargo hoje cadastrado vai divergir por definição, sempre
 *   que o sinal for verdadeiro. Nesses casos o chamador deve usar como
 *   evidência de identidade só o que é estável através do evento (nome,
 *   cidade/estado, e-mail, telefone, LinkedIn) e tratar cargo/empresa novos
 *   como o payload do sinal (tabela `signals.payload`), nunca como entrada
 *   deste módulo. company/role só devem entrar aqui quando o sinal NÃO for
 *   sobre uma mudança desses próprios campos (ex.: notícia da empresa,
 *   evento presencial).
 * @param {object} contact Linha de `contacts` (formato cru do Supabase).
 * @returns {{ matched: string[], conflicting: string[] }}
 */
function evaluateCandidate(signalEvidence, contact) {
  const matched = [];
  const conflicting = [];

  // Confirmação explícita do usuário sobre ESTE sinal específico — maior
  // força possível, resolve tudo sozinha (ver seção 11 do spec: "Se SIM:
  // guardar confirmação para matching futuro").
  if (signalEvidence.userConfirmedContactId && signalEvidence.userConfirmedContactId === contact.id) {
    matched.push("confirmado_pelo_usuario");
    return { matched, conflicting };
  }

  if (signalEvidence.name) {
    if (namesMatch(signalEvidence.name, contact.name)) matched.push("nome");
    else conflicting.push("nome");
  }

  if (signalEvidence.company && contact.company) {
    if (fieldsMatch(signalEvidence.company, contact.company)) matched.push("empresa");
    else conflicting.push("empresa");
  }

  if (signalEvidence.role && contact.role) {
    if (fieldsMatch(signalEvidence.role, contact.role)) matched.push("cargo");
    else conflicting.push("cargo");
  }

  if (signalEvidence.city && contact.city) {
    if (fieldsMatch(signalEvidence.city, contact.city)) matched.push("cidade");
    else conflicting.push("cidade");
  }

  if (signalEvidence.stateCode && contact.state_code) {
    if (fieldsMatch(signalEvidence.stateCode, contact.state_code)) matched.push("estado");
    else conflicting.push("estado");
  }

  if (signalEvidence.email && contact.contact_email) {
    if (fieldsMatch(signalEvidence.email, contact.contact_email)) matched.push("email");
    else conflicting.push("email");
  }

  if (signalEvidence.linkedin && contact.linkedin) {
    if (fieldsMatch(signalEvidence.linkedin, contact.linkedin)) matched.push("linkedin");
    else conflicting.push("linkedin");
  }

  return { matched, conflicting };
}

/**
 * Converte evidências casadas/conflitantes numa faixa de confiança.
 *
 * Regras (idênticas às da seção 3.5/10 do spec, auditadas antes de
 * escrever este código):
 * - Confirmação explícita do usuário → CONFIRMED, sempre, independente do
 *   resto.
 * - Qualquer conflito relevante (empresa/cargo/cidade/estado/email/linkedin
 *   batendo errado) derruba a confiança — nunca ignora contradição.
 * - Nome batendo sozinho, sem mais nada, é LOW — nome comum é o cenário
 *   exato que a seção 3.9 do spec pede pra nunca virar afirmação de fato.
 * - Nome + 1 ou mais evidências adicionais fortes (empresa, cargo, cidade,
 *   estado, email, linkedin), sem conflito = HIGH — o spec pede faixa, não
 *   score 0-100, então não escalona HIGH por quantidade de evidência.
 */
function classifyConfidence(matched, conflicting) {
  if (matched.includes("confirmado_pelo_usuario")) {
    return { confidence: CONFIDENCE.CONFIRMED, reason: "Identidade confirmada explicitamente pelo usuário em sinal anterior." };
  }

  const hasNameMatch = matched.includes("nome");
  const supportingEvidence = matched.filter((m) => m !== "nome" && m !== "confirmado_pelo_usuario");

  if (conflicting.length > 0) {
    return {
      confidence: CONFIDENCE.LOW,
      reason: `Há divergência em ${conflicting.join(", ")} — não é seguro assumir que é a mesma pessoa.`,
    };
  }

  if (!hasNameMatch) {
    return { confidence: CONFIDENCE.LOW, reason: "Nome não confere — evidência insuficiente para qualquer afirmação." };
  }

  if (supportingEvidence.length >= 1) {
    return {
      confidence: CONFIDENCE.HIGH,
      reason: `Nome confere e há evidência adicional sem conflito (${supportingEvidence.join(", ")}).`,
    };
  }

  return {
    confidence: CONFIDENCE.LOW,
    reason: "Só o nome confere, sem nenhuma outra evidência — nome sozinho não é suficiente (pode ser homônimo).",
  };
}

/**
 * Avalia um sinal contra a lista de contatos do usuário e devolve o melhor
 * candidato, com a faixa de confiança e as evidências que sustentam (ou
 * contradizem) o match.
 *
 * @param {object} signalEvidence Ver evaluateCandidate() acima.
 * @param {Array<object>} contacts Linhas de `contacts` do usuário.
 * @returns {{
 *   contact: object|null,
 *   confidence: "CONFIRMED"|"HIGH"|"MEDIUM"|"LOW",
 *   matchedEvidence: string[],
 *   conflictingEvidence: string[],
 *   confidenceReason: string,
 * }}
 */
export function matchEntity(signalEvidence, contacts) {
  if (!signalEvidence || !Array.isArray(contacts) || contacts.length === 0) {
    return {
      contact: null,
      confidence: CONFIDENCE.LOW,
      matchedEvidence: [],
      conflictingEvidence: [],
      confidenceReason: "Sem contatos para comparar.",
    };
  }

  let best = null;
  let bestRank = -1;

  for (const contact of contacts) {
    const { matched, conflicting } = evaluateCandidate(signalEvidence, contact);
    if (matched.length === 0 && conflicting.length === 0) continue; // nada a avaliar pra este contato

    const { confidence, reason } = classifyConfidence(matched, conflicting);
    const rank = CONFIDENCE_RANK[confidence];

    // Em empate de faixa, prefere o candidato com mais evidência combinada
    // (matched.length maior) — evita que o primeiro contato avaliado "vença"
    // por ordem arbitrária quando na verdade outro candidato tem uma
    // correspondência de nome mais forte, mesmo que os dois acabem LOW.
    // Isso não muda a faixa retornada (LOW continua LOW, nunca vira fato),
    // só torna o motivo relatado mais fiel a qual candidato quase bateu.
    const better =
      rank > bestRank ||
      (rank === bestRank && best && matched.length > best.matchedEvidence.length);

    if (better) {
      bestRank = rank;
      best = { contact, confidence, matchedEvidence: matched, conflictingEvidence: conflicting, confidenceReason: reason };
    }
  }

  return (
    best || {
      contact: null,
      confidence: CONFIDENCE.LOW,
      matchedEvidence: [],
      conflictingEvidence: [],
      confidenceReason: "Nenhum contato com evidência suficiente para comparação.",
    }
  );
}

/**
 * Regra dura (seção 13 do spec): sinal não é ação. Esta função só traduz a
 * faixa de confiança na PRÓXIMA etapa do pipeline — nunca decide "mandar
 * mensagem", isso continua sendo exclusividade de
 * shared/priorityEngine.js, depois de relevância relacional avaliada.
 *
 * @param {"CONFIRMED"|"HIGH"|"MEDIUM"|"LOW"} confidence
 * @returns {"discard"|"ask_user"|"evaluate_relevance"}
 */
export function nextStepForConfidence(confidence) {
  if (confidence === CONFIDENCE.LOW) return "discard";
  if (confidence === CONFIDENCE.MEDIUM) return "ask_user";
  // HIGH e CONFIRMED seguem para avaliação de relevância relacional —
  // nunca direto para o priorityEngine sem esse passo (ver pipeline da
  // seção 13: CAPTURA → MATCH → CONFIABILIDADE → RELEVÂNCIA → CONTEXTO →
  // PRIORITY ENGINE → EXPLICAÇÃO → USUÁRIO DECIDE).
  return "evaluate_relevance";
}

export default matchEntity;
