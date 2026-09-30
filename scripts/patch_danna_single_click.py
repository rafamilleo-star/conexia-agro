from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
app_path = ROOT / "src/App.jsx"
home_path = ROOT / "src/components/ConexiaLabHome.jsx"
app = app_path.read_text()
home = home_path.read_text()

if "danna-single-click-v1" in app and "danna-single-click-v1" in home:
    print("Danna: ajuste já aplicado.")
    raise SystemExit(0)


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit(
            "Arquivo diferente do esperado. Nenhum arquivo foi salvo: "
            + old[:90]
        )
    return text.replace(old, new, 1)


app = 'import { flushSync } from "react-dom";\n' + app

app = replace_once(
    app,
    '  const [dannaPref, setDannaPref] = useState(null);',
    '''  // danna-single-click-v1
  const dannaStartRef = useRef(null);
  const [dannaPref, setDannaPref] = useState(null);'''
)

app = replace_once(
    app,
    '  // Voz BETA: somente pagantes',
    '''  const openDannaConversation = () => {
    flushSync(() => setDannaHome(true));
    dannaStartRef.current?.start();
  };
  // Voz BETA: somente pagantes'''
)

app = replace_once(
    app,
    '        <ConexiaLabHome\n',
    '        <ConexiaLabHome\n          ref={dannaStartRef}\n'
)

app = replace_once(
    app,
    'onClick={() => setDannaHome(true)}',
    'onClick={openDannaConversation}'
)

home = replace_once(
    home,
    'import React, { useEffect, useMemo, useRef, useState } from "react";',
    'import React, { forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useState } from "react";'
)

home = replace_once(
    home,
    'export default function ConexiaLabHome({',
    'const ConexiaLabHome = forwardRef(function ConexiaLabHome({'
)

home = replace_once(
    home,
    '  voiceEngine = "openai",\n}) {',
    '  voiceEngine = "openai",\n}, ref) {'
)

home = replace_once(
    home,
    '  const greetedThisSessionRef = useRef(false);',
    '''  // danna-single-click-v1
  const preferencesReadyRef = useRef(Promise.resolve(null));
  const greetedThisSessionRef = useRef(false);'''
)

home = replace_once(
    home,
    '''    (async () => {
      if (!userId) return;

      setPrefsLoading(true);''',
    '''    preferencesReadyRef.current = (async () => {
      if (!userId) return null;

      setPrefsLoading(true);'''
)

home = replace_once(
    home,
    '''      setProfileSnapshot(prof || null);
      setPrefsLoading(false);
    })();''',
    '''      setProfileSnapshot(prof || null);
      setPrefsLoading(false);
      return { prefs: p, profile: prof };
    })().catch(error => {
      console.warn("[Danna] Perfil indisponível:", error);
      if (alive) setPrefsLoading(false);
      return null;
    });'''
)

home = replace_once(
    home,
    '''    conversationActiveRef.current = true;

    setConversationActive(true);''',
    '''    if (liveRef.current !== live) {
      live.disconnect("opening_cancelled");
      return;
    }
    conversationActiveRef.current = true;

    setConversationActive(true);'''
)

start = home.index(
    '    if (!greetedThisSessionRef.current) {',
    home.index('  const beginConversation')
)
end = home.index('  const findContactByName', start)

home = home[:start] + '''    const greetingTurn = ++turnSeqRef.current;
    const loaded = await preferencesReadyRef.current;
    if (isStaleTurn(greetingTurn) || liveRef.current !== live ||
        !conversationActiveRef.current) return;
    if (greetedThisSessionRef.current) return;

    const openingPrefs = loaded?.prefs || prefs;
    const openingProfile = loaded?.profile || profileSnapshot;
    const openingName = String(
      openingPrefs?.preferred_name || openingProfile?.first_name ||
      openingProfile?.name || firstName || ""
    ).trim().split(/\\s+/)[0] || "";
    const openingTimeZone = openingProfile?.timezone || timeZone;
    let storedFirstContact = false;
    try {
      storedFirstContact = Boolean(
        firstContactStorageKey && window.localStorage.getItem(firstContactStorageKey)
      );
    } catch {}

    if (!openingPrefs?.first_contact_completed && !storedFirstContact) {
      speak(
        `Oi${openingName ? `, ${openingName}` : ""}. Eu sou a Danna, ` +
        "a inteligência relacional do CONÉXIA. Me conta uma pessoa importante para você hoje.",
        true
      );
      greetedThisSessionRef.current = true;
      void markFirstContactCompleted();
      return;
    }

    let brain = null;
    try {
      brain = await loadDannaKnowledge();
    } catch (error) {
      console.warn("[Danna] Abertura sem snapshot:", error);
    }
    if (isStaleTurn(greetingTurn) || liveRef.current !== live ||
        !conversationActiveRef.current) return;

    speak(buildDannaGreeting(brain, openingName, openingTimeZone), true);
    greetedThisSessionRef.current = true;
  };

  useImperativeHandle(ref, () => ({
    start() {
      if (!liveRef.current && !conversationActiveRef.current) {
        void beginConversation();
      }
    },
  }));

''' + home[end:]

if not home.rstrip().endswith('}'):
    raise SystemExit(
        "Final de ConexiaLabHome inesperado. Nenhum arquivo foi salvo."
    )

home = home.rstrip()[:-1] + '});\n\nexport default ConexiaLabHome;\n'

app_path.write_text(app)
home_path.write_text(home)
print("Danna: clique único e saudação após conexão aplicados.")
