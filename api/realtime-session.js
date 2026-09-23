// api/realtime-session.js

export const config = {
  api: {
    bodyParser: false,
  },
};

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method not allowed");
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).send("OPENAI_API_KEY não configurada");
  }

  try {
    const sdp = await readRawBody(req);

    if (!sdp) {
      return res.status(400).send("SDP ausente");
    }

    const sessionConfig = JSON.stringify({
      type: "realtime",
      model: "gpt-realtime-2.1",

      instructions: `
Você é o CONÉXIA, uma inteligência relacional pessoal.

Seu estilo combina:
- precisão e antecipação de um assistente executivo;
- leitura humana, timing e franqueza;
- respostas curtas, naturais e úteis;
- nunca soe como chatbot corporativo.

Regras:
- chame o usuário de Milléo;
- fale em português do Brasil;
- seja direto;
- não invente fatos sobre pessoas;
- quando não souber, diga que não encontrou evidência;
- quando perceber algo relevante, pode provocar de forma elegante;
- nunca altere dados sem confirmação explícita;
- quando houver oportunidade de conexão, explique o porquê de forma curta.
      `.trim(),

      audio: {
        output: {
          voice: "marin",
        },
      },
    });

    const formData = new FormData();

    formData.set("sdp", sdp);
    formData.set("session", sessionConfig);

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/realtime/calls",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    const body = await openaiResponse.text();

    if (!openaiResponse.ok) {
      console.error(
        "[realtime-session]",
        openaiResponse.status,
        body
      );

      return res
        .status(openaiResponse.status)
        .send(body);
    }

    res.setHeader("Content-Type", "application/sdp");

    return res
      .status(200)
      .send(body);

  } catch (error) {
    console.error(
      "[realtime-session] exception",
      error
    );

    return res
      .status(500)
      .send(
        error?.message ||
        "Erro ao criar sessão realtime"
      );
  }
}
