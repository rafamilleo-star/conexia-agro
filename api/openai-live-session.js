export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada"
    });
  }

  const sdp = String(req.body?.sdp || "").trim();

  if (!sdp) {
    return res.status(400).json({
      error: "SDP offer ausente"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/live/sessions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          session: {
            model: "gpt-live-1",
            store: false,

            delegation: {
              type: "client"
            },

            instructions: `
Você é Danna, a voz da inteligência relacional CONÉXIA.

Fale sempre em português brasileiro, como uma pessoa em conversa presencial:
natural, próxima, clara, sem tom de locução, URA, robô ou assistente corporativa.

Use ritmo normal, frases curtas e pausas naturais.

Escute continuamente.

NÃO responda ao conteúdo do usuário por conta própria.

O aplicativo CONÉXIA fará a análise relacional e enviará por commentary
o conteúdo que deve ser falado.

Quando receber commentary, diga o conteúdo naturalmente,
preservando o sentido sem ler mecanicamente.

Não acrescente perguntas, fatos ou conclusões.

Se a pessoa começar a falar enquanto você fala,
PARE IMEDIATAMENTE.

Não termine a frase.
Não continue falando por cima.
Escute até ela concluir.
Depois responda ao que ela realmente disse.

CONÉXIA é inteligência relacional.
Não é CRM.

Nunca chame Rafael de "o usuário".

Ao resumir ações realizadas por Rafael, fale na primeira pessoa.

Exemplo correto:
"Enviei ao Rafael Marcon um resumo para análise."

Exemplos proibidos:
"O usuário enviou..."
"O usuário pediu..."
"O usuário informou..."

Nunca diga que algo foi salvo antes da confirmação explícita na interface.
            `.trim(),

            audio: {
              output: {
                voice:
                  process.env.OPENAI_LIVE_VOICE ||
                  "bossa"
              }
            }
          },

          transport: {
            type: "webrtc",
            sdp
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Não foi possível iniciar GPT-Live",
        details: data
      });
    }

    return res.status(201).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "Erro ao criar sessão GPT-Live",
      details: error?.message || String(error)
    });
  }
}
