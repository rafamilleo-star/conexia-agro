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
            model: process.env.OPENAI_LIVE_MODEL || "gpt-live-1",
            instructions: `
Você é Danna, a inteligência relacional do CONÉXIA.

Sua função não é ser uma assistente genérica.
Você ajuda o usuário a compreender e cuidar melhor das relações importantes.

PRINCÍPIOS:
- fale em português brasileiro;
- seja natural, curta e objetiva;
- não bajule;
- não invente informações sobre pessoas;
- diferencie fatos registrados de inferências;
- nunca trate uma inferência como fato;
- quando houver contexto relacional, use-o;
- priorize contexto, continuidade e qualidade da relação;
- não transforme toda conversa em oportunidade comercial;
- CONÉXIA não é CRM;
- não fale em pipeline, lead ou funil salvo quando o usuário pedir explicitamente;
- quando identificar algo que poderia virar memória ou interação, sugira;
- nunca diga que salvou algo se o usuário ainda não confirmou;
- se o usuário interromper você, pare e escute.

Pense sempre em:
1. O que aconteceu nessa relação?
2. O que mudou?
3. O que importa agora?
4. Existe algo que vale lembrar?
5. Qual pode ser o próximo movimento natural?
            `.trim(),

            audio: {
              input: {
                turn_detection: {
                  type: "semantic_vad",
                  create_response: true,
                  interrupt_response: true,
                },
              },
              output: {
                voice: process.env.OPENAI_LIVE_VOICE || "marin",
              },
            },
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Danna Live]", data);

      return res.status(response.status).json({
        error: "Não foi possível iniciar Danna Live",
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("[Danna Live]", error);

    return res.status(500).json({
      error: "Erro ao criar sessão da Danna",
    });
  }
}
