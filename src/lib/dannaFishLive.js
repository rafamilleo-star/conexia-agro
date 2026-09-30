import DannaGeminiLive from "./dannaGeminiLive.js";

// Gemini escuta e chama o cérebro. Fish fala o texto do CONÉXIA.
// A sessão Gemini continua ativa e pode ter custo.
export default class DannaFishLive extends DannaGeminiLive {
  constructor(options = {}) {
    super(options);

    this.engine = "fish";
    this.localBargeIn = true;
    this.audioEpoch = 0;
    this.synthesisAbort = null;
    this.onUserSpeechStart =
      options.onUserSpeechStart || (() => {});
  }

  async beforeConnect() {
    const token = await this.getAccessToken();

    const res = await fetch("/api/fish-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
      body: JSON.stringify({ check: true }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));

      throw new Error(
        data.error || "Fish Audio indisponível."
      );
    }
  }

  handleServerMessage(msg) {
    if (msg.serverContent?.interrupted) {
      this.interrupt();
      this.onUserSpeechStart();
    }

    const sc = msg.serverContent;

    // Descarta voz e texto de saída do Gemini.
    super.handleServerMessage(
      sc
        ? {
            ...msg,
            serverContent: {
              ...sc,
              modelTurn: undefined,
              outputTranscription: undefined,
              interrupted: false,
            },
          }
        : msg
    );
  }

  handleToolCall(calls) {
    const call = calls.find(
      c => c?.name === "conexia_responder"
    );

    for (const c of calls) {
      this.sendToolResponse(c, "");
    }

    const text = String(call?.args?.fala || "").trim();

    if (!text) return;

    this.markActivity();
    this.userTurns += 1;
    this.setStatus("thinking");
    this.onUserTranscript(text);
  }

  // A reprodução Fish chama diretamente o método da classe base.
  playChunk() {}

  speak(text) {
    const clean = String(text || "").trim();

    if (!clean || !this.connected) return false;

    this.interrupt();
    this.outputSuppressed = false;

    const epoch = this.audioEpoch;
    const abort = new AbortController();

    this.synthesisAbort = abort;
    this.markActivity();
    this.setStatus("thinking");

    void this.streamSpeech(clean, epoch, abort);

    return true;
  }

  async streamSpeech(text, epoch, abort) {
    let reader;

    const current = () =>
      !abort.signal.aborted &&
      this.connected &&
      epoch === this.audioEpoch;

    try {
      const token = await this.getAccessToken();

      if (!current()) return;

      const res = await fetch("/api/fish-tts", {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!current()) {
        await res.body?.cancel();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        throw new Error(
          data.error || `Fish Audio: HTTP ${res.status}`
        );
      }

      if (!res.body) {
        throw new Error("Fish não devolveu áudio.");
      }

      reader = res.body.getReader();

      let carry = new Uint8Array(0);

      while (current()) {
        const { value, done } = await reader.read();

        if (!current()) break;
        if (done) break;

        const bytes = new Uint8Array(
          carry.length + value.length
        );

        bytes.set(carry);
        bytes.set(value, carry.length);

        const evenLength = bytes.length - bytes.length % 2;

        carry = bytes.slice(evenLength);

        // PCM16 em blocos de até 100 ms.
        for (
          let offset = 0;
          offset < evenLength && current();
          offset += 4800
        ) {
          while (
            current() &&
            this.outCtx &&
            this.nextPlayTime - this.outCtx.currentTime > 0.5
          ) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }

          if (!current()) break;

          const chunk = bytes.subarray(
            offset,
            Math.min(offset + 4800, evenLength)
          );

          let binary = "";

          for (const byte of chunk) {
            binary += String.fromCharCode(byte);
          }

          super.playChunk(btoa(binary));
        }
      }
    } catch (error) {
      if (current() && error.name !== "AbortError") {
        this.stopPlayback();
        this.setStatus("error");
        this.onError(error);
      }
    } finally {
      try {
        await reader?.cancel();
      } catch {}

      if (this.synthesisAbort === abort) {
        this.synthesisAbort = null;
      }

      if (current() && !this.isSpeaking) {
        this.setStatus("listening");
      }
    }
  }

  stopPlayback() {
    this.audioEpoch += 1;
    this.synthesisAbort?.abort();
    this.synthesisAbort = null;

    super.stopPlayback();
  }
}
