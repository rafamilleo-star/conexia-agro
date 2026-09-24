export class DannaLive {
  constructor({
    onState,
    onTranscript,
    onUserTranscript,
    onError,
    onEvent
  } = {}) {
    this.pc = null;
    this.dc = null;
    this.audio = null;
    this.stream = null;

    this.connected = false;
    this.started = false;
    this.isSpeaking = false;
    this.interruptSent = false;

    this.onState = onState || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onUserTranscript = onUserTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onEvent = onEvent || (() => {});

    this.userBuffer = "";
    this.userTimer = null;
    this.speakingTimer = null;
    this.interruptResetTimer = null;
  }

  send(event) {
    if (!this.dc || this.dc.readyState !== "open") {
      return false;
    }

    this.dc.send(JSON.stringify(event));
    return true;
  }

  async connect() {
    try {
      this.onState("connecting");

      this.pc = new RTCPeerConnection();

      // Áudio remoto do GPT-Live.
      // NÃO mutamos/desmutamos durante interrupções.
      // GPT-Live/WebRTC deve manter entrada e saída ativas.
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.playsInline = true;
      this.audio.setAttribute("playsinline", "");

      this.pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0];

        if (remoteStream) {
          this.audio.srcObject = remoteStream;

          this.audio.play().catch((err) => {
            console.warn(
              "[Danna Live] autoplay:",
              err
            );
          });
        }
      };

      // Mantemos processamento padrão do navegador apenas
      // no MICROFONE. Isso não altera a voz da Danna.
      this.stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1
          }
        });

      for (
        const track of this.stream.getAudioTracks()
      ) {
        this.pc.addTrack(track, this.stream);
      }

      this.dc =
        this.pc.createDataChannel("oai-events");

      this.dc.addEventListener("open", () => {
        this.connected = true;
      });

      this.dc.addEventListener(
        "message",
        (event) => {
          try {
            this.handleEvent(
              JSON.parse(event.data)
            );
          } catch (e) {
            console.warn(
              "[Danna Live] evento inválido",
              e
            );
          }
        }
      );

      this.dc.addEventListener("close", () => {
        this.connected = false;
        this.started = false;
        this.isSpeaking = false;

        this.onState("idle");
      });

      this.dc.addEventListener("error", () => {
        this.onState("error");
      });

      const offer =
        await this.pc.createOffer();

      await this.pc.setLocalDescription(offer);

      const response = await fetch(
        "/api/openai-live-session",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            sdp: offer.sdp
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.details?.error?.message ||
          data?.error ||
          "Não foi possível iniciar a Danna Live"
        );
      }

      if (!data?.transport?.sdp) {
        throw new Error(
          "SDP de resposta da Danna não recebido."
        );
      }

      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: data.transport.sdp
      });

      return true;

    } catch (error) {
      console.error(
        "[Danna Live]",
        error
      );

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

    // ======================================================
    // USUÁRIO COMEÇOU A SER TRANSCRITO
    //
    // Se Danna estava falando, mandamos a instrução
    // IMEDIATAMENTE no primeiro fragmento.
    //
    // Não esperamos os 720 ms necessários para formar
    // a frase completa.
    // ======================================================

    if (
      event.type ===
      "session.input_transcript.delta"
    ) {
      const delta =
        String(event.delta || "");

      if (!delta) return;

      // BARGE-IN
      if (
        this.isSpeaking &&
        !this.interruptSent
      ) {
        this.interruptSent = true;
        this.interrupt();
      }

      this.onState("listening");

      this.userBuffer += delta;

      clearTimeout(this.userTimer);

      // A frase completa continua sendo agrupada
      // para o backend relacional.
      this.userTimer = setTimeout(() => {
        const text =
          this.userBuffer.trim();

        this.userBuffer = "";

        this.interruptSent = false;

        if (text) {
          this.onUserTranscript(text);
        }
      }, 650);

      return;
    }

    // ======================================================
    // DANNA COMEÇOU / CONTINUA FALANDO
    // ======================================================

    if (
      event.type ===
      "session.output_transcript.delta"
    ) {
      const delta =
        String(event.delta || "");

      if (!delta) return;

      this.isSpeaking = true;
      this.onState("speaking");
      this.onTranscript(delta);

      clearTimeout(
        this.speakingTimer
      );

      this.speakingTimer =
        setTimeout(() => {
          this.isSpeaking = false;
          this.interruptSent = false;
          this.onState("listening");
        }, 1000);

      return;
    }

    if (event.type === "session.closed") {
      this.isSpeaking = false;
      this.started = false;
      this.connected = false;
      this.onState("idle");
      return;
    }

    if (event.type === "error") {
      console.error(
        "[Danna Live event]",
        event
      );

      this.onError(
        new Error(
          event?.error?.message ||
          "Erro na conversa com a Danna"
        )
      );
    }
  }

  addContext(context) {
    const clean =
      String(context || "").trim();

    if (!clean) return;

    this.send({
      type: "session.thinking.append",
      event_id: `ctx_${Date.now()}`,
      delegation_id: null,
      content: clean.slice(0, 3000)
    });
  }

  speak(text) {
    const clean =
      String(text || "").trim();

    if (!clean) return;

    this.send({
      type: "session.commentary.append",
      event_id: `say_${Date.now()}`,
      delegation_id: null,

      content:
        "Comunique naturalmente esta informação ao interlocutor, " +
        "em português brasileiro. " +
        "Fale como numa conversa presencial: frases curtas, " +
        "ritmo humano, sem voz de locução e sem anunciar que está lendo. " +
        "Não acrescente fatos: " +
        clean.slice(0, 2200)
    });
  }

  sendText(text) {
    this.speak(text);
  }

  // ========================================================
  // INTERRUPÇÃO REAL DA CONVERSA
  //
  // Não mutamos o elemento <audio>.
  // Não criamos timer para voltar áudio antigo.
  //
  // GPT-Live continua recebendo o microfone durante
  // toda a fala da Danna.
  // ========================================================

  interrupt() {
    this.isSpeaking = false;

    this.onState("listening");

    this.send({
      type: "session.instructions.append",
      event_id:
        `interrupt_${Date.now()}`,
      delegation_id: null,

      content:
        "O interlocutor começou a falar. " +
        "Interrompa sua fala atual imediatamente. " +
        "Ceda o turno. " +
        "Não termine a frase interrompida. " +
        "Não repita o trecho anterior. " +
        "Escute a fala completa antes de voltar a falar."
    });
  }

  mute() {
    this.stream
      ?.getAudioTracks()
      .forEach(track => {
        track.enabled = false;
      });
  }

  unmute() {
    this.stream
      ?.getAudioTracks()
      .forEach(track => {
        track.enabled = true;
      });
  }

  disconnect() {
    clearTimeout(this.userTimer);
    clearTimeout(this.speakingTimer);
    clearTimeout(
      this.interruptResetTimer
    );

    // Encerramento gracioso quando possível.
    if (
      this.dc &&
      this.dc.readyState === "open"
    ) {
      try {
        this.send({
          type: "session.close"
        });
      } catch {}
    }

    try {
      this.stream
        ?.getTracks()
        .forEach(track =>
          track.stop()
        );
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
    this.isSpeaking = false;
    this.interruptSent = false;

    this.userBuffer = "";

    this.onState("idle");
  }
}

export default DannaLive;
