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

    // Danna 3
    this.relationalContext = "";
    this.lastInterruptAt = 0;
  }

  send(event) {
    if (!this.dc || this.dc.readyState !== "open") {
      return false;
    }

    try {
      this.dc.send(JSON.stringify(event));
      return true;
    } catch (error) {
      console.warn("[Danna 3] falha ao enviar evento", error);
      return false;
    }
  }

  async connect() {
    try {
      this.onState("connecting");

      this.pc = new RTCPeerConnection();

      /*
       * Áudio remoto da Danna.
       *
       * Não mutamos/desmutamos o elemento durante a conversa.
       * O microfone permanece aberto para permitir full-duplex.
       */
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.playsInline = true;
      this.audio.setAttribute("playsinline", "");

      this.pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0];

        if (!remoteStream) return;

        this.audio.srcObject = remoteStream;

        this.audio.play().catch((error) => {
          console.warn("[Danna 3] autoplay:", error);
        });
      };

      /*
       * Microfone.
       *
       * Echo cancellation é especialmente importante porque a Danna
       * precisa continuar ouvindo enquanto fala.
       */
      this.stream =
        await navigator.mediaDevices.getUserMedia({
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

      this.dc =
        this.pc.createDataChannel("oai-events");

      this.dc.addEventListener("open", () => {
        this.connected = true;
      });

      this.dc.addEventListener("message", (event) => {
        try {
          const parsed = JSON.parse(event.data);
          this.handleEvent(parsed);
        } catch (error) {
          console.warn(
            "[Danna 3] evento inválido",
            error
          );
        }
      });

      this.dc.addEventListener("close", () => {
        this.connected = false;
        this.started = false;
        this.isSpeaking = false;
        this.interruptSent = false;

        this.onState("idle");
      });

      this.dc.addEventListener("error", (event) => {
        console.error("[Danna 3] data channel", event);
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
            "Content-Type": "application/json"
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
          "Não foi possível iniciar a Danna 3"
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
      console.error("[Danna 3]", error);

      this.onState("error");
      this.onError(error);

      this.disconnect();

      return false;
    }
  }

  handleEvent(event) {
    this.onEvent(event);

    /*
     * Sessão pronta.
     */
    if (event.type === "session.started") {
      this.started = true;
      this.onState("listening");

      // Contexto relacional preparado antes da conexão.
      if (this.relationalContext) {
        this.addContext(this.relationalContext);
      }

      return;
    }

    /*
     * =====================================================
     * BARGE-IN — DANNA 3
     * =====================================================
     *
     * O principal erro da implementação anterior era esperar
     * a TRANSCRIÇÃO do usuário para descobrir que ele havia
     * começado a falar.
     *
     * Agora também reagimos aos eventos de atividade de voz,
     * quando fornecidos pela sessão.
     */

    if (
      event.type === "input_audio_buffer.speech_started" ||
      event.type === "session.input_audio.speech_started" ||
      event.type === "session.input_audio_buffer.speech_started"
    ) {
      if (this.isSpeaking) {
        this.interrupt();
      }

      this.onState("listening");
      return;
    }

    /*
     * Fallback:
     * se o servidor não entregar speech_started, o primeiro
     * fragmento de transcrição ainda interrompe a Danna.
     */
    if (
      event.type ===
      "session.input_transcript.delta"
    ) {
      const delta =
        String(event.delta || "");

      if (!delta) return;

      if (
        this.isSpeaking &&
        !this.interruptSent
      ) {
        this.interrupt();
      }

      this.onState("listening");

      this.userBuffer += delta;

      clearTimeout(this.userTimer);

      /*
       * A interrupção é imediata.
       * O agrupamento abaixo serve SOMENTE para entregar
       * uma frase coerente ao backend relacional.
       */
      this.userTimer = setTimeout(() => {
        const text =
          this.userBuffer.trim();

        this.userBuffer = "";
        this.interruptSent = false;

        if (text) {
          this.onUserTranscript(text);
        }
      }, 550);

      return;
    }

    /*
     * =====================================================
     * DANNA FALANDO
     * =====================================================
     */

    if (
      event.type ===
      "session.output_transcript.delta"
    ) {
      const delta =
        String(event.delta || "");

      if (!delta) return;

      this.isSpeaking = true;
      this.interruptSent = false;

      this.onState("speaking");
      this.onTranscript(delta);

      clearTimeout(this.speakingTimer);

      this.speakingTimer =
        setTimeout(() => {
          this.isSpeaking = false;
          this.interruptSent = false;
          this.onState("listening");
        }, 850);

      return;
    }

    /*
     * Algumas versões do protocolo fornecem eventos
     * explícitos de término da resposta.
     */
    if (
      event.type === "response.done" ||
      event.type === "session.response.done" ||
      event.type === "session.output_audio.done"
    ) {
      this.isSpeaking = false;
      this.interruptSent = false;
      this.onState("listening");
      return;
    }

    if (event.type === "session.closed") {
      this.isSpeaking = false;
      this.started = false;
      this.connected = false;
      this.interruptSent = false;

      this.onState("idle");
      return;
    }

    if (event.type === "error") {
      console.error(
        "[Danna 3 event]",
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

  /*
   * =======================================================
   * LONG-TERM MEMORY / RELATIONAL BRIEF
   * =======================================================
   */

  setRelationalContext(context) {
    const clean =
      String(context || "").trim();

    this.relationalContext =
      clean.slice(0, 6000);

    /*
     * Se a sessão já estiver ativa, atualizamos imediatamente.
     */
    if (
      this.started &&
      this.relationalContext
    ) {
      this.addContext(
        this.relationalContext
      );
    }
  }

  addContext(context) {
    const clean =
      String(context || "").trim();

    if (!clean) return false;

    return this.send({
      type: "session.thinking.append",
      event_id: `ctx_${Date.now()}`,
      delegation_id: null,

      content:
        [
          "CONTEXTO RELACIONAL SILENCIOSO DO CONÉXIA.",
          "",
          "Use estas informações somente quando forem relevantes.",
          "Não recite este contexto.",
          "Não diga que consultou banco de dados.",
          "Não invente informações ausentes.",
          "Não transforme a conversa em relatório.",
          "Se houver uma continuidade natural com uma conversa anterior,",
          "você pode demonstrar que se lembra dela de forma humana.",
          "",
          clean.slice(0, 6000)
        ].join("\n")
    });
  }

  /*
   * Abertura contextual da Danna 3.
   *
   * Recebe o Relational Brief já produzido pelo CONÉXIA.
   */
  openWithRelationalBrief(brief) {
    const clean =
      String(brief || "").trim();

    if (!clean) {
      return this.speak(
        "Cumprimente Rafael de forma breve e natural e pergunte como pode ajudá-lo."
      );
    }

    return this.send({
      type: "session.commentary.append",
      event_id: `opening_${Date.now()}`,
      delegation_id: null,

      content:
        [
          "Faça a abertura da conversa usando o contexto abaixo.",
          "",
          "REGRAS:",
          "- seja breve;",
          "- soe como alguém que realmente se lembra da conversa;",
          "- não leia um relatório;",
          "- não enumere informações;",
          "- use no máximo um ou dois fatos relevantes;",
          "- se houver pendência importante, mencione-a naturalmente;",
          "- termine dando espaço para Rafael falar;",
          "- não invente nenhum fato.",
          "",
          "RELATIONAL BRIEF:",
          clean.slice(0, 3500)
        ].join("\n")
    });
  }

  speak(text) {
    const clean =
      String(text || "").trim();

    if (!clean) return false;

    return this.send({
      type: "session.commentary.append",
      event_id: `say_${Date.now()}`,
      delegation_id: null,

      content:
        [
          "Comunique naturalmente a informação abaixo.",
          "Fale em português brasileiro.",
          "Use frases curtas.",
          "Não use voz de apresentação.",
          "Não anuncie que está lendo.",
          "Não acrescente fatos.",
          "",
          clean.slice(0, 2200)
        ].join("\n")
    });
  }

  sendText(text) {
    return this.speak(text);
  }

  /*
   * =======================================================
   * INTERRUPÇÃO
   * =======================================================
   *
   * Aqui não esperamos 650 ms de transcrição.
   * Assim que detectamos speech_started, sinalizamos
   * interrupção da resposta atual.
   */

  interrupt() {
    const now = Date.now();

    /*
     * Evita uma tempestade de eventos de cancelamento.
     */
    if (
      this.interruptSent &&
      now - this.lastInterruptAt < 400
    ) {
      return;
    }

    this.lastInterruptAt = now;
    this.interruptSent = true;
    this.isSpeaking = false;

    clearTimeout(this.speakingTimer);

    this.onState("listening");

    /*
     * Cancelamento explícito da resposta.
     *
     * Se o protocolo ativo aceitar response.cancel,
     * a geração em andamento é encerrada.
     */
    const cancelled =
      this.send({
        type: "response.cancel",
        event_id: `cancel_${now}`
      });

    /*
     * Mantemos também a instrução conversacional como fallback.
     *
     * Ela NÃO é mais o mecanismo principal de interrupção.
     */
    if (!cancelled) {
      this.send({
        type: "session.instructions.append",
        event_id: `interrupt_${now}`,
        delegation_id: null,

        content:
          "O interlocutor começou a falar. " +
          "Ceda o turno imediatamente. " +
          "Não termine a frase anterior. " +
          "Escute antes de responder."
      });
    }
  }

  mute() {
    this.stream
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = false;
      });
  }

  unmute() {
    this.stream
      ?.getAudioTracks()
      .forEach((track) => {
        track.enabled = true;
      });
  }

  disconnect() {
    clearTimeout(this.userTimer);
    clearTimeout(this.speakingTimer);

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
        .forEach((track) =>
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
