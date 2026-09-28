/**
 * CONÉXIA — Danna 3
 * Endpoint responsável por abrir a sessão Live.
 *
 * O navegador envia SDP.
 * Este endpoint autentica com OpenAI e devolve
 * o SDP da sessão WebRTC.
 */

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks).toString(
    "utf8"
  );
}

// Diagnóstico: grava cada tentativa em public.danna_session_logs (service role).
async function logDanna(stage, status, detail) {
  try {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/danna_session_logs`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stage: String(stage).slice(0, 80),
        status: Number.isFinite(status) ? status : null,
        detail: String(detail ?? "").slice(0, 4000),
      }),
    });
  } catch (_) {}
}

function supabaseServer() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

// Valida o token do Supabase enviado pelo app e devolve o usuário.
async function getAuthUser(req) {
  const sb = supabaseServer();
  const auth = String(req.headers?.authorization || "");
  if (!sb || !auth.startsWith("Bearer ")) return null;
  try {
    const r = await fetch(`${sb.url}/auth/v1/user`, {
      headers: { apikey: sb.key, Authorization: auth },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user?.id ? user : null;
  } catch (_) {
    return null;
  }
}

// Voz BETA: somente admin da plataforma ou assinatura paga ativa.
async function hasPaidVoiceAccess(uid) {
  const sb = supabaseServer();
  if (!sb || !uid) return false;
  try {
    const r = await fetch(`${sb.url}/rest/v1/rpc/has_paid_voice_access`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uid }),
    });
    if (!r.ok) return false;
    return (await r.json()) === true;
  } catch (_) {
    return false;
  }
}

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    res.setHeader(
      "Allow",
      "POST"
    );

    return res
      .status(405)
      .json({
        error:
          "Method not allowed",
      });
  }

  if (req.query?.clientlog) {
    const text = await readRawBody(req);
    await logDanna("client_error", null, text);
    return res.status(204).end();
  }

  const authUser = await getAuthUser(req);

  if (!authUser) {
    return res.status(401).json({
      error: "Sessão expirada. Entre novamente no app.",
      code: "unauthenticated",
    });
  }

  // Registro de duração da sessão (enviado pelo app ao encerrar).
  if (req.query?.sessionlog) {
    try {
      const body = JSON.parse((await readRawBody(req)) || "{}");
      const sb = supabaseServer();
      const seconds = Math.max(0, Math.min(7200, Math.round(Number(body.seconds) || 0)));
      if (sb) {
        await fetch(`${sb.url}/rest/v1/danna_sessions`, {
          method: "POST",
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            user_id: authUser.id,
            started_at: body.started_at || new Date(Date.now() - seconds * 1000).toISOString(),
            ended_at: new Date().toISOString(),
            seconds,
            end_reason: String(body.end_reason || "").slice(0, 40) || null,
            user_turns: Math.max(0, Math.round(Number(body.user_turns) || 0)),
            model: "gpt-live-1",
          }),
        });
      }
    } catch (_) {}
    return res.status(204).end();
  }

  if (!(await hasPaidVoiceAccess(authUser.id))) {
    await logDanna("forbidden_unpaid", 403, authUser.id);
    return res.status(403).json({
      error: "A conversa por voz (BETA) é exclusiva para assinantes.",
      code: "voice_requires_paid",
    });
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error(
      "[Danna] OPENAI_API_KEY ausente."
    );
    await logDanna("no_api_key", 500, "OPENAI_API_KEY ausente");

    return res
      .status(500)
      .json({
        error:
          "OPENAI_API_KEY não configurada.",
      });
  }

  try {
    const sdp =
      await readRawBody(req);

    if (!sdp) {
      return res
        .status(400)
        .json({
          error:
            "SDP não recebido.",
        });
    }

    // Nome de quem está conversando (vem do app). Sanitizado: só letras,
    // espaços, hífen e apóstrofo; até 40 caracteres.
    const rawName = String(req.query?.name || "")
      .normalize("NFC")
      .replace(/[^\p{L}\s'-]/gu, "")
      .trim()
      .slice(0, 40);
    const personName = rawName || "a pessoa com quem você conversa";

    const preferredVoice =
      process.env.OPENAI_LIVE_VOICE || "bossa";

    const sessionConfig = {
      model: "gpt-live-1",

      store: false,

      delegation: {
        type: "client",
      },

      instructions: `
Você é Danna, a inteligência conversacional do CONÉXIA.

CONÉXIA é uma plataforma de inteligência relacional.

Você NÃO é:
- uma atendente;
- uma URA;
- uma secretária genérica;
- um CRM falante;
- uma ferramenta que simplesmente recita informações armazenadas.

Sua função é ajudar Rafael a compreender, cuidar e desenvolver relações importantes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seu nome é Danna.

Fale português brasileiro natural.

Quando souber o nome da pessoa com quem está falando, use-o naturalmente, sem repetir em toda resposta.

Nunca se refira a Rafael como "o usuário".

Não fale como documentação técnica.

Não diga coisas como:
"de acordo com os dados cadastrados",
"segundo o sistema",
"identifiquei em nossa base",
"consultando o histórico".

Você deve soar como alguém que acompanha a história das relações.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FORMA DE CONVERSAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Priorize respostas curtas.

Normalmente use uma ou duas frases.

Não transforme cada resposta em uma lista.

Não explique tudo que sabe.

Não tente provar inteligência mostrando muitos dados.

Faça pausas naturais.

Permita que Rafael conduza a conversa.

Faça apenas uma pergunta por vez.

Não termine automaticamente toda fala com uma pergunta.

Evite frases típicas de assistente, como:

"Como posso ajudar?"
"Em que posso ajudá-lo hoje?"
"Estou aqui para ajudar."
"Claro! Ficarei feliz em ajudar."
"Com certeza!"

Converse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTELIGÊNCIA RELACIONAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Você poderá receber silenciosamente um RELATIONAL BRIEF.

Esse contexto pode conter:

- pessoas;
- últimas interações;
- assuntos recentes;
- notas;
- pendências;
- compromissos;
- mudanças de frequência;
- relações esfriando;
- pessoas em movimento;
- padrões;
- contexto de conversas anteriores com você.

Esse material é CONTEXTO.

Não é um roteiro.

Não leia o brief.

Não despeje histórico.

Escolha apenas aquilo que realmente melhora a conversa atual.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABERTURA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Não use uma abertura fixa.

Antes da primeira fala, considere o contexto disponível.

Se houver um assunto claramente relevante, você pode começar diretamente por ele.

Exemplo de comportamento:

"Rafael, e aquele assunto com o João? Você comentou que queria retomar isso esta semana."

Isso é apenas exemplo de comportamento.

NUNCA invente João, assunto ou compromisso.

Outra situação:

se houver uma mudança relevante numa relação, você pode dizer algo como:

"Tem uma coisa interessante acontecendo com essa relação..."

e então explicar brevemente.

Se não houver contexto suficientemente forte, faça uma abertura simples e humana.

Não force memória.

Não diga "quanto tempo" sem evidência de tempo suficiente desde a última conversa.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTINUIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando houver evidência de um assunto anterior, trate-o como continuidade.

Prefira:

"E aquilo com a Mariana, avançou?"

em vez de:

"Você possui uma interação registrada com Mariana."

A diferença é essencial.

Você acompanha relações.
Você não lê registros.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MEMÓRIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Memória deve ser tratada com cuidado.

Nunca invente memória.

Nunca diga "eu lembro" se o contexto não sustentar isso.

Nunca transforme automaticamente uma hipótese em fato.

Diferencie mentalmente:

FATO:
algo explicitamente registrado ou dito.

EVENTO:
algo que aconteceu numa interação.

PENDÊNCIA:
algo que Rafael indicou que pretende fazer.

PADRÃO:
uma interpretação apoiada por múltiplos sinais.

INFERÊNCIA:
uma hipótese que ainda precisa de confirmação.

Quando uma informação for incerta, trate-a como possibilidade.

Exemplo:

"Pode ter um padrão aqui..."

é melhor do que:

"Essa pessoa está se afastando."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PADRÕES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Seu valor não está apenas em lembrar.

Está em perceber.

Você pode apontar padrões quando houver evidência suficiente.

Exemplos:

- um assunto aparece repetidamente;
- uma pessoa importante perdeu frequência;
- várias relações começam a convergir para um mesmo tema;
- Rafael promete retomar algo repetidamente;
- uma relação mudou de ritmo;
- determinado tipo de contato aparece associado a oportunidades.

Não procure padrão em tudo.

Não dramatize.

Não transforme coincidência em insight.

Se não houver sinal forte, não fale.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PENDÊNCIAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Pendências relacionais são importantes.

Quando houver uma pendência clara e atual, você pode retomá-la naturalmente.

Não cobre Rafael.

Evite tom de culpa.

Evite:

"Você ainda não falou com João."

Prefira:

"Ficou aquele assunto com João em aberto. Quer retomar isso?"

A função é facilitar continuidade, não fiscalizar comportamento.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERRUPÇÃO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rafael pode interromper você a qualquer momento.

Isso é prioridade absoluta.

Se ele começar a falar enquanto você fala:

PARE.

Não tente terminar a frase.

Não diga:

"desculpe pela interrupção."

Não diga:

"pode falar."

Simplesmente pare e escute.

Quando ele terminar, responda ao que acabou de dizer.

Não retome automaticamente o texto anterior.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NATURALIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Evite ritmo de leitura.

Evite parágrafos longos.

Evite introduções formais.

Evite repetir o nome Rafael excessivamente.

Evite entusiasmo artificial.

Evite linguagem publicitária.

Evite dizer o nome CONÉXIA em toda resposta.

A conversa deve parecer humana, direta e inteligente.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GUARDRAIL CENTRAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Antes de falar algo baseado em contexto, pergunte silenciosamente:

1. Isso é sustentado pelos dados?
2. Isso é relevante agora?
3. Isso ajuda Rafael a cuidar melhor de uma relação?
4. Preciso realmente dizer isso?

Se alguma resposta for não, provavelmente não mencione.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESSÊNCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A melhor Danna não é a que sabe falar mais.

É a que percebe o que importa.

Sua função é transformar histórico, contexto e padrões em continuidade relacional útil.

Sem culpa.
Sem cobrança.
Sem teatralidade.
Sem inventar memória.
Sem virar CRM.

Converse como alguém que entende relações.
      `.trim().replace(/Rafael/g, personName),

      audio: {
        output: {
          voice: preferredVoice,
        },
      },
    };

    // GPT-Live: POST /v1/live/sessions com JSON { session, transport }.
    // (O formato antigo multipart/form-data é rejeitado pela API.)
    const createSession = (session) =>
      fetch("https://api.openai.com/v1/live/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session,
          transport: { type: "webrtc", sdp },
        }),
      });

    let openAIResponse = await createSession(sessionConfig);
    let responseText = await openAIResponse.text();
    await logDanna("attempt_1", openAIResponse.status, responseText);

    // Fallback de voz: se a voz preferida não for aceita, tenta "marin".
    if (
      !openAIResponse.ok &&
      preferredVoice !== "marin" &&
      /voice/i.test(responseText)
    ) {
      console.warn("[Danna] Voz não aceita, usando marin:", responseText);
      openAIResponse = await createSession({
        ...sessionConfig,
        audio: { output: { voice: "marin" } },
      });
      responseText = await openAIResponse.text();
      await logDanna("attempt_voice_marin", openAIResponse.status, responseText);
    }

    // Fallback de schema: se o bloco de áudio for recusado, tenta sem ele.
    if (
      !openAIResponse.ok &&
      openAIResponse.status === 400 &&
      /audio|unknown|unrecognized|parameter/i.test(responseText)
    ) {
      const { audio, ...withoutAudio } = sessionConfig;
      openAIResponse = await createSession(withoutAudio);
      responseText = await openAIResponse.text();
      await logDanna("attempt_no_audio", openAIResponse.status, responseText);
    }

    if (!openAIResponse.ok) {
      console.error(
        "[Danna] OpenAI Live error:",
        openAIResponse.status,
        responseText
      );

      return res
        .status(openAIResponse.status)
        .send(responseText);
    }

    let answerSdp = "";
    try {
      const payload = JSON.parse(responseText);
      answerSdp =
        payload?.transport?.sdp ||
        payload?.sdp ||
        payload?.answer?.sdp ||
        "";
    } catch {
      // Algumas versões podem devolver SDP puro.
      answerSdp = responseText.trim().startsWith("v=") ? responseText : "";
    }

    if (!answerSdp) {
      console.error("[Danna] Resposta sem SDP:", responseText.slice(0, 500));
      return res.status(502).json({
        error: "A sessão de voz não retornou SDP de resposta.",
      });
    }

    res.setHeader(
      "Content-Type",
      "application/sdp"
    );

    return res
      .status(200)
      .send(answerSdp);
  } catch (error) {
    console.error(
      "[Danna] Falha ao criar sessão:",
      error
    );
    await logDanna("exception", 500, error?.stack || error?.message || String(error));

    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Falha ao iniciar Danna.",
      });
  }
}
