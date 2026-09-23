const LIVE_WS_URL =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained";

function ensureOpen(socket) {
  return socket && socket.readyState === WebSocket.OPEN;
}

export async function createGeminiLiveSession({
  systemInstruction =
    "Você é o CONÉXIA, especializado exclusivamente em inteligência relacional. Responda de forma natural, fluida, contextual e objetiva.",
  onOpen,
  onMessage,
  onAudio,
  onTranscript,
  onError,
  onClose,
} = {}) {
  const tokenResponse = await fetch("/api/gemini-live-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || !tokenData?.token) {
    throw new Error(
      tokenData?.error || "Não foi possível criar token para Gemini Live."
    );
  }

  const socket = new WebSocket(
    `${LIVE_WS_URL}?access_token=${encodeURIComponent(tokenData.token)}`
  );

  socket.onopen = () => {
    const setupMessage = {
      setup: {
        model: "models/gemini-3.8-live",
        responseModalities: ["AUDIO"],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [
            {
              text: systemInstruction
            }
          ]
        }
      }
    };

    socket.send(JSON.stringify(setupMessage));
    onOpen?.(socket);
  };

  socket.onmessage = event => {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch {
      onError?.(
        new Error("Resposta inválida do Gemini Live."),
        socket
      );
      return;
    }

    onMessage?.(message, socket);

    const serverContent = message?.serverContent;

    if (serverContent?.inputTranscription?.text) {
      onTranscript?.({
        type: "input",
        text: serverContent.inputTranscription.text
      });
    }

    if (serverContent?.outputTranscription?.text) {
      onTranscript?.({
        type: "output",
        text: serverContent.outputTranscription.text
      });
    }

    const parts = serverContent?.modelTurn?.parts || [];

    for (const part of parts) {
      if (part?.inlineData?.data) {
        onAudio?.({
          data: part.inlineData.data,
          mimeType:
            part.inlineData.mimeType ||
            "audio/pcm;rate=24000"
        });
      }
    }
  };

  socket.onerror = event => {
    onError?.(event, socket);
  };

  socket.onclose = event => {
    onClose?.(event);
  };

  return {
    socket,

    close() {
      try {
        socket.close();
      } catch {}
    },

    sendText(text) {
      if (!ensureOpen(socket)) return false;

      const clean = String(text || "").trim();
      if (!clean) return false;

      socket.send(
        JSON.stringify({
          realtimeInput: {
            text: clean
          }
        })
      );

      return true;
    },

    sendAudioChunk(base64Pcm16, sampleRate = 16000) {
      if (!ensureOpen(socket)) return false;
      if (!base64Pcm16) return false;

      socket.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              data: base64Pcm16,
              mimeType: `audio/pcm;rate=${sampleRate}`
            }
          }
        })
      );

      return true;
    },

    endAudioStream() {
      if (!ensureOpen(socket)) return false;

      socket.send(
        JSON.stringify({
          realtimeInput: {
            audioStreamEnd: true
          }
        })
      );

      return true;
    }
  };
}
