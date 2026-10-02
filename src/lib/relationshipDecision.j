// src/lib/relationshipDecision.js

const PRIORIDADES = {
  compromisso: 3,
  necessidade: 2,
  objetivo: 1,
};

/**
 * Cada situação deve vir de informação registrada
 * ou confirmada pelo usuário.
 *
 * {
 *   contatoId,
 *   nome,
 *   tipo: "compromisso" | "necessidade" | "objetivo",
 *   motivo,
 *   proximoPasso,
 *   confirmado: true,
 *   concluido: false
 * }
 */
export function decidirAtencao(situacoes = []) {
  const candidatas = situacoes.filter((situacao) => {
    return (
      situacao.confirmado === true &&
      situacao.concluido !== true &&
      situacao.contatoId &&
      situacao.nome?.trim() &&
      situacao.motivo?.trim() &&
      situacao.proximoPasso?.trim() &&
      Object.hasOwn(PRIORIDADES, situacao.tipo)
    );
  });

  if (!candidatas.length) {
    return {
      status: "precisa_contexto",
      pergunta:
        "O que você precisa resolver ou qual relação quer cuidar agora?",
      opcoes: [],
    };
  }

  const maiorPrioridade = Math.max(
    ...candidatas.map((item) => PRIORIDADES[item.tipo])
  );

  const opcoes = candidatas
    .filter(
      (item) => PRIORIDADES[item.tipo] === maiorPrioridade
    )
    .map((item) => ({
      contatoId: item.contatoId,
      quem: item.nome,
      porQue: item.motivo,
      comoAgir: item.proximoPasso,
    }));

  return {
    status: opcoes.length === 1 ? "sugestao" : "escolher",
    pergunta:
      opcoes.length > 1
        ? "Qual destas situações merece sua atenção primeiro?"
        : null,
    opcoes,
  };
}
