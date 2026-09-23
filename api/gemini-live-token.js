export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY não configurada no ambiente."
    });
  }

  try {
    const now = Date.now();

    const payload = {
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: "models/gemini-3.8-live",
        config: {
          sessionResumption: {},
          responseModalities: ["AUDIO"]
        }
      }
    };

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Falha ao criar token efêmero.",
        details: data
      });
    }

    return res.status(200).json({
      token: data.name,
      model: "gemini-3.8-live",
      expiresAt: payload.expireTime
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || "Erro interno ao criar token efêmero."
    });
  }
}
