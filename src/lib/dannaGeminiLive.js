/**
 * CONÉXIA — Danna (motor Gemini Live)
 *
 * Mesma interface pública do DannaLive (OpenAI), para a tela da Danna
 * trocar de motor sem mudar a lógica:
 *   connect(), speak(text), interrupt(), addContext(), disconnect(reason),
 *   connected, isSpeaking.
 *
 * Fluxo:
 *   microfone (PCM16 16 kHz) → WebSocket Gemini Live
 *   Gemini detecta a fala → chama conexia_responder({ fala })
 *   → onUserTranscript(fala) → pipeline do CONÉXIA → speak(resposta)
 *   → toolResponse → Gemini fala a resposta (PCM16 24 kHz) → alto-falante
 *
 * Travas de custo idênticas ao motor OpenAI: 60 s sem atividade,
 * 10 min por sessão e encerramento quando o app vai para segundo plano.
 */

const WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

const INPUT_RATE = 16000;
const OUTPUT_RATE = 24000;
const TOOL_TIMEOUT_MS = 25000;

// AudioWorklet: converte o microfone (taxa nativa) em PCM16 16 kHz, em blocos de ~64 ms.
const WORKLET_SOURCE = `
class ConexiaMicProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = (options && options.processorOptions && options.processorOptions.targetRate) || 16000;
    this.ratio = sampleRate / this.targetRate;
    this.pos = 0;
    this.out = [];
    this.chunk = Math.round(this.targetRate * 0.064);
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
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
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToInt16(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

export default class DannaGeminiLive {
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
    this.engine = "gemini";
    this.userName = String(userName || "").trim().slice(0, 40);

    const noop = () => {};
    this.getAccessToken =
      typeof getAccessToken === "function" ? getAccessToken : async () => null;
    this.onAutoStop = typeof onAutoStop === "function" ? onAutoStop : noop;
    this.onStatus =
      typeof onStatus === "function"
        ? onStatus
        : typeof onState === "function"
          ? onState
          : noop;
    this.onUserTranscript =
      typeof onUserTranscript === "function" ? onUserTranscript : noop;
    this.onAssistantTranscript =
      typeof onAssistantTranscript === "function" ? onAssistantTranscript : noop;
    this.onError = typeof onError === "function" ? onError : noop;
    this.onSpeakingChange =
      typeof onSpeakingChange === "function" ? onSpeakingChange : noop;

    this.idleMs = idleMs;
    this.maxSessionMs = maxSessionMs;

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
  }

  setStatus(status) {
    try { this.onStatus(status); } catch (_) {}
  }

  setSpeaking(value) {
    const next = Boolean(value);
    if (this.isSpeaking === next) return;
    this.isSpeaking = next;
    if (next) this.markActivity();
    try { this.onSpeakingChange(next); } catch (_) {}
    this.setStatus(next ? "speaking" : this.connected ? "listening" : "idle");
  }

  /* ─────────────── CONEXÃO ─────────────── */

  async connect() {
    if (this.connected) return true;
    if (this.connecting) return false;

    this.connecting = true;
    this.setupDone = false;
    this.setStatus("connecting");

    // iOS: contextos de áudio criados e liberados ainda dentro do toque.
    const AC = window.AudioContext || window.webkitAudioContext;
    this.outCtx = new AC();
    this.inCtx = new AC();
    try { this.outCtx.resume(); } catch (_) {}
    try { this.inCtx.resume(); } catch (_) {}

    try {
      /* microfone */
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      /* token efêmero + configuração da sessão (servidor) */
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `/api/gemini-live-session${this.userName ? `?name=${encodeURIComponent(this.userName)}` : ""}`,
        {
          method: "POST",
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }
      );

      const raw = await response.text();
      let payload = null;
      try { payload = JSON.parse(raw); } catch (_) {}

      if (!response.ok) {
        const code = payload?.code || payload?.error?.status || "";
        let friendly;
        if (response.status === 403 || code === "voice_requires_paid") {
          friendly = "A conversa por voz (BETA) é exclusiva para assinantes.";
        } else if (response.status === 401) {
          friendly = "Sua sessão expirou. Entre novamente no app para conversar com a Danna.";
        } else if (response.status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(raw)) {
          friendly = "A voz da Danna está indisponível no momento. Tente novamente mais tarde.";
        } else {
          friendly = `Não consegui abrir a conversa por voz agora (${response.status}).`;
        }
        const err = new Error(friendly);
        err.status = response.status;
        err.detail = raw.slice(0, 1000);
        throw err;
      }

      if (!payload?.token || !payload?.setup) {
        throw new Error("Resposta inválida ao abrir a voz Gemini.");
      }

      this.model = payload.model || "gemini-3.8-live";

      /* WebSocket */
      await new Promise((resolve, reject) => {
        const ws = new WebSocket(
          `${WS_URL}?access_token=${encodeURIComponent(payload.token)}`
        );
        this.ws = ws;

        const failTimer = setTimeout(() => {
          reject(new Error("A voz Gemini demorou demais para responder."));
        }, 12000);

        ws.onopen = () => {
          ws.send(JSON.stringify({ setup: payload.setup }));
        };

        ws.onmessage = async (event) => {
          let text = event.data;
          if (typeof text !== "string") {
            try { text = await event.data.text(); } catch (_) { return; }
          }
          let msg;
          try { msg = JSON.parse(text); } catch (_) { return; }

          if (msg.setupComplete && !this.setupDone) {
            this.setupDone = true;
            clearTimeout(failTimer);
            resolve();
            return;
          }

          this.handleServerMessage(msg);
        };

        ws.onerror = () => {
          clearTimeout(failTimer);
          if (!this.setupDone) reject(new Error("Falha na conexão com a voz Gemini."));
        };

        ws.onclose = (event) => {
          clearTimeout(failTimer);
          if (!this.setupDone) {
            reject(
              new Error(
                `A voz Gemini recusou a sessão${event?.reason ? `: ${event.reason}` : "."}`
              )
            );
            return;
          }
          if (this.connected) {
            this.autoStop("server_closed");
          }
        };
      });

      await this.startMic();

      this.connected = true;
      this.connecting = false;
      this.setStatus("listening");
      this.startCostGuards();

      return true;
    } catch (error) {
      this.connecting = false;
      this.connected = false;

      console.error("[DannaGemini] Erro ao conectar:", error);

      try {
        fetch("/api/openai-live-session?clientlog=1", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          keepalive: true,
          body: `[gemini] ${error?.name || "Error"}: ${error?.message || String(error)} | status: ${error?.status || ""} | detail: ${error?.detail || ""} | UA: ${navigator.userAgent}`,
        }).catch(() => {});
      } catch (_) {}

      this.setStatus("error");
      try { this.onError(error); } catch (_) {}
      this.disconnect("connect_failed");
      throw error;
    }
  }

  async startMic() {
    const blob = new Blob([WORKLET_SOURCE], { type: "application/javascript" });
    this.workletUrl = URL.createObjectURL(blob);
    await this.inCtx.audioWorklet.addModule(this.workletUrl);

    this.micSource = this.inCtx.createMediaStreamSource(this.micStream);
    this.micNode = new AudioWorkletNode(this.inCtx, "conexia-mic-processor", {
      processorOptions: { targetRate: INPUT_RATE },
    });

    this.micNode.port.onmessage = (event) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.setupDone) return;
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: arrayBufferToBase64(event.data),
              mimeType: `audio/pcm;rate=${INPUT_RATE}`,
            },
          },
        })
      );
    };

    // Conecta ao destino com ganho zero (necessário para o worklet rodar no Safari).
    const mute = this.inCtx.createGain();
    mute.gain.value = 0;
    this.micSource.connect(this.micNode);
    this.micNode.connect(mute);
    mute.connect(this.inCtx.destination);
  }

  /* ─────────────── MENSAGENS DO SERVIDOR ─────────────── */

  handleServerMessage(msg) {
    if (msg.toolCall?.functionCalls?.length) {
      this.handleToolCall(msg.toolCall.functionCalls);
      return;
    }

    // Interrupção durante o "pensar": o Gemini cancela a chamada antiga.
    if (msg.toolCallCancellation?.ids?.length) {
      if (this.pendingTool && msg.toolCallCancellation.ids.includes(this.pendingTool.id)) {
        this.pendingTool = null;
        clearTimeout(this.toolTimer);
      }
      return;
    }

    if (msg.goAway) {
      this.autoStop("server_limit");
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      this.stopPlayback();
      this.markActivity();
      this.setStatus("listening");
    }

    if (sc.inputTranscription?.text) {
      this.markActivity();
    }

    if (sc.outputTranscription?.text) {
      this.assistantBuffer += sc.outputTranscription.text;
    }

    const parts = sc.modelTurn?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        this.playChunk(part.inlineData.data);
      }
    }

    if (sc.turnComplete) {
      const text = this.assistantBuffer.trim();
      this.assistantBuffer = "";
      if (text) {
        try { this.onAssistantTranscript(text); } catch (_) {}
      }
    }
  }

  handleToolCall(calls) {
    const call = calls.find((c) => c?.name === "conexia_responder") || calls[0];
    const fala = String(call?.args?.fala || "").trim();

    // Responde chamadas extras (se houver) para não travar o modelo.
    for (const c of calls) {
      if (c !== call) this.sendToolResponse(c, "");
    }

    this.markActivity();

    if (!fala) {
      this.sendToolResponse(call, "Não entendi. Pode repetir?");
      return;
    }

    this.pendingTool = call;
    clearTimeout(this.toolTimer);
    this.toolTimer = setTimeout(() => {
      if (this.pendingTool === call) {
        this.sendToolResponse(call, "Tive um problema para pensar nisso agora. Pode repetir?");
      }
    }, TOOL_TIMEOUT_MS);

    this.userTurns += 1;
    this.setStatus("thinking");

    try { this.onUserTranscript(fala); } catch (_) {}
  }

  sendToolResponse(call, resposta) {
    if (!call) return false;
    if (this.pendingTool === call) {
      this.pendingTool = null;
      clearTimeout(this.toolTimer);
    }
    return this.send({
      toolResponse: {
        functionResponses: [
          {
            id: call.id,
            name: call.name,
            response: { resposta: String(resposta || "") },
          },
        ],
      },
    });
  }

  send(payload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  /* ─────────────── ÁUDIO DE SAÍDA ─────────────── */

  playChunk(b64) {
    if (!this.outCtx) return;
    const pcm = base64ToInt16(b64);
    if (!pcm.length) return;

    const buffer = this.outCtx.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const src = this.outCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.outCtx.destination);

    const now = this.outCtx.currentTime;
    const startAt = Math.max(now + 0.02, this.nextPlayTime);
    src.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;

    this.playing.add(src);
    this.setSpeaking(true);

    src.onended = () => {
      this.playing.delete(src);
      this.markActivity();
      if (this.playing.size === 0) this.setSpeaking(false);
    };
  }

  stopPlayback() {
    for (const src of this.playing) {
      try { src.stop(); } catch (_) {}
    }
    this.playing.clear();
    this.nextPlayTime = 0;
    this.setSpeaking(false);
  }

  /* ─────────────── API USADA PELA TELA ─────────────── */

  // Resposta do CONÉXIA: devolve à chamada pendente; senão, pede para dizer o texto.
  speak(text) {
    const clean = String(text || "").trim();
    if (!clean) return false;

    if (this.pendingTool) {
      return this.sendToolResponse(this.pendingTool, clean);
    }

    return this.send({ realtimeInput: { text: `DIGA: ${clean}` } });
  }

  sendText(text) {
    return this.speak(text);
  }

  // O Gemini recebe o contexto pela configuração da sessão; nada a enviar aqui.
  addContext() {
    return true;
  }

  // Interrupção local: para o áudio em reprodução.
  interrupt() {
    this.stopPlayback();
    return true;
  }

  mute() {
    this.micStream?.getAudioTracks().forEach((t) => { t.enabled = false; });
  }

  unmute() {
    this.micStream?.getAudioTracks().forEach((t) => { t.enabled = true; });
  }

  /* ─────────────── TRAVAS DE CUSTO ─────────────── */

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
      if (!this.isSpeaking && !this.pendingTool && now - this.lastActivityAt >= this.idleMs) {
        this.autoStop("idle");
      }
    }, 5000);

    this.onVisibility = () => {
      if (document.visibilityState === "hidden") this.autoStop("app_hidden");
    };
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  autoStop(reason) {
    if (!this.sessionStartedAt) return;
    try { this.onAutoStop(reason); } catch (_) {}
    this.disconnect(reason);
  }

  async reportSession(reason) {
    if (!this.sessionStartedAt) return;
    const startedAt = this.sessionStartedAt;
    this.sessionStartedAt = null;

    const payload = {
      started_at: new Date(startedAt).toISOString(),
      seconds: Math.round((Date.now() - startedAt) / 1000),
      end_reason: reason || "manual",
      user_turns: this.userTurns,
    };

    try {
      const token = await this.getAccessToken();
      if (!token) return;
      await fetch("/api/gemini-live-session?sessionlog=1", {
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
    clearTimeout(this.toolTimer);
    this.pendingTool = null;

    if (this.onVisibility) {
      document.removeEventListener("visibilitychange", this.onVisibility);
      this.onVisibility = null;
    }

    void this.reportSession(reason);

    this.stopPlayback();

    try { this.micNode?.port && (this.micNode.port.onmessage = null); } catch (_) {}
    try { this.micSource?.disconnect(); } catch (_) {}
    try { this.micNode?.disconnect(); } catch (_) {}
    this.micStream?.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });

    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.onmessage = null;
      try { ws.close(); } catch (_) {}
    }

    try { this.inCtx?.close(); } catch (_) {}
    try { this.outCtx?.close(); } catch (_) {}
    if (this.workletUrl) {
      try { URL.revokeObjectURL(this.workletUrl); } catch (_) {}
    }

    this.micStream = null;
    this.micSource = null;
    this.micNode = null;
    this.inCtx = null;
    this.outCtx = null;
    this.workletUrl = null;

    this.connected = false;
    this.connecting = false;
    this.setupDone = false;
    this.setStatus("idle");
  }
}
