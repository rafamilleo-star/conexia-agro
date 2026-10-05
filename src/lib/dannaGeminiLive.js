// CONÉXIA — Danna Gemini Live
// Correção: sessão resiliente, idle de 5 min e reconexão automática.

const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const TOOL_TIMEOUT_MS = 25000;

const WORKLET_SOURCE = `
class ConexiaMicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = options?.processorOptions?.targetRate || 16000;
    this.ratio = sampleRate / this.targetRate;
    this.pos = 0;
    this.out = [];
    this.chunk = Math.round(this.targetRate * 0.064);
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    while (this.pos < input.length) {
      const i = Math.floor(this.pos);
      const f = this.pos - i;
      const a = input[i];
      const b = i + 1 < input.length ? input[i + 1] : a;

      this.out.push(a + (b - a) * f);
      this.pos += this.ratio;
    }

    this.pos -= input.length;

    if (this.out.length >= this.chunk) {
      const pcm = new Int16Array(this.out.length);

      for (let k = 0; k < this.out.length; k++) {
        const s = Math.max(-1, Math.min(1, this.out[k]));
        pcm[k] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(pcm.buffer, [pcm.buffer]);
      this.out = [];
    }

    return true;
  }
}

registerProcessor("conexia-mic-processor", ConexiaMicProcessor);
`;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + 0x8000)
    );
  }

  return btoa(binary);
}

function base64ToInt16(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Int16Array(
    bytes.buffer,
    0,
    Math.floor(bytes.length / 2)
  );
}

export default class DannaGeminiLive {
  constructor({
    userName = "",
    getAccessToken,
    onAutoStop,

    // Antes estava 60 segundos.
    // Agora a Danna tolera até 5 minutos sem atividade.
    idleMs = 300000,

    // Sessão total continua limitada a 10 minutos.
    maxSessionMs = 600000,

    onState,
    onStatus,
    onUserTranscript,
    onAssistantTranscript,
    onError,
    onSpeakingChange,
    onUserSpeechStart,
  } = {}) {
    const noop = () => {};

    this.engine = "gemini";

    this.userName = String(userName || "")
      .trim()
      .slice(0, 40);

    this.getAccessToken =
      typeof getAccessToken === "function"
        ? getAccessToken
        : async () => null;

    this.onAutoStop =
      typeof onAutoStop === "function"
        ? onAutoStop
        : noop;

    this.onStatus =
      typeof onStatus === "function"
        ? onStatus
        : typeof onState === "function"
          ? onState
          : noop;

    this.onUserTranscript =
      typeof onUserTranscript === "function"
        ? onUserTranscript
        : noop;

    this.onAssistantTranscript =
      typeof onAssistantTranscript === "function"
        ? onAssistantTranscript
        : noop;

    this.onError =
      typeof onError === "function"
        ? onError
        : noop;

    this.onSpeakingChange =
      typeof onSpeakingChange === "function"
        ? onSpeakingChange
        : noop;

    this.onUserSpeechStart =
      typeof onUserSpeechStart === "function"
        ? onUserSpeechStart
        : noop;

    this.idleMs = idleMs;
    this.maxSessionMs = maxSessionMs;

    // Reconexão automática.
    this.maxReconnectAttempts = 2;
    this.reconnectAttempts = 0;
    this.reconnecting = false;
    this.intentionalDisconnect = false;

    this.ws = null;

    this.micStream = null;
    this.inCtx = null;
    this.outCtx = null;
    this.micNode = null;
    this.micSource = null;
    this.workletUrl = null;

    this.connected = false;
    this.connecting = false;
    this.setupDone = false;

    this.isSpeaking = false;

    this.playing = new Set();
    this.nextPlayTime = 0;

    this.pendingTool = null;
    this.toolTimer = null;

    this.sessionStartedAt = null;
    this.lastActivityAt = 0;
    this.userTurns = 0;

    this.watchdog = null;
    this.onVisibility = null;

    this.assistantBuffer = "";
    this.outputSuppressed = false;

    this.localBargeIn = false;

    this.geminiMicHeld = false;
    this.geminiOutputOpen = false;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;
    this.geminiManualMuted = false;
    this.geminiReleaseTimer = null;
    this.geminiTrackStates = new Map();

    this.micSpeechMs = 0;
    this.micSilenceMs = 0;
    this.micSpeechActive = false;
  }

