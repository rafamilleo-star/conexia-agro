#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "src/lib/dannaGeminiLive.js"
MARKER = "// gemini-echo-gate-v2"

METHODS = r'''
  // gemini-echo-gate-v2
  acceptGeminiMic(buffer) {
    if (this.engine !== "gemini") return true;
    if (this.geminiMicHeld || this.geminiManualMuted) return false;

    const pcm = new Int16Array(buffer);
    if (!pcm.length) return false;

    let energy = 0;
    for (const sample of pcm) {
      energy += (sample / 32768) ** 2;
    }

    const rms = Math.sqrt(energy / pcm.length);

    this.geminiSpeechMs = rms >= 0.005
      ? this.geminiSpeechMs + pcm.length / INPUT_RATE * 1000
      : 0;

    if (this.geminiSpeechMs >= 128) {
      this.geminiFreshSpeech = true;
    }

    return true;
  }

  holdGeminiMic() {
    if (this.engine !== "gemini") return;

    clearTimeout(this.geminiReleaseTimer);
    this.geminiReleaseTimer = null;
    this.geminiMicHeld = true;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;

    for (const track of this.micStream?.getAudioTracks() || []) {
      if (!this.geminiTrackStates.has(track)) {
        this.geminiTrackStates.set(track, track.enabled);
      }

      track.enabled = false;
    }
  }

  releaseGeminiMicWhenDone() {
    if (this.engine !== "gemini" || !this.geminiMicHeld) return;
    if (this.geminiOutputOpen || this.playing.size) return;

    clearTimeout(this.geminiReleaseTimer);

    this.geminiReleaseTimer = setTimeout(() => {
      this.geminiReleaseTimer = null;

      if (
        !this.connected ||
        this.geminiOutputOpen ||
        this.playing.size
      ) {
        return;
      }

      for (const [track, enabled] of this.geminiTrackStates) {
        if (track.readyState !== "ended") {
          track.enabled = enabled && !this.geminiManualMuted;
        }
      }

      this.geminiTrackStates.clear();
      this.geminiMicHeld = false;
      this.geminiFreshSpeech = false;
      this.geminiSpeechMs = 0;
      this.setStatus("listening");
    }, 700);
  }

'''


def once(text, old, new, label):
    count = text.count(old)

    if count != 1:
        raise RuntimeError(
            f"{label}: encontrados {count} trechos. "
            "Nenhum arquivo alterado."
        )

    return text.replace(old, new, 1)


def main():
    text = TARGET.read_text(encoding="utf-8")

    if MARKER in text:
        print("Correção Gemini já aplicada.")
        return

    text = once(
        text,
        "    this.localBargeIn = false;",
        '''    this.localBargeIn = false;
    this.geminiMicHeld = false;
    this.geminiOutputOpen = false;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;
    this.geminiManualMuted = false;
    this.geminiReleaseTimer = null;
    this.geminiTrackStates = new Map();''',
        "Estado de proteção",
    )

    text = once(
        text,
        "    if (this.isSpeaking === next) return;",
        '''    if (this.engine === "gemini") {
      if (next) this.holdGeminiMic();
      else this.releaseGeminiMicWhenDone();
    }

    if (this.isSpeaking === next) return;''',
        "Estado de reprodução",
    )

    text = once(
        text,
        "  async startMic() {",
        METHODS + "  async startMic() {",
        "Métodos de proteção",
    )

    text = once(
        text,
        "      if (this.localBargeIn) {",
        '''      if (!this.acceptGeminiMic(event.data)) return;

      if (this.localBargeIn) {''',
        "Envio do microfone",
    )

    text = once(
        text,
        "    if (sc.interrupted) {",
        '''    if (sc.interrupted && (this.engine !== "gemini" ||
        (!this.geminiMicHeld && this.geminiFreshSpeech))) {''',
        "Interrupção remota",
    )

    text = once(
        text,
        "    if (sc.turnComplete) {",
        '''    if (sc.turnComplete) {
      if (this.engine === "gemini") {
        this.geminiOutputOpen = false;
        this.releaseGeminiMicWhenDone();
      }''',
        "Fim da geração de áudio",
    )

    text = once(
        text,
        "  handleToolCall(calls) {",
        '''  handleToolCall(calls) {
    if (this.engine === "gemini") {
      if (this.geminiMicHeld || !this.geminiFreshSpeech) {
        if (!this.geminiMicHeld) this.outputSuppressed = true;

        for (const call of calls) {
          this.sendToolResponse(call, "");
        }

        return;
      }

      this.geminiFreshSpeech = false;
      this.geminiSpeechMs = 0;
    }''',
        "Transcrição atrasada",
    )

    text = once(
        text,
        '''    if (!pcm.length) return;

    const buffer = this.outCtx.createBuffer(''',
        '''    if (!pcm.length) return;

    if (this.engine === "gemini") {
      this.geminiOutputOpen = true;
      this.holdGeminiMic();
    }

    const buffer = this.outCtx.createBuffer(''',
        "Início real do áudio",
    )

    text = once(
        text,
        "  stopPlayback() {",
        '''  stopPlayback() {
    if (this.engine === "gemini") {
      this.geminiOutputOpen = false;
    }''',
        "Parada manual",
    )

    text = once(
        text,
        "  mute() {",
        '''  mute() {
    if (this.engine === "gemini") {
      this.geminiManualMuted = true;
    }''',
        "Mute manual",
    )

    text = once(
        text,
        "  unmute() {",
        '''  unmute() {
    if (this.engine === "gemini") {
      this.geminiManualMuted = false;

      if (this.geminiMicHeld) {
        for (const track of this.geminiTrackStates.keys()) {
          this.geminiTrackStates.set(track, true);
        }

        return;
      }
    }''',
        "Reabertura manual",
    )

    text = once(
        text,
        '''    this.connected = false;
    this.connecting = false;
    this.setupDone = false;
    this.setStatus("idle");''',
        '''    this.connected = false;
    this.connecting = false;
    this.setupDone = false;

    clearTimeout(this.geminiReleaseTimer);
    this.geminiReleaseTimer = null;
    this.geminiTrackStates.clear();
    this.geminiMicHeld = false;
    this.geminiOutputOpen = false;
    this.geminiFreshSpeech = false;
    this.geminiSpeechMs = 0;

    this.setStatus("idle");''',
        "Limpeza da sessão",
    )

    TARGET.write_text(text, encoding="utf-8")

    print(
        "Gemini corrigido: bloqueio de envio durante a fala "
        "e descarte de transcrição sem nova fala."
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERRO: {error}", file=sys.stderr)
        sys.exit(1)
