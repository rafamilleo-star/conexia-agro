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

    this.onState = onState || (() => {});
    this.onTranscript = onTranscript || (() => {});
    this.onUserTranscript = onUserTranscript || (() => {});
    this.onError = onError || (() => {});
    this.onEvent = onEvent || (() => {});

    this.connected = false;
  }

  async connect() {
    try {
      this.onState("connecting");

      const tokenResponse = await fetch("/api/openai-live-token", {
        method: "POST",
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        throw new Error(
          tokenData?.error || "Não foi possível iniciar a Danna"
        );
      }

      const ephemeralKey =
        tokenData?.value ||
        tokenData?.client_secret?.value;

      if (!ephemeralKey) {
        throw new Error("Token temporário da Danna não recebido.");
      }

      this.pc = new RTCPeerConnection();

      this.audio = document.createElement("audio");
      this.audio.autoplay = true;
      this.audio.playsInline = true;

      this.pc.ontrack = (event) => {
        this.audio.srcObject = event.streams[0];
      };

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      for (const track of this.stream.getTracks()) {
        this.pc.addTrack(track, this.stream);
      }

      this.dc = this.pc.createDataChannel("oai-events");

      this.dc.addEventListener("open", () => {
        this.connected = true;
        this.onState("listening");
      });

      this.dc.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.warn("[Danna Live] Evento inválido", error);
        }
      });

      this.dc.addEventListener("close", () => {
        this.connected = false;
        this.onState("idle");
      });

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

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
        const message = await sdpResponse.text();
        throw new Error(message || "Falha WebRTC");
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
      case "input_audio_buffer.speech_started":
        this.onState("listening");
        break;

      case "input_audio_buffer.speech_stopped":
        this.onState("thinking");
        break;

      case "response.output_audio.delta":
      case "response.audio.delta":
        this.onState("speaking");
        break;

      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        if (event.delta) {
          this.onTranscript(event.delta);
        }
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) {
          this.onUserTranscript(event.transcript);
        }
        break;

      case "response.done":
        this.onState("listening");
        break;

      case "error":
        console.error("[Danna Live event]", event);
        this.onError(
          new Error(
            event?.error?.message || "Erro na conversa com a Danna"
          )
        );
        break;

      default:
        break;
    }
  }

  sendText(text) {
    if (!this.dc || this.dc.readyState !== "open") return;

    const clean = String(text || "").trim();
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

  addContext(context) {
    if (!this.dc || this.dc.readyState !== "open") return;

    const clean = String(context || "").trim();
    if (!clean) return;

    this.dc.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "system",
          content: [
            {
              type: "input_text",
              text: clean,
            },
          ],
        },
      })
    );
  }

  interrupt() {
    if (!this.dc || this.dc.readyState !== "open") return;

    try {
      this.dc.send(
        JSON.stringify({
          type: "response.cancel",
        })
      );
    } catch {}

    this.onState("listening");
  }

  mute() {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
  }

  unmute() {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
  }

  disconnect() {
    try {
      this.stream?.getTracks().forEach((track) => track.stop());
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