  setStatus(status) {
    try {
      this.onStatus(status);
    } catch {}
  }

  markActivity() {
    this.lastActivityAt = Date.now();
  }

  setSpeaking(value) {
    const next = Boolean(value);

    if (this.engine === "gemini") {
      if (next) {
        this.holdGeminiMic();
      } else {
        this.releaseGeminiMicWhenDone();
      }
    }

    if (this.isSpeaking === next) {
      return;
    }

    this.isSpeaking = next;

    if (next) {
      this.markActivity();
    }

    try {
      this.onSpeakingChange(next);
    } catch {}

    this.setStatus(
      next
        ? "speaking"
        : this.connected
          ? "listening"
          : "idle"
    );
  }

  // =========================================================
  // NOVA SESSÃO / NOVO TOKEN
  // =========================================================

  async requestSession() {
    const accessToken =
      await this.getAccessToken();

    const response = await fetch(
      `/api/gemini-live-session${
        this.userName
          ? `?name=${encodeURIComponent(this.userName)}`
          : ""
      }`,
      {
        method: "POST",

        headers: accessToken
          ? {
              Authorization: `Bearer ${accessToken}`,
            }
          : {},
      }
    );

    const raw = await response.text();

    let payload = null;

    try {
      payload = JSON.parse(raw);
    } catch {}

    if (!response.ok) {
      const code =
        payload?.code ||
        payload?.error?.status ||
        "";

      let friendly;

      if (
        response.status === 403 ||
        code === "voice_requires_paid"
      ) {
        friendly =
          "A conversa por voz (BETA) é exclusiva para assinantes.";
      } else if (response.status === 401) {
        friendly =
          "Sua sessão expirou. Entre novamente no app para conversar com a Danna.";
      } else if (
        response.status === 429 ||
        /quota|RESOURCE_EXHAUSTED/i.test(raw)
      ) {
        friendly =
          "A voz da Danna está indisponível no momento. Tente novamente mais tarde.";
      } else {
        friendly =
          `Não consegui abrir a conversa por voz agora (${response.status}).`;
      }

      const err = new Error(friendly);

      err.status = response.status;
      err.detail = raw.slice(0, 1000);

      throw err;
    }

    if (
      !payload?.token ||
      !payload?.setup
    ) {
      throw new Error(
        "Resposta inválida ao abrir a voz Gemini."
      );
    }

    return payload;
  }

  // =========================================================
  // WEBSOCKET
  // =========================================================

