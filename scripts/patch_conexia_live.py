from pathlib import Path

# ============================================================
# DANNA LIVE — CORREÇÃO DEFINITIVA DE VOZ + BARGE-IN
# ============================================================

danna_path = Path("src/lib/dannaLive.js")

danna = r'''export class DannaLive {
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
'''

danna_path.write_text(
    danna,
    encoding="utf-8"
)

print("✓ dannaLive.js corrigido")


# ============================================================
# GPT-LIVE SESSION
# ============================================================

session_path = Path(
    "api/openai-live-session.js"
)

session = r'''export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error:
        "OPENAI_API_KEY não configurada"
    });
  }

  const sdp =
    String(req.body?.sdp || "").trim();

  if (!sdp) {
    return res.status(400).json({
      error: "SDP offer ausente"
    });
  }

  try {
    const response = await fetch(
      "https://api.openai.com/v1/live/sessions",
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${apiKey}`,

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          session: {
            model: "gpt-live-1",

            store: false,

            delegation: {
              type: "client"
            },

            instructions: `
Você é Danna, a inteligência relacional por voz do CONÉXIA.

IDENTIDADE
Você conversa, não apresenta.
Você não é URA.
Você não é narradora.
Você não é atendente de call center.
Você não é uma assistente genérica.

IDIOMA E VOZ
Fale sempre em português brasileiro natural.

Use:
- ritmo de conversa presencial;
- frases curtas;
- pausas naturais;
- entonação humana;
- pequenas variações naturais de ritmo;
- tom próximo, seguro e inteligente.

Evite:
- voz de locução;
- cadência de apresentação;
- frases excessivamente formais;
- leitura mecânica;
- listas faladas;
- repetir a pergunta;
- anunciar o que vai fazer.

CONVERSA
Escute continuamente, inclusive enquanto estiver falando.

INTERRUPÇÃO
A interrupção do interlocutor tem prioridade absoluta.

Se ele começar a falar enquanto você estiver falando:
- pare imediatamente;
- ceda o turno;
- não conclua a frase;
- não continue falando por cima;
- não repita o trecho interrompido;
- escute até ele concluir;
- responda ao que ele acabou de dizer.

Uma interrupção significa que o interlocutor passou a ter a palavra.

BACKEND
O aplicativo CONÉXIA possui uma camada própria de inteligência relacional.

Quando receber session.commentary.append:
- transforme o conteúdo em fala natural;
- preserve os fatos;
- não leia mecanicamente;
- não acrescente fatos;
- não transforme em relatório;
- não acrescente uma pergunta desnecessária.

Quando receber session.thinking.append:
use como contexto silencioso.
Não leia esse conteúdo automaticamente.

CONÉXIA
CONÉXIA é inteligência relacional.
Não é CRM.
Não use linguagem de pipeline, lead ou funil.

MEMÓRIA
Nunca diga que uma informação foi salva antes de confirmação explícita.

PERSPECTIVA
Nunca chame Rafael de "o usuário".

Quando descrever algo que Rafael fez, use primeira pessoa quando o texto for apresentado como memória dele.

Exemplo:
"Enviei ao Rafael Marcon um resumo para análise."

Nunca:
"O usuário enviou..."
"O usuário pediu..."
"O usuário informou..."

ESTILO
Prefira uma resposta humana de duas frases a um discurso de seis.
Se uma frase basta, use uma frase.
            `.trim(),

            audio: {
              output: {
                // FORÇADO durante a validação.
                // Não permite que uma variável antiga
                // da Vercel substitua Bossa por Marin.
                voice: "bossa"
              }
            }
          },

          transport: {
            type: "webrtc",
            sdp
          }
        })
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "[GPT-Live session]",
        data
      );

      return res
        .status(response.status)
        .json({
          error:
            "Não foi possível iniciar GPT-Live",
          details: data
        });
    }

    return res
      .status(201)
      .json(data);

  } catch (error) {
    console.error(
      "[GPT-Live session]",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao criar sessão GPT-Live",
      details:
        error?.message ||
        String(error)
    });
  }
}
'''

session_path.write_text(
    session,
    encoding="utf-8"
)

print("✓ openai-live-session.js corrigido")


# ============================================================
# VERIFICAÇÕES
# ============================================================

danna_check = danna_path.read_text(encoding="utf-8")
session_check = session_path.read_text(encoding="utf-8")

assert "audio.muted = true" not in danna_check
assert "audio.muted = false" not in danna_check
assert "session.input_transcript.delta" in danna_check
assert "session.instructions.append" in danna_check

assert 'voice: "bossa"' in session_check
assert 'model: "gpt-live-1"' in session_check
assert "process.env.OPENAI_LIVE_VOICE" not in session_check

print("")
print("====================================")
print("DANNA GPT-LIVE V2 PRONTA")
print("Bossa BR forcada")
print("mute/unmute antigo removido")
print("interrupcao antecipada")
print("WebRTC mantido full-duplex")
print("====================================")
