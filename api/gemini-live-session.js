/**
 * CONÉXIA — Danna (motor Gemini Live)
 *
 * Emite um token efêmero de uso único para o navegador abrir a sessão
 * Gemini Live por WebSocket. A GEMINI_API_KEY nunca sai do servidor.
 *
 * Arquitetura: o Gemini Live é a VOZ (ouvir, falar, turnos, interrupção).
 * O raciocínio continua no pipeline do CONÉXIA (roteador + Central Brain
 * + captura com confirmação), acionado pela função `conexia_responder`.
 * Assim OpenAI e Gemini são comparados só pela voz, com o mesmo cérebro.
 */

import {
  readRawBody,
  logDanna,
  getAuthUser,
  hasPaidVoiceAccess,
  recordSession,
  sanitizeName,
} from "./_lib/dannaAccess.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const GEMINI_LIVE_MODEL =
  process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";

function buildInstructions(personName) {
  return `
Você é a VOZ da Danna, a inteligência relacional do CONÉXIA.
Fale sempre em português do Brasil, com naturalidade, calor humano e ritmo de conversa.
Quem está conversando com você é ${personName}.

COMO FUNCIONA:
1. Sempre que ${personName} disser qualquer coisa, chame a função conexia_responder
   passando em "fala" a transcrição fiel do que foi dito.
   Não responda com conhecimento próprio e não invente nada sobre pessoas ou fatos.
2. Quando a função devolver o campo "resposta", fale esse conteúdo com naturalidade,
   sem acrescentar informações, sem ler rótulos, aspas ou formatação.
3. Quando receber uma mensagem de texto que começa com "DIGA:", fale exatamente
   o que vem depois de "DIGA:", de forma natural, e depois aguarde.
4. Nunca diga que está chamando funções, consultando sistemas ou dados.
5. Se ${personName} interromper, pare e escute.
`.trim();
}

function buildLiveConfig(personName) {
  return {
    responseModalities: ["AUDIO"],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: process.env.GEMINI_LIVE_VOICE || "Kore",
        },
      },
    },
    systemInstruction: {
      parts: [{ text: buildInstructions(personName) }],
    },
    tools: [
      {
        functionDeclarations: [
          {
            name: "conexia_responder",
            description:
              "Envia a fala do usuário ao CONÉXIA e devolve a resposta que deve ser dita em voz alta.",
            parameters: {
              type: "OBJECT",
              properties: {
                fala: {
                  type: "STRING",
                  description: "Transcrição fiel do que o usuário acabou de dizer.",
                },
              },
              required: ["fala"],
            },
          },
        ],
      },
    ],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = await getAuthUser(req);

  if (!authUser) {
    return res.status(401).json({
      error: "Sessão expirada. Entre novamente no app.",
      code: "unauthenticated",
    });
  }

  if (req.query?.sessionlog) {
    try {
      const body = JSON.parse((await readRawBody(req)) || "{}");
      await recordSession(authUser.id, { ...body, model: GEMINI_LIVE_MODEL });
    } catch (_) {}
    return res.status(204).end();
  }

  if (!(await hasPaidVoiceAccess(authUser.id))) {
    await logDanna("gemini_forbidden_unpaid", 403, authUser.id);
    return res.status(403).json({
      error: "A conversa por voz (BETA) é exclusiva para assinantes.",
      code: "voice_requires_paid",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    await logDanna("gemini_no_api_key", 500, "GEMINI_API_KEY ausente");
    return res.status(500).json({ error: "GEMINI_API_KEY não configurada." });
  }

  try {
    const personName =
      sanitizeName(req.query?.name) || "a pessoa com quem você conversa";

    const liveConfig = buildLiveConfig(personName);
    const now = Date.now();

    const tokenBody = {
      uses: 1,
      // conexão pode durar até 11 min (teto de sessão do app é 10 min)
      expireTime: new Date(now + 11 * 60 * 1000).toISOString(),
      // a sessão precisa começar em até 1 minuto
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: `models/${GEMINI_LIVE_MODEL}`,
        config: liveConfig,
      },
    };

    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tokenBody),
      }
    );

    const text = await r.text();
    await logDanna("gemini_token", r.status, r.ok ? "ok" : text);

    if (!r.ok) {
      return res.status(r.status).send(text);
    }

    let data = null;
    try { data = JSON.parse(text); } catch (_) {}

    const token = data?.name;
    if (!token) {
      return res.status(502).json({ error: "Token do Gemini não recebido." });
    }

    return res.status(200).json({
      token,
      model: GEMINI_LIVE_MODEL,
      setup: {
        model: `models/${GEMINI_LIVE_MODEL}`,
        ...liveConfig,
      },
    });
  } catch (error) {
    await logDanna("gemini_exception", 500, error?.stack || error?.message || String(error));
    return res.status(500).json({
      error: error?.message || "Falha ao iniciar a voz Gemini.",
    });
  }
}
