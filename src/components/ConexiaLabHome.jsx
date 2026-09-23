// src/components/ConexiaLabHome.jsx
import React, { useMemo, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState(null);
  const [answer, setAnswer] = useState("");
  const [saved, setSaved] = useState("");

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

  const startVoice = () => {
    setError("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError("O navegador não liberou ditado por voz aqui. Escreva normalmente — a captura funciona do mesmo jeito.");
      return;
    }
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.interimResults = false;
    rec.continuous = false;
    setListening(true);
    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      setInput(prev => prev ? `${prev} ${spoken}` : spoken);
    };
    rec.onerror = () => setError("Não consegui ouvir agora. Você pode digitar a mesma frase.");
    rec.onend = () => setListening(false);
    rec.start();
  };

  const analyzeCapture = async () => {
    if (!input.trim() || busy) return;
    setBusy(true); setError(""); setDraft(null); setSaved(""); setAnswer("");
    try {
      const existing = contacts.map(c => ({ id:c.id, name:c.name, company:c.company || "", role:c.role || "" }));
      const prompt = `Você é o motor de captura do CONÉXIA. Transforme a frase do usuário em dados estruturados, sem inventar nada.

CONTATOS JÁ EXISTENTES:
${JSON.stringify(existing)}

FRASE:
${input.trim()}

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
    } catch (e) {
      setError(`Não consegui interpretar isso com segurança: ${e.message}`);
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

      const contactPatch = { last_interaction_at: new Date().toISOString(), last_interaction: new Date().toISOString() };
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

      setSaved(`Registrado com ${draft.contactName || contact?.name || "essa pessoa"}.`);
      setInput("");
      setDraft(null);
      await onDataChanged?.();
    } catch (e) {
      setError(`Não salvei nada: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const askNetwork = async () => {
    if (!input.trim() || busy) return;
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

      const prompt = `Você é o CONÉXIA, inteligência sobre a rede real do usuário. Responda APENAS com base nos dados abaixo. Não invente relação, contato, habilidade ou fato. Se os dados forem insuficientes, diga isso claramente.

PERGUNTA:
${input.trim()}

PESSOAS:
${JSON.stringify(people)}

INTERAÇÕES RECENTES:
${JSON.stringify(recent)}

Responda em português, direto, no máximo 6 frases. Quando útil, cite nomes reais e explique a evidência. Termine com uma ação concreta somente se houver base nos dados.`;

      const res = await fetch("/api/claude", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ prompt, maxTokens:900 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
      setAnswer((data.content?.[0]?.text || "").trim() || "Não encontrei evidência suficiente para responder.");
    } catch (e) {
      setError(`Não consegui consultar sua rede agora: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => mode === "capture" ? analyzeCapture() : askNetwork();

  return (
    <div style={{ maxWidth: 860, margin:"0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 22 }}>
        <div style={{ color:K.gold, fontFamily:sans, fontSize:10, fontWeight:800, letterSpacing:".14em", textTransform:"uppercase", marginBottom:7 }}>CONÉXIA LAB · só você</div>
        <h1 style={{ color:K.text, fontFamily:serif, fontSize:32, lineHeight:1.05, margin:"0 0 8px", fontWeight:700 }}>
          {firstName ? `${String(firstName).split(" ")[0]}, ` : ""}o que está acontecendo na sua rede?
        </h1>
        <div style={{ color:K.muted, fontFamily:sans, fontSize:13 }}>Menos dashboard. Mais contexto, memória e próximo movimento.</div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px,1fr))", gap:12, marginBottom:20 }}>
        {cards.length ? cards.map((card,idx) => <ActionCard key={idx} {...card} />) : (
          <ActionCard eyebrow="Hoje" title="Nada crítico apareceu." body="Registre uma conversa ou pergunte algo à sua rede. O CONÉXIA aprende com o que realmente aconteceu." tone="green" />
        )}
      </div>

      <div style={{ background:K.card, border:`1px solid ${K.border}`, borderRadius:18, padding:18, boxShadow:"0 14px 40px rgba(0,0,0,.18)" }}>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <button onClick={() => { setMode("capture"); setAnswer(""); setDraft(null); setError(""); }} style={{ background:mode==="capture"?K.gold:"transparent", color:mode==="capture"?K.bg:K.muted, border:`1px solid ${mode==="capture"?K.gold:K.border}`, borderRadius:999, padding:"8px 13px", fontFamily:sans, fontSize:12, fontWeight:700, cursor:"pointer" }}>Registrar algo</button>
          <button onClick={() => { setMode("ask"); setAnswer(""); setDraft(null); setError(""); }} style={{ background:mode==="ask"?K.gold:"transparent", color:mode==="ask"?K.bg:K.muted, border:`1px solid ${mode==="ask"?K.gold:K.border}`, borderRadius:999, padding:"8px 13px", fontFamily:sans, fontSize:12, fontWeight:700, cursor:"pointer" }}>Perguntar à minha rede</button>
        </div>

        <div style={{ color:K.text, fontFamily:serif, fontSize:20, fontWeight:700, marginBottom:6 }}>
          {mode === "capture" ? "O que aconteceu?" : "O que você quer entender?"}
        </div>
        <div style={{ color:K.muted, fontFamily:sans, fontSize:12, lineHeight:1.5, marginBottom:12 }}>
          {mode === "capture"
            ? 'Ex.: “Encontrei João hoje. Falamos de café e combinei de apresentar Carlos.”'
            : 'Ex.: “O que ficou pendente?”, “quem posso ajudar?” ou “com quem falei sobre IA?”'}
        </div>

        <textarea value={input} onChange={e => setInput(e.target.value)} rows={4}
          placeholder={mode === "capture" ? "Fale ou escreva naturalmente..." : "Pergunte à sua própria rede..."}
          style={{ width:"100%", boxSizing:"border-box", resize:"vertical", background:K.card2, border:`1px solid ${K.border}`, borderRadius:12, color:K.text, padding:14, fontFamily:sans, fontSize:14, lineHeight:1.55, outline:"none" }} />

        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:10 }}>
          <button onClick={startVoice} disabled={listening || busy} style={{ background:"transparent", color:K.text, border:`1px solid ${K.border}`, borderRadius:10, padding:"10px 14px", fontFamily:sans, fontSize:12, fontWeight:700, cursor:"pointer" }}>
            {listening ? "🎙 Ouvindo..." : "🎙 Falar"}
          </button>
          <button onClick={submit} disabled={!input.trim() || busy} style={{ background:K.gold, color:K.bg, border:"none", borderRadius:10, padding:"10px 16px", fontFamily:sans, fontSize:12, fontWeight:800, cursor:"pointer", opacity:(!input.trim() || busy) ? 0.6 : 1 }}>
            {busy ? "Entendendo..." : mode === "capture" ? "Entender" : "Perguntar"}
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
            <div style={{ display:"flex", gap:8, marginTop:12 }}>
              <button onClick={confirmCapture} disabled={busy} style={{ background:K.green, color:"#0B0D0B", border:"none", borderRadius:9, padding:"9px 13px", fontFamily:sans, fontSize:12, fontWeight:800, cursor:"pointer" }}>Confirmar e salvar</button>
              <button onClick={() => setDraft(null)} disabled={busy} style={{ background:"transparent", color:K.muted, border:`1px solid ${K.border}`, borderRadius:9, padding:"9px 13px", fontFamily:sans, fontSize:12, cursor:"pointer" }}>Corrigir texto</button>
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
        LAB: esta experiência está restrita ao seu usuário. Os demais continuam no CONÉXIA atual.
      </div>
    </div>
  );
}
