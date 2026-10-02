// A abertura convida à conversa.
// O contexto entra quando solicitado pelo usuário.

export function buildDannaGreeting(
  brain,
  name = "",
  timeZone,
  now
) {
  const spokenName = String(name || "").trim();

  return (
    `Oi${spokenName ? `, ${spokenName}` : ""}. ` +
    "Como você está? O que vamos ver hoje?"
  );
}