  async openSocket(payload) {
    this.model =
      payload.model ||
      "gemini-3.8-live";

    await new Promise(
      (resolve, reject) => {
        const ws =
          new WebSocket(
            `${WS_URL}?access_token=${encodeURIComponent(
              payload.token
            )}`
          );

        this.ws = ws;

        const failTimer =
          setTimeout(() => {
            reject(
              new Error(
                "A voz Gemini demorou demais para responder."
              )
            );
          }, 12000);

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              setup: payload.setup,
            })
          );
        };

        ws.onmessage =
          async event => {
            let text = event.data;

            if (
              typeof text !== "string"
            ) {
              try {
                text =
                  await event.data.text();
              } catch {
                return;
              }
            }

            let msg;

            try {
              msg =
                JSON.parse(text);
            } catch {
              return;
            }

            if (
              msg.setupComplete &&
              !this.setupDone
            ) {
              this.setupDone = true;

              clearTimeout(
                failTimer
              );

              resolve();
              return;
            }

            this.handleServerMessage(
              msg
            );
          };

        ws.onerror = () => {
          clearTimeout(
            failTimer
          );

          if (!this.setupDone) {
            reject(
              new Error(
                "Falha na conexão com a voz Gemini."
              )
            );
          }
        };

        ws.onclose = event => {
          clearTimeout(
            failTimer
          );

          if (!this.setupDone) {
            reject(
              new Error(
                `A voz Gemini recusou a sessão${
                  event?.reason
                    ? `: ${event.reason}`
                    : "."
                }`
              )
            );

            return;
          }

          // Antes:
          // autoStop("server_closed")
          //
          // Agora:
          // tenta gerar NOVO TOKEN
          // e abrir NOVA conexão automaticamente.

          if (
            this.connected &&
            !this.intentionalDisconnect
          ) {
            void this.reconnect(
              "server_closed"
            );
          }
        };
      }
    );
  }

  async prepareAudio() {
    const AC =
      window.AudioContext ||
      window.webkitAudioContext;

    this.outCtx =
      new AC();

    this.inCtx =
      new AC();

    try {
      await this.outCtx.resume();
    } catch {}

    try {
      await this.inCtx.resume();
    } catch {}

    this.micStream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        }
      );
  }

  // =========================================================
  // CONNECT
  // =========================================================

  async connect() {
    if (this.connected) {
      return true;
    }

    if (this.connecting) {
      return false;
    }

    this.connecting = true;
    this.intentionalDisconnect = false;
    this.setupDone = false;

    this.setStatus(
      "connecting"
    );

    try {
      await this.beforeConnect();

      await this.prepareAudio();

      const payload =
        await this.requestSession();

      await this.openSocket(
        payload
      );

      await this.startMic();

      this.connected = true;
      this.connecting = false;

      this.reconnectAttempts = 0;

      this.setStatus(
        "listening"
      );

      this.startCostGuards();

      return true;
    } catch (error) {
      this.connecting = false;
      this.connected = false;

      console.error(
        "[DannaGemini] Erro ao conectar:",
        error
      );

      this.setStatus(
        "error"
      );

      try {
        this.onError(error);
      } catch {}

      this.cleanupTransport(
        true
      );

      throw error;
    }
  }

  async beforeConnect() {}

  // =========================================================
  // RECONEXÃO AUTOMÁTICA
  // =========================================================

  async reconnect(
    reason = "server_closed"
  ) {
    if (
      this.intentionalDisconnect ||
      this.reconnecting
    ) {
      return false;
    }

    if (
      this.reconnectAttempts >=
      this.maxReconnectAttempts
    ) {
      this.autoStop(reason);
      return false;
    }

    this.reconnecting = true;
    this.reconnectAttempts += 1;

    const attempt =
      this.reconnectAttempts;

    this.setStatus(
      "connecting"
    );

    try {
      // Fecha somente transporte.
      // NÃO encerra a sessão lógica da Danna.
      this.cleanupTransport(
        false
      );

      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            Math.min(
              800 * attempt,
              1600
            )
          )
      );

      this.intentionalDisconnect =
        false;

      this.setupDone = false;

      await this.prepareAudio();

      // IMPORTANTE:
      // novo token Gemini.
      const payload =
        await this.requestSession();

      await this.openSocket(
        payload
      );

      await this.startMic();

      this.connected = true;
      this.reconnecting = false;

      this.reconnectAttempts = 0;

      this.markActivity();

      this.setStatus(
        "listening"
      );

      this.startCostGuards();

      return true;
    } catch (error) {
      this.reconnecting = false;

      if (
        this.reconnectAttempts <
        this.maxReconnectAttempts
      ) {
        return this.reconnect(
          reason
        );
      }

      try {
        this.onError(error);
      } catch {}

      this.autoStop(
        reason
      );

      return false;
    }
  }

  // =========================================================
  // MICROFONE / ECHO GATE
  // =========================================================

  acceptGeminiMic(buffer) {
    if (
      this.geminiMicHeld ||
      this.geminiManualMuted
    ) {
      return false;
    }

    const pcm =
      new Int16Array(buffer);

    if (!pcm.length) {
      return false;
    }

    let energy = 0;

    for (
      const sample of pcm
    ) {
      energy +=
        (sample / 32768) ** 2;
    }

    const rms =
      Math.sqrt(
        energy / pcm.length
      );

    this.geminiSpeechMs =
      rms >= 0.005
        ? this.geminiSpeechMs +
          pcm.length /
            INPUT_RATE *
            1000
        : 0;

    if (
      this.geminiSpeechMs >=
      128
    ) {
      this.geminiFreshSpeech =
        true;
    }

    return true;
  }

  holdGeminiMic() {
    clearTimeout(
      this.geminiReleaseTimer
    );

    this.geminiMicHeld = true;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;

    for (
      const track of
      this.micStream?.getAudioTracks() ||
      []
    ) {
      if (
        !this.geminiTrackStates.has(
          track
        )
      ) {
        this.geminiTrackStates.set(
          track,
          track.enabled
        );
      }

      track.enabled = false;
    }
  }

  releaseGeminiMicWhenDone() {
    if (
      !this.geminiMicHeld ||
      this.geminiOutputOpen ||
      this.playing.size
    ) {
      return;
    }

    clearTimeout(
      this.geminiReleaseTimer
    );

    this.geminiReleaseTimer =
      setTimeout(() => {
        if (
          !this.connected ||
          this.geminiOutputOpen ||
          this.playing.size
        ) {
          return;
        }

        for (
          const [
            track,
            enabled,
          ] of
          this.geminiTrackStates
        ) {
          if (
            track.readyState !==
            "ended"
          ) {
            track.enabled =
              enabled &&
              !this.geminiManualMuted;
          }
        }

        this.geminiTrackStates.clear();

        this.geminiMicHeld =
          false;

        this.geminiFreshSpeech =
          false;

        this.geminiSpeechMs = 0;

        this.setStatus(
          "listening"
        );
      }, 700);
  }

  async startMic() {
    const blob =
      new Blob(
        [WORKLET_SOURCE],
        {
          type: "application/javascript",
        }
      );

    this.workletUrl =
      URL.createObjectURL(
        blob
      );

    await this.inCtx.audioWorklet.addModule(
      this.workletUrl
    );

    this.micSource =
      this.inCtx.createMediaStreamSource(
        this.micStream
      );

    this.micNode =
      new AudioWorkletNode(
        this.inCtx,
        "conexia-mic-processor",
        {
          processorOptions: {
            targetRate:
              INPUT_RATE,
          },
        }
      );

    this.micNode.port.onmessage =
      event => {
        if (
          !this.ws ||
          this.ws.readyState !==
            WebSocket.OPEN ||
          !this.setupDone
        ) {
          return;
        }

        if (
          !this.acceptGeminiMic(
            event.data
          )
        ) {
          return;
        }

        if (
          this.localBargeIn
        ) {
          this.checkMicActivity(
            event.data
          );
        }

        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              audio: {
                data:
                  arrayBufferToBase64(
                    event.data
                  ),

                mimeType:
                  `audio/pcm;rate=${INPUT_RATE}`,
              },
            },
          })
        );
      };

    const mute =
      this.inCtx.createGain();

    mute.gain.value = 0;

    this.micSource.connect(
      this.micNode
    );

    this.micNode.connect(
      mute
    );

    mute.connect(
      this.inCtx.destination
    );
  }

  checkMicActivity(buffer) {
    const pcm =
      new Int16Array(buffer);

    if (!pcm.length) {
      return;
    }

    let energy = 0;

    for (const s of pcm) {
      energy +=
        (s / 32768) ** 2;
    }

    const rms =
      Math.sqrt(
        energy / pcm.length
      );

    const ms =
      pcm.length /
      INPUT_RATE *
      1000;

    if (rms >= 0.025) {
      this.micSilenceMs = 0;
      this.micSpeechMs += ms;

      if (
        !this.micSpeechActive &&
        this.micSpeechMs >=
          128
      ) {
        this.micSpeechActive =
          true;

        this.interrupt();

        this.markActivity();

        this.onUserSpeechStart();
      }
    } else {
      this.micSpeechMs = 0;
      this.micSilenceMs += ms;

      if (
        this.micSilenceMs >=
        300
      ) {
        this.micSpeechActive =
          false;
      }
    }
  }

  // =========================================================
  // MENSAGENS DO GEMINI
  // =========================================================

  handleServerMessage(msg) {
    if (
      msg.toolCall
        ?.functionCalls
        ?.length
    ) {
      this.handleToolCall(
        msg.toolCall
          .functionCalls
      );

      return;
    }

    if (
      msg.toolCallCancellation
        ?.ids?.length
    ) {
      if (
        this.pendingTool &&
        msg.toolCallCancellation.ids.includes(
          this.pendingTool.id
        )
      ) {
        this.pendingTool = null;

        clearTimeout(
          this.toolTimer
        );
      }

      return;
    }

    // Gemini avisou que vai encerrar.
    // Em vez de matar a Danna,
    // abre uma nova sessão.
    if (msg.goAway) {
      void this.reconnect(
        "server_limit"
      );

      return;
    }

    const sc =
      msg.serverContent;

    if (!sc) {
      return;
    }

    if (
      sc.interrupted &&
      !this.geminiMicHeld &&
      this.geminiFreshSpeech
    ) {
      this.interrupt();

      this.onUserSpeechStart();

      this.markActivity();

      this.setStatus(
        "listening"
      );
    }

    if (
      sc.inputTranscription
        ?.text
    ) {
      this.markActivity();
    }

    if (
      sc.outputTranscription
        ?.text
    ) {
      this.assistantBuffer +=
        sc.outputTranscription.text;
    }

    for (
      const part of
      sc.modelTurn?.parts ||
      []
    ) {
      if (
        part?.inlineData
          ?.data
      ) {
        this.playChunk(
          part.inlineData.data
        );
      }
    }

    if (
      sc.turnComplete
    ) {
      this.geminiOutputOpen =
        false;

      this.releaseGeminiMicWhenDone();

      const text =
        this.assistantBuffer.trim();

      this.assistantBuffer =
        "";

      if (text) {
        try {
          this.onAssistantTranscript(
            text
          );
        } catch {}
      }
    }
  }

  handleToolCall(calls) {
    if (
      this.geminiMicHeld ||
      !this.geminiFreshSpeech
    ) {
      if (
        !this.geminiMicHeld
      ) {
        this.outputSuppressed =
          true;
      }

      for (
        const call of calls
      ) {
        this.sendToolResponse(
          call,
          ""
        );
      }

      return;
    }

    this.geminiFreshSpeech =
      false;

    this.geminiSpeechMs = 0;

    const call =
      calls.find(
        c =>
          c?.name ===
          "conexia_responder"
      ) ||
      calls[0];

    const fala =
      String(
        call?.args?.fala ||
          ""
      ).trim();

    for (
      const c of calls
    ) {
      if (c !== call) {
        this.sendToolResponse(
          c,
          ""
        );
      }
    }

    this.markActivity();

    if (!fala) {
      this.sendToolResponse(
        call,
        "Não entendi. Pode repetir?"
      );

      return;
    }

    this.pendingTool =
      call;

    clearTimeout(
      this.toolTimer
    );

    this.toolTimer =
      setTimeout(() => {
        if (
          this.pendingTool ===
          call
        ) {
          this.sendToolResponse(
            call,
            "Tive um problema para pensar nisso agora. Pode repetir?"
          );
        }
      }, TOOL_TIMEOUT_MS);

    this.userTurns += 1;

    this.setStatus(
      "thinking"
    );

    try {
      this.onUserTranscript(
        fala
      );
    } catch {}
  }

  sendToolResponse(
    call,
    resposta
  ) {
    if (!call) {
      return false;
    }

    if (
      this.pendingTool ===
      call
    ) {
      this.pendingTool = null;

      clearTimeout(
        this.toolTimer
      );
    }

    return this.send({
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,

            response: {
              resposta:
                String(
                  resposta || ""
                ),
            },
          },
        ],
      },
    });
  }

  send(payload) {
    if (
      !this.ws ||
      this.ws.readyState !==
        WebSocket.OPEN
    ) {
      return false;
    }

    try {
      this.ws.send(
        JSON.stringify(
          payload
        )
      );

      return true;
    } catch {
      return false;
    }
  }

  // =========================================================
  // ÁUDIO DE SAÍDA
  // =========================================================

  playChunk(b64) {
    if (
      this.outputSuppressed ||
      !this.outCtx
    ) {
      return;
    }

    const pcm =
      base64ToInt16(b64);

    if (!pcm.length) {
      return;
    }

    this.geminiOutputOpen =
      true;

    this.holdGeminiMic();

    const buffer =
      this.outCtx.createBuffer(
        1,
        pcm.length,
        OUTPUT_RATE
      );

    const channel =
      buffer.getChannelData(
        0
      );

    for (
      let i = 0;
      i < pcm.length;
      i++
    ) {
      channel[i] =
        pcm[i] / 0x8000;
    }

    const src =
      this.outCtx.createBufferSource();

    src.buffer = buffer;

    src.connect(
      this.outCtx.destination
    );

    const startAt =
      Math.max(
        this.outCtx.currentTime +
          0.02,
        this.nextPlayTime
      );

    src.start(
      startAt
    );

    this.nextPlayTime =
      startAt +
      buffer.duration;

    this.playing.add(
      src
    );

    this.setSpeaking(
      true
    );

    src.onended = () => {
      this.playing.delete(
        src
      );

      this.markActivity();

      if (
        !this.playing.size
      ) {
        this.setSpeaking(
          false
        );
      }
    };
  }

  stopPlayback() {
    this.geminiOutputOpen =
      false;

    for (
      const src of
      this.playing
    ) {
      try {
        src.stop();
      } catch {}
    }

    this.playing.clear();

    this.nextPlayTime = 0;

    this.setSpeaking(
      false
    );
  }

  speak(text) {
    const clean =
      String(
        text || ""
      ).trim();

    if (!clean) {
      return false;
    }

    this.outputSuppressed =
      false;

    if (
      this.pendingTool
    ) {
      return this.sendToolResponse(
        this.pendingTool,
        clean
      );
    }

    return this.send({
      realtimeInput: {
        text:
          `DIGA: ${clean}`,
      },
    });
  }

  sendText(text) {
    return this.speak(
      text
    );
  }

  addContext() {
    return true;
  }

  interrupt() {
    this.outputSuppressed =
      true;

    this.stopPlayback();

    return true;
  }

  silence() {
    this.interrupt();

    if (
      this.pendingTool
    ) {
      this.sendToolResponse(
        this.pendingTool,
        ""
      );
    }

    return true;
  }

  mute() {
    this.geminiManualMuted =
      true;

    this.micStream
      ?.getAudioTracks()
      .forEach(t => {
        t.enabled = false;
      });
  }

  unmute() {
    this.geminiManualMuted =
      false;

    if (
      this.geminiMicHeld
    ) {
      for (
        const track of
        this.geminiTrackStates.keys()
      ) {
        this.geminiTrackStates.set(
          track,
          true
        );
      }

      return;
    }

    this.micStream
      ?.getAudioTracks()
      .forEach(t => {
        t.enabled = true;
      });
  }

  // =========================================================
  // WATCHDOG
  // =========================================================

  startCostGuards() {
    // Durante reconexão NÃO reinicia
    // o início lógico da conversa.
    if (
      !this.sessionStartedAt
    ) {
      this.sessionStartedAt =
        Date.now();

      this.userTurns = 0;
    }

    this.lastActivityAt =
      Date.now();

    clearInterval(
      this.watchdog
    );

    this.watchdog =
      setInterval(() => {
        if (
          !this.sessionStartedAt
        ) {
          return;
        }

        const now =
          Date.now();

        if (
          now -
            this.sessionStartedAt >=
          this.maxSessionMs
        ) {
          this.autoStop(
            "max_duration"
          );

          return;
        }

        if (
          !this.isSpeaking &&
          !this.pendingTool &&
          now -
            this.lastActivityAt >=
            this.idleMs
        ) {
          this.autoStop(
            "idle"
          );
        }
      }, 5000);

    // IMPORTANTE:
    // não mata mais a Danna simplesmente
    // porque a tela perdeu visibilidade.
    //
    // Isso pode acontecer ao gravar,
    // mudar de app, abrir seletor etc.

    if (
      !this.onVisibility
    ) {
      this.onVisibility =
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            this.markActivity();
          }
        };

      document.addEventListener(
        "visibilitychange",
        this.onVisibility
      );
    }
  }

  autoStop(reason) {
    if (
      !this.sessionStartedAt
    ) {
      return;
    }

    try {
      this.onAutoStop(
        reason
      );
    } catch {}

    this.disconnect(
      reason
    );
  }

  // =========================================================
  // LOG DA SESSÃO
  // =========================================================

  async reportSession(
    reason
  ) {
    if (
      !this.sessionStartedAt
    ) {
      return;
    }

    const startedAt =
      this.sessionStartedAt;

    this.sessionStartedAt =
      null;

    const payload = {
      started_at:
        new Date(
          startedAt
        ).toISOString(),

      seconds:
        Math.round(
          (
            Date.now() -
            startedAt
          ) /
            1000
        ),

      end_reason:
        reason ||
        "manual",

      user_turns:
        this.userTurns,
    };

    try {
      const token =
        await this.getAccessToken();

      if (!token) {
        return;
      }

      await fetch(
        "/api/gemini-live-session?sessionlog=1",
        {
          method: "POST",

          keepalive: true,

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );
    } catch {}
  }

  // =========================================================
  // LIMPEZA DO TRANSPORTE
  // =========================================================

  cleanupTransport(
    intentional = true
  ) {
    this.intentionalDisconnect =
      intentional;

    clearTimeout(
      this.toolTimer
    );

    this.pendingTool =
      null;

    this.stopPlayback();

    try {
      if (
        this.micNode?.port
      ) {
        this.micNode.port.onmessage =
          null;
      }
    } catch {}

    try {
      this.micSource?.disconnect();
    } catch {}

    try {
      this.micNode?.disconnect();
    } catch {}

    this.micStream
      ?.getTracks()
      .forEach(t => {
        try {
          t.stop();
        } catch {}
      });

    if (this.ws) {
      const ws =
        this.ws;

      this.ws = null;

      ws.onclose = null;
      ws.onmessage = null;

      try {
        ws.close();
      } catch {}
    }

    try {
      this.inCtx?.close();
    } catch {}

    try {
      this.outCtx?.close();
    } catch {}

    if (
      this.workletUrl
    ) {
      try {
        URL.revokeObjectURL(
          this.workletUrl
        );
      } catch {}
    }

    this.micStream = null;
    this.micSource = null;
    this.micNode = null;

    this.inCtx = null;
    this.outCtx = null;

    this.workletUrl = null;

    this.connected = false;
    this.setupDone = false;

    clearTimeout(
      this.geminiReleaseTimer
    );

    this.geminiReleaseTimer =
      null;

    this.geminiTrackStates.clear();

    this.geminiMicHeld = false;
    this.geminiOutputOpen = false;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;
  }

  // =========================================================
  // DISCONNECT DEFINITIVO
  // =========================================================

  disconnect(
    reason = "manual"
  ) {
    this.intentionalDisconnect =
      true;

    clearInterval(
      this.watchdog
    );

    this.watchdog = null;

    if (
      this.onVisibility
    ) {
      document.removeEventListener(
        "visibilitychange",
        this.onVisibility
      );

      this.onVisibility =
        null;
    }

    void this.reportSession(
      reason
    );

    this.cleanupTransport(
      true
    );

    this.connecting = false;
    this.reconnecting = false;

    this.reconnectAttempts =
      0;

    this.setStatus(
      "idle"
    );
  }
}
