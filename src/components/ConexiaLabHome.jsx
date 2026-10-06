import useRelationshipIntelligence, { invalidateRelationshipIntelligence } from '../lib/useRelationshipIntelligence.js';
import { loadRelationshipData } from '../../shared/relationshipData.js';
import { computeRelationshipIntelligence } from '../../shared/relationshipIntelligence.js';
import ContactCircleField from "./ContactCircleField";
import { circlePath, resolveCircle } from "../../shared/networkCircles.js";
import { saveDannaCapture, linkDannaCapture, updateDannaContact, capturePerson } from "../lib/dannaCapture.js";
import React, { forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import {
  detectPatterns,
  PATTERN_NOTES,
} from "../../shared/relationshipPatternDetector.js";
import conexiaIcon from "../assets/brand/conexia_icone_transparente.svg";
import DannaLive from "../lib/dannaLive";
import DannaGeminiLive from "../lib/dannaGeminiLive";
import DannaFishLive from "../lib/dannaFishLive";
import { buildDannaGreeting } from "../lib/dannaGreeting.js";
import {
  resolveDannaSpokenName, isNetworkQuestion,
  buildNetworkOverview, extractPendingPersonName,
} from "../lib/dannaConversation.js";

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

const normalize = value =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const interactionDate = i => i?.created_at || i?.createdAt || null;
const interactionContactId = i => i?.contact_id || i?.contactId || null;

function firstJson(text) {
  const match = String(text || "").match(/\{[\s\S]*\}/);

  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function getHourInTimezone(timeZone = "America/Sao_Paulo") {
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      timeZone,
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const hour = Number(
      parts.find(p => p.type === "hour")?.value
    );

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
  const contactMap = new Map(
    (contacts || []).map(c => [c.id, c])
  );

  const signal =
    /(vou\s+(mandar|enviar|apresentar|verificar|retornar|ligar)|vamos\s+(falar|marcar|combinar)|combin(ei|amos)|me\s+lembra|ficou\s+de|interessad[oa]|precisa\s+de|est[aá]\s+procurando|quer\s+conhecer|depois\s+(falamos|vemos))/i;

  return [...(interactions || [])]
    .filter(i =>
      signal.test(i?.description || i?.note || i?.notes || "")
    )
    .sort(
      (a, b) =>
        new Date(interactionDate(b) || 0) -
        new Date(interactionDate(a) || 0)
    )
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

  const label = listening
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
          0%,100% { transform: scale(1); opacity:.45; }
          50% { transform: scale(1.045); opacity:.9; }
        }
      `}</style>

      <div style={{
        width: 216,
        minHeight: 248,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
      }}>
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
          <div style={{
            position: "absolute",
            inset: 5,
            borderRadius: "50%",
            border: `1px solid ${active ? `${K.gold}B8` : `${K.gold}55`}`,
            boxShadow: active
              ? `0 0 46px ${K.gold}16, inset 0 0 34px ${K.gold}0B`
              : "0 0 26px rgba(0,0,0,.25)",
            animation: active ? "conexiaRing 2.2s ease-in-out infinite" : "none",
            transition: "border-color .25s ease, box-shadow .25s ease",
          }} />

          <div style={{
            position: "absolute",
            inset: 18,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 45%, ${K.gold}10 0%, ${K.card} 50%, ${K.bg} 100%)`,
            border: `1px solid ${K.gold}24`,
          }} />

          <div style={{
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
          }}>
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

        <div style={{
          color: active ? K.gold : K.text,
          fontFamily: sans,
          fontSize: 18,
          fontWeight: 800,
          marginTop: 4,
          letterSpacing: "-.01em",
        }}>
          {label}
        </div>

        <div style={{
          color: K.muted,
          fontFamily: sans,
          fontSize: 11,
          marginTop: 5,
        }}>
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
    .slice(0, 2)
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

      <div style={{
        color: K.text,
        fontFamily: sans,
        fontSize: 13,
        fontWeight: 800,
      }}>
        {person?.name || "Pessoa"}
      </div>

      <div style={{
        color: K.muted,
        fontFamily: sans,
        fontSize: 10,
        marginTop: 2,
      }}>
        {[person?.company, person?.role].filter(Boolean).join(" · ") || "sua rede"}
      </div>
    </div>
  );
}

