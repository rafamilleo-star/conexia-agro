// src/components/ConexiaLabHome.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../utils/supabase";
import { computePriorities } from "../../shared/priorityEngine.js";
import { detectPatterns, PATTERN_NOTES } from "../../shared/relationshipPatternDetector.js";

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
  const label = listening ? "Ouvindo" : thinking ? "Pensando" : speaking ? "Falando" : active ? "Conversando" : "Conversar";

  return (
    <button
      onClick={onClick}
      style={{
        width: 154,
        height: 154,
        borderRadius: "50%",
        background: listening ? `${K.gold}25` : K.card2,
        border: `2px solid ${active ? K.gold : K.border}`,
        boxShadow: active ? `0 0 0 12px ${K.gold}0C, 0 0 42px ${K.gold}20` : "0 10px 30px rgba(0,0,0,.25)",
        color: active ? K.gold : K.text,
        cursor: "pointer",
        transition: "all .2s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ fontSize: 30, lineHeight: 1 }}>{speaking ? "◉" : listening ? "●" : "◎"}</div>
      <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 800, marginTop: 8 }}>{label}</div>
      <div style={{ fontFamily: sans, fontSize: 9, color: K.muted, marginTop: 4 }}>
        {active ? "toque para encerrar" : "toque uma vez"}
      </div>
    </button>
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

  const recRef = useRef(null);
  const transcriptRef = useRef("");
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

  const chooseVoice = () => {
    if (!("speechSynthesis" in window)) return null;

    const voices = window.speechSynthesis.getVoices() || [];

    const score = (voice) => {
      const n = normalize(voice?.name);
      const l = normalize(voice?.lang);

      let s = l === "pt-br" ? 100 : l.startsWith("pt") ? 60 : -100;

      if (n.includes("google")) s += 30;
      if (n.includes("microsoft")) s += 25;
      if (n.includes("natural")) s += 25;
      if (n.includes("neural")) s += 25;
      if (/(compact|robot|child|espeak|festival)/.test(n)) s -= 50;

      return s;
    };

    return [...voices].sort((a,b) => score(b) - score(a))[0] || null;
  };

  const speak = (text, resumeListening = true) => {
    const line = String(text || "").trim();

    if (!line || !("speechSynthesis" in window)) {
      if (resumeListening && conversationActiveRef.current) {
        startListening();
      }
      return;
    }

    addTurn("assistant", line);

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch {}

    setVoiceState("speaking");

    const utterance = new SpeechSynthesisUtterance(line);
    const voice = chooseVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "pt-BR";
    } else {
      utterance.lang = "pt-BR";
    }

    utterance.rate = 0.96;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setVoiceState("speaking");

    utterance.onend = () => {
      if (conversationActiveRef.current && resumeListening) {
        setTimeout(() => startListening(), 350);
      } else {
        setVoiceState("idle");
      }
    };

    utterance.onerror = () => {
      setVoiceState("idle");

      if (conversationActiveRef.current && resumeListening) {
        setTimeout(() => startListening(), 500);
      }
    };

    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setVoiceState("idle");
      }
    }, 80);
  };

  const stopListening = () => {
    try {
      recRef.current?.stop();
    } catch {}

    recRef.current = null;
  };

  const stopConversation = () => {
    conversationActiveRef.current = false;
    greetedThisSessionRef.current = false;
    setConversationActive(false);
    stopListening();

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setVoiceState("idle");
  };

  const startListening = () => {
    if (!conversationActiveRef.current) return;
    if (recRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
      setError(
        "Este navegador não liberou reconhecimento de voz. Use o campo de texto abaixo."
      );
      setVoiceState("idle");
      return;
    }

    setError("");
    transcriptRef.current = "";

    const rec = new SR();
    recRef.current = rec;

    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setVoiceState("listening");

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";

        if (event.results[i].isFinal) {
          finalText += t + " ";
        } else {
          interim += t + " ";
        }
      }

      if (finalText) transcriptRef.current += finalText;

      setInput(
        (transcriptRef.current + interim).trim()
      );
    };

    rec.onerror = (e) => {
      recRef.current = null;

      if (e?.error !== "no-speech" && e?.error !== "aborted") {
        setError("Não consegui ouvir. Tente novamente ou escreva.");
      }

      setVoiceState("idle");
    };

    rec.onend = () => {
      recRef.current = null;

      const spoken = transcriptRef.current.trim();

      if (spoken) {
        handleUserTurn(spoken);
      } else if (conversationActiveRef.current) {
        setVoiceState("idle");

        setTimeout(() => {
          if (
            conversationActiveRef.current &&
            !recRef.current
          ) {
            startListening();
          }
        }, 650);
      }
    };

    rec.start();
  };

  const beginConversation = () => {
    if (conversationActiveRef.current) {
      stopConversation();
      return;
    }

    conversationActiveRef.current = true;
    setConversationActive(true);

    setCurrentView(v => v === "saved" ? "today" : v);
    setInput("");
    setError("");

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();

      const unlock = new SpeechSynthesisUtterance("");
      unlock.volume = 0.01;
      window.speechSynthesis.speak(unlock);
    } catch {}

    if (!greetedThisSessionRef.current) {
      greetedThisSessionRef.current = true;

      setTimeout(() => {
        speak(
          `${greetingForNow(displayName, timeZone)} Estou ouvindo.`,
          true
        );
      }, 150);
    } else {
      setTimeout(() => startListening(), 80);
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
  "description":"resumo fiel em 1 ou 2 frases",
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

  const askNetwork = async (text) => {
    const people = contacts.map(c => ({
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

    const recent = [...interactions]
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
Você é o CONÉXIA, uma inteligência relacional pessoal.

PERSONALIDADE:
- conversa natural, fluida e segura;
- direto, inteligente e humano;
- não reinicie a conversa;
- NÃO diga "bom dia", "boa tarde" ou "boa noite" no meio da conversa;
- NÃO responda como chatbot corporativo;
- use o contexto dos turnos anteriores;
- entenda referências como "ele", "ela", "essa reunião", "essa pessoa", "isso", "amanhã";
- se o usuário acabou de registrar uma reunião e pergunta como se preparar, entenda que ele está falando dessa reunião;
- não invente informações;
- diferencie claramente fato registrado de recomendação sua;
- se faltarem dados essenciais, diga exatamente o que falta;
- seja útil: quando perguntarem como se preparar, sintetize histórico, temas, pendências, objetivo provável e perguntas recomendadas usando somente evidências disponíveis.

CONTEXTO ATIVO:
${JSON.stringify(ctx)}

ÚLTIMOS TURNOS DA CONVERSA:
${JSON.stringify(recentTurnsRef.current)}

ÚLTIMA INTERAÇÃO SALVA NESTA SESSÃO:
${JSON.stringify(lastSavedContextRef.current)}

PERGUNTA ATUAL:
${text}

PESSOAS DA REDE:
${JSON.stringify(people)}

INTERAÇÕES REGISTRADAS:
${JSON.stringify(recent)}

Responda SOMENTE JSON válido:
{
  "answer":"resposta natural, objetiva e útil. Pode usar até 8 frases se a pergunta exigir preparação ou análise.",
  "view":"answer|connection|person|insight",
  "people":["nomes exatos de até 2 pessoas relevantes"],
  "topics":["até 4 temas relevantes"],
  "suggestedActions":["why","bridge","tomorrow"],
  "activePerson":"nome da pessoa principal ou null"
}

REGRAS DE VIEW:
- connection: conexão concreta entre duas pessoas;
- person: foco principal em uma pessoa;
- insight: padrão ou provocação sobre a rede;
- answer: demais casos.

IMPORTANTE:
Se a pergunta for continuação clara do que acabou de ser falado, priorize o contexto da conversa e da última interação salva, mesmo que a pergunta atual não repita o nome da pessoa.
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
Classifique a intenção no CONÉXIA.

FALA ATUAL:
${text}

CONTEXTO ATIVO:
${JSON.stringify(sessionContextRef.current)}

ÚLTIMOS TURNOS:
${JSON.stringify(recentTurnsRef.current)}

ÚLTIMA INTERAÇÃO SALVA:
${JSON.stringify(lastSavedContextRef.current)}

Responda SOMENTE JSON:
{"intent":"capture|ask"}

capture:
- usuário está contando algo que aconteceu;
- encontro, ligação, reunião, mensagem, promessa ou nova informação que deve ser registrada.

ask:
- pergunta;
- pedido de análise;
- preparação para reunião;
- busca sobre pessoa;
- pedido de recomendação;
- conexão;
- continuação do assunto anterior;
- frase com pronomes ou contexto implícito, como "e agora?", "o que preciso saber?", "como me preparo?", "e ele?", "por quê?".

REGRA CRÍTICA:
Se houver dúvida entre capture e ask em uma frase que depende do contexto anterior, escolha ask.
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

    const parsed = firstJson(
      data.content?.[0]?.text || ""
    );

    return parsed?.intent === "capture"
      ? "capture"
      : "ask";
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

    const isPureGreeting =
      /^(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|e aí|fala|opa)[.! ]*$/.test(n);

    if (isPureGreeting) {
      const response =
        "Estou aqui. Pode continuar de onde paramos.";

      setAnswer(response);
      setCurrentView("answer");
      speak(response, true);
      return;
    }

    try {
      const intent = await classifyIntent(line);

      if (intent === "capture") {
        await analyzeCapture(line);
      } else {
        await askNetwork(line);
      }
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
    prefs?.greeting_mode === "direto"
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
          {currentView === "today"
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

      <div style={{
        marginTop: 10,
        display: "flex",
        justifyContent: "center",
        gap: 24,
        color: K.muted,
        fontFamily: sans,
        fontSize: 10,
      }}>
        <span>Hoje</span>
        <span>Rede</span>
        <span style={{
          color: K.gold,
          fontWeight: 800,
        }}>
          Conversar
        </span>
        <span>Eu</span>
      </div>
    </div>
  );
}
