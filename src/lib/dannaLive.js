/**
 * CONÉXIA — Danna Live
 * Camada de voz/conversação em tempo real.
 *
 * Responsabilidades:
 * - abrir sessão Live via WebRTC
 * - enviar microfone
 * - reproduzir áudio remoto
 * - receber transcrições
 * - permitir interrupção real (barge-in)
 * - receber contexto relacional silencioso
 * - iniciar conversa a partir de Relational Brief
 */

export default class DannaLive {
  constructor({
    userName = "",
    getAccessToken,
    onAutoStop,
    idleMs = 60000,
    maxSessionMs = 600000,
    onState,
    onStatus,
    onUserTranscript,
    onAssistantTranscript,
    onError,
    onSpeakingChange,
  } = {}) {
    this.pc = null;
    this.dc = null;
    this.localStream = null;
    this.remoteAudio = null;

    this.connected = false;
    this.connecting = false;
    this.isSpeaking = false;
    this.isMuted = false;

    this.userTranscriptBuffer = "";
    this.userTranscriptTimer = null;

    this.assistantTranscriptBuffer = "";
    this.assistantTranscriptTimer = null;

    this.speakingTimer = null;

    this.relationalContext = null;

    this.sessionReady = false;

    this.userName = String(userName || "").trim().slice(0, 40);

    // Travas de custo (gpt-live-1 é cobrado por minuto de sessão aberta).
    this.getAccessToken =
      typeof getAccessToken === "function" ? getAccessToken : async () => null;
    this.onAutoStop =
      typeof onAutoStop === "function" ? onAutoStop : () => {};
    this.idleMs = idleMs;
    this.maxSessionMs = maxSessionMs;
    this.sessionStartedAt = null;
    this.lastActivityAt = 0;
    this.userTurns = 0;
    this.watchdog = null;
    this.onVisibility = null;

    const statusHandler =
      typeof onStatus === "function"
        ? onStatus
        : typeof onState === "function"
          ? onState
          : null;

    this.onStatus = statusHandler || (() => {});

    this.onUserTranscript =
      typeof onUserTranscript === "function"
        ? onUserTranscript
        : () => {};

    this.onAssistantTranscript =
      typeof onAssistantTranscript === "function"
        ? onAssistantTranscript
        : () => {};

    this.onError =
      typeof onError === "function" ? onError : () => {};

    this.onSpeakingChange =
      typeof onSpeakingChange === "function"
        ? onSpeakingChange
        : () => {};
  }

  /* ─────────────────────────────────────────────
     STATUS
  ───────────────────────────────────────────── */

  setStatus(status) {
    try {
      this.onStatus(status);
    } catch (_) {}
  }