function ConnectionView({
  people = [],
  topics = [],
  answer,
  onWhy,
  onCreateBridge,
  onTomorrow,
}) {
  const [a, b] = people;

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

          <div style={{
            color: K.gold,
            fontFamily: sans,
            fontSize: 10,
            fontWeight: 800,
          }}>
            CONEXÃO POR
          </div>

          <div style={{
            display: "flex",
            gap: 5,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 6,
          }}>
            {(topics.length ? topics : ["contexto"]).slice(0, 3).map(t => (
              <span key={t} style={{
                border: `1px solid ${K.gold}50`,
                borderRadius: 999,
                padding: "4px 7px",
                color: K.text,
                fontFamily: sans,
                fontSize: 10,
              }}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <PersonMini person={b} />
      </div>

      {answer && (
        <div style={{
          color: K.text,
          fontFamily: sans,
          fontSize: 13.5,
          lineHeight: 1.6,
          marginTop: 14,
        }}>
          {answer}
        </div>
      )}

      <div style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginTop: 14,
      }}>
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

      <div style={{
        color: K.text,
        fontFamily: serif,
        fontSize: 28,
        fontWeight: 700,
        marginBottom: 7,
      }}>
        {draft?.contactName || "Nova interação"}
      </div>

      <div style={{
        color: K.muted,
        fontFamily: sans,
        fontSize: 13,
        lineHeight: 1.6,
      }}>
        {draft?.description}
      </div>

      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 7,
        marginTop: 14,
      }}>
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

      <div style={{
        display: "flex",
        gap: 8,
        marginTop: 16,
        flexWrap: "wrap",
      }}>
        <button
          onClick={onConfirm}
          style={{ ...primaryButton, background: K.green, color: "#0A0D0B" }}
        >
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

        <div style={{
          color: K.text,
          fontFamily: sans,
          fontSize: 14,
          lineHeight: 1.65,
        }}>
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

      <div style={{
        color: K.text,
        fontFamily: serif,
        fontSize: 27,
        fontWeight: 700,
      }}>
        {title}
      </div>

      <div style={{
        color: K.muted,
        fontFamily: sans,
        fontSize: 13,
        lineHeight: 1.6,
        marginTop: 7,
      }}>
        {body}
      </div>

      {onOpen && (
        <button
          onClick={onOpen}
          style={{ ...secondaryButton, marginTop: 13 }}
        >
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

const ConexiaLabHome = forwardRef(function ConexiaLabHome({
  userId,
  firstName,
  contacts = [],
  interactions = [],
  onOpenContact,
  onDataChanged,
  network,
  voiceEngine = "openai",
  autoStart = false,
}, ref) {
  const networkRef = useRef(network);
  networkRef.current = network;
  const [prefs, setPrefs] = useState(null);
  const [selectedVoiceEngine, setSelectedVoiceEngine] = useState(voiceEngine);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(true);

  const [conversationActive, setConversationActive] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");
  const [currentView, setCurrentView] = useState("today");
  const [input, setInput] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  // danna-capture-v1
  const [draft, setDraft] = useState(null);
  const [pendingContact, setPendingContact] = useState(null);
  const [pendingGrouping, setPendingGrouping] = useState(null);
  const pendingGroupingRef = useRef(null);
  const [groupChoice, setGroupChoice] = useState("");
  const [contactNameInput, setContactNameInput] = useState("");
  const pendingContactRef = useRef(null);
  const captureBusyRef = useRef(false);
  const pendingNameRef = useRef({ awaiting: false, candidate: null });
  const autoStartAttemptedRef = useRef(false);
  const [connectionData, setConnectionData] = useState(null);
  const [error, setError] = useState("");
  const [showText, setShowText] = useState(false);
    const [textInput, setTextInput] = useState("");

  const liveRef = useRef(null);
  const conversationActiveRef = useRef(false);
  // danna-single-click-v1
  const preferencesReadyRef = useRef(Promise.resolve(null));
  const greetedThisSessionRef = useRef(false);
  const recentTurnsRef = useRef([]);
  const turnSeqRef = useRef(0);
  const lastSavedContextRef = useRef(null);

  const isStaleTurn = turnId =>
    Boolean(turnId) && turnId !== turnSeqRef.current;

  const sessionContextRef = useRef({
    activePerson: null,
    activePeople: [],
    activeTopics: [],
    lastView: "today",
    lastQuestion: "",
    lastSavedInteraction: null,
  });

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

    preferencesReadyRef.current = (async () => {
      if (!userId) return null;

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
      return { prefs: p, profile: prof };
    })().catch(error => {
      console.warn("[Danna] Perfil indisponível:", error);
      if (alive) setPrefsLoading(false);
      return null;
    });

    return () => {
      alive = false;
    };
  }, [userId]);

  const timeZone =
    profileSnapshot?.timezone || "America/Sao_Paulo";

  const displayName =
    prefs?.preferred_name ||
    profileSnapshot?.first_name ||
    profileSnapshot?.name ||
    firstName ||
    "";

  const spokenName = resolveDannaSpokenName(prefs, profileSnapshot, firstName);

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

  const priorities = useRelationshipIntelligence(userId, contacts, interactions);

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
        body: `${
          pending.age === 0
            ? "Hoje"
            : pending.age === 1
              ? "Ontem"
              : `Há ${pending.age} dias`
        }: ${pending.text.slice(0, 160)}`,
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
    turnSeqRef.current += 1;
    conversationActiveRef.current = false;
    greetedThisSessionRef.current = false;

    setConversationActive(false);

    try { liveRef.current?.disconnect(); } catch {}

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
      console.warn(
        "[CONÉXIA Live] Não consegui persistir first_contact_completed:",
        e
      );
    }
  };

  const beginConversation = async () => {
    if (liveRef.current?.connecting) return;

    if (conversationActiveRef.current) {
      stopConversation();
      return;
    }

    setCurrentView(v => v === "saved" ? "today" : v);
    setInput("");
    setError("");
    setVoiceState("connecting");

    const VoiceEngine =
      selectedVoiceEngine === "fish"
        ? DannaFishLive
        : selectedVoiceEngine === "gemini"
          ? DannaGeminiLive
          : DannaLive;

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

      onAutoStop: reason => {
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

      onUserSpeechStart: () => {
        turnSeqRef.current += 1;
        setVoiceState("listening");
      },

      onUserTranscript: spoken => {
        const clean = String(spoken || "").trim();

        if (!clean || !conversationActiveRef.current) {
          return;
        }

        live.interrupt();
        setInput(clean);

        void handleUserTurn(clean);
      },

      onTranscript: () => {},

      onError: err => {
        setError(
          err?.message ||
          "Não consegui manter a conversa por voz."
        );

        setVoiceState("idle");
      },
    });

    liveRef.current = live;

    let ok = false;

    try {
      ok = await live.connect();
    } catch (e) {
      ok = false;
      setError(
        e?.message || "Não consegui abrir a conversa por voz."
      );
      setVoiceState("idle");
    }

    if (!ok) {
      liveRef.current = null;
      conversationActiveRef.current = false;
      setConversationActive(false);
      return;
    }

    if (liveRef.current !== live) {
      live.disconnect("opening_cancelled");
      return;
    }
    if (live.outCtx && live.outCtx.state !== "running") {
      live.disconnect("audio_requires_gesture");
      liveRef.current = null;
      conversationActiveRef.current = false;
      setConversationActive(false);
      setVoiceState("idle");
      setError("Toque em Conversar para liberar o áudio neste navegador.");
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

    const greetingTurn = ++turnSeqRef.current;
    const loaded = await preferencesReadyRef.current;
    if (isStaleTurn(greetingTurn) || liveRef.current !== live ||
        !conversationActiveRef.current) return;
    if (greetedThisSessionRef.current) return;

    const openingPrefs = loaded?.prefs || prefs;
    const openingProfile = loaded?.profile || profileSnapshot;
    const openingName = resolveDannaSpokenName(openingPrefs, openingProfile, firstName);
    const openingTimeZone = openingProfile?.timezone || timeZone;
    let storedFirstContact = false;
    try {
      storedFirstContact = Boolean(
        firstContactStorageKey && window.localStorage.getItem(firstContactStorageKey)
      );
    } catch {}

    greetedThisSessionRef.current = true;
    let openingBrain = null;
    try { openingBrain = await loadDannaKnowledge(); }
    catch (error) { console.warn('[Danna] Abertura sem contexto:', error.message); }
    if (isStaleTurn(greetingTurn) || liveRef.current !== live || !conversationActiveRef.current) return;
    speak(buildDannaGreeting(openingBrain, openingName, openingTimeZone), true);
    if (!openingPrefs?.first_contact_completed && !storedFirstContact) {
      void markFirstContactCompleted();
    }
  };

  useImperativeHandle(ref, () => ({
    start() {
      if (!liveRef.current && !conversationActiveRef.current) {
        void beginConversation();
      }
    },
  }));

  // Tenta iniciar ao montar a tela. Se o navegador exigir um gesto,
  // o botão existente continua disponível, sem repetição automática.
  useEffect(() => {
    if (!autoStart || !userId || prefsLoading || autoStartAttemptedRef.current) return;
    autoStartAttemptedRef.current = true;
    if (!liveRef.current && !conversationActiveRef.current) void beginConversation();
  }, [autoStart, userId, prefsLoading]);

  const findContactByName = name => {
    const n = normalize(name);

    if (!n) return null;

    return (
      contacts.find(c => normalize(c.name) === n) ||
      contacts.find(c =>
        normalize(c.name).includes(n) ||
        n.includes(normalize(c.name))
      )
    );
  };

  const analyzeCapture = async (text, turnId = null) => {
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

REGRA CRÍTICA SOBRE PESSOAS:
- "contactName" é SEMPRE o nome da pessoa mencionada explicitamente na FALA ATUAL ou, apenas quando a fala atual for continuação inequívoca, na CONVERSA RECENTE.
- Extraia primeiro o nome falado. Só depois verifique se essa pessoa existe em CONTATOS.
- Preserve "contactName" mesmo quando essa pessoa NÃO existir em CONTATOS.
- A ausência da pessoa em CONTATOS NUNCA é motivo para retornar "contactName": null.
- "existingContactId" é independente de "contactName".
- Só preencha "existingContactId" quando houver correspondência clara com um contato cadastrado.
- Se a pessoa foi mencionada mas não está cadastrada, retorne obrigatoriatoriamente o nome ouvido em "contactName" e "existingContactId": null.
- Não substitua uma pessoa não cadastrada por um contato de nome parecido.
- Não descarte sobrenomes.
- Preserve o nome da forma mais completa possível.

EXEMPLOS:

FALA ATUAL:
"Conversei com Douglas Oliveira hoje sobre o projeto."

Se Douglas Oliveira NÃO estiver em CONTATOS:
{
  "contactName": "Douglas Oliveira",
  "existingContactId": null
}

FALA ATUAL:
"Falei com João da Silva."

Se João da Silva estiver em CONTATOS:
{
  "contactName": "João da Silva",
  "existingContactId": "id-do-contato"
}

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

    const parsed = firstJson(data.content?.[0]?.text || "");

    if (!parsed) {
      throw new Error("Não consegui estruturar a interação.");
    }

    if (!parsed.existingContactId && parsed.contactName) {
      const local = findContactByName(parsed.contactName);

      if (local) parsed.existingContactId = local.id;
    }

    if (isStaleTurn(turnId)) return;

    parsed.sourceText = text;
    const exactMatches = contacts.filter(c =>
      parsed.contactName && normalize(c.name) === normalize(parsed.contactName)
    );
    if (!contacts.some(c => c.id === parsed.existingContactId)) {
      parsed.existingContactId = null;
    }
    if (parsed.contactName) {
      parsed.existingContactId = exactMatches.length === 1 ? exactMatches[0].id : null;
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
    const loadDannaKnowledge = async () => {
    if (!userId) {
      throw new Error("Sessão não autenticada.");
    }

    const now = new Date();
    const nowIso = now.toISOString();

    const raw = await loadRelationshipData(supabase, userId, now);
    const contactsRes = { data: raw.contacts };
    const interactionsRes = { data: raw.interactions };
    const memoryRes = { data: raw.memories };
    const alertsRes = { data: raw.alerts };
    const eventsRes = { data: raw.events };
    const profileRes = { data: raw.profile };
    const signalsRes = await supabase.from('signals')
      .select('id,contact_id,source,type,title,summary,identity_confidence,detected_at,expires_at,status')
      .eq('user_id', userId).in('status', ['new', 'evaluated', 'relevant'])
      .order('detected_at', { ascending: false }).limit(100);
    const intelligence = computeRelationshipIntelligence(raw, now);

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

    const interactionsForAI = (interactionsRes.data || [])
      .slice(0, 200)
      .map(i => ({
        person: contactName(i.contact_id) || capturePerson(i.description) || "a identificar",
        date: i.created_at,
        type: i.type || "",
        description: (i.description || "").slice(0, 400),
        tags: i.tags || [],
        sentiment: i.sentiment || "",
        valueGenerated: i.value_generated || null,
      }));

    const memoryForAI = (memoryRes.data || []).map(m => ({
      id: m.id,
      metadata: m.metadata,
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

    const tz =
      profileRes.data?.timezone ||
      timeZone ||
      "America/Sao_Paulo";

    const dayKey = d => {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(d));
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    };

    const timeLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", {
          timeZone: tz,
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(d));
      } catch {
        return "";
      }
    };

    const weekdayLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", {
          timeZone: tz,
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
        }).format(new Date(d));
      } catch {
        return dayKey(d);
      }
    };

    const events = (eventsRes.data || [])
      .filter(e => !["cancelado", "concluido"].includes(e.status))
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

    const week_overview = Array.from(
      { length: 7 },
      (_, idx) => {
        const ref = new Date(now.getTime() + idx * 86400000);
        const key = dayKey(ref);
        const dayEvents = upcomingEvents.filter(e => e.day === key);

        return {
          date: key,
          label: idx === 0
            ? `hoje (${weekdayLabel(ref)})`
            : idx === 1
              ? `amanhã (${weekdayLabel(ref)})`
              : weekdayLabel(ref),
          eventCount: dayEvents.length,
          events: dayEvents.map(({ day, ...rest }) => rest),
        };
      }
    );

    const todayKey = dayKey(now);

    const overdueNextActions = people
      .filter(c =>
        c.next_action &&
        c.next_action_date &&
        String(c.next_action_date).slice(0, 10) < todayKey
      )
      .map(c => ({
        person: c.name,
        nextAction: c.next_action,
        dueDate: c.next_action_date,
      }))
      .slice(0, 30);

    const upcomingBirthdays = people
      .map(c => {
        const m = String(c.birthday || "")
          .match(/(\d{4})-(\d{2})-(\d{2})/);

        if (!m) return null;

        const year = now.getFullYear();

        let next = new Date(
          `${year}-${m[2]}-${m[3]}T12:00:00`
        );

        if (next.getTime() < now.getTime() - 86400000) {
          next = new Date(
            `${year + 1}-${m[2]}-${m[3]}T12:00:00`
          );
        }

        const inDays = Math.round(
          (next.getTime() - now.getTime()) / 86400000
        );

        return inDays >= 0 && inDays <= 30
          ? {
              person: c.name,
              date: `${m[3]}/${m[2]}`,
              inDays,
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.inDays - b.inDays);

    const coolingContacts = people
      .filter(c =>
        c.ideal_frequency_days && c.last_interaction_at
      )
      .map(c => ({
        person: c.name,
        daysSinceLast: Math.floor(
          (now.getTime() - new Date(c.last_interaction_at).getTime()) /
          86400000
        ),
        idealFrequencyDays: c.ideal_frequency_days,
      }))
      .filter(x => x.daysSinceLast > x.idealFrequencyDays)
      .sort(
        (a, b) =>
          (b.daysSinceLast - b.idealFrequencyDays) -
          (a.daysSinceLast - a.idealFrequencyDays)
      )
      .slice(0, 20);

    const profile = profileRes.data || null;

    return {
      contacts: contactsForAI,
      interactions: interactionsForAI,
      overview: {
        generated_at: nowIso,
        today: intelligence.today,
        timezone: tz,
        relationship_intelligence: intelligence,
        profile: profile
          ? {
              name: profile.first_name || profile.name || null,
              company: profile.company || null,
              role: profile.role || null,
              city: profile.city || null,
              segment: profile.segment || null,
              objectives: profile.objectives || [],
              lastDiscussedPerson:
                contactName(profile.last_discussed_contact_id),
              lastDiscussedAt:
                profile.last_discussed_contact_at || null,
              calendarConnected: Boolean(profile.calendar_ics_url),
            }
          : null,
        network_overview: buildNetworkOverview(people, interactionsRes.data || [], now, true),
        counts: {
          contacts: people.length,
          interactionsLoaded: (interactionsRes.data || []).length,
          activeMemories: memoryForAI.length,
          openAlerts: alertsForAI.length,
          upcomingEvents: upcomingEvents.length,
          activeSignals: signalsForAI.length,
        },
        week_overview,
        upcoming_events:
          upcomingEvents.map(({ day, ...rest }) => rest),
        recent_past_events:
          recentPastEvents.map(({ day, ...rest }) => rest),
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

  const askNetwork = async (text, turnId = null) => {
    let brain = null;

    try {
      brain = await loadDannaKnowledge();
    } catch (e) {
      console.warn(
        "[Danna Brain] snapshot indisponível; usando dados da Home.",
        e
      );
    }

    const people = brain?.contacts || contacts.map(c => ({
      id: c.id,
      name: c.name,
      company: c.company || "",
      role: c.role || "",
      category: c.category || "",
      city: c.city || "",
      notes: (c.personal_notes || c.notes || "").slice(0, 400),
      nextAction: c.next_action || c.nextAction || null,
      nextActionDate: c.next_action_date || c.nextActionDate || null,
      lastInteractionAt:
        c.last_interaction_at || c.lastInteractionAt || null,
    }));

    const contactMap = new Map(
      contacts.map(c => [c.id, c.name])
    );

    const recent = brain?.interactions || [...interactions]
      .sort(
        (a, b) =>
          new Date(interactionDate(b) || 0) -
          new Date(interactionDate(a) || 0)
      )
      .slice(0, 120)
      .map(i => ({
        person:
          contactMap.get(interactionContactId(i)) ||
          "desconhecido",
        date: interactionDate(i),
        type: i.type || "",
        description:
          (i.description || i.note || i.notes || "")
            .slice(0, 500),
        tags: i.tags || [],
        sentiment: i.sentiment || "",
      }));

    const networkScope = isNetworkQuestion(text);
    const conversationContext = networkScope
      ? { scope: "network", activePerson: null, activePeople: [], lastSavedInteraction: null }
      : { ...sessionContextRef.current, lastSavedInteraction: lastSavedContextRef.current };
    const promptOverview = brain?.overview && networkScope
      ? { ...brain.overview, profile: { ...brain.overview.profile, lastDiscussedPerson: null, lastDiscussedAt: null } }
      : brain?.overview;
    const ctx = {
      ...conversationContext,
      networkOrganization: networkRef.current
        ? networkRef.current.circles.map(c => ({
            id: c.id,
            path: circlePath(networkRef.current.circles, c.id),
            contactIds: Object.keys(networkRef.current.assignments)
              .filter(id => networkRef.current.assignments[id] === c.id),
          }))
        : [],
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
${JSON.stringify(networkScope ? null : lastSavedContextRef.current)}

ESCOPO DESTA PERGUNTA:
${networkScope ? "REDE INTEIRA: use network_overview e todas as pessoas. O foco de turnos anteriores não limita esta análise. Comece pela visão do conjunto, depois cite exemplos de pessoas diferentes quando existirem evidências. Nunca transforme um contato na análise da rede inteira. Não invente uma nota de saúde. Se a amostra for limitada ou o snapshot falhar, declare a limitação." : "Responda ao pedido atual; contexto anterior serve apenas para referências relevantes."}

PERGUNTA ATUAL:
${text}

SNAPSHOT FRESCO DO CONÉXIA (lido agora do banco; fonte de verdade para agenda, memória relacional, alertas, sinais e pontos de atenção):
${brain ? JSON.stringify(promptOverview) : "indisponível nesta consulta; use somente pessoas e interações abaixo e avise se a pergunta depender de agenda ou memória."}

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
- DECISÃO CENTRAL: para quem merece atenção agora, use relationship_intelligence.decisions: pessoa, motivo, nextMove, confidence e evidence. Não reordene por suposição. Padrões e dimensões explicam a rede; não comprovam urgência de uma pessoa. Se status for no_supported_action, não invente urgência.
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

    const parsed = firstJson(data.content?.[0]?.text || "");

    if (!parsed) {
      throw new Error("Não consegui estruturar a resposta.");
    }

    const resolvedPeople = (parsed.people || [])
      .map(name => findContactByName(name))
      .filter(Boolean)
      .slice(0, 2);

    const finalAnswer =
      parsed.answer || "Não encontrei evidência suficiente.";

    if (isStaleTurn(turnId)) return;

    setAnswer(finalAnswer);

    sessionContextRef.current.lastQuestion = text;
    sessionContextRef.current.activePeople =
      resolvedPeople.map(p => p.name);
    sessionContextRef.current.activeTopics = parsed.topics || [];
    sessionContextRef.current.lastView = parsed.view || "answer";

    sessionContextRef.current.activePerson = networkScope ? null : (parsed.activePerson || null);
    if (networkScope) sessionContextRef.current.activePeople = [];

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

  const classifyIntent = async text => {
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
    const handleUserTurn = async text => {
    const line = String(text || "").trim();

    if (!line) return;

    const turnId = ++turnSeqRef.current;

    addTurn("user", line);
    setLastQuestion(line);
    setInput(line);
    setVoiceState("thinking");
    setError("");

    const n = normalize(line);

    if (
      /^(para|pare|parar|stop|silencio|fica quieta|pode parar|pare de falar|para de falar)[.! ]*$/.test(n)
    ) {
      const live = liveRef.current;

      if (typeof live?.silence === "function") {
        live.silence();
      } else {
        live?.interrupt();
      }

      setVoiceState("listening");
      return;
    }

    if (pendingGroupingRef.current) {
      await handleCircleChoice(line);
      return;
    }

    if (pendingContactRef.current) {
      const nameState = pendingNameRef.current;
      if (nameState.candidate && /^(sim|isso|correto|certo|pode|pode cadastrar|pode adicionar)[.! ]*$/.test(n)) {
        await addCapturedContact(nameState.candidate);
        return;
      }
      if (nameState.candidate && /^(nao|nao e|nome errado|corrigir|corrige)[.! ]*$/.test(n)) {
        pendingNameRef.current = { awaiting: true, candidate: null };
        speak("Qual é o nome correto? O relato continua salvo.", true);
        return;
      }
      if (nameState.awaiting) {
        const name = extractPendingPersonName(line);
        if (name) {
          pendingNameRef.current = { awaiting: false, candidate: name };
          speak(`Você quer cadastrar ${name} e vincular ao relato que já salvei?`, true);
          return;
        }
      }
      if (/^(sim|pode|pode adicionar|pode cadastrar|quero|adiciona|adicionar|adicionar agora|cadastra|cadastrar|cadastrar agora)[.! ]*$/.test(n)) {
        await addCapturedContact();
        return;
      }
      if (/^(nao|agora nao|nao agora|depois|mais tarde|nao quero)[.! ]*$/.test(n)) {
        declineCapturedContact();
        return;
      }
      const named = /^(?:adicionar|cadastrar)\s+(.+?)[.!]*$/i.exec(line);
      if (named) {
        await addCapturedContact(named[1]);
        return;
      }
    }

    if (currentView === "capture" && draft) {
      if (
        /^(sim|pode|salva|salvar|confirma|confirmar|correto|isso|certo|exato|perfeito)/.test(n)
      ) {
        await confirmCapture();
        return;
      }

      if (/^(nao|não|corrige|corrigir|cancela|cancelar)/.test(n)) {
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

      const response = /obrigad/.test(n)
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
        sessionContextRef.current.activePerson ||
        lastSavedContextRef.current
          ? "Estou aqui. Pode continuar de onde paramos."
          : "Oi. Como você está? O que vamos ver hoje?";

      setAnswer(response);
      setCurrentView("answer");
      speak(response, true);
      return;
    }

    try {
      const intent = await classifyIntent(line);

      if (isStaleTurn(turnId)) return;

      if (intent === "capture") {
        await analyzeCapture(line, turnId);
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

      await askNetwork(line, turnId);
    } catch (e) {
      if (isStaleTurn(turnId)) return;

      setError(`Não consegui processar agora: ${e.message}`);
      setVoiceState("idle");
    }
  };

  const refreshCaptureData = async () => {
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


  const askContactCircle = (contactId, contactName) => {
    const network = networkRef.current;
    if (!network || network.assignments[contactId]) return "";
    const pending = { contactId, contactName };
    pendingGroupingRef.current = pending;
    setPendingGrouping(pending);
    setGroupChoice("");
    const examples = network.circles
      .filter(c => !c.parent_id).slice(0, 5).map(c => c.name);
    return ` Em qual círculo você quer colocar ${contactName}? ${examples.length ? `Você tem ${examples.join(", ")}. ` : "Você pode criar seu primeiro círculo. "}Se preferir, pode organizar depois.`;
  };

  const finishCircleChoice = async circleId => {
    const network = networkRef.current;
    const pending = pendingGroupingRef.current;
    if (!pending || captureBusyRef.current) return;
    if (!circleId) {
      pendingGroupingRef.current = null;
      setPendingGrouping(null);
      const message = `Tudo bem. ${pending.contactName} continua salvo. Você pode organizar depois na Minha rede.`;
      setAnswer(message);
      speak(message, true);
      return;
    }
    if (!network || network.loading || network.error) {
      speak("Ainda não consegui carregar seus círculos. Tente novamente ou escolha organizar depois na tela.", true);
      return;
    }
    captureBusyRef.current = true;
    try {
      await network.assign(pending.contactId, circleId);
      const message = `Pronto. ${pending.contactName} está em ${circlePath(network.circles, circleId)}.`;
      pendingGroupingRef.current = null;
      setPendingGrouping(null);
      setAnswer(message);
      speak(message, true);
    } catch (e) {
      setError(e.message);
      setVoiceState("listening");
    } finally {
      captureBusyRef.current = false;
    }
  };

  const handleCircleChoice = async line => {
    const network = networkRef.current;
    const n = normalize(line).replace(/[.!?]+$/, "");
    if (/^(depois|organizo depois|organizar depois|mais tarde|agora nao|nao|cancelar|cancela)$/.test(n)) {
      await finishCircleChoice(null);
      return;
    }
    if (!network || network.loading || network.error) {
      speak("Escolha organizar depois ou tente novamente quando seus círculos carregarem.", true);
      return;
    }
    const resolved = resolveCircle(network.circles, line.replace(/[.!?]+$/, ""));
    if (resolved) {
      await finishCircleChoice(resolved.id);
      return;
    }
    const createMatch = /^(?:criar|crie|cria)\s+(?:um\s+)?(?:circulo|círculo|grupo|subgrupo)\s+(.+?)(?:\s+(?:em|dentro de)\s+(.+))?$/i.exec(line.replace(/[.!?]+$/, ""));
    if (createMatch && !captureBusyRef.current) {
      const parent = createMatch[2]
        ? resolveCircle(network.circles, createMatch[2])
        : null;
      if (createMatch[2] && !parent) {
        speak("Não consegui identificar o círculo principal. Diga o caminho completo ou escolha na tela.", true);
        return;
      }
      captureBusyRef.current = true;
      try {
        const created = await network.create(createMatch[1], parent?.id || null);
        setGroupChoice(created.id);
        const personName = pendingGroupingRef.current?.contactName || "a pessoa";
        setAnswer(`Criei ${created.name}. Selecione Salvar grupo para colocar ${personName} nele.`);
        speak(`Criei ${created.name}. Diga ${created.name} para colocar a pessoa nele, ou confirme na tela.`, true);
      } catch (e) {
        setError(e.message);
        setVoiceState("listening");
      } finally {
        captureBusyRef.current = false;
      }
      return;
    }
    speak("Escolha o nome de um círculo, diga criar círculo seguido do nome, ou diga organizar depois. Para subgrupos com nomes iguais, diga o caminho completo ou escolha na tela.", true);
  };

  const declineCapturedContact = () => {
    pendingContactRef.current = null;
    pendingNameRef.current = { awaiting: false, candidate: null };
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
        "Claro. Qual é o nome da pessoa? O relato já está salvo.";
      pendingNameRef.current = { awaiting: true, candidate: null };
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
      pendingNameRef.current = { awaiting: false, candidate: null };
      setPendingContact(null);

      let commitmentWarning = '';
      try { await updateDannaContact(supabase, userId, linked); }
      catch (error) {
        commitmentWarning = ' Não consegui confirmar o acompanhamento do compromisso.';
        setError(error.message);
      }
      invalidateRelationshipIntelligence();

      const message =
        `Pronto. ${linked.contactName} está na sua rede e vinculado ao relato que já salvei.` + commitmentWarning + askContactCircle(linked.contactId, linked.contactName);
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
      pendingNameRef.current = {
        awaiting: saved.needsContact && !saved.contactName,
        candidate:
          saved.needsContact && saved.contactName
            ? saved.contactName
            : null,
      };
      setContactNameInput(saved.contactName || "");

      let message;

      if (saved.needsContact) {
        message = saved.contactName
          ? `Registrei o relato. Vi que ${saved.contactName} não está na sua lista. Você quer adicionar essa pessoa agora?`
          : "Registrei o relato. Qual é o nome da pessoa que você quer vincular? Se preferir, podemos deixar para depois.";
      } else {
        message = `Pronto. Registrei com ${saved.contactName || "essa pessoa"}.`;

        try { await updateDannaContact(supabase, userId, saved); }
        catch (error) {
          message += ' O relato está salvo, mas não consegui confirmar o acompanhamento do próximo passo.';
          setError(error.message);
        }
      }

      if (saved.needsContact && saved.commitmentError) {
        message += ' Não consegui confirmar o acompanhamento do compromisso.';
        setError(saved.commitmentError);
      }
      invalidateRelationshipIntelligence();
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

  const askWhy = () => {
    const text = connectionData?.people?.length === 2
      ? `Por que você acha que ${connectionData.people[0].name} e ${connectionData.people[1].name} deveriam se conectar?`
      : "Por quê?";

    handleUserTurn(text);
  };

  const createBridge = () => {
    if (!connectionData?.people?.length) return;

    const [a, b] = connectionData.people;

    const response =
      `A melhor próxima ação é você fazer a ponte entre ${a.name} e ${b.name}. Posso deixar isso como próximo movimento.`;

    setAnswer(response);
    setCurrentView("answer");
    speak(response, true);
  };

  const remindTomorrow = async () => {
    const person = connectionData?.people?.[0];

    if (!person) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const date = tomorrow.toISOString().slice(0, 10);
    const other = connectionData?.people?.[1]?.name;

    const action = other
      ? `Apresentar ${person.name} a ${other}`
      : `Retomar ${person.name}`;

    const { error } = await supabase
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

    speak("Fechado. Deixei isso para amanhã.", true);
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

  const greeting = !firstContactCompleted
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
            {pendingGrouping && network && <div style={{ marginTop: 16 }}>
              <ContactCircleField
                network={network}
                value={groupChoice}
                onChange={setGroupChoice}
                label={`Onde colocar ${pendingGrouping.contactName}?`}
              />
              <button
                disabled={network.loading || Boolean(network.error)}
                onClick={() => finishCircleChoice(groupChoice || null)}
                style={secondaryButton}
              >Salvar grupo</button>{" "}
              <button
                onClick={() => finishCircleChoice(null)}
                style={secondaryButton}
              >Organizar depois</button>
            </div>}
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
        )}

        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 22,
        }}>
          <label style={{
            color: K.muted,
            fontFamily: sans,
            fontSize: 12,
            marginBottom: 14,
          }}>
            Voz da Danna:{" "}
            <select
              aria-label="Voz da Danna"
              value={selectedVoiceEngine}
              disabled={
                conversationActive ||
                voiceState === "connecting"
              }
              onChange={e => setSelectedVoiceEngine(e.target.value)}
              style={{
                background: K.card2,
                color: K.text,
                border: `1px solid ${K.border}`,
                borderRadius: 8,
                padding: 8,
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
              <option value="fish">Fish Audio — teste</option>
            </select>
          </label>

          {conversationActive && (
            <button
              onClick={() => {
                turnSeqRef.current += 1;

                speak(
                  `Oi${spokenName ? `, ${spokenName}` : ""}. Como vai? Estou aqui para ajudar você a cuidar das suas conexões. Pode me interromper quando quiser. Por onde vamos começar?`,
                  true
                );
              }}
              style={{
                ...secondaryButton,
                marginBottom: 12,
              }}
            >
              Ouvir frase de teste
            </button>
          )}

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
              opacity: 0.85,
            }}>
              “{input}”
            </div>
          )}

          <button
            onClick={() => setShowText(v => !v)}
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
            {showText ? "Fechar texto" : "Prefiro escrever"}
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
              onChange={e => setTextInput(e.target.value)}
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
              <button onClick={submitText} style={primaryButton}>
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
});

export default ConexiaLabHome;
