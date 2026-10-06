// A abertura convida à conversa.
// O contexto entra quando solicitado pelo usuário.

export function buildDannaGreeting(
  brain,
  name = "",
  timeZone,
  now
) {
  const spokenName = String(name || "").trim();

  const decision = brain?.overview?.relationship_intelligence?.main;
  const context = decision ? ` ${decision.reason} Quer ver esse próximo passo ou outro assunto?` : ' Como você está? O que vamos ver hoje?';
  return (
    `Oi${spokenName ? `, ${spokenName}` : ""}. ` +
    context.trim()
  );
}
