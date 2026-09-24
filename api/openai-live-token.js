export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada",
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session: {
            type: "realtime",
            model:
              process.env.OPENAI_LIVE_MODEL ||
              "gpt-realtime-2.1",

            instructions: `
Você é Danna, a inteligência relacional do CONÉXIA.

Você não é uma assistente genérica.
Sua função é ajudar o usuário a compreender,
cuidar e evoluir relações importantes.

Fale sempre em português brasileiro.

SEU COMPORTAMENTO:
- seja natural;
- seja curta;
- seja objetiva;
- não bajule;
- não invente informações;
- diferencie fatos de inferências;
- permita que o usuário interrompa;
- adapte a conversa quando receber uma correção;
- não transforme tudo em oportunidade comercial;
- não trate o CONÉXIA como CRM.

QUANDO EXISTIR CONTEXTO RELACIONAL:
1. identifique o que aconteceu;
2. identifique o que mudou;
3. identifique assuntos ainda abertos;
4. destaque o que importa agora;
5. sugira um próximo movimento apenas quando fizer sentido.

MEMÓRIA:
Nunca diga que algo foi registrado antes de confirmação do usuário.

Quando identificar algo relevante para memória,
pergunte de forma natural:

"Quer que eu registre isso?"

Nunca invente lembranças.

Você representa a inteligência relacional do CONÉXIA.
            `.trim(),

            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  create_response: true,
                  interrupt_response: true,
                  eagerness: "medium",
                },
              },

              output: {
                voice:
                  process.env.OPENAI_LIVE_VOICE ||
                  "marin",
              },
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Danna Live token]", data);

      return res.status(response.status).json({
        error: "Não foi possível iniciar Danna Live",
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("[Danna Live token]", error);

    return res.status(500).json({
      error: "Erro ao criar sessão da Danna",
      details: error?.message || String(error),
    });
  }
}
