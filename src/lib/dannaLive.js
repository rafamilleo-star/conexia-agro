export class DannaLive {
  constructor({ onState, onTranscript, onUserTranscript, onError, onEvent } = {}) {
    this.pc = null; this.dc = null; this.audio = null; this.stream = null;
    this.connected = false; this.started = false;
    this.onState = onState || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onUserTranscript = onUserTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onEvent = onEvent || (() => {});
    this.userBuffer = ""; this.userTimer = null; this.speakingTimer = null; this.interruptionTimer = null;
  }

  send(event) {
    if (!this.dc || this.dc.readyState !== "open") return false;
    this.dc.send(JSON.stringify(event));
    return true;
  }

  async connect() {
    try {
      this.onState("connecting");

      this.pc = new RTCPeerConnection();

      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.playsInline = true;
      this.audio.setAttribute("playsinline", "");

      this.pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0];
        if (remoteStream) {
          this.audio.srcObject = remoteStream;
          this.audio.play().catch(() => {});
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });

      for (const track of this.stream.getAudioTracks()) {
        this.pc.addTrack(track, this.stream);
      }

      this.dc = this.pc.createDataChannel("oai-events");

      this.dc.addEventListener("open", () => {
        this.connected = true;
      });

      this.dc.addEventListener("message", (event) => {
        try {
          this.handleEvent(JSON.parse(event.data));
        } catch (e) {
          console.warn("[Danna Live] evento inválido", e);
        }
      });

      this.dc.addEventListener("close", () => {
        this.connected = false;
        this.started = false;
        this.onState("idle");
      });

      this.dc.addEventListener("error", () => this.onState("error"));

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const response = await fetch("/api/openai-live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.details?.error?.message ||
          data?.error ||
          "Não foi possível iniciar a Danna Live"
        );
      }

      if (!data?.transport?.sdp) {
        throw new Error("SDP de resposta da Danna não recebido.");
      }

      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: data.transport.sdp
      });

      return true;

    } catch (error) {
      console.error("[Danna Live]", error);
      this.onState("error");
      this.onError(error);
      this.disconnect();
      return false;
    }
  }

  handleEvent(event) {
    this.onEvent(event);

    if (event.type === "session.started") {
      this.started = true;
      this.onState("listening");
      return;
    }

    if (event.type === "session.input_transcript.delta") {
      const delta = String(event.delta || "");
      if (!delta) return;

      this.onState("listening");

      if (this.audio) {
        this.audio.muted = true;
        clearTimeout(this.interruptionTimer);

        this.interruptionTimer = setTimeout(() => {
          if (this.audio) this.audio.muted = false;
        }, 260);
      }

      this.userBuffer += delta;
      clearTimeout(this.userTimer);

      this.userTimer = setTimeout(() => {
        const text = this.userBuffer.trim();
        this.userBuffer = "";

        if (text) this.onUserTranscript(text);
      }, 720);

      return;
    }

    if (event.type === "session.output_transcript.delta") {
      const delta = String(event.delta || "");
      if (!delta) return;

      this.onState("speaking");
      this.onTranscript(delta);

      clearTimeout(this.speakingTimer);
      this.speakingTimer = setTimeout(
        () => this.onState("listening"),
        900
      );

      return;
    }

    if (event.type === "error") {
      console.error("[Danna Live event]", event);

      this.onError(
        new Error(
          event?.error?.message ||
          "Erro na conversa com a Danna"
        )
      );
    }
  }

  addContext(context) {
    const clean = String(context || "").trim();
    if (!clean) return;

    this.send({
      type: "session.thinking.append",
      event_id: `ctx_${Date.now()}`,
      delegation_id: null,
      content: clean.slice(0, 3500)
    });
  }

  speak(text) {
    const clean = String(text || "").trim();
    if (!clean) return;

    this.send({
      type: "session.commentary.append",
      event_id: `say_${Date.now()}`,
      delegation_id: null,
      content:
        "Diga isto agora em português brasileiro, de forma natural e conversacional. " +
        "Preserve o sentido, mas não leia como locução nem acrescente nova pergunta: " +
        clean.slice(0, 2800)
    });
  }

  sendText(text) {
    this.speak(text);
  }

  interrupt() {
    if (this.audio) {
      this.audio.muted = true;
      clearTimeout(this.interruptionTimer);

      this.interruptionTimer = setTimeout(() => {
        if (this.audio) this.audio.muted = false;
      }, 320);
    }

    this.send({
      type: "session.instructions.append",
      event_id: `interrupt_${Date.now()}`,
      delegation_id: null,
      content:
        "Pare de falar imediatamente. Escute o usuário. Não retome a frase interrompida."
    });

    this.onState("listening");
  }

  mute() {
    this.stream?.getAudioTracks().forEach(t => {
      t.enabled = false;
    });
  }

  unmute() {
    this.stream?.getAudioTracks().forEach(t => {
      t.enabled = true;
    });
  }

  disconnect() {
    clearTimeout(this.userTimer);
    clearTimeout(this.speakingTimer);
    clearTimeout(this.interruptionTimer);

    try {
      this.stream?.getTracks().forEach(t => t.stop());
    } catch {}

    try {
      this.dc?.close();
    } catch {}

    try {
      this.pc?.close();
    } catch {}

    if (this.audio) {
      try {
        this.audio.pause();
      } catch {}

      this.audio.srcObject = null;
      this.audio.remove();
    }

    this.pc = null;
    this.dc = null;
    this.audio = null;
    this.stream = null;
    this.connected = false;
    this.started = false;
    this.userBuffer = "";

    this.onState("idle");
  }
}

export default DannaLive;
