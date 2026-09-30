from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "src/components/ConexiaLabHome.jsx"
text = path.read_text()

if "danna-capture-v1" in text:
    print("Captura já corrigida.")
    raise SystemExit(0)


def change(old, new):
    global text
    if text.count(old) != 1:
        raise SystemExit(
            "Arquivo diferente do esperado. Nada foi salvo: " + old[:80]
        )
    text = text.replace(old, new, 1)


text = (
    'import { saveDannaCapture, linkDannaCapture, updateDannaContact, '
    'capturePerson } from "../lib/dannaCapture.js";\n'
    + text
)

change(
    '  const [draft, setDraft] = useState(null);',
    '''  // danna-capture-v1
  const [draft, setDraft] = useState(null);
  const [pendingContact, setPendingContact] = useState(null);
  const [contactNameInput, setContactNameInput] = useState("");
  const pendingContactRef = useRef(null);
  const captureBusyRef = useRef(false);'''
)

change(
    '    setDraft(parsed);',
    '''    parsed.sourceText = text;
    const exactMatches = contacts.filter(c =>
      parsed.contactName && normalize(c.name) === normalize(parsed.contactName)
    );
    if (!contacts.some(c => c.id === parsed.existingContactId)) {
      parsed.existingContactId = null;
    }
    if (parsed.contactName) {
      parsed.existingContactId = exactMatches.length === 1 ? exactMatches[0].id : null;
    }
    setDraft(parsed);'''
)

change(
    'person: contactName(i.contact_id) || "desconhecido",',
    'person: contactName(i.contact_id) || capturePerson(i.description) || "a identificar",'
)

change(
    '    if (currentView === "capture" && draft) {',
    '''    if (pendingContactRef.current) {
      if (/^(sim|pode|pode adicionar|pode cadastrar|quero|adiciona|adicionar|adicionar agora|cadastra|cadastrar|cadastrar agora)[.! ]*$/.test(n)) {
        await addCapturedContact();
        return;
      }
      if (/^(nao|agora nao|nao agora|depois|mais tarde|nao quero)[.! ]*$/.test(n)) {
        declineCapturedContact();
        return;
      }
      const named = /^(?:adicionar|cadastrar)\\s+(.+?)[.!]*$/i.exec(line);
      if (named) {
        await addCapturedContact(named[1]);
        return;
      }
    }

    if (currentView === "capture" && draft) {'''
)

start = text.index('  const confirmCapture = async () => {')
end = text.index('  const askWhy =', start)

text = text[:start] + '''  const refreshCaptureData = async () => {
    try { await onDataChanged?.(); }
    catch (error) {
      console.warn("[Danna] Registro salvo; atualização da tela falhou:", error);
    }
  };

  const rememberCapture = saved => {
    lastSavedContextRef.current = saved;
    sessionContextRef.current.lastSavedInteraction = saved;
    sessionContextRef.current.activePerson = saved.contactName;
    sessionContextRef.current.activePeople =
      saved.contactName ? [saved.contactName] : [];
    sessionContextRef.current.activeTopics = saved.tags || [];
    sessionContextRef.current.lastView = "saved";
  };

  const declineCapturedContact = () => {
    pendingContactRef.current = null;
    setPendingContact(null);
    const message =
      "Tudo bem. O relato continua salvo, sem adicionar a pessoa à sua rede.";
    setAnswer(message);
    speak(message, true);
  };

  const addCapturedContact = async explicitName => {
    const saved = pendingContactRef.current;
    if (!saved || captureBusyRef.current) return;

    const name = String(
      explicitName || contactNameInput || saved.contactName || ""
    ).trim();

    if (!name) {
      const message =
        "O relato já está salvo. Para cadastrar, diga 'adicionar' seguido do nome da pessoa, ou escreva o nome abaixo.";
      setAnswer(message);
      speak(message, true);
      return;
    }

    captureBusyRef.current = true;
    setError("");

    try {
      const linked = await linkDannaCapture(supabase, userId, saved, name);
      rememberCapture(linked);
      pendingContactRef.current = null;
      setPendingContact(null);

      try { await updateDannaContact(supabase, userId, linked); }
      catch (error) {
        console.warn("[Danna] Pessoa vinculada; próximo passo não atualizado:", error);
      }

      const message =
        `Pronto. ${linked.contactName} está na sua rede e vinculado ao relato que já salvei.`;
      setAnswer(message);
      await refreshCaptureData();
      speak(message, true);
    } catch (error) {
      setError(
        `Seu relato está salvo. Não consegui concluir o cadastro: ${error.message}`
      );
      setVoiceState("listening");
    } finally {
      captureBusyRef.current = false;
    }
  };

  const confirmCapture = async () => {
    if (!draft || captureBusyRef.current) return;

    captureBusyRef.current = true;
    setVoiceState("thinking");
    setError("");

    try {
      const saved = await saveDannaCapture(supabase, userId, draft, contacts);
      rememberCapture(saved);
      setDraft(null);

      pendingContactRef.current = saved.needsContact ? saved : null;
      setPendingContact(pendingContactRef.current);
      setContactNameInput(saved.contactName || "");

      let message;

      if (saved.needsContact) {
        message = saved.contactName
          ? `Registrei o relato. Vi que ${saved.contactName} não está na sua lista. Você quer adicionar essa pessoa agora?`
          : "Registrei o relato. Não consegui identificar o nome da pessoa. Se quiser cadastrá-la, diga 'adicionar' seguido do nome. Você também pode deixar para depois.";
      } else {
        message = `Pronto. Registrei com ${saved.contactName || "essa pessoa"}.`;

        try { await updateDannaContact(supabase, userId, saved); }
        catch (error) {
          console.warn("[Danna] Relato salvo; próximo passo não atualizado:", error);
        }
      }

      setAnswer(message);
      setCurrentView("saved");
      await refreshCaptureData();
      speak(message, true);
    } catch (error) {
      setError(`Não consegui salvar o relato: ${error.message}`);
      setVoiceState("idle");
    } finally {
      captureBusyRef.current = false;
    }
  };

''' + text[end:]

change(
    '''              {answer}
            </div>
          </div>
        )}''',
    '''              {answer}
            </div>
            {pendingContact && (
              <div style={{ marginTop: 16 }}>
                <input
                  aria-label="Nome da pessoa para adicionar"
                  placeholder="Nome da pessoa"
                  value={contactNameInput}
                  onChange={event => setContactNameInput(event.target.value)}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    marginBottom: 12,
                    maxWidth: "100%",
                  }}
                />
                <div style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                }}>
                  <button
                    onClick={() => addCapturedContact()}
                    style={secondaryButton}
                  >
                    Adicionar agora
                  </button>
                  <button
                    onClick={declineCapturedContact}
                    style={secondaryButton}
                  >
                    Agora não
                  </button>
                </div>
              </div>
            )}
          </div>
        )}'''
)

path.write_text(text)
print("Captura corrigida: salva antes de oferecer cadastro.")
