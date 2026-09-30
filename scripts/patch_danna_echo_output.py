from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "src/lib/dannaGeminiLive.js"
text = path.read_text()

if "danna-echo-output-v1" in text:
    print("Saída de voz já corrigida.")
    raise SystemExit(0)

if "danna-mobile-echo-v1" in text:
    raise SystemExit(
        "Este arquivo contém a proteção com microfone pausado. "
        "Não aplicar sobre essa versão."
    )


def change(old, new):
    global text

    if text.count(old) != 1:
        raise SystemExit(
            "Arquivo diferente do esperado. Nada foi salvo: " + old[:90]
        )

    text = text.replace(old, new, 1)


text = (
    'import DannaEchoOutput, { needsEchoOutput } '
    'from "./dannaEchoOutput.js";\n'
    + text
)

change(
    '    this.outputSuppressed = false;\n  }',
    '''    this.outputSuppressed = false;
    // danna-echo-output-v1
    this.echoOutput = null;
  }'''
)

change(
    '    this.outCtx = new AC();',
    '    this.outCtx = new AC({ latencyHint: "interactive" });'
)

change(
    '''    try {
      await this.beforeConnect();''',
    '''    try {
      if (needsEchoOutput()) {
        this.echoOutput = new DannaEchoOutput(this.outCtx);
        await this.echoOutput.open();
      }
      await this.beforeConnect();'''
)

change(
    '          autoGainControl: true,',
    '          autoGainControl: !needsEchoOutput(),'
)

change(
    '    src.connect(this.outCtx.destination);',
    '''    this.echoOutput?.resume();
    src.connect(this.echoOutput?.input || this.outCtx.destination);'''
)

change(
    '  stopPlayback() {',
    '  stopPlayback() {\n    this.echoOutput?.interrupt();'
)

change(
    '  disconnect(reason = "manual") {',
    '''  disconnect(reason = "manual") {
    this.echoOutput?.close();
    this.echoOutput = null;'''
)

path.write_text(text)

print(
    "Saída WebRTC aplicada ao Gemini/Fish no celular, "
    "mantendo o microfone ativo."
)
