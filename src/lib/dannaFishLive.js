import DannaGeminiLive from "./dannaGeminiLive.js";

// Gemini escuta e chama o cérebro. Fish fala o texto do CONÉXIA.
export default class DannaFishLive extends DannaGeminiLive {
  constructor(options = {}) {
    super(options);
    this.engine = "fish";
    this.localBargeIn = false;
    this.audioEpoch = 0;
    this.synthesisAbort = null;
    this.captureHeld = false;
    this.releaseTimer = null;
    this.savedTrackStates = new Map();
    this.manualMuted = false;

    const transcript = this.onUserTranscript;
    const speechStart = this.onUserSpeechStart;
    this.onUserTranscript = text => {
      if (!this.captureHeld) transcript(text);
    };
    this.onUserSpeechStart = () => {
      if (!this.captureHeld) speechStart();
    };
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
      throw new Error(data.error || "Fish Audio indisponível.");
    }
  }

  handleServerMessage(msg) {
    if (msg.serverContent?.interrupted && !this.captureHeld) {
      this.interrupt();
      this.onUserSpeechStart();
    }
    const sc = msg.serverContent;
    super.handleServerMessage(sc ? {
      ...msg,
      serverContent: {
        ...sc,
        modelTurn: undefined,
        outputTranscription: undefined,
        interrupted: false,
      },
    } : msg);
  }

  handleToolCall(calls) {
    if (this.captureHeld) {
      for (const call of calls) this.sendToolResponse(call, "");
      return;
    }
    const call = calls.find(c => c?.name === "conexia_responder");
    for (const c of calls) this.sendToolResponse(c, "");
    const text = String(call?.args?.fala || "").trim();
    if (!text) return;
    this.markActivity();
    this.userTurns += 1;
    this.setStatus("thinking");
    this.onUserTranscript(text);
  }

  // A voz Gemini é descartada; Fish usa super.playChunk diretamente.
  playChunk() {}

  speak(text) {
    const clean = String(text || "").trim();
    if (!clean || !this.connected) return false;

    this.interrupt();
    this.outputSuppressed = false;
    this.holdCapture();

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
      !abort.signal.aborted && this.connected && epoch === this.audioEpoch;

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
        throw new Error(data.error || `Fish Audio: HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Fish não devolveu áudio.");

      reader = res.body.getReader();
      let carry = new Uint8Array(0);

      while (current()) {
        const { value, done } = await reader.read();
        if (!current() || done) break;

        const bytes = new Uint8Array(carry.length + value.length);
        bytes.set(carry);
        bytes.set(value, carry.length);
        const evenLength = bytes.length - bytes.length % 2;
        carry = bytes.slice(evenLength);

        for (
          let offset = 0;
          offset < evenLength && current();
          offset += 4800
        ) {
          while (
            current() && this.outCtx &&
            this.nextPlayTime - this.outCtx.currentTime > 0.5
          ) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          if (!current()) break;

          const chunk = bytes.subarray(
            offset, Math.min(offset + 4800, evenLength)
          );
          let binary = "";
          for (const byte of chunk) binary += String.fromCharCode(byte);
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
      try { await reader?.cancel(); } catch {}
      if (this.synthesisAbort === abort) this.synthesisAbort = null;
      if (current()) this.releaseCaptureWhenDone();
    }
  }

  holdCapture() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    this.captureHeld = true;
    for (const track of this.micStream?.getAudioTracks() || []) {
      if (!this.savedTrackStates.has(track)) {
        this.savedTrackStates.set(track, track.enabled);
      }
      track.enabled = false;
    }
    this.micSpeechMs = 0;
    this.micSilenceMs = 0;
    this.micSpeechActive = false;
  }

  releaseCaptureWhenDone() {
    if (!this.captureHeld || this.synthesisAbort || this.playing.size) return;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.synthesisAbort || this.playing.size || !this.connected) return;
      this.releaseCapture();
      this.setStatus("listening");
    }, 450);
  }

  releaseCapture() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    for (const [track, enabled] of this.savedTrackStates) {
      if (track.readyState !== "ended") {
        track.enabled = enabled && !this.manualMuted;
      }
    }
    this.savedTrackStates.clear();
    this.captureHeld = false;
    this.micSpeechMs = 0;
    this.micSilenceMs = 0;
    this.micSpeechActive = false;
  }

  setSpeaking(value) {
    super.setSpeaking(value);
    if (!value && this.captureHeld) this.releaseCaptureWhenDone();
  }

  checkMicActivity(buffer) {
    if (!this.captureHeld) super.checkMicActivity(buffer);
  }

  mute() {
    this.manualMuted = true;
    super.mute();
  }

  unmute() {
    this.manualMuted = false;
    if (this.captureHeld) {
      for (const track of this.savedTrackStates.keys()) {
        this.savedTrackStates.set(track, true);
      }
    } else {
      super.unmute();
    }
  }

  disconnect(reason = "manual") {
    super.disconnect(reason);
    this.releaseCapture();
  }

  stopPlayback() {
    this.audioEpoch += 1;
    this.synthesisAbort?.abort();
    this.synthesisAbort = null;
    super.stopPlayback();
    this.releaseCaptureWhenDone();
  }
}
