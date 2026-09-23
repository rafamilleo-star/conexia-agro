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
  amber: "#D6A34A",
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

function daysSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function greetingForNow(name = "") {
  const h = new Date().getHours();
  const g = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return `${g}${name ? `, ${name}` : ""}.`;
}

function extractPreferredName(text) {
  const raw = String(text || "").trim();
  const patterns = [
    /(?:pode me chamar de|me chama de|chame de|prefiro|sou o|sou a)\s+([A-Za-zÀ-ÿ' -]{2,40})/i,
    /^([A-Za-zÀ-ÿ' -]{2,40})$/,
  ];
  for (const p of patterns) {
    const m = raw.match(p);
    if (m?.[1]) return m[1].trim().split(/\s+/).slice(0, 2).join(" ");
  }
  return raw.split(/\s+/).slice(-2).join(" ");
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

function ActionCard({ eyebrow, title, body, tone = "gold", onClick, actionLabel }) {
  const toneColor = tone === "green" ? K.green : tone === "amber" ? K.amber : tone === "red" ? K.red : K.gold;
  return (
    <div style={{ background: K.card, border: `1px solid ${toneColor}45`, borderRadius: 16, padding: 18 }}>
      <div style={{ color: toneColor, fontFamily: sans, fontSize: 10, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 8 }}>{eyebrow}</div>
      <div style={{ color: K.text, fontFamily: serif, fontSize: 21, lineHeight: 1.15, fontWeight: 700, marginBottom: 7 }}>{title}</div>
      <div style={{ color: K.muted, fontFamily: sans, fontSize: 13, lineHeight: 1.55 }}>{body}</div>
      {onClick && actionLabel && (
        <button onClick={onClick} style={{ marginTop: 13, background: "transparent", border: `1px solid ${toneColor}80`, color: toneColor, borderRadius: 9, padding: "9px 12px", fontFamily: sans, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function ConexiaLabHome({
  userId,
  firstName,
  contacts = [],
  interactions = [],
  onOpenContact,
  onDataChanged,
}) {
  const [mode, setMode] = useState("capture");
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [processingVoice, setProcessingVoice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState("");
  const [assistantLine, setAssistantLine] = useState("");
  const [prefs, setPrefs] = useState(null);
  const [profileSnapshot, setProfileSnapshot] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewBusy, setInterviewBusy] = useState(false);
  const recognitionRef = useRef(null);
  const speechBufferRef = useRef("");
  const voiceIntentRef = useRef("auto");

  const speak = (text) => {
    const line = String(text || "").trim();
    if (!line) return;
    setAssistantLine(line);
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(line);
    u.lang = "pt-BR";
    u.rate = 1.02;
    u.pitch = 0.96;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => {
    let active = true;
    const loadPrefs = async () => {
      if (!userId) return;
      setPrefsLoading(true);
      const [{ data: prefData }, { data: profData }] = await Promise.all([
        supabase.from("conexia_lab_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("id,name,first_name,company,role,city,segment").eq("id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setPrefs(prefData || null);
      setProfileSnapshot(profData || null);
      setPrefsLoading(false);
    };
    loadPrefs();
    return () => { active = false; };
  }, [userId]);

  const displayName = prefs?.preferred_name || profileSnapshot?.first_name || profileSnapshot?.name || firstName || "";

  const interviewQuestions = useMemo(() => {
    const q = [
      {
        key: "preferred_name",
        question: `${greetingForNow(displayName || firstName)} Antes de começarmos: como você prefere que eu te chame?`,
      },
    ];
    if (!profileSnapshot?.company) q.push({ key: "company", question: "Em qual empresa ou negócio você atua hoje?" });
    if (!profileSnapshot?.role) q.push({ key: "role", question: "E qual é a sua função ou papel principal?" });
    if (!profileSnapshot?.city) q.push({ key: "city", question: "Qual cidade é sua base principal?" });
    q.push(
      {
        key: "greeting_mode",
        question: "Você prefere que eu comece nossas conversas naturalmente, com bom dia, boa tarde ou boa noite, ou que eu vá direto ao ponto?",
      },
      {
        key: "conversation_style",
        question: "Quando eu trouxer uma leitura da sua rede, você prefere uma resposta direta, mais consultiva ou provocativa?",
      },
      {
        key: "primary_goal",
        question: "Última: quando você abrir o CONÉXIA, o que mais espera que eu faça por você e pela sua rede?",
      },
    );
    return q;
  }, [profileSnapshot, displayName, firstName]);

  const needsInterview = !prefsLoading && !prefs?.first_contact_completed;
  const currentInterview = interviewQuestions[Math.min(interviewStep, interviewQuestions.length - 1)];

  useEffect(() => {
    if (!needsInterview || !currentInterview || assistantLine) return;
    const t = setTimeout(() => speak(currentInterview.question), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsInterview, currentInterview?.key]);

  const saveInterviewAnswer = async (spoken) => {
    if (!currentInterview || interviewBusy) return;
    setInterviewBusy(true);
    setError("");
    try {
      const key = currentInterview.key;
      let value = String(spoken || "").trim();

      if (key === "preferred_name") {
        value = extractPreferredName(value);
      } else if (key === "greeting_mode") {
        const n = normalize(value);
        value = /(direto|sem sauda|objetiv)/.test(n) ? "direto" : "natural";
      } else if (key === "conversation_style") {
        const n = normalize(value);
        value = n.includes("provoc") ? "provocativo" : n.includes("consult") ? "consultivo" : "direto";
      }

      if (["company", "role", "city"].includes(key)) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ [key]: value })
          .eq("id", userId);
        if (profileError) throw profileError;
        setProfileSnapshot(p => ({ ...(p || {}), [key]: value }));
      } else {
        const payload = {
          user_id: userId,
          preferred_name: prefs?.preferred_name || null,
          greeting_mode: prefs?.greeting_mode || "natural",
          conversation_style: prefs?.conversation_style || "direto",
          primary_goal: prefs?.primary_goal || null,
          [key]: value,
        };
        const isLast = interviewStep >= interviewQuestions.length - 1;
        if (isLast) payload.first_contact_completed = true;

        const { data, error: prefError } = await supabase
          .from("conexia_lab_preferences")
          .upsert(payload, { onConflict: "user_id" })
          .select("*")
          .single();
        if (prefError) throw prefError;
        setPrefs(data);
      }

      const next = interviewStep + 1;
      if (next >= interviewQuestions.length) {
        const name = key === "preferred_name" ? value : (prefs?.preferred_name || displayName);
        speak(`Perfeito${name ? `, ${name}` : ""}. Já entendi como você prefere interagir comigo. A partir de agora, é só segurar o botão, falar e soltar.`);
        setInterviewStep(next);
      } else {
        setInterviewStep(next);
        setAssistantLine("");
        setTimeout(() => speak(interviewQuestions[next].question), 250);
      }
    } catch (e) {
      setError(`Não consegui guardar essa resposta: ${e.message}`);
    } finally {
      setInterviewBusy(false);
    }
  };

  const priorities = useMemo(
    () => computePriorities(contacts, {}, new Date().toISOString().slice(0,10), interactions),
    [contacts, interactions]
  );
  const patterns = useMemo(() => detectPatterns(contacts, interactions, new Date()), [contacts, interactions]);
  const pending = useMemo(() => pickInvisiblePending(interactions, contacts), [interactions, contacts]);

  const cards = useMemo(() => {
    const out = [];
    if (priorities?.main) {
      out.push({
        eyebrow: "Faça isso agora",
        title: priorities.main.title,
        body: priorities.main.reason,
        tone: "gold",
        onClick: () => onOpenContact?.(priorities.main.relationshipId),
        actionLabel: "Abrir pessoa",
      });
    }
    if (pending) {
      out.push({
        eyebrow: "Pode ter ficado pendente",
        title: pending.contact?.name || "Uma conversa merece revisão",
        body: `${pending.age === 0 ? "Hoje" : pending.age === 1 ? "Ontem" : `Há ${pending.age} dias`}: “${pending.text.slice(0, 150)}${pending.text.length > 150 ? "…" : ""}”`,
        tone: "amber",
        onClick: () => onOpenContact?.(pending.contact?.id),
        actionLabel: "Revisar relação",
      });
    }
    if (patterns?.[0]) {
      out.push({
        eyebrow: "O que você talvez não esteja vendo",
        title: "Há um movimento na sua rede",
        body: PATTERN_NOTES[patterns[0].type] || "O padrão de relacionamento mudou e merece uma olhada.",
        tone: "green",
      });
    }
    return out.slice(0,3);
  }, [priorities, pending, patterns, onOpenContact]);

  const analyzeCapture = async (sourceText = input) => {
    const text = String(sourceText || "").trim();
    if (!text || busy) return;
    setBusy(true); setError(""); setDraft(null); setSaved(""); setAnswer("");
    try {
      const existing = contacts.map(c => ({ id:c.id, name:c.name, company:c.company || "", role:c.role || "" }));
      const prompt = `Você é o motor de captura do CONÉXIA. Transforme a frase do usuário em dados estruturados, sem inventar nada.

CONTATOS JÁ EXISTENTES:
${JSON.stringify(existing)}

FRASE:
${text}

Responda SOMENTE JSON válido:
{
  "contactName": "nome da pessoa mencionada ou null",
  "existingContactId": "id exato se houver correspondência clara na lista, senão null",
  "company": "empresa explicitamente mencionada ou null",
  "role": "cargo explicitamente mencionado ou null",
  "interactionType": "reuniao|ligacao|mensagem|encontro|evento|outro",
  "description": "resumo fiel em 1 ou 2 frases",
  "sentiment": "positivo|neutro|negativo",
  "tags": ["até 5 temas explícitos"],
  "nextAction": "compromisso/próximo passo explicitamente mencionado ou null",
  "nextActionDate": "YYYY-MM-DD somente se a data puder ser inferida com segurança, senão null",
  "confidence": 0.0
}
Regras: não deduza cargo, empresa, relação, compromisso ou data que não estejam na frase. Se houver dúvida, use null. confidence entre 0 e 1.`;

      const res = await fetch("/api/claude", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ prompt, maxTokens:700 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      const parsed = firstJson(data.content?.[0]?.text || "");
      if (!parsed?.contactName && !parsed?.existingContactId) throw new Error("Não consegui identificar com segurança com quem foi a interação.");
      if (!parsed.existingContactId && parsed.contactName) {
        const local = contacts.find(c => normalize(c.name) === normalize(parsed.contactName));
        if (local) parsed.existingContactId = local.id;
      }
      setDraft(parsed);
      setInput(text);
      speak(`Entendi. ${parsed.contactName ? `É sobre ${parsed.contactName}. ` : ""}${parsed.description || ""} Quer que eu salve?`);
    } catch (e) {
      setError(`Não consegui interpretar isso com segurança: ${e.message}`);
      speak("Não consegui interpretar isso com segurança. Tenta me contar de outro jeito.");
    } finally {
      setBusy(false);
    }
  };

  const confirmCapture = async () => {
    if (!draft || busy) return;
    setBusy(true); setError(""); setSaved("");
    try {
      let contactId = draft.existingContactId || null;
      let contact = contacts.find(c => c.id === contactId) || null;

      if (!contactId) {
        const { data, error: insertContactError } = await supabase
          .from("contacts")
          .insert({
            user_id: userId,
            name: draft.contactName,
            company: draft.company || null,
            role: draft.role || null,
            status: "active",
          })
          .select("id,name")
          .single();
        if (insertContactError) throw insertContactError;
        contactId = data.id;
        contact = data;
      }

      const { error: interactionError } = await supabase.from("interactions").insert({
        user_id: userId,
        contact_id: contactId,
        type: draft.interactionType || "outro",
        description: draft.description || input.trim(),
        sentiment: draft.sentiment || "neutro",
        tags: Array.isArray(draft.tags) ? draft.tags.slice(0,5) : [],
      });
      if (interactionError) throw interactionError;

      const contactPatch = { last_interaction_at: new Date().toISOString() };
      if (draft.nextAction) contactPatch.next_action = draft.nextAction;
      if (draft.nextActionDate) contactPatch.next_action_date = draft.nextActionDate;
      if (!contact?.company && draft.company) contactPatch.company = draft.company;
      if (!contact?.role && draft.role) contactPatch.role = draft.role;

      const { error: updateError } = await supabase
        .from("contacts")
        .update(contactPatch)
        .eq("id", contactId)
        .eq("user_id", userId);
      if (updateError) throw updateError;

      const who = draft.contactName || contact?.name || "essa pessoa";
      setSaved(`Registrado com ${who}.`);
      setInput("");
      setDraft(null);
      speak(`Pronto. Registrei com ${who}.`);
      await onDataChanged?.();
    } catch (e) {
      setError(`Não salvei nada: ${e.message}`);
      speak("Não consegui salvar. Nada foi alterado.");
    } finally {
      setBusy(false);
    }
  };

  const askNetwork = async (sourceText = input) => {
    const text = String(sourceText || "").trim();
    if (!text || busy) return;
    setBusy(true); setError(""); setAnswer(""); setDraft(null); setSaved("");
    try {
      const contactMap = new Map(contacts.map(c => [c.id, c.name]));
      const recent = [...interactions]
        .sort((a,b) => new Date(interactionDate(b) || 0) - new Date(interactionDate(a) || 0))
        .slice(0,80)
        .map(i => ({
          person: contactMap.get(interactionContactId(i)) || "desconhecido",
          date: interactionDate(i),
          type: i.type || "",
          description: (i.description || "").slice(0,400),
          tags: i.tags || [],
          valueGenerated: !!(i.value_generated || i.valueGenerated),
        }));
      const people = contacts.map(c => ({
        name:c.name, company:c.company || "", role:c.role || "", category:c.category || "",
        city:c.city || "", notes:(c.personal_notes || c.notes || "").slice(0,300),
        nextAction:c.next_action || c.nextAction || null,
      }));

      const tone = prefs?.conversation_style || "direto";
      const prompt = `Você é o CONÉXIA, inteligência sobre a rede real do usuário. Responda APENAS com base nos dados abaixo. Não invente relação, contato, habilidade ou fato. Se os dados forem insuficientes, diga isso claramente.

ESTILO DE RESPOSTA PREFERIDO: ${tone}
OBJETIVO PRINCIPAL DO USUÁRIO: ${prefs?.primary_goal || "não informado"}

PERGUNTA:
${text}

PESSOAS:
${JSON.stringify(people)}

INTERAÇÕES RECENTES:
${JSON.stringify(recent)}

Responda em português, natural e direto, no máximo 6 frases. Quando útil, cite nomes reais e explique a evidência. Termine com uma ação concreta somente se houver base nos dados.`;

      const res = await fetch("/api/claude", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ prompt, maxTokens:900 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      const response = (data.content?.[0]?.text || "").trim() || "Não encontrei evidência suficiente para responder.";
      setAnswer(response);
      setInput(text);
      speak(response);
    } catch (e) {
      setError(`Não consegui consultar sua rede agora: ${e.message}`);
      speak("Não consegui consultar sua rede agora.");
    } finally {
      setBusy(false);
    }
  };

  const routeVoice = async (spoken) => {
    const text = String(spoken || "").trim();
    if (!text) return;

    if (needsInterview) {
      await saveInterviewAnswer(text);
      return;
    }

    if (draft) {
      const n = normalize(text);
      if (/^(sim|pode|salva|salvar|confirma|confirmar|isso|correto|certo)/.test(n)) {
        await confirmCapture();
        return;
      }
      if (/^(nao|não|cancela|cancelar|corrige|corrigir)/.test(n)) {
        setDraft(null);
        setInput("");
        speak("Tudo bem. Me conta novamente do jeito que aconteceu.");
        return;
      }
    }

    if (voiceIntentRef.current === "capture") {
      await analyzeCapture(text);
      return;
    }
    if (voiceIntentRef.current === "ask") {
      await askNetwork(text);
      return;
    }

    setProcessingVoice(true);
    try {
      const prompt = `Classifique a intenção da fala para o CONÉXIA.

FALA: ${text}

Use:
- "capture" se a pessoa está contando algo que aconteceu com alguém, registrando encontro, ligação, mensagem, compromisso ou informação de uma relação.
- "ask" se está fazendo uma pergunta, pedindo análise, recomendação, busca na própria rede ou querendo saber o que fazer.
- "chat" se é saudação ou conversa curta sem ação.

Responda SOMENTE JSON:
{"intent":"capture|ask|chat","reply":"resposta curta apenas se intent=chat"}`;

      const res = await fetch("/api/claude", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ prompt, maxTokens:180 }) });
      const data = await res.json();
      const parsed = firstJson(data.content?.[0]?.text || "") || {};

      if (parsed.intent === "capture") await analyzeCapture(text);
      else if (parsed.intent === "ask") await askNetwork(text);
      else {
        const reply = parsed.reply || `${greetingForNow(displayName)} O que você quer registrar ou descobrir sobre sua rede?`;
        speak(reply);
      }
    } catch {
      await askNetwork(text);
    } finally {
      setProcessingVoice(false);
    }
  };

  const startPushToTalk = (intent = "auto") => {
    if (listening || busy || processingVoice || interviewBusy) return;
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("Este navegador não liberou reconhecimento de voz. Você ainda pode escrever normalmente.");
      return;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    voiceIntentRef.current = intent;
    speechBufferRef.current = "";
    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;

    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += t + " ";
        else interimText += t + " ";
      }
      if (finalText) speechBufferRef.current += finalText;
      setInput((speechBufferRef.current + interimText).trim());
    };

    rec.onerror = (event) => {
      if (event?.error !== "aborted") setError("Não consegui ouvir. Tente novamente.");
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const spoken = speechBufferRef.current.trim() || input.trim();
      speechBufferRef.current = "";
      if (spoken) routeVoice(spoken);
    };

    setListening(true);
    rec.start();
  };

  const stopPushToTalk = () => {
    if (!recognitionRef.current) return;
    try { recognitionRef.current.stop(); } catch (_) {}
  };

  const submit = () => mode === "capture" ? analyzeCapture() : askNetwork();

  if (prefsLoading) {
    return (
      <div style={{ maxWidth: 760, margin:"0 auto", padding:"48px 0", textAlign:"center" }}>
        <div style={{ color:K.gold, fontFamily:sans, fontSize:11, letterSpacing:".12em", textTransform:"uppercase" }}>CONÉXIA LAB</div>
        <div style={{ color:K.text, fontFamily:serif, fontSize:28, marginTop:10 }}>Preparando sua experiência...</div>
      </div>
    );
  }

  if (needsInterview) {
    return (
      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 0 60px" }}>
        <div style={{ color:K.gold, fontFamily:sans, fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase", marginBottom:18 }}>PRIMEIRO CONTATO · CONÉXIA LAB</div>

        <div style={{ background:K.card, border:`1px solid ${K.gold}55`, borderRadius:22, padding:"28px 22px", textAlign:"center", boxShadow:"0 18px 60px rgba(0,0,0,.22)" }}>
          <div style={{ color:K.muted, fontFamily:sans, fontSize:11, marginBottom:10 }}>
            Pergunta {Math.min(interviewStep + 1, interviewQuestions.length)} de {interviewQuestions.length}
          </div>
          <div style={{ color:K.text, fontFamily:serif, fontSize:28, lineHeight:1.22, fontWeight:700, maxWidth:580, margin:"0 auto 28px" }}>
            {currentInterview?.question}
          </div>

          <button
            onPointerDown={() => startPushToTalk("interview")}
            onPointerUp={stopPushToTalk}
            onPointerCancel={stopPushToTalk}
            onPointerLeave={() => listening && stopPushToTalk()}
            disabled={interviewBusy}
            style={{
              width:150, height:150, borderRadius:"50%",
              background:listening ? `${K.gold}30` : K.card2,
              border:`2px solid ${listening ? K.gold : K.border}`,
              boxShadow:listening ? `0 0 0 14px ${K.gold}10, 0 0 50px ${K.gold}25` : "0 8px 30px rgba(0,0,0,.25)",
              color:listening ? K.gold : K.text,
              fontFamily:sans, fontSize:14, fontWeight:800,
              cursor:"pointer", transition:"all .18s ease", touchAction:"none",
            }}
          >
            <div style={{ fontSize:34, marginBottom:6 }}>🎙</div>
            {listening ? "FALANDO..." : "SEGURE PARA FALAR"}
          </button>

          <div style={{ color:K.muted, fontFamily:sans, fontSize:11, marginTop:16 }}>
            Segure enquanto fala. Solte quando terminar.
          </div>

          {input && (
            <div style={{ marginTop:20, background:K.card2, border:`1px solid ${K.border}`, borderRadius:12, padding:12, color:K.text, fontFamily:sans, fontSize:13, lineHeight:1.5, textAlign:"left" }}>
              “{input}”
            </div>
          )}
          {error && <div style={{ color:K.red, fontFamily:sans, fontSize:12, marginTop:14 }}>{error}</div>}
        </div>

        <div style={{ color:K.muted, fontFamily:sans, fontSize:10, textAlign:"center", marginTop:12 }}>
          As respostas ficam associadas à sua conta e servem para personalizar a forma como o CONÉXIA conversa com você.
        </div>
      </div>
    );
  }

  const naturalGreeting = prefs?.greeting_mode === "direto" ? "" : greetingForNow(displayName);

  return (
    <div style={{ maxWidth: 860, margin:"0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ color:K.gold, fontFamily:sans, fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase", marginBottom:7 }}>CONÉXIA LAB · só você</div>
        <h1 style={{ color:K.text, fontFamily:serif, fontSize:32, lineHeight:1.05, margin:"0 0 8px", fontWeight:700 }}>
          {naturalGreeting || `${displayName ? `${displayName}, ` : ""}o que está acontecendo na sua rede?`}
        </h1>
        <div style={{ color:K.muted, fontFamily:sans, fontSize:13 }}>
          {naturalGreeting ? "O que está acontecendo na sua rede?" : "Menos dashboard. Mais contexto, memória e próximo movimento."}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:12, marginBottom:20 }}>
        {cards.length ? cards.map((card,idx) => <ActionCard key={idx} {...card} />) : (
          <ActionCard eyebrow="Hoje" title="Nada crítico apareceu." body="Registre uma conversa ou pergunte algo à sua rede. O CONÉXIA aprende com o que realmente aconteceu." tone="green" />
        )}
      </div>

      <div style={{ background:K.card, border:`1px solid ${K.border}`, borderRadius:20, padding:20, boxShadow:"0 14px 40px rgba(0,0,0,.18)" }}>
        <div style={{ textAlign:"center", marginBottom:18 }}>
          <div style={{ color:K.text, fontFamily:serif, fontSize:23, fontWeight:700, marginBottom:5 }}>
            {listening ? "Estou ouvindo..." : processingVoice || busy ? "Estou entendendo..." : "Fale com o CONÉXIA"}
          </div>
          <div style={{ color:K.muted, fontFamily:sans, fontSize:12 }}>
            Conte algo que aconteceu ou pergunte qualquer coisa sobre sua rede.
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"center", margin:"8px 0 22px" }}>
          <button
            onPointerDown={() => startPushToTalk("auto")}
            onPointerUp={stopPushToTalk}
            onPointerCancel={stopPushToTalk}
            onPointerLeave={() => listening && stopPushToTalk()}
            disabled={busy || processingVoice}
            style={{
              width:142, height:142, borderRadius:"50%",
              background:listening ? `${K.gold}30` : K.card2,
              border:`2px solid ${listening ? K.gold : K.gold}90`,
              boxShadow:listening ? `0 0 0 14px ${K.gold}10, 0 0 52px ${K.gold}28` : "0 10px 30px rgba(0,0,0,.30)",
              color:listening ? K.gold : K.text,
              fontFamily:sans, fontSize:13, fontWeight:800,
              cursor:"pointer", transition:"all .18s ease", touchAction:"none",
              opacity:(busy || processingVoice) ? .55 : 1,
            }}
          >
            <div style={{ fontSize:34, marginBottom:6 }}>◉</div>
            {listening ? "FALE..." : "SEGURE E FALE"}
          </button>
        </div>

        {assistantLine && (
          <div style={{ background:`${K.gold}0D`, border:`1px solid ${K.gold}35`, borderRadius:13, padding:14, marginBottom:14 }}>
            <div style={{ color:K.gold, fontFamily:sans, fontSize:9, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", marginBottom:5 }}>CONÉXIA</div>
            <div style={{ color:K.text, fontFamily:sans, fontSize:13, lineHeight:1.55 }}>{assistantLine}</div>
          </div>
        )}

        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <button onClick={() => { setMode("capture"); setAnswer(""); setDraft(null); setError(""); }} style={{ background:mode==="capture"?K.gold:"transparent", color:mode==="capture"?K.bg:K.muted, border:`1px solid ${mode==="capture"?K.gold:K.border}`, borderRadius:999, padding:"8px 13px", fontFamily:sans, fontSize:12, fontWeight:700, cursor:"pointer" }}>Registrar algo</button>
          <button onClick={() => { setMode("ask"); setAnswer(""); setDraft(null); setError(""); }} style={{ background:mode==="ask"?K.gold:"transparent", color:mode==="ask"?K.bg:K.muted, border:`1px solid ${mode==="ask"?K.gold:K.border}`, borderRadius:999, padding:"8px 13px", fontFamily:sans, fontSize:12, fontWeight:700, cursor:"pointer" }}>Perguntar à minha rede</button>
        </div>

        <textarea value={input} onChange={e => setInput(e.target.value)} rows={3}
          placeholder={mode === "capture" ? "Ou escreva: encontrei João hoje..." : "Ou escreva sua pergunta..."}
          style={{ width:"100%", boxSizing:"border-box", resize:"vertical", background:K.card2, border:`1px solid ${K.border}`, borderRadius:12, color:K.text, padding:14, fontFamily:sans, fontSize:14, lineHeight:1.55, outline:"none" }} />

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
          <button onClick={submit} disabled={!input.trim() || busy} style={{ background:K.gold, color:K.bg, border:"none", borderRadius:10, padding:"10px 16px", fontFamily:sans, fontSize:12, fontWeight:800, cursor:"pointer", opacity:(!input.trim() || busy) ? 0.6 : 1 }}>
            {busy ? "Entendendo..." : mode === "capture" ? "Entender texto" : "Perguntar por texto"}
          </button>
        </div>

        {error && <div style={{ marginTop:12, color:K.red, fontFamily:sans, fontSize:12, lineHeight:1.5 }}>{error}</div>}
        {saved && <div style={{ marginTop:12, color:K.green, fontFamily:sans, fontSize:12, fontWeight:700 }}>✓ {saved}</div>}

        {draft && (
          <div style={{ marginTop:16, background:K.card2, border:`1px solid ${K.gold}55`, borderRadius:14, padding:15 }}>
            <div style={{ color:K.gold, fontFamily:sans, fontSize:10, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", marginBottom:10 }}>Entendi isso — confirme antes de salvar</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:9 }}>
              {[
                ["Pessoa", draft.contactName],
                ["Empresa", draft.company],
                ["Cargo", draft.role],
                ["Tipo", draft.interactionType],
                ["Próximo passo", draft.nextAction],
                ["Data", draft.nextActionDate],
              ].map(([label,value]) => value ? (
                <div key={label} style={{ border:`1px solid ${K.border}`, borderRadius:9, padding:10 }}>
                  <div style={{ color:K.muted, fontFamily:sans, fontSize:9, textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
                  <div style={{ color:K.text, fontFamily:sans, fontSize:12, marginTop:3 }}>{value}</div>
                </div>
              ) : null)}
            </div>
            <div style={{ color:K.text, fontFamily:sans, fontSize:13, lineHeight:1.5, marginTop:11 }}>{draft.description}</div>
            <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
              <button onClick={confirmCapture} disabled={busy} style={{ background:K.green, color:"#0B0D0B", border:"none", borderRadius:9, padding:"9px 13px", fontFamily:sans, fontSize:12, fontWeight:800, cursor:"pointer" }}>Confirmar e salvar</button>
              <button onClick={() => { setDraft(null); setAssistantLine(""); }} disabled={busy} style={{ background:"transparent", color:K.muted, border:`1px solid ${K.border}`, borderRadius:9, padding:"9px 13px", fontFamily:sans, fontSize:12, cursor:"pointer" }}>Corrigir</button>
              <div style={{ color:K.muted, fontFamily:sans, fontSize:11, alignSelf:"center" }}>ou segure o botão e diga “sim” / “não”</div>
            </div>
          </div>
        )}

        {answer && (
          <div style={{ marginTop:16, background:K.card2, border:`1px solid ${K.green}55`, borderRadius:14, padding:16 }}>
            <div style={{ color:K.green, fontFamily:sans, fontSize:10, fontWeight:800, letterSpacing:".1em", textTransform:"uppercase", marginBottom:8 }}>O CONÉXIA encontrou</div>
            <div style={{ color:K.text, fontFamily:sans, fontSize:14, lineHeight:1.65, whiteSpace:"pre-wrap" }}>{answer}</div>
          </div>
        )}
      </div>

      <div style={{ marginTop:12, color:K.muted, fontFamily:sans, fontSize:10, lineHeight:1.5 }}>
        LAB: experiência restrita ao seu usuário. Preferências de conversa ficam salvas na sua conta.
      </div>
    </div>
  );
}
