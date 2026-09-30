import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getAuthUser, hasPaidVoiceAccess } from "./_lib/dannaAccess.js";

export const config = {
  api: { bodyParser: { sizeLimit: "16kb" } },
};

export function createFishHandler({
  authenticate = getAuthUser,
  authorize = hasPaidVoiceAccess,
  fetchAudio = fetch,
  env = process.env,
  recordUsage = usage => console.info(JSON.stringify(usage)),
} = {}) {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await authenticate(req);

    if (!user) {
      return res.status(401).json({
        error: "Entre novamente no app.",
      });
    }

    if (!(await authorize(user.id))) {
      return res.status(403).json({
        error: "Voz exclusiva para assinantes.",
        code: "voice_requires_paid",
      });
    }

    if (!env.FISH_API_KEY || !env.FISH_VOICE_ID) {
      return res.status(503).json({
        error: "Configure FISH_API_KEY e FISH_VOICE_ID para testar esta voz.",
      });
    }

    const model = env.FISH_TTS_MODEL || "s2.1-pro-free";

    if (!["s2.1-pro-free", "s2.1-pro", "s2-pro"].includes(model)) {
      return res.status(503).json({
        error: "FISH_TTS_MODEL inválido.",
      });
    }

    if (req.body?.check === true) {
      return res.status(200).json({ ready: true, model });
    }

    const text =
      typeof req.body?.text === "string"
        ? req.body.text.trim()
        : "";

    if (!text || text.length > 4000) {
      return res.status(400).json({
        error: "Envie um texto entre 1 e 4000 caracteres.",
      });
    }

    const inputBytes = Buffer.byteLength(text, "utf8");
    const paidEquivalentUsd = inputBytes * 15 / 1000000;

    let outcome = "failed";

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30000);

    const close = () => {
      if (!res.writableFinished) abort.abort();
    };

    res.on("close", close);

    try {
      const upstream = await fetchAudio(
        "https://api.fish.audio/v1/tts",
        {
          method: "POST",
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${env.FISH_API_KEY}`,
            "Content-Type": "application/json",
            model,
          },
          body: JSON.stringify({
            text,
            reference_id: env.FISH_VOICE_ID,
            format: "pcm",
            sample_rate: 24000,
            latency: "balanced",
            temperature: 0.7,
            top_p: 0.7,
          }),
        }
      );

      if (!upstream.ok || !upstream.body) {
        const status = upstream.status === 429 ? 429 : 502;

        return res.status(status).json({
          error:
            `Fish Audio indisponível (${upstream.status}). ` +
            "Confira chave, voz e créditos.",
        });
      }

      res.setHeader("Content-Type", "audio/pcm");
      res.setHeader("X-Audio-Sample-Rate", "24000");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Fish-Input-Bytes", String(inputBytes));
      res.setHeader("X-Fish-Model", model);

      await pipeline(
        Readable.fromWeb(upstream.body),
        res,
        { signal: abort.signal }
      );

      outcome = "completed";
    } catch (error) {
      if (!res.destroyed && !res.headersSent) {
        res.status(error?.name === "AbortError" ? 504 : 502).json({
          error: "Não consegui gerar a voz Fish agora.",
        });
      } else if (!res.destroyed) {
        res.destroy();
      }
    } finally {
      clearTimeout(timer);
      res.off("close", close);

      // Mede o texto enviado, não o áudio ouvido nem a fatura.
      // Não registra conversas, nomes ou credenciais.
      try {
        await recordUsage({
          event: "fish_tts_usage",
          model,
          inputBytes,
          outcome: abort.signal.aborted ? "aborted" : outcome,
          estimatedUsd:
            model === "s2.1-pro-free" ? 0 : paidEquivalentUsd,
          paidEquivalentUsd,
        });
      } catch {
        // Falha nas métricas não deve impedir a conversa.
      }
    }
  };
}

export default createFishHandler();
