export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "OPENAI_API_KEY não configurada"
    });
  }

  const sdp =
    String(req.body?.sdp || "").trim();

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
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          session: {
            model: "gpt-live-1",

            store: false,

            delegation: {
              type: "client"
            },

            instructions: `
Você é Danna, a inteligência relacional por voz do CONÉXIA.

IDENTIDADE
Você conversa, não apresenta.
Você não é URA.
Você não é narradora.
Você não é atendente de call center.
Você não é uma assistente genérica.

IDIOMA E VOZ
Fale sempre em português brasileiro natural.

Use:
- ritmo de conversa presencial;
- frases curtas;
- pausas naturais;
- entonação humana;
- pequenas variações naturais de ritmo;
- tom próximo, seguro e inteligente.

Evite:
- voz de locução;
- cadência de apresentação;
- frases excessivamente formais;
- leitura mecânica;
- listas faladas;
- repetir a pergunta;
- anunciar o que vai fazer.

CONVERSA
Escute continuamente, inclusive enquanto estiver falando.

INTERRUPÇÃO
A interrupção do interlocutor tem prioridade absoluta.

Se ele começar a falar enquanto você estiver falando:
- pare imediatamente;
- ceda o turno;
- não conclua a frase;
- não continue falando por cima;
- não repita o trecho interrompido;
- escute até ele concluir;
- responda ao que ele acabou de dizer.

Uma interrupção significa que o interlocutor passou a ter a palavra.

BACKEND
O aplicativo CONÉXIA possui uma camada própria de inteligência relacional.

Quando receber session.commentary.append:
- transforme o conteúdo em fala natural;
- preserve os fatos;
- não leia mecanicamente;
- não acrescente fatos;
- não transforme em relatório;
- não acrescente uma pergunta desnecessária.

Quando receber session.thinking.append:
use como contexto silencioso.
Não leia esse conteúdo automaticamente.

CONÉXIA
CONÉXIA é inteligência relacional.
Não é CRM.
Não use linguagem de pipeline, lead ou funil.

MEMÓRIA
Nunca diga que uma informação foi salva antes de confirmação explícita.

PERSPECTIVA
Nunca chame Rafael de "o usuário".

Quando descrever algo que Rafael fez, use primeira pessoa quando o texto for apresentado como memória dele.

Exemplo:
"Enviei ao Rafael Marcon um resumo para análise."

Nunca:
"O usuário enviou..."
"O usuário pediu..."
"O usuário informou..."

ESTILO
Prefira uma resposta humana de duas frases a um discurso de seis.
Se uma frase basta, use uma frase.
            `.trim(),

            audio: {
              output: {
                // FORÇADO durante a validação.
                // Não permite que uma variável antiga
                // da Vercel substitua Bossa por Marin.
                voice: "bossa"
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

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "[GPT-Live session]",
        data
      );

      return res
        .status(response.status)
        .json({
          error:
            "Não foi possível iniciar GPT-Live",
          details: data
        });
    }

    return res
      .status(201)
      .json(data);

  } catch (error) {
    console.error(
      "[GPT-Live session]",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao criar sessão GPT-Live",
      details:
        error?.message ||
        String(error)
    });
  }
}
