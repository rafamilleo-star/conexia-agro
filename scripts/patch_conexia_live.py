from pathlib import Path

p = Path("src/components/ConexiaLabHome.jsx")
s = p.read_text(encoding="utf-8")

if 'import DannaLive from "../lib/dannaLive";' not in s:
    s = s.replace(
        'import conexiaIcon from "../assets/brand/conexia_icone_transparente.svg";',
        'import conexiaIcon from "../assets/brand/conexia_icone_transparente.svg";\n'
        'import DannaLive from "../lib/dannaLive";'
    )

s = s.replace(
    '''  const recRef = useRef(null);
  const transcriptRef = useRef("");
  const conversationActiveRef = useRef(false);''',
    '''  const liveRef = useRef(null);
  const conversationActiveRef = useRef(false);'''
)

a = s.index("  const chooseVoice = () => {")
b = s.index("  const markFirstContactCompleted = async () => {")

voice = '''  const speak = (text, resumeListening = true) => {
    const raw = String(text || "").trim();

    if (!raw) return;

    addTurn("assistant", raw);

    if (!liveRef.current?.connected) {
      setAnswer(raw);
      setVoiceState("idle");
      return;
    }

    liveRef.current.speak(raw);
  };

  const stopListening = () => {};

  const startListening = () => {
    if (conversationActiveRef.current) {
      setVoiceState("listening");
    }
  };

  const stopConversation = () => {
    conversationActiveRef.current = false;
    greetedThisSessionRef.current = false;

    setConversationActive(false);

    try {
      liveRef.current?.disconnect();
    } catch {}

    liveRef.current = null;

    setVoiceState("idle");
  };

'''

s = s[:a] + voice + s[b:]

a = s.index("  const beginConversation = () => {")
b = s.index("  const findContactByName = (name) => {")

begin = '''  const beginConversation = async () => {
    if (conversationActiveRef.current) {
      stopConversation();
      return;
    }

    setCurrentView(v =>
      v === "saved" ? "today" : v
    );

    setInput("");
    setError("");
    setVoiceState("connecting");

    const live = new DannaLive({
      onState: setVoiceState,

      onUserTranscript: (spoken) => {
        const clean =
          String(spoken || "").trim();

        if (
          !clean ||
          !conversationActiveRef.current
        ) {
          return;
        }

        live.interrupt();

        setInput(clean);

        void handleUserTurn(clean);
      },

      onTranscript: () => {},

      onError: (err) => {
        setError(
          err?.message ||
          "Não consegui manter a conversa por voz."
        );

        setVoiceState("idle");
      }
    });

    liveRef.current = live;

    const ok = await live.connect();

    if (!ok) {
      conversationActiveRef.current = false;
      setConversationActive(false);
      return;
    }

    conversationActiveRef.current = true;

    setConversationActive(true);
    setVoiceState("listening");

    live.addContext(
      "Conversa de inteligência relacional no CONÉXIA. " +
      "Escute e aguarde o aplicativo enviar o conteúdo falado. " +
      "Nunca use a expressão 'o usuário'."
    );

    if (!greetedThisSessionRef.current) {
      greetedThisSessionRef.current = true;

      if (!firstContactCompleted) {
        void markFirstContactCompleted();

        const introName =
          displayName
            ? `${displayName}, `
            : "";

        speak(
          `${introName}eu sou a Danna, a inteligência relacional do CONÉXIA. ` +
          `Me conta uma pessoa importante para você hoje.`,
          true
        );

      } else {
        speak("Estou ouvindo.", true);
      }
    }
  };

'''

s = s[:a] + begin + s[b:]

s = s.replace(
    '''Extraia apenas o que está explícito.
Não invente.''',
    '''Extraia apenas o que está explícito.
Não invente.
A descrição será exibida como memória pessoal do dono da rede:
escreva em primeira pessoa.

É proibido narrar como observador externo usando "o usuário".'''
)

s = s.replace(
    '"description":"resumo fiel em 1 ou 2 frases",',
    '''"description":"resumo fiel em 1 ou 2 frases, SEMPRE na primeira pessoa do dono da relação. Ex.: 'Enviei ao Rafael um resumo para análise.' Nunca escreva 'o usuário enviou', 'o usuário pediu' ou 'o usuário informou'.",'''
)

for legacy in [
    "speechSynthesis",
    "SpeechSynthesisUtterance",
    "webkitSpeechRecognition",
    "SpeechRecognition"
]:
    if legacy in s:
        raise RuntimeError(
            "API antiga ainda presente: " + legacy
        )

p.write_text(
    s,
    encoding="utf-8"
)

print(
    "ConexiaLabHome.jsx atualizado para GPT-Live."
)
