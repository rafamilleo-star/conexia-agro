export class DannaLive {
  constructor({
    onState,
    onTranscript,
    onUserTranscript,
    onError,
    onEvent,
  } = {}) {
    this.pc = null;
    this.dc = null;
    this.audio = null;
    this.stream = null;
    this.connected = false;

    this.onState = onState || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onUserTranscript = onUserTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onEvent = onEvent || (() => {});
  }

  async connect() {
    try {
      this.onState("connecting");

      /*
       * 1. Pede ao nosso backend um token temporário.
       * A OPENAI_API_KEY nunca vai para o navegador.
       */
      const tokenResponse = await fetch(
        "/api/openai-live-token",
        {
          method: "POST",
        }
      );

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData?.details?.error?.message ||
          tokenData?.error ||
          "Não foi possível iniciar a Danna"
        );
      }

      const ephemeralKey =
        tokenData?.value ||
        tokenData?.client_secret?.value;

      if (!ephemeralKey) {
        throw new Error(
          "Token temporário da Danna não recebido."
        );
      }

      /*
       * 2. Abre conexão WebRTC.
       */
      this.pc = new RTCPeerConnection();

      /*
       * 3. Áudio retornado pela Danna.
       */
      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.playsInline = true;

      this.pc.ontrack = (event) => {
        const remoteStream = event.streams?.[0];

        if (remoteStream) {
          this.audio.srcObject = remoteStream;
        }
      };

      /*
       * 4. Microfone do usuário.
       */
      this.stream =
        await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

      this.stream
        .getAudioTracks()
        .forEach((track) => {
          this.pc.addTrack(track, this.stream);
        });

      /*
       * 5. Canal de eventos.
       */
      this.dc =
        this.pc.createDataChannel("oai-events");

      this.dc.addEventListener("open", () => {
        this.connected = true;
        this.onState("listening");
      });

      this.dc.addEventListener(
        "message",
        (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleEvent(data);
          } catch (error) {
            console.warn(
              "[Danna Live] evento inválido",
              error
            );
          }
        }
      );

      this.dc.addEventListener("close", () => {
        this.connected = false;
        this.onState("idle");
      });

      this.dc.addEventListener("error", () => {
        this.onState("error");
      });

      /*
       * 6. Oferta WebRTC.
       */
      const offer =
        await this.pc.createOffer();

      await this.pc.setLocalDescription(offer);

      /*
       * 7. Entrega SDP à OpenAI usando
       * SOMENTE o token temporário.
       */
      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
        {
          method: "POST",

          body: offer.sdp,

          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!sdpResponse.ok) {
        const message =
          await sdpResponse.text();

        throw new Error(
          message || "Falha na conexão WebRTC"
        );
      }

      const answer = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };

      await this.pc.setRemoteDescription(answer);

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

    switch (event.type) {
      /*
       * Usuário começou a falar.
       */
      case "input_audio_buffer.speech_started":
        this.onState("listening");
        break;

      /*
       * Usuário terminou de falar.
       */
      case "input_audio_buffer.speech_stopped":
        this.onState("thinking");
        break;

      /*
       * A Danna começou a falar.
       */
      case "output_audio_buffer.started":
        this.onState("speaking");
        break;

      /*
       * Áudio terminou.
       */
      case "output_audio_buffer.stopped":
        this.onState("listening");
        break;

      /*
       * Usuário interrompeu.
       */
      case "output_audio_buffer.cleared":
        this.onState("listening");
        break;

      /*
       * Transcrição da Danna.
       */
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (event.delta) {
          this.onTranscript(event.delta);
        }
        break;

      /*
       * Transcrição do usuário.
       */
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          this.onUserTranscript(
            event.transcript
          );
        }
        break;

      case "response.done":
        this.onState("listening");
        break;

      case "error":
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
        break;

      default:
        break;
    }
  }

  /*
   * Envia texto para a conversa.
   * Útil como fallback ou para contexto adicional.
   */
  sendText(text) {
    if (
      !this.dc ||
      this.dc.readyState !== "open"
    ) {
      return;
    }

    const clean =
      String(text || "").trim();

    if (!clean) return;

    this.dc.send(
      JSON.stringify({
        type: "conversation.item.create",

        item: {
          type: "message",
          role: "user",

          content: [
            {
              type: "input_text",
              text: clean,
            },
          ],
        },
      })
    );

    this.dc.send(
      JSON.stringify({
        type: "response.create",
      })
    );
  }

  /*
   * Adiciona contexto à sessão.
   */
  addContext(context) {
    if (
      !this.dc ||
      this.dc.readyState !== "open"
    ) {
      return;
    }

    const clean =
      String(context || "").trim();

    if (!clean) return;

    this.dc.send(
      JSON.stringify({
        type: "session.update",

        session: {
          type: "realtime",

          instructions: `
Você é Danna, a inteligência relacional do CONÉXIA.

Considere também este contexto relacional:

${clean}

REGRAS:
- use somente fatos presentes no contexto;
- não invente;
- notas antigas podem estar desatualizadas;
- diferencie histórico de situação atual;
- destaque mudanças quando existirem;
- priorize assuntos em aberto;
- sugestões são sugestões, nunca fatos.
          `.trim(),
        },
      })
    );
  }

  /*
   * Interrompe imediatamente a Danna.
   */
  interrupt() {
    if (
      !this.dc ||
      this.dc.readyState !== "open"
    ) {
      return;
    }

    try {
      this.dc.send(
        JSON.stringify({
          type: "response.cancel",
        })
      );

      this.dc.send(
        JSON.stringify({
          type: "output_audio_buffer.clear",
        })
      );
    } catch {}

    this.onState("listening");
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
    try {
      this.stream
        ?.getTracks()
        .forEach((track) => track.stop());
    } catch {}

    try {
      this.dc?.close();
    } catch {}

    try {
      this.pc?.close();
    } catch {}

    if (this.audio) {
      this.audio.srcObject = null;
      this.audio.remove();
    }

    this.pc = null;
    this.dc = null;
    this.audio = null;
    this.stream = null;

    this.connected = false;

    this.onState("idle");
  }
}

export default DannaLive;