  setSpeaking(value) {
    const next = Boolean(value);

    if (this.isSpeaking === next) return;

    this.isSpeaking = next;

    try {
      this.onSpeakingChange(next);
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     CONEXÃO
  ───────────────────────────────────────────── */

  async connect() {
    if (this.connected) {
      return true;
    }

    if (this.connecting) {
      return false;
    }

    this.connecting = true;
    this.sessionReady = false;
    this.setStatus("connecting");

    try {
      this.pc = new RTCPeerConnection();

      /* ── áudio remoto ── */

      this.remoteAudio = document.createElement("audio");
      this.remoteAudio.autoplay = true;
      this.remoteAudio.playsInline = true;

      this.pc.ontrack = (event) => {
        try {
          const stream = event.streams?.[0];

          if (stream && this.remoteAudio) {
            this.remoteAudio.srcObject = stream;

            const playPromise = this.remoteAudio.play();

            if (
              playPromise &&
              typeof playPromise.catch === "function"
            ) {
              playPromise.catch(() => {});
            }
          }
        } catch (error) {
          console.warn(
            "[DannaLive] Falha ao reproduzir áudio remoto:",
            error
          );
        }
      };

      /* ── microfone ── */

      this.localStream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });

      const audioTrack =
        this.localStream.getAudioTracks()?.[0];

      if (!audioTrack) {
        throw new Error(
          "Nenhum microfone disponível para a Danna."
        );
      }

      this.pc.addTrack(
        audioTrack,
        this.localStream
      );

      /* ── canal de eventos ── */

      this.dc =
        this.pc.createDataChannel("oai-events");

      this.dc.onopen = () => {
        this.connected = true;
        this.connecting = false;
        this.setStatus("connected");
      };

      this.dc.onclose = () => {
        this.connected = false;
        this.connecting = false;
        this.setSpeaking(false);
        this.setStatus("closed");
      };

      this.dc.onerror = (event) => {
        console.error(
          "[DannaLive] DataChannel error:",
          event
        );

        try {
          this.onError(
            new Error(
              "Erro no canal de comunicação da Danna."
            )
          );
        } catch (_) {}
      };

      this.dc.onmessage = (event) => {
        this.handleServerEvent(event);
      };

      /* ── SDP ── */

      const offer =
        await this.pc.createOffer();

      await this.pc.setLocalDescription(
        offer
      );

      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `/api/openai-live-session${this.userName ? `?name=${encodeURIComponent(this.userName)}` : ""}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/sdp",
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {}),
          },
          body: offer.sdp,
        }
      );

      if (!response.ok) {
        const raw = await response.text();
        let payload = null;
        try { payload = JSON.parse(raw); } catch (_) {}

        const code =
          payload?.code || payload?.error?.code || "";

        let friendly;
        if (response.status === 403 || code === "voice_requires_paid") {
          friendly = "A conversa por voz (BETA) é exclusiva para assinantes.";
        } else if (response.status === 401) {
          friendly = "Sua sessão expirou. Entre novamente no app para conversar com a Danna.";
        } else if (response.status === 429 || /quota|credit/i.test(code)) {
          friendly = "A voz da Danna está indisponível no momento. Tente novamente mais tarde.";
        } else {
          friendly = `Não consegui abrir a conversa por voz agora (${response.status}).`;
        }

        const err = new Error(friendly);
        err.status = response.status;
        err.detail = raw.slice(0, 1000);
        throw err;
      }

      const answerSdp =
        await response.text();

      await this.pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });

      // GPT-Live: comandos só depois de "session.started".
      // Espera até 8s; se o evento não vier, segue com o canal aberto.
      await new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          if (this.sessionReady) return resolve();
          if (Date.now() - started > 8000) return resolve();
          setTimeout(tick, 100);
        };
        tick();
      });

      this.startCostGuards();

      return true;
    } catch (error) {
      this.connecting = false;
      this.connected = false;

      console.error(
        "[DannaLive] Erro ao conectar:",
        error
      );

      try {
        fetch("/api/openai-live-session?clientlog=1", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          body: `${error?.name || "Error"}: ${error?.message || String(error)} | status: ${error?.status || ""} | detail: ${error?.detail || ""} | UA: ${typeof navigator !== "undefined" ? navigator.userAgent : ""}`,
        }).catch(() => {});
      } catch (_) {}

      this.setStatus("error");

      try {
        this.onError(error);
      } catch (_) {}

      this.disconnect();

      throw error;
    }
  }

  /* ─────────────────────────────────────────────
     EVENTOS DO SERVIDOR
  ───────────────────────────────────────────── */

  handleServerEvent(event) {
    let data;

    try {
      data = JSON.parse(event.data);
    } catch (_) {
      return;
    }

    if (!data?.type) return;

    if (/speech_started|transcript|output_audio|audio\.delta|response\./.test(data.type)) {
      this.markActivity();
    }

    switch (data.type) {
      case "session.started":
      case "session.created":
      case "session.updated": {
        this.sessionReady = true;
        this.setStatus("connected");
        break;
      }

      /*
       * BARGE-IN
       *
       * O ponto importante aqui:
       * assim que a plataforma detecta que Rafael
       * começou a falar, cancelamos a resposta atual.
       *
       * Mantemos variantes porque a taxonomia dos
       * eventos pode variar entre versões do Live.
       */
      case "input_audio_buffer.speech_started":
      case "session.input_audio.speech_started":
      case "session.input_audio_buffer.speech_started": {
        this.interrupt();
        this.setStatus("listening");
        break;
      }

      case "input_audio_buffer.speech_stopped":
      case "session.input_audio.speech_stopped":
      case "session.input_audio_buffer.speech_stopped": {
        this.setStatus("thinking");
        break;
      }

      /* ── transcrição do usuário ── */

      case "session.input_transcript.delta":
      case "conversation.item.input_audio_transcription.delta":
      case "input_audio_transcription.delta": {
        const delta =
          data.delta ||
          data.text ||
          data.transcript ||
          "";

        if (delta) {
          /*
           * Fallback de interrupção.
           * Se speech_started não chegar, o simples
           * fato de haver transcrição do usuário
           * significa que ele está falando.
           */
          if (this.isSpeaking) {
            this.interrupt();
          }

          this.bufferUserTranscript(delta);
        }

        break;
      }

      case "session.input_transcript.done":
      case "conversation.item.input_audio_transcription.completed":
      case "input_audio_transcription.completed": {
        const transcript =
          data.transcript ||
          data.text ||
          "";

        if (transcript) {
          this.flushUserTranscript(
            transcript
          );
        }

        break;
      }

      /* ── resposta da Danna ── */

      case "session.output_transcript.delta":
      case "response.audio_transcript.delta":
      case "response.output_text.delta": {
        const delta =
          data.delta ||
          data.text ||
          data.transcript ||
          "";

        if (delta) {
          this.setSpeaking(true);
          this.setStatus("speaking");

          this.bufferAssistantTranscript(
            delta
          );

          clearTimeout(
            this.speakingTimer
          );

          this.speakingTimer =
            setTimeout(() => {
              this.setSpeaking(false);
            }, 1000);
        }

        break;
      }

      case "session.output_transcript.done":
      case "response.audio_transcript.done":
      case "response.output_text.done": {
        const transcript =
          data.transcript ||
          data.text ||
          "";

        if (transcript) {
          this.flushAssistantTranscript(
            transcript
          );
        }

        this.setSpeaking(false);
        this.setStatus("listening");

        break;
      }

      case "response.created":
      case "response.output_audio.started": {
        this.setSpeaking(true);
        this.setStatus("speaking");
        break;
      }

      case "response.done":
      case "response.cancelled":
      case "response.output_audio.done": {
        this.setSpeaking(false);
        this.setStatus("listening");
        break;
      }

      case "session.closed": {
        this.connected = false;
        this.setSpeaking(false);
        this.setStatus("closed");
        break;
      }

      case "error": {
        const message =
          data.error?.message ||
          data.message ||
          "Erro na sessão da Danna.";

        console.error(
          "[DannaLive] Live API:",
          data
        );

        try {
          this.onError(
            new Error(message)
          );
        } catch (_) {}

        break;
      }

      default:
        break;
    }
  }

  /* ─────────────────────────────────────────────
     TRANSCRIÇÕES
  ───────────────────────────────────────────── */

  bufferUserTranscript(delta) {
    this.userTranscriptBuffer += delta;

    clearTimeout(
      this.userTranscriptTimer
    );

    this.userTranscriptTimer =
      setTimeout(() => {
        this.flushUserTranscript();
      }, 650);
  }

  flushUserTranscript(explicitText) {
    clearTimeout(
      this.userTranscriptTimer
    );

    const text = String(
      explicitText ||
        this.userTranscriptBuffer ||
        ""
    ).trim();

    this.userTranscriptBuffer = "";

    if (!text) return;

    this.userTurns += 1;
    this.markActivity();

    try {
      this.onUserTranscript(text);
    } catch (_) {}
  }

  bufferAssistantTranscript(delta) {
    this.assistantTranscriptBuffer +=
      delta;

    clearTimeout(
      this.assistantTranscriptTimer
    );

    this.assistantTranscriptTimer =
      setTimeout(() => {
        this.flushAssistantTranscript();
      }, 850);
  }

  flushAssistantTranscript(
    explicitText
  ) {
    clearTimeout(
      this.assistantTranscriptTimer
    );

    const text = String(
      explicitText ||
        this.assistantTranscriptBuffer ||
        ""
    ).trim();

    this.assistantTranscriptBuffer = "";

    if (!text) return;

    try {
      this.onAssistantTranscript(
        text
      );
    } catch (_) {}
  }

  /* ─────────────────────────────────────────────
     ENVIO DE EVENTOS
  ───────────────────────────────────────────── */

  sendEvent(payload) {
    if (
      !this.dc ||
      this.dc.readyState !== "open"
    ) {
      return false;
    }

    try {
      this.dc.send(
        JSON.stringify(payload)
      );

      return true;
    } catch (error) {
      console.warn(
        "[DannaLive] Falha ao enviar evento:",
        error
      );

      return false;
    }
  }

  /* ─────────────────────────────────────────────
     INTERRUPÇÃO REAL
  ───────────────────────────────────────────── */

  interrupt() {
    if (
      !this.connected &&
      !this.dc
    ) {
      return false;
    }

    let sent = false;

    /*
     * Cancela a geração atual.
     * Isto é diferente de dizer no prompt:
     * "pare de falar".
     */
    sent =
      this.sendEvent({
        type: "response.cancel",
      }) || sent;

    /*
     * Limpa áudio que eventualmente ainda esteja
     * aguardando reprodução no buffer.
     *
     * Algumas versões do transporte podem ignorar
     * esse evento. Por isso ele é complementar ao
     * response.cancel.
     */
    sent =
      this.sendEvent({
        type: "output_audio_buffer.clear",
      }) || sent;

    /*
     * Fallback para sessões que não reconheçam
     * response.cancel.
     */
    if (!sent) {
      this.sendEvent({
        type: "session.instructions.append",
        instructions:
          "O usuário começou a falar. Pare imediatamente e escute. Não conclua a frase anterior.",
      });
    }

    this.setSpeaking(false);
    this.setStatus("listening");

    return true;
  }

  /* ─────────────────────────────────────────────
     CONTEXTO RELACIONAL
  ───────────────────────────────────────────── */

  setRelationalContext(context) {
    this.relationalContext =
      context || null;

    return this.relationalContext;
  }

  addContext(context) {
    if (!context) return false;

    this.relationalContext =
      context;

    const serialized =
      typeof context === "string"
        ? context
        : JSON.stringify(
            context,
            null,
            2
          );

    return this.sendEvent({
      type: "session.thinking.append",
      text: `
CONTEXTO RELACIONAL SILENCIOSO DO CONÉXIA

${serialized}

REGRAS:
- Use este contexto para compreender continuidade, pessoas, assuntos, pendências e padrões.
- Não leia este contexto em voz alta.
- Não liste dados como se estivesse lendo uma ficha.
- Não diga "segundo o sistema".
- Não diga que se lembra de algo que não esteja sustentado pelo contexto.
- Não transforme inferência em fato.
- Prefira continuidade natural de conversa.
- Só mencione algo se isso melhorar a conversa agora.
      `.trim(),
    });
  }

  /*
   * O Relational Brief NÃO contém uma saudação pronta.
   * Ele fornece fatos/contexto e pede à Danna que escolha
   * o melhor início.
   */
  openWithRelationalBrief(brief) {
    if (brief) {
      this.setRelationalContext(
        brief
      );

      this.addContext(brief);
    }

    return this.sendEvent({
      type: "session.commentary.append",
      text: `
Inicie agora a conversa.

Antes de falar, considere silenciosamente o Relational Brief disponível.

Escolha o elemento mais relevante para este momento:
- um assunto vivo;
- uma pendência real;
- uma pessoa em movimento;
- uma continuidade da conversa anterior;
- ou um padrão relacional realmente útil.

Não use uma saudação padronizada.
Não tente mencionar dados apenas para demonstrar memória.
Não invente assunto, pessoa, compromisso ou acontecimento.

Se houver algo realmente relevante, comece pela continuidade natural desse assunto.

Se não houver nada suficientemente relevante, faça uma abertura humana, curta e natural e deixe a pessoa conduzir.

Fale como alguém que acompanha a história, não como um CRM lendo registros.
      `.trim(),
    });
  }

  /* ─────────────────────────────────────────────
     FALA / TEXTO
  ───────────────────────────────────────────── */

  speak(text) {
    if (!text) return false;

    return this.sendEvent({
      type: "session.commentary.append",
      text: String(text),
    });
  }

  sendText(text) {
    if (!text) return false;

    return this.sendEvent({
      type: "session.commentary.append",
      text: String(text),
    });
  }

  /* ─────────────────────────────────────────────
     MICROFONE
  ───────────────────────────────────────────── */

  mute() {
    const tracks =
      this.localStream?.getAudioTracks?.() ||
      [];

    tracks.forEach((track) => {
      track.enabled = false;
    });

    this.isMuted = true;

    return true;
  }

  unmute() {
    const tracks =
      this.localStream?.getAudioTracks?.() ||
      [];

    tracks.forEach((track) => {
      track.enabled = true;
    });

    this.isMuted = false;

    return true;
  }

  /* ─────────────────────────────────────────────
     ENCERRAMENTO
  ───────────────────────────────────────────── */

  /* ─────────────────────────────────────────────
     TRAVAS DE CUSTO
  ───────────────────────────────────────────── */

  markActivity() {
    this.lastActivityAt = Date.now();
  }

  startCostGuards() {
    this.sessionStartedAt = Date.now();
    this.lastActivityAt = Date.now();
    this.userTurns = 0;

    clearInterval(this.watchdog);
    this.watchdog = setInterval(() => {
      if (!this.sessionStartedAt) return;
      const now = Date.now();

      if (now - this.sessionStartedAt >= this.maxSessionMs) {
        this.autoStop("max_duration");
        return;
      }

      if (!this.isSpeaking && now - this.lastActivityAt >= this.idleMs) {
        this.autoStop("idle");
      }
    }, 5000);

    if (typeof document !== "undefined") {
      this.onVisibility = () => {
        if (document.visibilityState === "hidden") {
          this.autoStop("app_hidden");
        }
      };
      document.addEventListener("visibilitychange", this.onVisibility);
    }
  }

  autoStop(reason) {
    if (!this.sessionStartedAt) return;
    try {
      this.onAutoStop(reason);
    } catch (_) {}
    this.disconnect(reason);
  }

  async reportSession(reason) {
    if (!this.sessionStartedAt) return;

    const startedAt = this.sessionStartedAt;
    const payload = {
      started_at: new Date(startedAt).toISOString(),
      seconds: Math.round((Date.now() - startedAt) / 1000),
      end_reason: reason || "manual",
      user_turns: this.userTurns,
    };

    this.sessionStartedAt = null;

    try {
      const token = await this.getAccessToken();
      if (!token) return;
      await fetch("/api/openai-live-session?sessionlog=1", {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (_) {}
  }

  disconnect(reason = "manual") {
    clearInterval(this.watchdog);
    this.watchdog = null;

    if (this.onVisibility && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.onVisibility = null;
    }

    void this.reportSession(reason);

    clearTimeout(
      this.userTranscriptTimer
    );

    clearTimeout(
      this.assistantTranscriptTimer
    );

    clearTimeout(
      this.speakingTimer
    );

    this.userTranscriptTimer = null;
    this.assistantTranscriptTimer = null;
    this.speakingTimer = null;

    try {
      if (this.dc) {
        this.dc.onopen = null;
        this.dc.onclose = null;
        this.dc.onerror = null;
        this.dc.onmessage = null;

        if (
          this.dc.readyState !== "closed"
        ) {
          this.dc.close();
        }
      }
    } catch (_) {}

    try {
      if (this.pc) {
        this.pc.ontrack = null;
        this.pc.close();
      }
    } catch (_) {}

    try {
      this.localStream
        ?.getTracks?.()
        ?.forEach((track) => {
          track.stop();
        });
    } catch (_) {}

    try {
      if (this.remoteAudio) {
        this.remoteAudio.pause();
        this.remoteAudio.srcObject =
          null;
      }
    } catch (_) {}

    this.pc = null;
    this.dc = null;
    this.localStream = null;
    this.remoteAudio = null;

    this.connected = false;
    this.connecting = false;
    this.isMuted = false;

    this.userTranscriptBuffer = "";
    this.assistantTranscriptBuffer =
      "";

    this.setSpeaking(false);
    this.setStatus("closed");
  }
}
