// src/components/ConexiaLabHome.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { computePriorities } from "../../shared/priorityEngine.js";
import { detectPatterns, PATTERN_NOTES } from "../../shared/relationshipPatternDetector.js";
import conexiaIcon from "../assets/brand/conexia_icone_transparente.svg";
import DannaLive from "../lib/dannaLive";
import DannaGeminiLive from "../lib/dannaGeminiLive";

const K = {
  bg: "#0D0D0F",
  card: "#151516",
  card2: "#1B1B1D",
  border: "#2A2927",
  text: "#F1EDE6",
  muted: "#9A938B",
  gold: "#C9A84C",
  green: "#5FA66F",
  red: "#D66A62",
};

const sans = "'DM Sans', sans-serif";
const serif = "'Cormorant Garamond', serif";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const interactionDate = (i) => i?.created_at || i?.createdAt || null;
const interactionContactId = (i) => i?.contact_id || i?.contactId || null;

function firstJson(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function getHourInTimezone(timeZone = "America/Sao_Paulo") {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find(p => p.type === "hour")?.value);
    return Number.isFinite(hour) ? hour : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

function greetingForNow(name = "", timeZone = "America/Sao_Paulo") {
  const h = getHourInTimezone(timeZone);
  const g = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${g}${name ? `, ${name}` : ""}.`;
}

function daysSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function pickInvisiblePending(interactions, contacts) {
  const contactMap = new Map((contacts || []).map(c => [c.id, c]));
  const signal = /(vou\s+(mandar|enviar|apresentar|verificar|retornar|ligar)|vamos\s+(falar|marcar|combinar)|combin(ei|amos)|me\s+lembra|ficou\s+de|interessad[oa]|precisa\s+de|est[aá]\s+procurando|quer\s+conhecer|depois\s+(falamos|vemos))/i;

  return [...(interactions || [])]
    .filter(i => signal.test(i?.description || i?.note || i?.notes || ""))
    .sort((a,b) => new Date(interactionDate(b) || 0) - new Date(interactionDate(a) || 0))
    .map(i => ({
      interaction: i,
      contact: contactMap.get(interactionContactId(i)),
      text: i?.description || i?.note || i?.notes || "",
      age: daysSince(interactionDate(i)),
    }))
    .find(x => x.contact && x.text) || null;
}

function VoiceOrb({ state, active, onClick }) {
  const listening = state === "listening";
  const thinking = state === "thinking";
  const speaking = state === "speaking";

  const label =
    listening
      ? "Ouvindo"
      : thinking
        ? "Pensando"
        : speaking
          ? "Falando"
          : active
            ? "Conversando"
            : "Conversar";

  return (
    <>
      <style>{`
        @keyframes conexiaBreath {
          0%,100% { transform: scale(1); opacity:.94; }
          50% { transform: scale(1.055); opacity:1; }
        }

        @keyframes conexiaThink {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes conexiaSpeak {
          0%,100% { transform: scale(1); }
          35% { transform: scale(1.045); }
          68% { transform: scale(.985); }
        }

        @keyframes conexiaRing {
          0%,100% {
            transform: scale(1);
            opacity:.45;
          }
          50% {
            transform: scale(1.045);
            opacity:.9;
          }
        }
      `}</style>

      <div
        style={{
          width: 216,
          minHeight: 248,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
        }}
      >
        <button
          onClick={onClick}
          aria-label={active ? "Encerrar conversa" : "Iniciar conversa"}
          style={{
            position: "relative",
            width: 196,
            height: 196,
            borderRadius: "50%",
            padding: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 5,
              borderRadius: "50%",
              border: `1px solid ${active ? `${K.gold}B8` : `${K.gold}55`}`,
              boxShadow: active
                ? `0 0 46px ${K.gold}16, inset 0 0 34px ${K.gold}0B`
                : `0 0 26px rgba(0,0,0,.25)`,
              animation: active ? "conexiaRing 2.2s ease-in-out infinite" : "none",
              transition: "border-color .25s ease, box-shadow .25s ease",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: 18,
              borderRadius: "50%",
              background: `radial-gradient(circle at 50% 45%, ${K.gold}10 0%, ${K.card} 50%, ${K.bg} 100%)`,
              border: `1px solid ${K.gold}24`,
            }}
          />

          <div
            style={{
              position: "relative",
              width: 104,
              height: 104,
              display: "grid",
              placeItems: "center",
              animation: thinking
                ? "conexiaThink 6.5s linear infinite"
                : speaking
                  ? "conexiaSpeak 1.25s ease-in-out infinite"
                  : listening
                    ? "conexiaBreath 1.65s ease-in-out infinite"
                    : active
                      ? "conexiaBreath 3.2s ease-in-out infinite"
                      : "none",
              filter: active
                ? "drop-shadow(0 0 14px rgba(201,168,76,.34))"
                : "drop-shadow(0 0 6px rgba(201,168,76,.12))",
              transformOrigin: "50% 50%",
            }}
          >
            <img
              src={conexiaIcon}
              alt=""
              draggable="false"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        </button>

        <div
          style={{
            color: active ? K.gold : K.text,
            fontFamily: sans,
            fontSize: 18,
            fontWeight: 800,
            marginTop: 4,
            letterSpacing: "-.01em",
          }}
        >
          {label}
        </div>

        <div
          style={{
            color: K.muted,
            fontFamily: sans,
            fontSize: 11,
            marginTop: 5,
          }}
        >
          {active ? "toque para encerrar" : "toque para iniciar"}
        </div>
      </div>
    </>
  );
}

function PersonMini({ person }) {
  const initials = String(person?.name || "?")
    .split(/\s+/)
    .map(x => x[0])
    .join("")
    .slice(0,2)
    .toUpperCase();

  return (
    <div style={{ minWidth: 120, textAlign: "center" }}>
      <div style={{
        width: 54,
        height: 54,
        borderRadius: "50%",
        margin: "0 auto 7px",
        border: `1px solid ${K.gold}80`,
        background: K.card2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: K.gold,
        fontFamily: sans,
        fontWeight: 800,
      }}>
        {initials}
      </div>

      <div style={{ color: K.text, fontFamily: sans, fontSize: 13, fontWeight: 800 }}>
        {person?.name || "Pessoa"}
      </div>

      <div style={{ color: K.muted, fontFamily: sans, fontSize: 10, marginTop: 2 }}>
        {[person?.company, person?.role].filter(Boolean).join(" · ") || "sua rede"}
      </div>
    </div>
  );
}

function ConnectionView({ people = [], topics = [], answer, onWhy, onCreateBridge, onTomorrow }) {
  const [a,b] = people;

  return (
    <div>
      <div style={{
        color: K.gold,
        fontFamily: sans,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        marginBottom: 10,
      }}>
        POSSÍVEL PONTE
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        background: K.card2,
        border: `1px solid ${K.gold}40`,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}>
        <PersonMini person={a} />

        <div style={{ textAlign: "center", minWidth: 110 }}>
          <div style={{
            height: 1,
            background: `linear-gradient(90deg, transparent, ${K.gold}, transparent)`,
            marginBottom: 8,
          }} />

          <div style={{ color: K.gold, fontFamily: sans, fontSize: 10, fontWeight: 800 }}>
            CONEXÃO POR
          </div>

          <div style={{ display: "flex", gap: 5, justifyContent: "center", flexWrap: "wrap", marginTop: 6 }}>
            {(topics.length ? topics : ["contexto"]).slice(0,3).map(t => (
              <span
                key={t}
                style={{
                  border: `1px solid ${K.gold}50`,
                  borderRadius: 999,
                  padding: "4px 7px",
                  color: K.text,
                  fontFamily: sans,
                  fontSize: 10,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <PersonMini person={b} />
      </div>

      {answer && (
        <div style={{ color: K.text, fontFamily: sans, fontSize: 13.5, lineHeight: 1.6, marginTop: 14 }}>
          {answer}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button onClick={onWhy} style={secondaryButton}>Por quê?</button>
        <button onClick={onCreateBridge} style={primaryButton}>Criar ponte</button>
        <button onClick={onTomorrow} style={secondaryButton}>Lembrar amanhã</button>
      </div>
    </div>
  );
}

function CaptureView({ draft, onConfirm, onCorrect }) {
  return (
    <div>
      <div style={{
        color: K.gold,
        fontFamily: sans,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        marginBottom: 9,
      }}>
        ENTENDI ISTO
      </div>

      <div style={{ color: K.text, fontFamily: serif, fontSize: 28, fontWeight: 700, marginBottom: 7 }}>
        {draft?.contactName || "Nova interação"}
      </div>

      <div style={{ color: K.muted, fontFamily: sans, fontSize: 13, lineHeight: 1.6 }}>
        {draft?.description}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        {[
          draft?.company && `Empresa: ${draft.company}`,
          draft?.role && `Cargo: ${draft.role}`,
          draft?.interactionType && `Tipo: ${draft.interactionType}`,
          draft?.nextAction && `Próximo passo: ${draft.nextAction}`,
          draft?.nextActionDate && `Data: ${draft.nextActionDate}`,
        ].filter(Boolean).map(v => (
          <span key={v} style={chip}>{v}</span>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <button onClick={onConfirm} style={{ ...primaryButton, background: K.green, color: "#0A0D0B" }}>
          Confirmar e salvar
        </button>
        <button onClick={onCorrect} style={secondaryButton}>Corrigir</button>
      </div>
    </div>
  );
}

function AnswerView({ question, answer }) {
  return (
    <div>
      {question && (
        <div style={{
          marginLeft: "auto",
          maxWidth: "82%",
          background: K.card2,
          border: `1px solid ${K.border}`,
          borderRadius: "14px 14px 4px 14px",
          padding: "10px 12px",
          color: K.muted,
          fontFamily: sans,
          fontSize: 12.5,
          lineHeight: 1.5,
          marginBottom: 12,
        }}>
          {question}
        </div>
      )}

      <div style={{
        maxWidth: "92%",
        background: `${K.gold}0D`,
        border: `1px solid ${K.gold}35`,
        borderRadius: "14px 14px 14px 4px",
        padding: "14px 15px",
      }}>
        <div style={{
          color: K.gold,
          fontFamily: sans,
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: ".1em",
          marginBottom: 5,
        }}>
          CONÉXIA
        </div>

        <div style={{ color: K.text, fontFamily: sans, fontSize: 14, lineHeight: 1.65 }}>
          {answer}
        </div>
      </div>
    </div>
  );
}

function InsightView({ title, body, onOpen }) {
  return (
    <div>
      <div style={{
        color: K.gold,
        fontFamily: sans,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}>
        OLHE ISSO
      </div>

      <div style={{ color: K.text, fontFamily: serif, fontSize: 27, fontWeight: 700 }}>
        {title}
      </div>

      <div style={{ color: K.muted, fontFamily: sans, fontSize: 13, lineHeight: 1.6, marginTop: 7 }}>
        {body}
      </div>

      {onOpen && (
        <button onClick={onOpen} style={{ ...secondaryButton, marginTop: 13 }}>
          Abrir pessoa
        </button>
      )}
    </div>
  );
}

const chip = {
  border: `1px solid ${K.border}`,
  background: K.card2,
  color: K.text,
  borderRadius: 999,
  padding: "7px 10px",
  fontFamily: sans,
  fontSize: 11,
};

const primaryButton = {
  background: K.gold,
  color: K.bg,
  border: "none",
  borderRadius: 10,
  padding: "11px 15px",
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton = {
  background: "transparent",
  color: K.text,
  border: `1px solid ${K.border}`,
  borderRadius: 10,
  padding: "11px 14px",
  fontFamily: sans,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};

export default function ConexiaLabHome({
  userId,
  firstName,
  contacts = [],
  interactions = [],
  onOpenContact,
  onDataChanged,
  voiceEngine = "openai",
}) {
  const [prefs, setPrefs] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  const [conversationActive, setConversationActive] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");
  const [currentView, setCurrentView] = useState("today");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [draft, setDraft] = useState(null);
  const [connectionData, setConnectionData] = useState(null);
  const [error, setError] = useState("");
  const [showText, setShowText] = useState(false);
  const [textInput, setTextInput] = useState("");

  const liveRef = useRef(null);
  const conversationActiveRef = useRef(false);
  const greetedThisSessionRef = useRef(false);

  const recentTurnsRef = useRef([]);
  const lastSavedContextRef = useRef(null);

  const sessionContextRef = useRef({
    activePerson: null,
    activePeople: [],
    activeTopics: [],
    lastView: "today",
    lastQuestion: "",
    lastSavedInteraction: null,
  });

  // Ao sair da tela (voltar ao painel, trocar de motor), encerra a voz na hora:
  // sessão aberta é cobrada por minuto.
  useEffect(() => {
    return () => {
      try { liveRef.current?.disconnect("unmount"); } catch {}
      liveRef.current = null;
    };
  }, []);

  const addTurn = (role, content) => {
    const line = String(content || "").trim();
    if (!line) return;

    recentTurnsRef.current = [
      ...recentTurnsRef.current,
      { role, content: line },
    ].slice(-10);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!userId) return;

      setPrefsLoading(true);

      const [{ data: p }, { data: prof }] = await Promise.all([
        supabase
          .from("conexia_lab_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select("id,name,first_name,company,role,city,segment,timezone")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      if (!alive) return;

      setPrefs(p || null);
      setProfileSnapshot(prof || null);
      setPrefsLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const timeZone = profileSnapshot?.timezone || "America/Sao_Paulo";

  const displayName =
    prefs?.preferred_name ||
    profileSnapshot?.first_name ||
    profileSnapshot?.name ||
    firstName ||
    "";

  // Primeiro nome para uso falado (ex.: "Rafael Milléo" -> "Rafael").
  const spokenName = String(displayName || "").trim().split(/\s+/)[0] || "";

  const firstContactStorageKey = userId
    ? `conexia_first_contact_completed_${userId}`
    : "";

  const firstContactCompleted =
    Boolean(prefs?.first_contact_completed) ||
    Boolean(
      firstContactStorageKey &&
      typeof window !== "undefined" &&
      window.localStorage?.getItem(firstContactStorageKey)
    );

  const priorities = useMemo(
    () =>
      computePriorities(
        contacts,
        {},
        new Date().toISOString().slice(0,10),
        interactions
      ),
    [contacts, interactions]
  );

  const patterns = useMemo(
    () => detectPatterns(contacts, interactions, new Date()),
    [contacts, interactions]
  );

  const pending = useMemo(
    () => pickInvisiblePending(interactions, contacts),
    [interactions, contacts]
  );

  const todayInsight = useMemo(() => {
    if (priorities?.main) {
      return {
        title: priorities.main.title,
        body: priorities.main.reason,
        onOpen: () => onOpenContact?.(priorities.main.relationshipId),
      };
    }

    if (pending) {
      return {
        title: pending.contact?.name || "Uma conversa merece revisão",
        body: `${pending.age === 0 ? "Hoje" : pending.age === 1 ? "Ontem" : `Há ${pending.age} dias`}: ${pending.text.slice(0,160)}`,
        onOpen: () => onOpenContact?.(pending.contact?.id),
      };
    }

    if (patterns?.[0]) {
      return {
        title: "Há um movimento na sua rede",
        body:
          PATTERN_NOTES[patterns[0].type] ||
          "O padrão de relacionamento mudou e merece uma olhada.",
      };
    }

    return {
      title: "Sua rede está tranquila agora.",
      body:
        "Você pode conversar comigo, registrar algo que aconteceu ou perguntar sobre alguém da sua rede.",
    };
  }, [priorities, pending, patterns, onOpenContact]);

  const speak = (text, resumeListening = true) => {
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

  const markFirstContactCompleted = async () => {
    if (!userId) return;

    if (firstContactStorageKey && typeof window !== "undefined") {
      try {
        window.localStorage.setItem(firstContactStorageKey, "1");
      } catch {}
    }

    setPrefs(prev => ({
      ...(prev || {}),
      user_id: userId,
      first_contact_completed: true,
    }));

    try {
      await supabase
        .from("conexia_lab_preferences")
        .upsert(
          {
            user_id: userId,
            first_contact_completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
    } catch (e) {
      console.warn("[CONÉXIA Live] Não consegui persistir first_contact_completed:", e);
    }
  };

  const beginConversation = async () => {
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

    // Motor de voz: "gemini" (Gemini Live) ou "openai" (GPT-Live).
    // Mesmo cérebro (roteador + Central Brain + captura) nos dois.
    const VoiceEngine =
      voiceEngine === "gemini" ? DannaGeminiLive : DannaLive;

    const live = new VoiceEngine({
      userName: spokenName,

      getAccessToken: async () => {
        try {
          const { data } = await supabase.auth.getSession();
          return data?.session?.access_token || null;
        } catch {
          return null;
        }
      },

      // Travas de custo: encerra sozinha após 60s de silêncio,
      // 10 min de sessão ou quando o app vai para segundo plano.
      onAutoStop: (reason) => {
        conversationActiveRef.current = false;
        greetedThisSessionRef.current = false;
        liveRef.current = null;
        setConversationActive(false);
        setVoiceState("idle");

        const notice =
          reason === "max_duration"
            ? "Encerrei a conversa por voz depois de 10 minutos. Toque para continuar."
            : reason === "idle"
              ? "Encerrei a conversa por voz por falta de atividade. Toque para retomar."
              : "Conversa por voz encerrada.";

        setAnswer(notice);
        setCurrentView("answer");
      },
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

    let ok = false;
    try {
      ok = await live.connect();
    } catch (e) {
      ok = false;
      setError(e?.message || "Não consegui abrir a conversa por voz.");
      setVoiceState("idle");
    }

    if (!ok) {
      liveRef.current = null;
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

  const findContactByName = (name) => {
    const n = normalize(name);
    if (!n) return null;

    return (
      contacts.find(c => normalize(c.name) === n) ||
      contacts.find(
        c =>
          normalize(c.name).includes(n) ||
          n.includes(normalize(c.name))
      )
    );
  };

  const analyzeCapture = async (text) => {
    const existing = contacts.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company || "",
      role: c.role || "",
    }));

    const prompt = `
Você é o motor de captura do CONÉXIA.

Extraia apenas o que está explícito.
Não invente.
A descrição será exibida como memória pessoal do dono da rede:
escreva em primeira pessoa.

É proibido narrar como observador externo usando "o usuário".

CONTATOS:
${JSON.stringify(existing)}

CONVERSA RECENTE:
${JSON.stringify(recentTurnsRef.current)}

FALA ATUAL:
${text}

Responda SOMENTE JSON válido:
{
  "contactName":"nome ou null",
  "existingContactId":"id exato se houver correspondência clara ou null",
  "company":"empresa explícita ou null",
  "role":"cargo explícito ou null",
  "interactionType":"reuniao|ligacao|mensagem|encontro|evento|outro",
  "description":"resumo fiel em 1 ou 2 frases, SEMPRE na primeira pessoa do dono da relação. Ex.: 'Enviei ao Rafael um resumo para análise.' Nunca escreva 'o usuário enviou', 'o usuário pediu' ou 'o usuário informou'.",
  "sentiment":"positivo|neutro|negativo",
  "tags":["até 5 temas explícitos"],
  "nextAction":"próximo passo explícito ou null",
  "nextActionDate":"YYYY-MM-DD apenas se houver segurança ou null"
}
`.trim();

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        maxTokens: 700,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        `HTTP ${res.status}`
      );
    }

    const parsed = firstJson(
      data.content?.[0]?.text || ""
    );

    if (!parsed) {
      throw new Error(
        "Não consegui estruturar a interação."
      );
    }

    if (
      !parsed.existingContactId &&
      parsed.contactName
    ) {
      const local = findContactByName(
        parsed.contactName
      );

      if (local) {
        parsed.existingContactId = local.id;
      }
    }

    setDraft(parsed);
    setCurrentView("capture");

    sessionContextRef.current.activePerson =
      parsed.contactName || null;

    sessionContextRef.current.lastView = "capture";

    speak(
      `Entendi. ${
        parsed.contactName
          ? `É sobre ${parsed.contactName}. `
          : ""
      }${parsed.description || ""} Quer que eu salve?`,
      true
    );
  };

  // Danna Central Brain: consulta o CONÉXIA inteiro sob demanda.
  // A Home continua leve; os dados completos só são buscados quando Rafael pergunta algo.
  const loadDannaKnowledge = async () => {
    if (!userId) throw new Error("Sessão não autenticada.");

    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const horizon = new Date(now.getTime() + 45 * 86400000).toISOString();

    const [
      contactsRes,
      interactionsRes,
      memoryRes,
      alertsRes,
      eventsRes,
      signalsRes,
      profileRes,
    ] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,name,company,role,category,city,state_code,birthday,hobbies,main_culture,personal_notes,notes,next_action,next_action_date,last_interaction_at,status,ideal_frequency_days")
        .eq("user_id", userId)
        .order("last_interaction_at", { ascending: false, nullsFirst: false }),

      supabase
        .from("interactions")
        .select("id,contact_id,type,description,sentiment,tags,value_generated,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),

      supabase
        .from("relational_memory")
        .select("id,contact_id,memory_type,content,summary,source_type,source_excerpt,confidence,occurred_at,valid_from,valid_until,created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("alerts")
        .select("id,contact_id,title,description,status,created_at,metadata")
        .eq("user_id", userId)
        .neq("status", "dismissed")
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("scheduled_events")
        .select("id,contact_id,type,scheduled_at,duration_minutes,location,notes,status,source,created_at")
        .eq("user_id", userId)
        .gte("scheduled_at", new Date(now.getTime() - 7 * 86400000).toISOString())
        .lte("scheduled_at", horizon)
        .order("scheduled_at", { ascending: true })
        .limit(150),

      supabase
        .from("signals")
        .select("id,contact_id,source,type,title,summary,identity_confidence,detected_at,expires_at,status")
        .eq("user_id", userId)
        .in("status", ["new", "evaluated", "relevant"])
        .order("detected_at", { ascending: false })
        .limit(100),

      supabase
        .from("profiles")
        .select("id,name,first_name,company,role,city,segment,timezone,last_discussed_contact_id,last_discussed_contact_at,calendar_ics_url")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const critical = [contactsRes, interactionsRes, memoryRes, eventsRes];
    const criticalError = critical.find(x => x?.error)?.error;
    if (criticalError) throw criticalError;

    // Alerts/signals são enriquecimento. Se uma dessas fontes falhar, a Danna continua.
    if (alertsRes.error) console.warn("[Danna Brain] alerts indisponível", alertsRes.error);
    if (signalsRes.error) console.warn("[Danna Brain] signals indisponível", signalsRes.error);
    if (profileRes.error) console.warn("[Danna Brain] profile indisponível", profileRes.error);

    const people = contactsRes.data || [];
    const contactById = new Map(people.map(c => [c.id, c]));
    const contactName = id => contactById.get(id)?.name || null;

    const contactsForAI = people.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company || "",
      role: c.role || "",
      category: c.category || "",
      city: [c.city, c.state_code].filter(Boolean).join("/"),
      birthday: c.birthday || null,
      hobbies: c.hobbies || null,
      mainCulture: c.main_culture || null,
      notes: (c.personal_notes || c.notes || "").slice(0, 400),
      nextAction: c.next_action || null,
      nextActionDate: c.next_action_date || null,
      lastInteractionAt: c.last_interaction_at || null,
      idealFrequencyDays: c.ideal_frequency_days || null,
      status: c.status || null,
    }));

    // Interações: 500 lidas, 200 enviadas à IA (controle de tamanho do prompt).
    const interactionsForAI = (interactionsRes.data || []).slice(0, 200).map(i => ({
      person: contactName(i.contact_id) || "desconhecido",
      date: i.created_at,
      type: i.type || "",
      description: (i.description || "").slice(0, 400),
      tags: i.tags || [],
      sentiment: i.sentiment || "",
      valueGenerated: i.value_generated || null,
    }));

    const memoryForAI = (memoryRes.data || []).map(m => ({
      person: contactName(m.contact_id),
      type: m.memory_type,
      content: (m.summary || m.content || "").slice(0, 400),
      source: m.source_type,
      confidence: m.confidence,
      occurredAt: m.occurred_at,
      validUntil: m.valid_until,
    }));

    const alertsForAI = (alertsRes.data || []).map(a => ({
      person: contactName(a.contact_id),
      title: a.title,
      description: (a.description || "").slice(0, 300),
      status: a.status,
      createdAt: a.created_at,
    }));

    const signalsForAI = (signalsRes.data || []).map(sg => ({
      person: contactName(sg.contact_id),
      source: sg.source,
      type: sg.type,
      title: sg.title,
      summary: (sg.summary || "").slice(0, 300),
      identityConfidence: sg.identity_confidence,
      detectedAt: sg.detected_at,
      status: sg.status,
    }));

    const tz = profileRes.data?.timezone || timeZone || "America/Sao_Paulo";
    const dayKey = d => {
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    };
    const timeLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
      } catch {
        return "";
      }
    };
    const weekdayLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(d));
      } catch {
        return dayKey(d);
      }
    };

    const events = (eventsRes.data || [])
      .filter(e => e.status !== "cancelado")
      .map(e => ({
        person: contactName(e.contact_id),
        type: e.type,
        at: e.scheduled_at,
        day: dayKey(e.scheduled_at),
        time: timeLabel(e.scheduled_at),
        durationMinutes: e.duration_minutes || null,
        location: e.location || null,
        notes: (e.notes || "").slice(0, 300),
        status: e.status,
        source: e.source,
      }));

    const upcomingEvents = events.filter(e => e.at >= nowIso);
    const recentPastEvents = events.filter(e => e.at < nowIso);

    // Visão da semana: hoje + 6 dias, dia a dia (inclusive dias livres).
    const week_overview = Array.from({ length: 7 }, (_, idx) => {
      const ref = new Date(now.getTime() + idx * 86400000);
      const key = dayKey(ref);
      const dayEvents = upcomingEvents.filter(e => e.day === key);
      return {
        date: key,
        label: idx === 0 ? `hoje (${weekdayLabel(ref)})` : idx === 1 ? `amanhã (${weekdayLabel(ref)})` : weekdayLabel(ref),
        eventCount: dayEvents.length,
        events: dayEvents.map(({ day, ...rest }) => rest),
      };
    });

    // Sinais de atenção calculados localmente (fatos, não inferência).
    const todayKey = dayKey(now);
    const overdueNextActions = people
      .filter(c => c.next_action && c.next_action_date && String(c.next_action_date).slice(0, 10) < todayKey)
      .map(c => ({ person: c.name, nextAction: c.next_action, dueDate: c.next_action_date }))
      .slice(0, 30);

    const upcomingBirthdays = people
      .map(c => {
        const m = String(c.birthday || "").match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        const year = now.getFullYear();
        let next = new Date(`${year}-${m[2]}-${m[3]}T12:00:00`);
        if (next.getTime() < now.getTime() - 86400000) next = new Date(`${year + 1}-${m[2]}-${m[3]}T12:00:00`);
        const inDays = Math.round((next.getTime() - now.getTime()) / 86400000);
        return inDays >= 0 && inDays <= 30 ? { person: c.name, date: `${m[3]}/${m[2]}`, inDays } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.inDays - b.inDays);

    const coolingContacts = people
      .filter(c => c.ideal_frequency_days && c.last_interaction_at)
      .map(c => ({
        person: c.name,
        daysSinceLast: Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000),
        idealFrequencyDays: c.ideal_frequency_days,
      }))
      .filter(x => x.daysSinceLast > x.idealFrequencyDays)
      .sort((a, b) => (b.daysSinceLast - b.idealFrequencyDays) - (a.daysSinceLast - a.idealFrequencyDays))
      .slice(0, 20);

    const profile = profileRes.data || null;

    return {
      contacts: contactsForAI,
      interactions: interactionsForAI,
      overview: {
        generated_at: nowIso,
        today,
        timezone: tz,
        profile: profile
          ? {
              name: profile.first_name || profile.name || null,
              company: profile.company || null,
              role: profile.role || null,
              city: profile.city || null,
              segment: profile.segment || null,
              lastDiscussedPerson: contactName(profile.last_discussed_contact_id),
              lastDiscussedAt: profile.last_discussed_contact_at || null,
              calendarConnected: Boolean(profile.calendar_ics_url),
            }
          : null,
        counts: {
          contacts: people.length,
          interactionsLoaded: (interactionsRes.data || []).length,
          activeMemories: memoryForAI.length,
          openAlerts: alertsForAI.length,
          upcomingEvents: upcomingEvents.length,
          activeSignals: signalsForAI.length,
        },
        week_overview,
        upcoming_events: upcomingEvents.map(({ day, ...rest }) => rest),
        recent_past_events: recentPastEvents.map(({ day, ...rest }) => rest),
        relational_memory: memoryForAI,
        open_alerts: alertsForAI,
        signals: signalsForAI,
        attention: {
          overdueNextActions,
          upcomingBirthdays,
          coolingContacts,
        },
      },
    };
  };

  const askNetwork = async (text) => {
    let brain = null;
    try {
      brain = await loadDannaKnowledge();
    } catch (e) {
      console.warn("[Danna Brain] snapshot indisponível; usando dados da Home.", e);
    }

    const people = brain?.contacts || contacts.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company || "",
      role: c.role || "",
      category: c.category || "",
      city: c.city || "",
      notes: (c.personal_notes || c.notes || "").slice(0,400),
      nextAction: c.next_action || c.nextAction || null,
      nextActionDate: c.next_action_date || c.nextActionDate || null,
      lastInteractionAt: c.last_interaction_at || c.lastInteractionAt || null,
    }));

    const contactMap = new Map(
      contacts.map(c => [c.id, c.name])
    );

    const recent = brain?.interactions || [...interactions]
      .sort(
        (a,b) =>
          new Date(interactionDate(b) || 0) -
          new Date(interactionDate(a) || 0)
      )
      .slice(0,120)
      .map(i => ({
        person:
          contactMap.get(interactionContactId(i)) ||
          "desconhecido",
        date: interactionDate(i),
        type: i.type || "",
        description:
          (i.description || i.note || i.notes || "")
            .slice(0,500),
        tags: i.tags || [],
        sentiment: i.sentiment || "",
      }));

    const ctx = {
      ...sessionContextRef.current,
      lastSavedInteraction: lastSavedContextRef.current,
    };

    const prompt = `
Você é o CONÉXIA, um cérebro conversacional especializado EXCLUSIVAMENTE em inteligência relacional.

MISSÃO:
Ajudar o usuário a compreender melhor pessoas, relações, interações, contexto, reuniões, riscos, oportunidades, conexões, pendências, padrões e próximos movimentos.

VOCÊ NÃO É:
- assistente genérico;
- amigo para conversar sobre qualquer assunto;
- CRM tradicional;
- agenda genérica;
- mecanismo de respostas soltas.

COMPORTAMENTO:
- sustente uma conversa contínua e natural;
- preserve o fio da conversa entre turnos;
- entenda referências como "ele", "ela", "essa reunião", "essa pessoa", "isso", "aquele assunto", "e agora?", "e o risco?";
- nunca reinicie uma conversa em andamento;
- NUNCA diga "bom dia", "boa tarde" ou "boa noite" nas respostas da conversa;
- saudações de horário pertencem apenas ao cabeçalho visual do app;
- não repita contexto que já está claro;
- por padrão, NÃO despeje datas exatas, horários, timestamps ou cronologias detalhadas;
- prefira linguagem natural como "recentemente", "nas últimas semanas", "há alguns dias" ou "na última conversa";
- use data exata somente se ela mudar uma decisão, indicar urgência/cadência, fizer parte de compromisso futuro, ou se o usuário pedir "quando", "qual data" ou equivalente;
- responda diretamente ao que foi perguntado;
- faça uma pergunta de continuidade SOMENTE quando isso realmente melhorar a análise;
- se já houver dados suficientes, não faça pergunta: entregue a leitura;
- quando perceber algo importante que o usuário não pediu explicitamente, pode trazer como provocação curta;
- diferencie claramente FATO REGISTRADO de LEITURA/INFERÊNCIA;
- nunca invente fatos sobre pessoas;
- se faltar evidência, diga exatamente o que falta;
- nunca altere dados sem confirmação explícita.

GUARDRAIL DE PRODUTO:
Antes de responder, avalie silenciosamente:
1. Isto fere a essência de inteligência relacional?
2. Isto afeta negativamente foco, clareza ou experiência?
3. Isto é uma evolução útil dentro de inteligência relacional?

Se o assunto sair do domínio relacional, redirecione de forma curta para o que pode ser útil dentro de relações, pessoas, interações ou contexto.
Não dê respostas genéricas fora do domínio só porque sabe responder.

CAPACIDADES RELACIONAIS:
- PERSON_MEMORY: recuperar contexto e histórico de uma pessoa;
- MEETING_PREP: preparar o usuário para uma reunião usando histórico, temas, pendências, objetivo provável e perguntas úteis;
- RELATIONSHIP_RISK: detectar esfriamento, ausência de retorno, dependência, concentração, ruptura de cadência ou perda de contexto;
- CONNECTION_DISCOVERY: identificar pontes possíveis entre pessoas;
- NETWORK_PATTERN: identificar padrões recorrentes da rede;
- NEXT_BEST_ACTION: recomendar o próximo movimento relacional;
- PENDING_COMMITMENT: identificar promessas ou compromissos abertos;
- RELATIONAL_REFLECTION: ajudar o usuário a pensar sobre uma relação sem inventar fatos;
- CAPTURE_CONTEXT: usar o que acabou de ser registrado como parte viva da conversa.

CONTEXTO ATIVO:
${JSON.stringify(ctx)}

ÚLTIMOS TURNOS DA CONVERSA:
${JSON.stringify(recentTurnsRef.current)}

ÚLTIMA INTERAÇÃO SALVA NESTA SESSÃO:
${JSON.stringify(lastSavedContextRef.current)}

PERGUNTA ATUAL:
${text}

SNAPSHOT FRESCO DO CONÉXIA (lido agora do banco; fonte de verdade para agenda, memória relacional, alertas, sinais e pontos de atenção):
${brain ? JSON.stringify(brain.overview) : "indisponível nesta consulta; use somente pessoas e interações abaixo e avise se a pergunta depender de agenda ou memória."}

PESSOAS DA REDE:
${JSON.stringify(people)}

INTERAÇÕES REGISTRADAS:
${JSON.stringify(recent)}

Responda SOMENTE JSON válido:
{
  "answer":"resposta natural, fluida, direta e útil",
  "view":"answer|connection|person|insight",
  "people":["nomes exatos de até 2 pessoas relevantes"],
  "topics":["até 4 temas relevantes"],
  "suggestedActions":["why","bridge","tomorrow"],
  "activePerson":"nome da pessoa principal ou null",
  "relationalMode":"person_memory|meeting_prep|relationship_risk|connection_discovery|network_pattern|next_best_action|pending_commitment|relational_reflection|general_relational",
  "followUpQuestion":"pergunta curta de continuidade ou null",
  "confidence":"high|medium|low"
}

REGRAS DE RESPOSTA:
- AGENDA: para "minha semana", "amanhã", "próximas reuniões" ou similares, use week_overview e upcoming_events do SNAPSHOT; nunca invente compromissos fora dele;
- MEMÓRIA: relational_memory são fatos/compromissos já consolidados; use-os como evidência forte, citando a pessoa;
- ATENÇÃO: attention traz ações vencidas, aniversários próximos e contatos esfriando; traga só o que for relevante para a pergunta;
- DATAS: não cite datas exatas automaticamente; resuma temporalidade em linguagem natural. Cite data exata apenas quando ela for relevante para decisão/urgência/cadência ou quando o usuário pedir;
- para MEETING_PREP: use até 8 frases se necessário e priorize: histórico relevante, pontos de atenção, pendências, objetivo provável, perguntas recomendadas;
- para PERSON_MEMORY: sintetize somente o que existe nos registros;
- para RELATIONSHIP_RISK: explique evidências concretas antes da interpretação;
- para CONNECTION_DISCOVERY: diga por que a conexão faz sentido;
- para NEXT_BEST_ACTION: recomende no máximo 1 ou 2 movimentos;
- para RELATIONAL_REFLECTION: ajude a pensar, mas não trate percepção subjetiva como fato;
- para perguntas de continuação, use o contexto anterior sem exigir que o usuário repita nomes ou detalhes;
- followUpQuestion só deve existir se a próxima pergunta realmente aprofundar a inteligência relacional.
`.trim();

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        maxTokens: 1200,
        temperature: 0.35,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error?.message ||
        data?.error ||
        `HTTP ${res.status}`
      );
    }

    const parsed = firstJson(
      data.content?.[0]?.text || ""
    );

    if (!parsed) {
      throw new Error(
        "Não consegui estruturar a resposta."
      );
    }

    const resolvedPeople = (
      parsed.people || []
    )
      .map(name => findContactByName(name))
      .filter(Boolean)
      .slice(0,2);

    const finalAnswer =
      parsed.answer ||
      "Não encontrei evidência suficiente.";

    setAnswer(finalAnswer);

    sessionContextRef.current.lastQuestion =
      text;

    sessionContextRef.current.activePeople =
      resolvedPeople.map(p => p.name);

    sessionContextRef.current.activeTopics =
      parsed.topics || [];

    sessionContextRef.current.lastView =
      parsed.view || "answer";

    if (parsed.activePerson) {
      sessionContextRef.current.activePerson =
        parsed.activePerson;
    }

    if (
      parsed.view === "connection" &&
      resolvedPeople.length >= 2
    ) {
      setConnectionData({
        people: resolvedPeople,
        topics: parsed.topics || [],
        answer: finalAnswer,
      });

      setCurrentView("connection");
    } else {
      setCurrentView("answer");
    }

    speak(finalAnswer, true);
  };

  const classifyIntent = async (text) => {
    const prompt = `
Você é o roteador do CONÉXIA, especializado em inteligência relacional.

FALA ATUAL:
${text}

CONTEXTO ATIVO:
${JSON.stringify(sessionContextRef.current)}

ÚLTIMOS TURNOS:
${JSON.stringify(recentTurnsRef.current)}

ÚLTIMA INTERAÇÃO SALVA:
${JSON.stringify(lastSavedContextRef.current)}

Classifique SOMENTE entre:

capture
= o usuário está contando algo que aconteceu e há informação nova para registrar:
reunião, ligação, mensagem, encontro, promessa, compromisso, contexto novo sobre uma pessoa.

relational
= pergunta, análise, reflexão, preparação, busca sobre pessoa, risco, conexão, padrão, oportunidade, próximo movimento ou continuação natural da conversa.

out_of_scope
= assunto sem relação com pessoas, relações, interações, contexto profissional/pessoal relacional, preparação de conversas, networking ou inteligência relacional.

DESPEDIDAS:
"tchau", "valeu", "obrigado", "até mais", "até amanhã", "falou" não são out_of_scope; são encerramentos naturais e normalmente serão tratados antes deste roteador.

REGRAS:
- se a fala depende do contexto anterior, escolha relational;
- "o que eu preciso saber?", "como me preparo?", "e ele?", "por quê?", "e agora?", "qual o risco?", "quem poderia ajudar?" = relational;
- se houver dúvida entre capture e relational numa continuação, escolha relational;
- não classifique como out_of_scope apenas porque a pergunta é ampla, se houver vínculo claro com uma pessoa, reunião ou relação ativa.

Responda SOMENTE JSON:
{"intent":"capture|relational|out_of_scope"}
`.trim();

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        maxTokens: 100,
        temperature: 0,
      }),
    });

    const data = await res.json();
    const parsed = firstJson(data.content?.[0]?.text || "");

    if (parsed?.intent === "capture") return "capture";
    if (parsed?.intent === "out_of_scope") return "out_of_scope";
    return "relational";
  };

  const handleUserTurn = async (text) => {
    const line = String(text || "").trim();
    if (!line) return;

    addTurn("user", line);

    setLastQuestion(line);
    setInput(line);
    setVoiceState("thinking");
    setError("");

    const n = normalize(line);

    if (currentView === "capture" && draft) {
      if (
        /^(sim|pode|salva|salvar|confirma|confirmar|correto|isso|certo|exato|perfeito)/.test(n)
      ) {
        await confirmCapture();
        return;
      }

      if (
        /^(nao|não|corrige|corrigir|cancela|cancelar)/.test(n)
      ) {
        setDraft(null);
        setCurrentView("today");

        speak(
          "Tudo bem. Me conta novamente do jeito que aconteceu.",
          true
        );

        return;
      }
    }

    const isFarewell =
      /^(tchau|valeu|obrigado|obrigada|falou|ate mais|até mais|ate amanha|até amanhã|boa noite por hoje|encerrar|pode encerrar|fim)[.! ]*$/.test(n);

    if (isFarewell) {
      conversationActiveRef.current = false;
      greetedThisSessionRef.current = false;
      setConversationActive(false);
      stopListening();

      const response =
        /obrigad/.test(n)
          ? `Por nada${spokenName ? `, ${spokenName}` : ""}. Até mais.`
          : `Até mais${spokenName ? `, ${spokenName}` : ""}.`;

      setAnswer(response);
      setCurrentView("answer");
      speak(response, false);
      return;
    }

    const isPureGreeting =
      /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|fala|opa)[.! ]*$/.test(n);

    if (isPureGreeting) {
      const response =
        sessionContextRef.current.activePerson || lastSavedContextRef.current
          ? "Estou aqui. Pode continuar de onde paramos."
          : "Estou aqui. Pode falar sobre uma pessoa, relação, reunião ou situação da sua rede.";

      setAnswer(response);
      setCurrentView("answer");
      speak(response, true);
      return;
    }

    try {
      const intent = await classifyIntent(line);

      if (intent === "capture") {
        await analyzeCapture(line);
        return;
      }

      if (intent === "out_of_scope") {
        const response =
          "Isso foge do que eu faço melhor. Se quiser, eu posso conectar esse assunto a uma pessoa, reunião, relação ou decisão da sua rede.";

        setAnswer(response);
        setCurrentView("answer");
        speak(response, true);
        return;
      }

      await askNetwork(line);
    } catch (e) {
      setError(
        `Não consegui processar agora: ${e.message}`
      );
      setVoiceState("idle");
    }
  };

  const confirmCapture = async () => {
    if (!draft) return;

    setVoiceState("thinking");
    setError("");

    try {
      let contactId =
        draft.existingContactId || null;

      let contact =
        contacts.find(c => c.id === contactId) ||
        null;

      if (!contactId) {
        const { data, error } =
          await supabase
            .from("contacts")
            .insert({
              user_id: userId,
              name: draft.contactName,
              company: draft.company || null,
              role: draft.role || null,
              status: "active",
            })
            .select("id,name,company,role")
            .single();

        if (error) throw error;

        contactId = data.id;
        contact = data;
      }

      const savedContext = {
        contactId,
        contactName:
          draft.contactName ||
          contact?.name ||
          null,
        company:
          draft.company ||
          contact?.company ||
          null,
        role:
          draft.role ||
          contact?.role ||
          null,
        interactionType:
          draft.interactionType ||
          "outro",
        description:
          draft.description ||
          lastQuestion,
        sentiment:
          draft.sentiment ||
          "neutro",
        tags:
          Array.isArray(draft.tags)
            ? draft.tags.slice(0,5)
            : [],
        nextAction:
          draft.nextAction ||
          null,
        nextActionDate:
          draft.nextActionDate ||
          null,
        savedAt:
          new Date().toISOString(),
      };

      const { error: intErr } =
        await supabase
          .from("interactions")
          .insert({
            user_id: userId,
            contact_id: contactId,
            type:
              draft.interactionType ||
              "outro",
            description:
              draft.description ||
              lastQuestion,
            sentiment:
              draft.sentiment ||
              "neutro",
            tags:
              Array.isArray(draft.tags)
                ? draft.tags.slice(0,5)
                : [],
          });

      if (intErr) throw intErr;

      const patch = {
        last_interaction_at:
          new Date().toISOString(),
      };

      if (draft.nextAction) {
        patch.next_action = draft.nextAction;
      }

      if (draft.nextActionDate) {
        patch.next_action_date =
          draft.nextActionDate;
      }

      if (!contact?.company && draft.company) {
        patch.company = draft.company;
      }

      if (!contact?.role && draft.role) {
        patch.role = draft.role;
      }

      const { error: upErr } =
        await supabase
          .from("contacts")
          .update(patch)
          .eq("id", contactId)
          .eq("user_id", userId);

      if (upErr) throw upErr;

      lastSavedContextRef.current =
        savedContext;

      sessionContextRef.current.lastSavedInteraction =
        savedContext;

      sessionContextRef.current.activePerson =
        savedContext.contactName;

      sessionContextRef.current.activePeople =
        savedContext.contactName
          ? [savedContext.contactName]
          : [];

      sessionContextRef.current.activeTopics =
        savedContext.tags || [];

      sessionContextRef.current.lastView =
        "saved";

      sessionContextRef.current.lastQuestion =
        lastQuestion;

      const who =
        savedContext.contactName ||
        "essa pessoa";

      setDraft(null);

      const confirmation =
        `Pronto. Registrei com ${who}.`;

      setAnswer(confirmation);
      setCurrentView("saved");

      await onDataChanged?.();

      speak(
        `${confirmation} Podemos continuar falando sobre essa reunião.`,
        true
      );
    } catch (e) {
      setError(
        `Não salvei nada: ${e.message}`
      );

      setVoiceState("idle");
    }
  };

  const askWhy = () => {
    const text =
      connectionData?.people?.length === 2
        ? `Por que você acha que ${connectionData.people[0].name} e ${connectionData.people[1].name} deveriam se conectar?`
        : "Por quê?";

    handleUserTurn(text);
  };

  const createBridge = () => {
    if (!connectionData?.people?.length) {
      return;
    }

    const [a,b] = connectionData.people;

    const response =
      `A melhor próxima ação é você fazer a ponte entre ${a.name} e ${b.name}. Posso deixar isso como próximo movimento.`;

    setAnswer(response);
    setCurrentView("answer");
    speak(response, true);
  };

  const remindTomorrow = async () => {
    const person =
      connectionData?.people?.[0];

    if (!person) return;

    const tomorrow = new Date();
    tomorrow.setDate(
      tomorrow.getDate() + 1
    );

    const date =
      tomorrow.toISOString().slice(0,10);

    const other =
      connectionData?.people?.[1]?.name;

    const action =
      other
        ? `Apresentar ${person.name} a ${other}`
        : `Retomar ${person.name}`;

    const { error } =
      await supabase
        .from("contacts")
        .update({
          next_action: action,
          next_action_date: date,
        })
        .eq("id", person.id)
        .eq("user_id", userId);

    if (error) {
      setError(error.message);
      return;
    }

    const response =
      `Fechado. Deixei ${action.toLowerCase()} para amanhã.`;

    setAnswer(response);
    setCurrentView("answer");

    await onDataChanged?.();

    speak(
      "Fechado. Deixei isso para amanhã.",
      true
    );
  };

  const submitText = () => {
    const t = textInput.trim();
    if (!t) return;

    setTextInput("");
    setShowText(false);

    handleUserTurn(t);
  };

  if (prefsLoading) {
    return (
      <div style={{
        color: K.text,
        fontFamily: sans,
        padding: 30,
      }}>
        Preparando CONÉXIA Live...
      </div>
    );
  }

  const greeting =
    !firstContactCompleted
      ? `Bem-vindo${displayName ? `, ${displayName}` : ""}.`
      : prefs?.greeting_mode === "direto"
        ? `${displayName ? `${displayName}, ` : ""}vamos cuidar da sua rede.`
        : greetingForNow(displayName, timeZone);

  return (
    <div style={{
      maxWidth: 820,
      margin: "0 auto",
      paddingBottom: 42,
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{
          color: K.gold,
          fontFamily: sans,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: ".14em",
          textTransform: "uppercase",
          marginBottom: 7,
        }}>
          CONÉXIA LIVE
        </div>

        <h1 style={{
          color: K.text,
          fontFamily: serif,
          fontSize: 32,
          lineHeight: 1.05,
          margin: "0 0 7px",
          fontWeight: 700,
        }}>
          {greeting}
        </h1>

        <div style={{
          color: K.muted,
          fontFamily: sans,
          fontSize: 13,
        }}>
          {!firstContactCompleted
            ? "Vamos começar por uma pessoa importante para você."
            : currentView === "today"
              ? "Tem uma coisa na sua rede que eu olharia hoje."
              : "A conversa continua. Eu mantenho o contexto."}
        </div>
      </div>

      <div style={{
        background: K.card,
        border: `1px solid ${K.border}`,
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 16px 42px rgba(0,0,0,.20)",
      }}>
        {currentView === "today" && (
          <InsightView
            title={todayInsight.title}
            body={todayInsight.body}
            onOpen={todayInsight.onOpen}
          />
        )}

        {currentView === "capture" && draft && (
          <CaptureView
            draft={draft}
            onConfirm={confirmCapture}
            onCorrect={() => {
              setDraft(null);
              setCurrentView("today");
              setAnswer("");
            }}
          />
        )}

        {currentView === "connection" && connectionData && (
          <ConnectionView
            people={connectionData.people}
            topics={connectionData.topics}
            answer={connectionData.answer}
            onWhy={askWhy}
            onCreateBridge={createBridge}
            onTomorrow={remindTomorrow}
          />
        )}

        {currentView === "answer" && (
          <AnswerView
            question={lastQuestion}
            answer={answer}
          />
        )}

        {currentView === "saved" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: `${K.green}18`,
              border: `1px solid ${K.green}55`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
              color: K.green,
              fontSize: 26,
            }}>
              ✓
            </div>

            <div style={{
              color: K.text,
              fontFamily: serif,
              fontSize: 27,
              fontWeight: 700,
            }}>
              Registrado.
            </div>

            <div style={{
              color: K.muted,
              fontFamily: sans,
              fontSize: 13,
              marginTop: 6,
            }}>
              {answer}
            </div>
          </div>
        )}

        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 22,
        }}>
          <VoiceOrb
            state={voiceState}
            active={conversationActive}
            onClick={beginConversation}
          />

          <div style={{
            color: K.muted,
            fontFamily: sans,
            fontSize: 10.5,
            marginTop: 10,
          }}>
            {conversationActive
              ? "Sessão aberta. Continue falando naturalmente."
              : "Toque uma vez para conversar."}
          </div>

          {input && voiceState === "listening" && (
            <div style={{
              marginTop: 12,
              color: K.text,
              fontFamily: sans,
              fontSize: 12.5,
              opacity: .85,
            }}>
              “{input}”
            </div>
          )}

          <button
            onClick={() =>
              setShowText(v => !v)
            }
            style={{
              marginTop: 10,
              background: "transparent",
              border: "none",
              color: K.muted,
              fontFamily: sans,
              fontSize: 11,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {showText
              ? "Fechar texto"
              : "Prefiro escrever"}
          </button>
        </div>

        {showText && (
          <div style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop: `1px solid ${K.border}`,
          }}>
            <textarea
              value={textInput}
              onChange={e =>
                setTextInput(e.target.value)
              }
              rows={3}
              placeholder="Fale comigo por texto..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                resize: "vertical",
                background: K.card2,
                border: `1px solid ${K.border}`,
                borderRadius: 12,
                color: K.text,
                padding: 13,
                fontFamily: sans,
                fontSize: 13.5,
                lineHeight: 1.5,
                outline: "none",
              }}
            />

            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 8,
            }}>
              <button
                onClick={submitText}
                style={primaryButton}
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 14,
            color: K.red,
            fontFamily: sans,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
