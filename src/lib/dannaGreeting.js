export function buildDannaGreeting(
  brain,
  name = "",
  timeZone = "America/Sao_Paulo",
  now = new Date()
) {
  const pieces = [
    `Oi${name ? `, ${name}` : ""}. Como vai?`,
  ];

  const profile = brain?.overview?.profile;

  if (profile?.lastDiscussedPerson) {
    pieces.push(
      `Na última conversa registrada, falamos sobre ${profile.lastDiscussedPerson}.`
    );
  } else {
    const last = (brain?.interactions || []).find(
      i => i.person && i.person !== "desconhecido"
    );

    if (last) {
      const detail = String(last.description || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      pieces.push(
        `Seu último registro foi com ${last.person}${
          detail ? `: ${detail}` : ""
        }.`
      );
    }
  }

  if (brain) {
    const until = now.getTime() + 7 * 86400000;

    const events = (brain.overview?.upcoming_events || [])
      .filter(e => {
        const at = Date.parse(e.at);

        return at >= now.getTime() && at < until;
      })
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    if (events.length) {
      const next = events[0];

      let when = "";

      try {
        when = new Intl.DateTimeFormat("pt-BR", {
          timeZone,
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(next.at));
      } catch {}

      pieces.push(
        `Nos próximos sete dias, há ${events.length} ` +
        `compromisso${events.length > 1 ? "s" : ""} ` +
        `registrado${events.length > 1 ? "s" : ""}. ` +
        `O próximo é ${next.type || "um encontro"}` +
        `${next.person ? ` com ${next.person}` : ""}` +
        `${when ? `, ${when}` : ""}.`
      );
    } else {
      pieces.push(
        "Não encontrei compromissos registrados para os próximos sete dias."
      );
    }
  } else {
    pieces.push(
      "Não consegui consultar sua memória e agenda agora."
    );
  }

  pieces.push("Por onde vamos começar?");

  return pieces.join(" ");
}
