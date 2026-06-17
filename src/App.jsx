import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./utils/supabase";
import { C, ADMIN_EMAIL, ENABLE_ADMIN_TOOLS, isAdmin } from "./utils/theme";
import { DIMS, QS, SEGMENTS, OBJECTIVES, UFS, CATS, ITYPES, SENTS } from "./data/constants";

/* ─── Profiles ────────────────────────────────────────── */
const PROFILES = {
  estrategista: { name: "O Estrategista", emoji: "🎯", tagline: "Você joga xadrez relacional.", desc: "Você não faz networking por acaso. Sabe exatamente quem precisa na sua rede, por quê, e cultiva com disciplina. Sua força está na clareza de intenção combinada com consistência.", strengths: ["Visão estratégica de longo prazo", "Disciplina no follow-up", "Capacidade de priorizar relações"], risks: ["Pode parecer transacional", "Subestima conexões sem utilidade imediata"], actions: ["Liste 3 pessoas que mantém contato por obrigação — existe algo genuíno ali?", "Tenha 1 conversa sem agenda nas próximas 2 semanas.", "Envie reconhecimento para alguém que te ajudou, sem pedir nada."] },
  influenciador: { name: "O Influenciador", emoji: "🌟", tagline: "Onde você está, as coisas acontecem.", desc: "Presença de mercado e generosidade natural. As pessoas te procuram porque sabem que você conecta, indica e gera valor. Rede viva e diversa.", strengths: ["Alta visibilidade", "Generosidade natural", "Confiança rápida"], risks: ["Pode se sobrecarregar", "Rede ampla mas nem sempre profunda"], actions: ["Transforme 2 contatos superficiais em relações profundas.", "Crie critério claro para dizer não sem culpa.", "Documente os 10 contatos que mais geram valor mútuo."] },
  conector: { name: "O Conector", emoji: "🔗", tagline: "Você tece redes vivas.", desc: "Escuta de verdade e conecta A com B criando valor para ambos. Confiança natural porque se importa genuinamente.", strengths: ["Escuta ativa genuína", "Conecta pessoas certas", "Alta reciprocidade"], risks: ["Falta de direcionamento estratégico", "Pode dar mais do que recebe"], actions: ["Liste 10 conexões valiosas que fez para outros — peça algo para 3.", "Defina 3 objetivos para sua rede nos próximos 90 dias.", "Para cada conexão: isso me aproxima de qual objetivo?"] },
  tecnico_invisivel: { name: "O Técnico Invisível", emoji: "🔬", tagline: "Competente demais para ser ignorado — mas é o que acontece.", desc: "Competência inquestionável. Mas sua rede não sabe porque você não aparece. Confiança alta, presença baixa.", strengths: ["Competência reconhecida por quem convive", "Autenticidade", "Relações profundas"], risks: ["Invisibilidade profissional", "Perde oportunidades"], actions: ["Participe de 1 evento do setor nos próximos 30 dias.", "Publique 1 conteúdo técnico no LinkedIn esta semana.", "Peça a 3 pessoas: me indica para uma conversa importante."] },
  relacional_intuitivo: { name: "O Relacional Intuitivo", emoji: "💫", tagline: "Você sente as pessoas. Falta transformar em sistema.", desc: "Dom natural para relações, opera por intuição. Quando a vida aperta, networking cai primeiro — porque não tem estrutura.", strengths: ["Inteligência emocional alta", "Relações autênticas", "Confiança rápida"], risks: ["Networking inconsistente", "Reativo — só cultiva quando precisa"], actions: ["Configure o CONÉXIA com 10 contatos mais importantes.", "Ritual semanal: toda segunda, escolha 2 pessoas para contatar.", "Escreva o que cada contato precisa. Envie algo relevante sem pedir nada."] },
  ativador_intermitente: { name: "O Ativador Intermitente", emoji: "⚡", tagline: "Quando ativa, é poderoso. O problema é que nem sempre ativa.", desc: "Visão e presença. Mas a inconsistência faz sua rede nunca saber se pode contar com você.", strengths: ["Alta capacidade quando engajado", "Boa visão estratégica", "Presença forte"], risks: ["Inconsistência crônica", "Perde credibilidade pela oscilação"], actions: ["Ative alertas para contatos com mais de 15 dias sem interação.", "Comprometa-se com 3 interações por semana.", "Agende networking como reunião fixa no calendário."] },
  construtor_confianca: { name: "O Construtor de Confiança", emoji: "🏛️", tagline: "Você constrói devagar, mas o que constrói não cai.", desc: "Rede sólida. Cultiva com consistência e autenticidade. O que falta é expandir.", strengths: ["Alta confiabilidade", "Consistência no cultivo", "Autenticidade reconhecida"], risks: ["Rede pode ser pequena demais", "Dificuldade em expandir zona de conforto"], actions: ["Identifique 3 pessoas FORA do seu círculo que seriam estratégicas.", "Peça a um aliado para te apresentar a alguém novo.", "Participe de 1 evento onde não conhece ninguém."] },
  explorador_rede: { name: "O Explorador de Rede", emoji: "🧭", tagline: "Você está no começo. E isso é vantagem.", desc: "Sem padrão dominante — pode construir do zero, com método, sem vícios. O CONÉXIA será sua fundação.", strengths: ["Mente aberta", "Sem vícios de networking", "Alto potencial"], risks: ["Pode se sentir perdido", "Risco de desistir cedo"], actions: ["Liste 15 pessoas que importam — classifique cada uma no CONÉXIA.", "Escolha 3 e envie mensagem genuína esta semana.", "Leia o capítulo 1 do livro e aplique 1 conceito."] },
};

const PLAN = [
  { week: 1, title: "Mapear contatos", icon: "🗺️", goal: "Construir a fundação da sua rede.", tasks: ["Cadastre 10 contatos estratégicos", "Classifique cada um", "Defina frequência ideal", "Escreva notas sobre cada pessoa"], metric: "10 contatos cadastrados" },
  { week: 2, title: "Reativar relações", icon: "🔄", goal: "Reconectar com quem esfriou.", tasks: ["Identifique 3 contatos com menor health", "Envie mensagem genuína para cada um", "Registre cada interação no CONÉXIA"], metric: "3 relações reativadas" },
  { week: 3, title: "Gerar valor", icon: "💎", goal: "Dar antes de pedir.", tasks: ["Para cada contato-chave: o que posso oferecer?", "Faça 2 indicações", "Compartilhe conteúdo com 3 contatos"], metric: "2 indicações + 3 conteúdos" },
  { week: 4, title: "Criar sistema", icon: "⚙️", goal: "Transformar ação em hábito.", tasks: ["Defina ritual semanal", "Configure alertas", "Defina 3 metas para 90 dias"], metric: "Ritual + metas documentadas" },
];

/* ─── Culturas Agro ───────────────────────────────────── */
const MAIN_CULTURES = [
  { value: "soja",        label: "🌱 Soja" },
  { value: "milho",       label: "🌽 Milho" },
  { value: "cafe",        label: "☕ Café" },
  { value: "algodao",     label: "🌿 Algodão" },
  { value: "cana",        label: "🎋 Cana-de-açúcar" },
  { value: "trigo",       label: "🌾 Trigo" },
  { value: "hortifruti",  label: "🥦 Hortifruti" },
  { value: "pecuaria",    label: "🐄 Pecuária" },
  { value: "citrus",      label: "🍊 Citrus" },
  { value: "cacau",       label: "🍫 Cacau" },
  { value: "feijao",      label: "🫘 Feijão" },
  { value: "arroz",       label: "🍚 Arroz" },
  { value: "outro",       label: "🌍 Outro" },
];

/* ─── Helpers ─────────────────────────────────────────── */
const dSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999;
const hScore = (last, freq) => { const d = dSince(last); if (!last || d > freq * 3) return 0; return Math.max(0, Math.round((1 - d / (freq * 1.5)) * 100)); };
const fD = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";
const birthdayDaysAway = (birthday) => {
  if (!birthday) return null;
  const today = new Date(); const b = new Date(birthday);
  const next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
};

function calcScores(answers) {
  const scores = {};
  DIMS.forEach((dim, di) => {
    const qs = QS.filter(q => q.dim === di);
    const vals = qs.map(q => { const ans = answers[q.id]; const raw = ans ? (q.scores?.[ans] ?? Number(ans) ?? 3) : 3; return q.rev ? (6 - raw) : raw; });
    scores[dim.key] = Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100);
  });
  const overall = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length);
  return { scores, overall };
}

function getProfile(scores) {
  const { intencao_estrategica: IE = 0, escuta_relacional: ER = 0, presenca_mercado: PM = 0, reciprocidade_ativa: RA = 0, ritual_consistencia: RC = 0, confianca_autentica: CA = 0 } = scores;
  if (IE >= 80 && RC >= 70) return "estrategista";
  if (PM >= 80 && RA >= 75) return "influenciador";
  if (ER >= 80 && RA >= 75) return "conector";
  if (CA >= 70 && ER >= 70 && PM < 60) return "tecnico_invisivel";
  if (ER >= 75 && CA >= 75 && IE < 65) return "relacional_intuitivo";
  if ((PM >= 75 || IE >= 75) && RC < 60) return "ativador_intermitente";
  if (RC >= 75 && CA >= 75) return "construtor_confianca";
  return "explorador_rede";
}

/* ─── UI Components ───────────────────────────────────── */
function Btn({ children, onClick, variant = "primary", disabled, small, full }) {
  const base = { fontFamily: "'DM Sans',sans-serif", fontSize: small ? 12 : 15, fontWeight: 600, border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer", padding: small ? "8px 16px" : "14px 28px", transition: "all .15s", opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: full ? "100%" : "auto" };
  const v = { primary: { color: C.bg, background: `linear-gradient(135deg,${C.gold},${C.gB})` }, secondary: { color: C.txt, background: C.w06 }, ghost: { color: C.txM, background: "transparent" }, danger: { color: C.cor, background: C.corD }, success: { color: C.grn, background: C.grnD } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant] }}>{children}</button>;
}

function Inp({ label, value, onChange, placeholder, type = "text", textarea }) {
  const s = { width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "12px 14px", fontFamily: "'DM Sans'", fontSize: 14, color: C.txt, outline: "none" };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>{label}</label>}
      {textarea ? <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...s, resize: "vertical" }} /> : <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />}
    </div>
  );
}

function Sel({ label, value, onChange, options, placeholder }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>{label}</label>}
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "12px 14px", fontFamily: "'DM Sans'", fontSize: 14, color: value ? C.txt : C.txL, outline: "none" }}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Tag({ children, color = C.gold, small }) {
  return <span style={{ display: "inline-block", fontSize: small ? 9 : 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color, background: `${color}16`, border: `1px solid ${color}28`, padding: small ? "2px 7px" : "3px 10px", borderRadius: 4, fontFamily: "'DM Sans'" }}>{children}</span>;
}

function HBar({ score, small }) {
  const cl = score >= 70 ? C.grn : score >= 40 ? C.amb : C.cor;
  const h = small ? 3 : 5;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: h, borderRadius: h, background: C.w06 }}>
        <div style={{ height: h, borderRadius: h, background: cl, width: `${score}%`, transition: "width .6s" }} />
      </div>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: small ? 10 : 11, fontWeight: 600, color: cl, minWidth: 28, textAlign: "right" }}>{score}%</span>
    </div>
  );
}

function Modal({ children, onClose, title }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: C.card, border: `1px solid ${C.brdH}`, borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "85vh", overflow: "auto", padding: 28 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.txt, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.txL, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RadarChart({ scores, size = 260 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI / 6) * i; const d = r * (v / 100); return [cx + d * Math.cos(a), cy + d * Math.sin(a)]; };
  const vals = DIMS.map(d => scores[d.key] || 0);
  const poly = vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: size }}>
      {[20, 40, 60, 80, 100].map(v => <polygon key={v} points={Array.from({ length: 6 }, (_, i) => pt(i, v).join(",")).join(" ")} fill="none" stroke={C.brd} strokeWidth={0.5} opacity={0.5} />)}
      {vals.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.brd} strokeWidth={0.5} opacity={0.3} />; })}
      <polygon points={poly} fill={`${C.gold}15`} stroke={C.gold} strokeWidth={2} />
      {vals.map((v, i) => { const [x, y] = pt(i, v); return <circle key={i} cx={x} cy={y} r={4} fill={DIMS[i].color} stroke={C.bg} strokeWidth={2} />; })}
      {vals.map((_, i) => { const [x, y] = pt(i, 115); return <text key={`l${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={DIMS[i].color} fontSize={9} fontWeight={600} fontFamily="'DM Sans'">{DIMS[i].short}</text>; })}
    </svg>
  );
}

/* ═══ WELCOME ═════════════════════════════════════════════ */
/* ═══ ONBOARDING ══════════════════════════════════════════ */
function Onboard({ onDone }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", role: "", segment: "", state: "", objectives: [] });
  const tog = (v) => setForm(p => ({ ...p, objectives: p.objectives.includes(v) ? p.objectives.filter(x => x !== v) : [...p.objectives, v] }));

  if (step === 1) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <Tag>Passo 1 de 2 · Perfil</Tag>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "12px 0 6px" }}>Conte sobre você</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 24px" }}>Personaliza seu diagnóstico.</p>
        <Inp label="Seu nome" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Como podemos te chamar?" />
        <Inp label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="seu@email.com" type="email" />
        <Inp label="Função/cargo" value={form.role} onChange={v => setForm({ ...form, role: v })} placeholder="Ex: Gerente Comercial, RTV..." />
        <Sel label="Segmento" value={form.segment} onChange={v => setForm({ ...form, segment: v })} options={SEGMENTS} placeholder="Selecione..." />
        <Sel label="Estado" value={form.state} onChange={v => setForm({ ...form, state: v })} options={UFS} placeholder="UF" />
        <Btn onClick={() => setStep(2)} disabled={!form.name.trim() || !form.email.trim() || !form.role.trim() || !form.segment} full>Continuar</Btn>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <Tag>Passo 2 de 2 · Objetivos</Tag>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "12px 0 6px" }}>O que você busca com networking?</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Selecione tudo que faz sentido.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 28 }}>
          {OBJECTIVES.map(o => {
            const sel = form.objectives.includes(o.value);
            return (
              <button key={o.value} onClick={() => tog(o.value)} style={{ background: sel ? C.gD : C.sf, border: `1px solid ${sel ? C.gL : C.brd}`, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{o.icon}</span>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? C.gold : C.txM }}>{o.label}</span>
              </button>
            );
          })}
        </div>
        <Btn onClick={() => onDone(form)} disabled={form.objectives.length === 0} full>Iniciar assessment →</Btn>
      </div>
    </div>
  );
}

/* ═══ ASSESSMENT ══════════════════════════════════════════ */
function Assess({ profile, onDone }) {
  const [qi, setQi] = useState(0);
  const [ans, setAns] = useState({});
  const [done, setDone] = useState(false);
  const { scores, overall } = useMemo(() => calcScores(ans), [ans]);
  const pKey = useMemo(() => getProfile(scores), [scores]);
  const prof = PROFILES[pKey];
  const q = QS[qi];
  const cur = ans[q?.id];

  const save = async () => {
    const result = { scores, overall, profileKey: pKey, profileName: prof.name, createdAt: new Date().toISOString(), answers: ans };
    onDone(result);
  };

  if (done) {
    const vals = Object.entries(scores);
    const maxD = DIMS.find(d => d.key === vals.sort((a, b) => b[1] - a[1])[0]?.[0]);
    const minD = DIMS.find(d => d.key === vals.sort((a, b) => a[1] - b[1])[0]?.[0]);

    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
        <div style={{ maxWidth: 560, width: "100%", overflowY: "auto", maxHeight: "100vh", paddingBottom: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{prof.emoji}</div>
            <Tag color={C.grn}>Diagnóstico completo</Tag>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 700, color: C.gold, margin: "12px 0 4px", fontStyle: "italic" }}>{prof.name}</h1>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, fontStyle: "italic" }}>{prof.tagline}</p>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: C.gold, marginTop: 6 }}>Score geral: {overall}%</div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", justifyContent: "center" }}><RadarChart scores={scores} /></div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>Suas 6 dimensões</div>
            {DIMS.map((d, i) => { const v = scores[d.key] || 0; return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: C.txt }}>{d.label}</span><span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 600, color: d.color }}>{v}%</span></div>
                <div style={{ height: 8, borderRadius: 4, background: C.w06 }}><div style={{ height: 8, borderRadius: 4, background: d.color, width: `${v}%`, transition: "width 1s" }} /></div>
              </div>
            ); })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div style={{ background: C.grnD, border: `1px solid ${C.grn}28`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, textTransform: "uppercase", marginBottom: 4 }}>Sua força</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt }}>{maxD?.label}</div>
            </div>
            <div style={{ background: C.corD, border: `1px solid ${C.cor}28`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.cor, textTransform: "uppercase", marginBottom: 4 }}>Oportunidade</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt }}>{minD?.label}</div>
            </div>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Análise profunda</div>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, lineHeight: 1.65 }}>{prof.desc}</p>
          </div>
          <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 4 }}>Você é {prof.name}.</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, marginBottom: 14 }}>Agora faça estas 3 ações:</div>
            {prof.actions.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: C.gD, border: `1px solid ${C.gL}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 600, color: C.gold, flexShrink: 0 }}>{i + 1}</div>
                <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Plano de ativação · 4 semanas</div>
            {PLAN.map((w, i) => (
              <div key={i} style={{ marginTop: 16, paddingTop: i > 0 ? 16 : 0, borderTop: i > 0 ? `1px solid ${C.brd}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}><span style={{ fontSize: 18 }}>{w.icon}</span><div><Tag color={C.amb} small>Semana {w.week}</Tag><div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginTop: 3 }}>{w.title}</div></div></div>
                <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 4, fontStyle: "italic" }}>{w.goal}</p>
                {w.tasks.map((t, j) => <div key={j} style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, paddingLeft: 12 }}>→ {t}</div>)}
              </div>
            ))}
          </div>
          <Btn onClick={save} full>Entrar no CONÉXIA →</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Tag color={DIMS[q.dim].color}>{DIMS[q.dim].label}</Tag>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.txL }}>{qi + 1}/{QS.length}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: C.w06, marginBottom: 32 }}><div style={{ height: 4, borderRadius: 2, background: C.gold, width: `${((qi + 1) / QS.length) * 100}%`, transition: "width .3s" }} /></div>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: C.txt, lineHeight: 1.35, margin: "0 0 28px", minHeight: 80 }}>{q.text}</p>
        {(q.opcoes || []).map(o => (
          <button key={o.v} onClick={() => setAns(p => ({ ...p, [q.id]: o.v }))} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: cur === o.v ? C.gD : C.sf, border: `1.5px solid ${cur === o.v ? C.gold : C.brd}`, borderRadius: 10, padding: "14px 18px", cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${cur === o.v ? C.gold : C.brd}`, display: "flex", alignItems: "center", justifyContent: "center", background: cur === o.v ? C.gold : "transparent", flexShrink: 0 }}>{cur === o.v && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.bg }} />}</div>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 14, color: cur === o.v ? C.gold : C.txM, fontWeight: cur === o.v ? 600 : 400, lineHeight: 1.4 }}><strong style={{ color: cur === o.v ? C.gold : C.txL, marginRight: 6 }}>{o.v}.</strong>{o.l}</span>
          </button>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {qi > 0 && <Btn variant="ghost" onClick={() => setQi(qi - 1)} small>← Anterior</Btn>}
          <div style={{ flex: 1 }} />
          {qi < QS.length - 1 ? <Btn onClick={() => setQi(qi + 1)} disabled={!cur}>Próxima →</Btn> : <Btn onClick={() => setDone(true)} disabled={!cur}>Ver meu perfil</Btn>}
        </div>
      </div>
    </div>
  );
}

/* ═══ MAKE WEBHOOK ════════════════════════════════════════ */
const MAKE_WEBHOOK = "https://hook.us2.make.com/ao22pba9b6y41uuxnj50hev7m1oq790r";

/* ═══ CRM APP ═════════════════════════════════════════════ */
function CRM({ profile, assessment, onReset, user }) {
  const [view, setView] = useState("dash");
  const [cts, setCts] = useState([]);
  const [its, setIts] = useState([]);
  const [selId, setSelId] = useState(null);
  const [modal, setModal] = useState(null);
  const [intCid, setIntCid] = useState(null);
  const [dbgMsg, setDbgMsg] = useState("");
  const [cf, setCf] = useState({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "" });
  const [inf, setInf] = useState({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });

  const load = useCallback(async () => {
    if (!user?.id) { setDbgMsg("⚠️ user.id ausente — não autenticado"); return; }
    const { data: c, error: ce } = await supabase.from("contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: i, error: ie } = await supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (ce) { setDbgMsg("❌ Erro ao buscar contatos: " + ce.message); return; }
    if (ie) { setDbgMsg("❌ Erro ao buscar interações: " + ie.message); return; }
    setDbgMsg("✅ user:" + user.id.slice(0,8) + " | contatos:" + (c?.length || 0));
    setCts((c || []).map(ct => ({ ...ct, health: hScore(ct.last_interaction_at, ct.ideal_frequency_days || 30), notes: ct.personal_notes, howMet: ct.how_met, idealFreq: ct.ideal_frequency_days, lastInteraction: ct.last_interaction_at, nextAction: ct.next_action, nextActionDate: ct.next_action_date, whatsapp: ct.whatsapp, contactEmail: ct.contact_email, linkedin: ct.linkedin, birthday: ct.birthday, hobbies: ct.hobbies, mainCulture: ct.main_culture, city: ct.city, stateCode: ct.state_code })));
    setIts((i || []).map(it => ({ ...it, desc: it.description, contactId: it.contact_id, createdAt: it.created_at, valueGen: it.value_generated })));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const addC = async () => {
    if (!cf.name.trim() || !user?.id) { setDbgMsg("⚠️ Bloqueado: " + (!user?.id ? "sem user.id" : "nome vazio")); return; }
    setDbgMsg("⏳ Salvando...");
    const { data: newContact, error } = await supabase.from("contacts").insert({
      user_id: user.id, name: cf.name.trim(), company: cf.company.trim(),
      role: cf.role.trim(), category: cf.category, proximity: parseInt(cf.proximity),
      ideal_frequency_days: parseInt(cf.idealFreq) || 30, how_met: cf.howMet.trim(),
      personal_notes: cf.notes.trim(),
      whatsapp: cf.whatsapp.trim() || null,
      contact_email: cf.contactEmail.trim() || null,
      linkedin: cf.linkedin.trim() || null,
      birthday: cf.birthday || null,
      hobbies: cf.hobbies.trim() || null,
      main_culture: cf.mainCulture || null,
      city: cf.city.trim() || null,
      state_code: cf.stateCode || null,
      next_action: cf.nextAction.trim() || null,
      next_action_date: cf.nextActionDate || null,
    }).select().single();
    if (error) { setDbgMsg("❌ " + error.message + " [" + error.code + "]"); return; }
    setDbgMsg("✅ Salvo: " + newContact?.name);
    if (newContact) {
      try {
        const p = profile || {};
        await fetch(MAKE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "novo_contato", timestamp: new Date().toISOString(),
            userId: user?.id || "", usuarioNome: p.first_name || p.name || "",
            usuarioEmail: user?.email || "", contatoNome: newContact.name,
            contatoEmpresa: newContact.company || "", contatoCargo: newContact.role || "",
            contatoCategoria: newContact.category, contatoWhatsapp: newContact.whatsapp || "",
            contatoEmail: newContact.contact_email || "", contatoLinkedin: newContact.linkedin || "",
            contatoAniversario: newContact.birthday || "", contatoCultura: newContact.main_culture || "",
            contatoCidade: newContact.city || "", contatoEstado: newContact.state_code || "",
            contatoHobbies: newContact.hobbies || "", contatoProximidade: newContact.proximity,
            contatoFrequencia: newContact.ideal_frequency_days, contatoComoConheceu: newContact.how_met || "",
            contatoNotas: newContact.personal_notes || "", totalContatos: cts.length + 1,
          }),
        });
      } catch (e) { console.warn("[Make push contato]", e); }
    }
    setCf({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "" });
    setModal(null);
    await load();
  };

  const addI = async () => {
    if (!inf.desc.trim() || !intCid || !user?.id) return;
    await supabase.from("interactions").insert({
      user_id: user.id, contact_id: intCid, type: inf.type,
      description: inf.desc.trim(), sentiment: inf.sentiment,
      tags: inf.tags ? inf.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      value_generated: inf.valueGen,
    });
    // Atualiza last_interaction_at no contato (essencial para Health Score)
    await supabase.from("contacts").update({ last_interaction_at: new Date().toISOString() }).eq("id", intCid).eq("user_id", user.id);
    // Push interação para Make
    const contact = cts.find(c => c.id === intCid);
    if (contact) {
      try {
        const p = profile || {};
        await fetch(MAKE_WEBHOOK, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "nova_interacao",
            timestamp: new Date().toISOString(),
            userId: user?.id || "",
            usuarioNome: p.first_name || p.name || "",
            usuarioEmail: user?.email || "",
            contatoNome: contact.name,
            contatoEmpresa: contact.company || "",
            contatoCategoria: contact.category,
            contatoWhatsapp: contact.whatsapp || "",
            interacaoTipo: inf.type,
            interacaoDescricao: inf.desc.trim(),
            interacaoSentimento: inf.sentiment,
            interacaoValorGerado: inf.valueGen,
            interacaoTags: inf.tags,
            healthAnterior: contact.health,
          }),
        });
      } catch (e) { console.warn("[Make push interação]", e); }
    }
    setInf({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });
    setModal(null);
    await load();
  };

  const delC = async (id) => {
    await supabase.from("interactions").delete().eq("contact_id", id);
    await supabase.from("contacts").delete().eq("id", id);
    setSelId(null);
    await load();
  };

  const sel = cts.find(c => c.id === selId);
  const cI = sel ? its.filter(i => i.contactId === sel.id) : [];
  const pf = assessment ? PROFILES[assessment.profileKey] : null;
  const sc = assessment?.scores || {};
  const admin = isAdmin(profile?.email);
  const NAVS = [
    { id: "dash", icon: "◎", label: "Dashboard" },
    { id: "contacts", icon: "◈", label: "Contatos" },
    { id: "teia", icon: "⊛", label: "Teia" },
    { id: "plano", icon: "🗺️", label: "Plano" },
    { id: "report", icon: "📊", label: "Relatório" },
    ...(admin ? [{ id: "mentor", icon: "👁", label: "Mentor" }, { id: "export", icon: "⬇", label: "Exportar" }] : []),
  ];

  const renderMentor = () => {
    // In localStorage mode, mentor sees shared data. In Supabase mode, RLS handles cross-user reads.
    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Painel do Mentor</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Visão administrativa — apenas para {ADMIN_EMAIL}</p>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.vio, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Seus dados locais</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
            {profile?.name} · {profile?.email}<br />
            {profile?.role} · {profile?.segment} · {profile?.state}<br />
            Perfil: {pf?.emoji} {pf?.name} · Score: {assessment?.overall}%<br />
            {cts.length} contatos · {its.length} interações
          </div>
        </div>
        <div style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 8 }}>Quando migrar para Supabase</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.6 }}>Este painel mostrará todos os mentorados, seus assessments, contatos e interações. A RLS do Supabase garante que só o mentor (is_mentor=true) consegue leitura cross-user.</div>
        </div>
      </div>
    );
  };

  const renderExport = () => {
    const exportCSV = () => {
      try {
        const header = "Nome,Empresa,Cargo,Categoria,Proximidade,Frequência,Health,Último Contato,Como Conheceu,Notas\n";
        const rows = cts.map(c => `"${c.name}","${c.company || ""}","${c.role || ""}","${c.category}",${c.proximity},${c.idealFreq},${c.health},"${fD(c.lastInteraction)}","${c.howMet || ""}","${(c.notes || "").replace(/"/g, "''")}"`).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "conexia-contatos.csv"; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
    };

    const exportJSON = () => {
      try {
        const data = { profile, assessment, contacts: cts, interactions: its, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "conexia-backup.json"; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
    };

    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Exportar dados</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Apenas o admin pode exportar. Testadores não veem esta tela.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 6 }}>Contatos CSV</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 12 }}>{cts.length} contatos</div>
            <Btn small onClick={exportCSV}>Baixar CSV</Btn>
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💾</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 6 }}>Backup completo</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 12 }}>Perfil + assessment + CRM</div>
            <Btn small onClick={exportJSON}>Baixar JSON</Btn>
          </div>
        </div>

        <div style={{ background: C.ambD, border: `1px solid ${C.amb}28`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, marginBottom: 6 }}>Google Drive · Em breve</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.6 }}>No deploy com Supabase, este botão conectará ao Google Drive via OAuth exclusivo do admin. Relatórios, contatos e backups serão salvos automaticamente na pasta MILLÉO STRATEGIC HUB.</div>
        </div>
      </div>
    );
  };

  const renderPlan = () => {
    const week = Math.min(4, Math.max(1, Math.ceil(dSince(assessment?.createdAt) / 7) || 1));
    const profileActions = pf?.actions || [];
    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Plano de Ativação</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Seu guia de 4 semanas para transformar networking em hábito.</p>

        {pf && <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>Suas 3 ações como {pf.name}</div>
          {profileActions.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: 6, background: C.gD, border: `1px solid ${C.gL}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 700, color: C.gold, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
        </div>}

        {PLAN.map((w, i) => {
          const isCurrent = w.week === week;
          const isDone = w.week < week;
          return (
            <div key={i} style={{ background: isCurrent ? `${C.gold}06` : C.card, border: `1px solid ${isCurrent ? C.gL : C.brd}`, borderRadius: 12, padding: 20, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: isDone ? C.grnD : isCurrent ? C.gD : C.w06, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{isDone ? "✅" : w.icon}</div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Tag color={isCurrent ? C.gold : isDone ? C.grn : C.txL} small>Semana {w.week}</Tag>
                    {isCurrent && <Tag color={C.gold} small>↑ Agora</Tag>}
                  </div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600, color: C.txt, marginTop: 3 }}>{w.title}</div>
                </div>
              </div>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, margin: "0 0 10px", fontStyle: "italic" }}>{w.goal}</p>
              {w.tasks.map((t, j) => (
                <div key={j} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ color: isCurrent ? C.gold : C.txL, fontSize: 12, marginTop: 1 }}>→</span>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: isCurrent ? C.txt : C.txM, lineHeight: 1.5 }}>{t}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, background: C.w06, borderRadius: 6, padding: "8px 12px" }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, textTransform: "uppercase" }}>Meta: </span>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: isCurrent ? C.gold : C.txM, fontWeight: isCurrent ? 600 : 400 }}>{w.metric}</span>
              </div>
            </div>
          );
        })}

        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginTop: 8 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Dicas de uso do CONÉXIA</div>
          {[
            { icon: "📅", title: "Ritual semanal", desc: "Toda segunda-feira, 15 minutos: veja os alertas do Dashboard e escolha 2 contatos para contatar." },
            { icon: "📋", title: "Registre interações", desc: "Sempre que falar com alguém relevante, registre na aba Contatos. Quanto mais você registra, mais preciso o Health Score fica." },
            { icon: "🎯", title: "Próxima ação", desc: "Todo contato deve ter sempre uma próxima ação definida. Relacionamento sem direção esfria." },
            { icon: "🌱", title: "Diversifique categorias", desc: "Equilibre sua rede entre Mentores, Aliados, Pontes e Potenciais. Redes diversas geram mais oportunidades." },
          ].map((tip, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: i < 3 ? `1px solid ${C.brd}` : "none" }}>
              <span style={{ fontSize: 20 }}>{tip.icon}</span>
              <div><div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 3 }}>{tip.title}</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>{tip.desc}</div></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDash = () => {
    const active = cts.filter(c => c.health > 40).length;
    const avg = cts.length ? Math.round(cts.reduce((s, c) => s + c.health, 0) / cts.length) : 0;
    const wk = its.filter(i => dSince(i.createdAt) <= 7).length;
    const cooling = [...cts].filter(c => c.health <= 40 && c.health > 0).sort((a, b) => a.health - b.health);
    const dead = cts.filter(c => c.health === 0 && c.lastInteraction);
    const noAction = cts.filter(c => !c.nextAction && c.status === "active");
    const rc = sc?.ritual_consistencia || 0;

    // Alert generation
    const alerts = [];
    cooling.slice(0, 3).forEach(c => {
      const days = dSince(c.lastInteraction);
      alerts.push({ type: "esfriando", icon: "⏳", severity: "high", color: C.cor, title: `${c.name} está esfriando`, msg: `Faz ${days} dias desde a última interação. Uma mensagem curta pode reativar essa conexão.`, action: "Envie uma mensagem simples hoje.", cid: c.id });
    });
    dead.slice(0, 2).forEach(c => {
      const days = dSince(c.lastInteraction);
      alerts.push({ type: "perdido", icon: "🔥", severity: "critical", color: C.cor, title: `${c.name} — conexão perdida`, msg: `${days} dias sem contato. Reative antes que vire apenas um nome.`, action: "Ligue ou mande mensagem genuína hoje.", cid: c.id });
    });
    noAction.slice(0, 2).forEach(c => {
      alerts.push({ type: "sem_acao", icon: "📋", severity: "medium", color: C.amb, title: `${c.name} sem próxima ação`, msg: `Relacionamento sem direção esfria. Defina o próximo passo.`, action: "Defina uma próxima interação.", cid: c.id });
    });
    // Rede concentrada
    if (cts.length >= 3) {
      const catCount = {};
      cts.forEach(c => { catCount[c.category] = (catCount[c.category] || 0) + 1; });
      const maxCat = Math.max(...Object.values(catCount));
      if (maxCat / cts.length > 0.7) {
        const dominant = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
        const catLabel = CATS.find(c => c.value === dominant)?.label || dominant;
        alerts.push({ type: "concentrada", icon: "🎯", severity: "medium", color: C.amb, title: "Rede pouco diversa", msg: `${Math.round(maxCat / cts.length * 100)}% dos seus contatos são "${catLabel}". Diversifique para criar mais oportunidades.`, action: "Busque 2 contatos de categorias diferentes." });
      }
    }
    // Aniversários próximos (7 dias)
    cts.forEach(c => {
      const days = birthdayDaysAway(c.birthday);
      if (days !== null && days <= 7) {
        alerts.push({ type: "aniversario", icon: "🎂", severity: days === 0 ? "critical" : "high", color: C.vio, title: days === 0 ? `Hoje é aniversário de ${c.name}!` : `Aniversário de ${c.name} em ${days} dia${days > 1 ? "s" : ""}`, msg: days === 0 ? `Envie uma mensagem personalizada agora — é um momento único para fortalecer o vínculo.` : `Prepare uma mensagem especial com antecedência. Demonstra que você se importa de verdade.`, action: `Envie uma mensagem genuína${c.whatsapp ? ` pelo WhatsApp ${c.whatsapp}` : ""}.`, cid: c.id });
      }
    });
    // Ritual de consistência
    if (assessment && rc < 60) {
      alerts.push({ type: "consistencia", icon: "⚡", severity: "medium", color: C.vio, title: "Ritual de Consistência em atenção", msg: `Seu score está em ${rc}%. Sua rede esfria mais rápido do que você nutre.`, action: "Crie um ritual: toda segunda, 15min, 2 contatos." });
    }

    // Weekly ritual
    const toReactivate = [...cts].filter(c => c.health < 60 && c.health > 0).sort((a, b) => a.health - b.health).slice(0, 3);
    const forValue = cts.filter(c => c.health >= 60).sort(() => Math.random() - 0.5)[0];
    const catCounts = {};
    cts.forEach(c => { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
    const leastCat = CATS.filter(ct => (catCounts[ct.value] || 0) === Math.min(...CATS.map(x => catCounts[x.value] || 0)))[0];

    // Health arc SVG
    const arcSize = 120;
    const arcR = 48;
    const arcPerc = avg / 100;
    const arcEnd = Math.PI * 2 * arcPerc - Math.PI / 2;
    const arcX = arcSize / 2 + arcR * Math.cos(arcEnd);
    const arcY = arcSize / 2 + arcR * Math.sin(arcEnd);
    const arcLarge = arcPerc > 0.5 ? 1 : 0;
    const arcColor = avg >= 70 ? C.grn : avg >= 40 ? C.amb : C.cor;

    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Olá, {profile?.name || ""}</h2>
        {pf && <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.gold, margin: "0 0 4px", fontWeight: 500 }}>{pf.emoji} {pf.name}</p>}
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 22px" }}>{cts.length === 0 ? "Cadastre seu primeiro contato para ativar sua rede." : `${cts.length} contatos · ${active} ativos · ${wk} interações esta semana`}</p>

        {cts.length === 0 ? (
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 44, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>◈</div>
            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.txt, margin: "0 0 10px" }}>Sua rede começa aqui</h3>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, lineHeight: 1.6, margin: "0 auto 16px", maxWidth: 380 }}>Cadastre 5-10 pessoas estratégicas na aba <strong style={{ color: C.gold }}>Contatos</strong>.</p>
            {pf && <div style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 10, padding: 14, textAlign: "left", marginTop: 12 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 6 }}>Sua primeira ação como {pf.name}:</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{pf.actions[0]}</div>
            </div>}
          </div>
        ) : (
          <>
            {/* ── Health Score + Metrics ── */}
            <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 16, display: "flex", alignItems: "center", gap: 16, flex: isMobile ? "1 1 100%" : "0 0 auto" }}>
                <svg width={arcSize} height={arcSize} viewBox={`0 0 ${arcSize} ${arcSize}`}>
                  <circle cx={arcSize / 2} cy={arcSize / 2} r={arcR} fill="none" stroke={C.brd} strokeWidth={6} />
                  {avg > 0 && <path d={`M ${arcSize / 2} ${arcSize / 2 - arcR} A ${arcR} ${arcR} 0 ${arcLarge} 1 ${arcX.toFixed(1)} ${arcY.toFixed(1)}`} fill="none" stroke={arcColor} strokeWidth={6} strokeLinecap="round" />}
                  <text x={arcSize / 2} y={arcSize / 2 - 4} textAnchor="middle" fill={arcColor} fontSize={22} fontWeight={700} fontFamily="'JetBrains Mono'">{avg}%</text>
                  <text x={arcSize / 2} y={arcSize / 2 + 14} textAnchor="middle" fill={C.txL} fontSize={9} fontFamily="'DM Sans'" fontWeight={600}>SAÚDE DA REDE</text>
                </svg>
                <div>
                  {[{ l: "Ativos", v: active, c: C.grn }, { l: "Esfriando", v: cooling.length, c: C.amb }, { l: "Perdidos", v: dead.length, c: C.cor }, { l: "Semana", v: wk, c: C.blu }].map((m, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: m.c }} />
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, minWidth: 70 }}>{m.l}</span>
                      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 600, color: m.c }}>{m.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Alerts ── */}
            {alerts.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>🔔 Alertas da sua rede ({alerts.length})</div>
                {alerts.map((al, i) => (
                  <div key={i} style={{ background: `${al.color}08`, border: `1px solid ${al.color}25`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{al.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 3 }}>{al.title}</div>
                        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, marginBottom: 8 }}>{al.msg}</div>
                        <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 6, padding: "8px 12px", marginBottom: 8 }}>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>Ação sugerida</div>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{al.action}</div>
                        </div>
                        {al.cid && <Btn variant="ghost" small onClick={() => { setSelId(al.cid); setView("contacts"); }}>Ver contato →</Btn>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Ritual Semanal ── */}
            {cts.length >= 3 && (
              <div style={{ background: `${C.gold}06`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 18 }}>✨</span>
                  <div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em" }}>Seu ritual da semana</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>5 micro-ações para nutrir sua rede</div>
                  </div>
                </div>

                {toReactivate.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.teal, textTransform: "uppercase", marginBottom: 6 }}>🔄 Reativar</div>
                    {toReactivate.map((c, i) => {
                      const ci = CATS.find(x => x.value === c.category);
                      return (
                        <div key={i} onClick={() => { setSelId(c.id); setView("contacts"); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer", borderBottom: i < toReactivate.length - 1 ? `1px solid ${C.brd}` : "none" }}>
                          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${ci?.color || C.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: ci?.color }}>{c.name[0]}</div>
                          <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, flex: 1 }}>{c.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: C.cor }}>{c.health}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {forValue && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, textTransform: "uppercase", marginBottom: 6 }}>💎 Gerar valor</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Envie algo útil para <strong style={{ color: C.txt }}>{forValue.name}</strong> — um artigo, uma indicação ou um elogio genuíno. Sem pedir nada.</div>
                  </div>
                )}

                <div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.blu, textTransform: "uppercase", marginBottom: 6 }}>🌱 Expandir rede</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Busque 1 contato novo na categoria <strong style={{ color: C.txt }}>{leastCat?.label || "Ponte"}</strong>. Sua rede precisa de diversidade para gerar oportunidades inesperadas.</div>
                </div>
              </div>
            )}

            {/* ── Ações Prioritárias ── */}
            {(cooling.length > 0 || noAction.length > 0) && (
              <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.cor, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>⚡ Ações prioritárias</div>
                {cooling.slice(0, 5).map((c, i) => {
                  const ci = CATS.find(x => x.value === c.category);
                  return (
                    <div key={i} onClick={() => { setSelId(c.id); setView("contacts"); }} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, cursor: "pointer" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: `${ci?.color || C.gold}14`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: ci?.color }}>{c.name[0]}</div>
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt, flex: 1 }}>{c.name}</span>
                      <div style={{ width: 65 }}><HBar score={c.health} small /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderContacts = () => {
    if (sel) {
      const ci = CATS.find(c => c.value === sel.category);
      return (
        <div>
          <button onClick={() => setSelId(null)} style={{ background: "none", border: "none", color: C.txM, cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 13, padding: "0 0 14px" }}>← Voltar</button>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 14, display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `${ci?.color || C.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: ci?.color }}>{sel.name[0]}</div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>{sel.name}</h3>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>{[sel.role, sel.company].filter(Boolean).join(" · ")}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}><Tag color={ci?.color}>{ci?.label}</Tag></div>
              <div style={{ marginTop: 10, maxWidth: 180 }}><HBar score={sel.health} /></div>
            </div>
            <Btn variant="danger" small onClick={() => { if (confirm("Remover contato?")) delC(sel.id); }}>Remover</Btn>
          </div>
          {sel.notes && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 14, marginBottom: 10, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{sel.notes}</div>}
          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {sel.whatsapp && <a href={`https://wa.me/55${sel.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 2 }}>📱 WhatsApp</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{sel.whatsapp}</div></a>}
            {sel.contactEmail && <a href={`mailto:${sel.contactEmail}`} style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.blu, marginBottom: 2 }}>✉️ Email</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.contactEmail}</div></a>}
            {sel.linkedin && <a href={sel.linkedin.startsWith("http") ? sel.linkedin : `https://${sel.linkedin}`} target="_blank" rel="noreferrer" style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: "#0A66C2", marginBottom: 2 }}>🔗 LinkedIn</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ver perfil</div></a>}
            {sel.birthday && (() => { const days = birthdayDaysAway(sel.birthday); const bDate = new Date(sel.birthday); return <div style={{ background: days !== null && days <= 7 ? `${C.vio}12` : C.card, border: `1px solid ${days !== null && days <= 7 ? C.vio : C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.vio, marginBottom: 2 }}>🎂 Aniversário</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{bDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}{days !== null && days <= 7 && <span style={{ color: C.vio, fontWeight: 600 }}> · em {days === 0 ? "hoje!" : `${days}d`}</span>}</div></div>; })()}
            {sel.mainCulture && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 2 }}>🌱 Cultura</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{MAIN_CULTURES.find(m => m.value === sel.mainCulture)?.label || sel.mainCulture}</div></div>}
            {(sel.city || sel.stateCode) && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, marginBottom: 2 }}>📍 Localização</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{[sel.city, sel.stateCode].filter(Boolean).join(", ")}</div></div>}
          </div>
          {sel.hobbies && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginBottom: 10 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.amb }}>🎯 Hobbies: </span><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>{sel.hobbies}</span></div>}
          {sel.nextAction && <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 8, padding: 12, marginBottom: 10 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.gold, marginBottom: 4 }}>📋 Próxima ação{sel.nextActionDate ? ` · ${fD(sel.nextActionDate)}` : ""}</div><div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{sel.nextAction}</div></div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase" }}>Timeline ({cI.length})</span>
            <Btn variant="success" small onClick={() => { setIntCid(sel.id); setModal("addI"); }}>+ Interação</Btn>
          </div>
          {cI.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 28, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 13, color: C.txL }}>Registre a primeira interação.</div>
          : cI.map((r, i) => { const tp = ITYPES.find(t => t.value === r.type); const se = SENTS.find(s => s.value === r.sentiment); return (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 2 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}><div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: se?.color || C.txL }} />{i < cI.length - 1 && <div style={{ width: 1, flex: 1, background: C.brd }} />}</div>
              <div style={{ flex: 1, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: C.txt }}>{tp?.icon} {tp?.label}{r.valueGen ? " · 💎" : ""}</span><span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{fD(r.createdAt)}</span></div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{r.desc}</div>
              </div>
            </div>
          ); })}
        </div>
      );
    }
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: 0 }}>Contatos</h2>
          <Btn small onClick={() => setModal("addC")}>+ Novo</Btn>
        </div>
        {cts.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 40, textAlign: "center" }}><Btn small onClick={() => setModal("addC")}>+ Primeiro contato</Btn></div>
        : cts.map(c => { const ci = CATS.find(x => x.value === c.category); return (
          <div key={c.id} onClick={() => setSelId(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: "12px 14px", marginBottom: 6, cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ci?.color || C.gold}14`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 700, color: ci?.color }}>{c.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div><div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{c.company || "—"}</div></div>
            <div style={{ width: 70 }}><HBar score={c.health} small /></div>
            <Tag small color={ci?.color}>{ci?.label}</Tag>
          </div>
        ); })}
      </div>
    );
  };

  const renderTeia = () => {
    if (cts.length < 2) return <div><h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 12px" }}>Teia</h2><div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 50, textAlign: "center" }}><div style={{ fontSize: 32, marginBottom: 12 }}>⊛</div><div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 8 }}>Você tem {cts.length} contato cadastrado</div><div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txL, marginBottom: 16 }}>Cadastre mais {2 - cts.length} contato{2 - cts.length > 1 ? "s" : ""} para visualizar sua Teia</div><Btn small onClick={() => { setView("contacts"); setModal("addC"); }}>+ Adicionar contato</Btn></div></div>;
    const CX = 300, CY = 260, R = 195;
    const sorted = [...cts].sort((a, b) => { const o = { mentor: 0, aliado: 1, ponte: 2, potencial: 3, dormindo: 4 }; return (o[a.category] || 4) - (o[b.category] || 4); });
    const step = (2 * Math.PI) / sorted.length;
    const nodes = sorted.map((c, i) => { const a = -Math.PI / 2 + i * step; const d = R * Math.max(0.15, c.health / 100); const ci = CATS.find(x => x.value === c.category); return { c, x: CX + d * Math.cos(a), y: CY + d * Math.sin(a), lx: CX + (R + 28) * Math.cos(a), ly: CY + (R + 28) * Math.sin(a), a, col: ci?.color || C.gold, r: Math.max(7, Math.min(20, 7 + its.filter(x => x.contactId === c.id).length * 2)) }; });
    const wp = nodes.length >= 3 ? nodes.map((n, i) => `${i === 0 ? "M" : "L"} ${n.x} ${n.y}`).join(" ") + " Z" : "";
    return (
      <div><h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 12px" }}>Teia da Rede</h2>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 16 }}>
          <svg viewBox="0 0 600 520" style={{ width: "100%", height: "auto" }}>
            {[1, 2, 3, 4, 5].map(i => <circle key={i} cx={CX} cy={CY} r={R * (i / 5)} fill="none" stroke={C.brd} strokeWidth={0.5} strokeDasharray={i < 5 ? "3,6" : "none"} opacity={0.5} />)}
            {wp && <path d={wp} fill={`${C.gold}08`} stroke={C.gL} strokeWidth={1.5} />}
            <circle cx={CX} cy={CY} r={5} fill={C.gold} opacity={0.8} />
            {nodes.map((n, i) => (
              <g key={i} onClick={() => { setSelId(n.c.id); setView("contacts"); }} style={{ cursor: "pointer" }}>
                <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.col}30`} stroke={n.col} strokeWidth={1.5} />
                <circle cx={n.x} cy={n.y} r={3} fill={n.c.health >= 70 ? C.grn : n.c.health >= 40 ? C.amb : C.cor} />
                <text x={n.lx} y={n.ly} textAnchor={n.a > Math.PI / 2 || n.a < -Math.PI / 2 ? "end" : "start"} dominantBaseline="middle" fill={C.txM} fontSize={10} fontFamily="'DM Sans'">{n.c.name.length > 13 ? n.c.name.slice(0, 12) + "…" : n.c.name}</text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  const renderReport = () => {
    if (!assessment) return <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 40, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 14, color: C.txL }}>Relatório não encontrado.</div>;
    const isPro = profile?.is_pro || user?.email === "rafaelmilleo@yahoo.com.br" || user?.email === "rafamilleo@gmail.com";
    const downloadReport = () => {
      // ── helpers ──────────────────────────────────────────────
      const s10 = (k) => Math.round((sc[k]||0)/10);  // score /10
      const pct = (k) => sc[k]||0;                    // score %
      const sortedD = [...DIMS].sort((a,b)=>(sc[b.key]||0)-(sc[a.key]||0));
      const maxD = sortedD[0];
      const minD = sortedD[sortedD.length-1];
      const top3 = sortedD.slice(0,3);
      const bot2 = sortedD.slice(-2);
      const overallTen = Math.round(assessment.overall/10);
      const percLabel = assessment.overall>=85?'TOP 10%':assessment.overall>=75?'TOP 20%':assessment.overall>=65?'TOP 30%':assessment.overall>=55?'TOP 40%':'EM DESENVOLVIMENTO';
      const percColor = assessment.overall>=75?'#4caf50':assessment.overall>=55?'#ff9800':'#ef5350';

      const getLvl = (v) => v>=75?'high':v>=50?'mid':'low';
      const getLvlLbl = (v) => v>=80?'Excelente':v>=65?'Forte':v>=50?'Médio':v>=35?'Relevante':'Gap Crítico';
      const getLvlClr = (v) => v>=75?'#4caf50':v>=50?'#ff9800':'#ef5350';
      const proj = (v) => v<30?Math.min(100,v+40):v<50?Math.min(100,v+30):v<70?Math.min(100,v+20):Math.min(100,v+10);

      // ── per-dimension content ─────────────────────────────────
      const dimContent = {
        intencao_estrategica:{
          sintese: {high:"Você vê o networking como investimento estratégico — sabe exatamente quem precisa na sua rede e por quê. Age com propósito e tem visão de longo prazo.",mid:"Você tem alguma clareza sobre seus objetivos relacionais, mas nem sempre age com intenção deliberada. Há espaço para tornar sua estratégia mais explícita.",low:"Você age por impulso mais do que por estratégia nas relações. Construir uma visão clara de quem quer ter na rede é o primeiro passo."},
          gatilho_at:{label:"Mapa Estratégico",desc:"Clareza de onde cada contato gera impacto no longo prazo",acao:"Monte um mapa de 15-20 contatos prioritários com ciclo de 30 dias para cada um."},
          gatilho_bl:{label:"Falta de Visão Sistêmica",desc:"Age por impulso ou contexto, sem estratégia clara de quais conexões cultivar",antidoto:"Dedique 30 minutos por mês para revisar sua rede e identificar gaps estratégicos."},
          interp:{high:"Visão de mercado e clareza de intenção — pico absoluto",mid:"Direção presente, execução a desenvolver",low:"Oportunidade crítica de alavancagem"}
        },
        escuta_relacional:{
          sintese:{high:"Sua escuta é um ativo relacional raro. As pessoas saem de conversas com você sentindo que foram genuinamente vistas e compreendidas.",mid:"Você escuta bem em momentos importantes, mas a agenda própria às vezes interfere. Presença plena nas conversas é o diferencial.",low:"Você tende a falar mais do que ouvir. Conversas posicionadas não criam aliados — conversas transformadoras criam."},
          gatilho_at:{label:"Profundidade Conversacional",desc:"Momentos de escuta genuína criam vínculos que posicionamento não consegue",acao:"Regra: em 1 conversa por dia, escute 70% do tempo. Faça perguntas que você genuinamente não sabe a resposta."},
          gatilho_bl:{label:"Escuta Rasa",desc:"Foco no posicionamento pessoal em vez de entender o outro",antidoto:"Antes de cada conversa importante, defina 2 perguntas que você quer genuinamente aprender sobre a pessoa."},
          interp:{high:"Escuta profunda — o maior ponto de alavancagem",mid:"Desenvolvimento ativo necessário",low:"GAP CRÍTICO — escuta rasa limita a profundidade das conexões"}
        },
        presenca_mercado:{
          sintese:{high:"Você tem marca pessoal sólida. O mercado te conhece pelo que você entrega — sua reputação precede você e as pessoas te buscam ativamente.",mid:"Você tem alguma visibilidade, mas ela é inconsistente. Falta constância para consolidar uma referência de mercado.",low:"Sua competência não é visível para quem deveria conhecê-la. O mercado não pode valorizar o que não enxerga."},
          gatilho_at:{label:"Visibilidade Ativa",desc:"Ambientes de alta visibilidade onde pode posicionar sua referência",acao:"Publique 1 insight por semana sobre sua área. Presencie 1 evento estratégico por mês."},
          gatilho_bl:{label:"Presença Episódica",desc:"Aparece nos momentos certos mas some entre os eventos",antidoto:"Crie um calendário fixo de presença: 1 conteúdo/semana, 1 evento/mês, 1 artigo/trimestre."},
          interp:{high:"Marca pessoal forte — circula com objetivo claro",mid:"Visibilidade inconsistente — constância é o gap",low:"Invisível para quem deveria te conhecer"}
        },
        reciprocidade_ativa:{
          sintese:{high:"Você gera valor antes de pedir. Indica, conecta, compartilha sem agenda — e isso cria uma rede que genuinamente quer te ajudar.",mid:"Você se importa em contribuir, mas nem sempre toma a iniciativa. Pequenos gestos frequentes constroem dívidas de gratidão.",low:"Você espera que a relação evolua sozinha. A reciprocidade ativa — dar primeiro, sem agenda — é o combustível das redes sólidas."},
          gatilho_at:{label:"Geração de Valor",desc:"Identificar oportunidades de contribuir antes de ser solicitado",acao:"Para cada contato-chave: o que posso oferecer agora sem esperar nada? Faça 2 indicações esta semana."},
          gatilho_bl:{label:"Follow-up Passivo",desc:"Aguarda que a relação evolua naturalmente sem iniciativa própria",antidoto:"Regra das 48h: toda conversa relevante recebe mensagem personalizada com algo de valor."},
          interp:{high:"Valor nos relacionamentos — presente e genuíno",mid:"Espaço para ampliar a proatividade",low:"Reciprocidade passiva limita conversão de contatos em aliados"}
        },
        ritual_consistencia:{
          sintese:{high:"Você trata networking como hábito. Sua rede nunca esfria porque você a alimenta regularmente — mesmo nas épocas mais intensas.",mid:"Você tem intenção de manter contato, mas a rotina engole a execução. Um sistema mínimo substitui a motivação variável.",low:"Seu networking é reativo — você cultiva quando precisa. Isso limita profundamente o capital relacional que você consegue construir."},
          gatilho_at:{label:"Sistema de Hábito",desc:"Quando o sistema de contato está instalado, a consistência é automática",acao:"Ritual: toda segunda-feira, 20 minutos, 3 contatos. Sem exceção. Configure no calendário agora."},
          gatilho_bl:{label:"Rotina que Engole",desc:"Intenção alta, mas execução dependente da energia disponível",antidoto:"CRM pessoal simples: 20 contatos prioritários, data do último contato, próximo contato planejado."},
          interp:{high:"Follow-up ativo — comportamento de alto impacto instalado",mid:"GAP CRÍTICO — follow-up passivo limita conversão dos contatos",low:"GAP CRÍTICO — ausência de sistema torna networking reativo"}
        },
        confianca_autentica:{
          sintese:{high:"Você é o mesmo nas reuniões formais e no cafezinho informal. Essa coerência é percebida e valorizada — é a base de todas as relações sólidas.",mid:"Você é relativamente autêntico, mas há um 'personagem profissional' que ainda limita conexões mais profundas.",low:"Há distância entre quem você é e como se apresenta profissionalmente. Essa lacuna cria barreiras invisíveis que impedem vínculos genuínos."},
          gatilho_at:{label:"Identidade Coerente",desc:"Alinhamento entre valores pessoais e comportamento profissional gera confiança",acao:"Compartilhe algo real sobre o que você está construindo ou enfrentando. Deixe o outro contribuir."},
          gatilho_bl:{label:"Personagem Profissional",desc:"Apresenta uma versão curada que impede conexões genuínas",antidoto:"Em 2 conversas próximas, seja vulnerável: compartilhe um desafio real. Isso transforma contato em aliado."},
          interp:{high:"Alinhamento presente — base sólida de confiança",mid:"Autenticidade em desenvolvimento",low:"Gap entre intenção e expressão — barreira para vínculos profundos"}
        }
      };

      // ── tensão central inteligente ────────────────────────────
      const hiLabel = (d) => `${d.label} ${s10(d.key)}/10`;
      const tensao = bot2.length>=2
        ? `${hiLabel(top3[0])} e ${hiLabel(top3[1])} — mas ${hiLabel(bot2[1])} e ${hiLabel(bot2[0])}. ${dimContent[bot2[0].key]?.sintese?.[getLvl(pct(bot2[0].key))]?.split('.')[0]||''}. A rede existe em potencial; o capital relacional profundo ainda está sendo construído.`
        : `Score geral ${overallTen}/10. ${pf?.desc?.split('.')[0]||''}.`;

      // ── SÍNTESE gerada a partir dos scores ───────────────────
      const sintese12 = [
        {q:"O que mais te impressiona?", a: pct('intencao_estrategica')>=70?`A clareza sobre quem você quer ter na sua rede e por quê — você vê o networking como investimento, não como evento.`:`A intenção existe, mas a estratégia de rede ainda está em construção — há espaço para tornar os objetivos mais explícitos.`},
        {q:"Como gostaria de ser descrito?", a: pct('presenca_mercado')>=70?`Uma referência — sabe muito sobre o que faz e tem visão de mercado que o torna reconhecível.`:`Um profissional sólido, mas ainda construindo visibilidade consistente no mercado.`},
        {q:"Sua relação com networking?", a: pct('intencao_estrategica')>=70?`Como investimento estratégico que precisa ser gerenciado com clareza de propósito e retorno.`:`Como algo importante mas que ainda compete com a rotina — a intenção supera a execução.`},
        {q:"Como se comporta em eventos?", a: pct('presenca_mercado')>=70?`Circulando ativamente — o objetivo é conectar com pessoas relevantes com clareza de propósito.`:`Presente, mas sem sempre ter clareza do que quer gerar em cada conversa.`},
        {q:"Alguém pede ajuda. Sua reação?", a: pct('reciprocidade_ativa')>=70?`Responde com generosidade — conecta, indica, compartilha. A reciprocidade é um valor genuíno.`:`Ajuda quando solicitado, mas raramente toma a iniciativa de oferecer antes de ser chamado.`},
        {q:"Qual situação te representa?", a: pct('ritual_consistencia')>=70?`Contatos que se tornam aliados — porque você cultiva com consistência, não apenas em momentos de necessidade.`:`Muitos contatos, mas poucos que eu chamaria de aliados reais — a profundidade é o gap.`},
        {q:"Maior bloqueio?", a: pct('ritual_consistencia')>=70?`A escala — manter qualidade quando o volume de relações cresce é o desafio.`:`O tempo — tenho a intenção, mas a rotina engole a execução. O sistema ainda não está instalado.`},
        {q:"O que faz nas 48h após conversa?", a: pct('reciprocidade_ativa')>=70?`Envio mensagem personalizada com algo de valor — um artigo, uma indicação, um reconhecimento.`:`Depende da conversa — nas mais relevantes, faço follow-up; nas demais, aguardo que a relação evolua.`},
        {q:"Onde sua energia vai em conversas?", a: pct('escuta_relacional')>=70?`Para entender o outro genuinamente — o que está construindo, enfrentando, precisando.`:`Para me posicionar bem — como estou sendo percebido e que impressão estou gerando.`},
        {q:"Papel dos relacionamentos?", a: pct('confianca_autentica')>=70?`É o que define meu legado — o impacto que gerei nas pessoas e no mercado.`:`É essencial para o meu crescimento, mas ainda não é gerenciado com a atenção que merece.`},
        {q:"Uma coisa que mudaria?", a: pct('ritual_consistencia')>=70?`Aprofundar as conexões que já tenho — transformar mais contatos em aliados reais.`:`Ser mais consistente no follow-up — manter o contato vivo entre os momentos de encontro.`},
        {q:"O que rede representa?", a: pct('confianca_autentica')>=70?`Segurança — pessoas que estarão lá quando eu precisar, porque cultivei com genuinidade.`:`Oportunidade — mas ainda não operacionalizada com a consistência que o potencial merece.`},
      ];

      // ── radar SVG ─────────────────────────────────────────────
      const cx=220,cy=220,r=160;
      const rPt=(i,v)=>{const a=-Math.PI/2+(2*Math.PI/6)*i;const d=r*(v/100);return[cx+d*Math.cos(a),cy+d*Math.sin(a)];};
      const dVals=DIMS.map(d=>pct(d.key));
      const rPoly=dVals.map((v,i)=>rPt(i,v).join(',')).join(' ');
      const rRings=[20,40,60,80,100].map(v=>`<polygon points="${Array.from({length:6},(_,i)=>rPt(i,v).join(',')).join(' ')}" fill="none" stroke="#2a2825" stroke-width="${v===60?1.2:.6}"/>`).join('');
      const rAxes=DIMS.map((_,i)=>{const[x,y]=rPt(i,100);return`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#2a2825" stroke-width=".5"/>`;}).join('');
      const rDots=dVals.map((v,i)=>{const[x,y]=rPt(i,v);return`<circle cx="${x}" cy="${y}" r="5" fill="${DIMS[i].color}"/>`;}).join('');
      const rLbls=DIMS.map((_,i)=>{const[x,y]=rPt(i,120);const v=dVals[i];return`<text x="${x}" y="${y-4}" text-anchor="middle" fill="${DIMS[i].color}" font-size="9.5" font-weight="700" font-family="Arial">${DIMS[i].short}</text><text x="${x}" y="${y+9}" text-anchor="middle" fill="${DIMS[i].color}" font-size="11" font-weight="700" font-family="monospace">${v}%</text>`;}).join('');
      const radarSVG=`<svg viewBox="0 0 440 440" width="340" height="340">${rRings}${rAxes}<polygon points="${rPoly}" fill="#c9a22718" stroke="#c9a227" stroke-width="2"/>${rDots}${rLbls}</svg>`;

      // ── mapa mental SVG ───────────────────────────────────────
      const W=1000,H=780,MMcx=W/2,MMcy=H/2+20;
      const mmSubtopics={
        intencao_estrategica:["Visão de longo prazo","Mapa de contatos","Propósito claro","Retorno de rede","Priorização"],
        escuta_relacional:["Presença plena","Perguntas abertas","Empatia ativa","Conexão genuína","Escuta 70/30"],
        presenca_mercado:["Marca pessoal","Conteúdo","Eventos","Referência","Visibilidade"],
        reciprocidade_ativa:["Dar primeiro","Indicações","Compartilhar","Valor sem agenda","Follow-up"],
        ritual_consistencia:["Rotina semanal","CRM pessoal","Segunda-feira","Hábito","Sistema"],
        confianca_autentica:["Coerência","Vulnerabilidade","Valores","Identidade","Autenticidade"]
      };
      let mmSVG='';
      const mmRings=[60,130,200,270].map(rr=>`<circle cx="${MMcx}" cy="${MMcy}" r="${rr}" fill="none" stroke="#1e1c18" stroke-width=".8" stroke-dasharray="3,8"/>`).join('');
      mmSVG+=mmRings;
      DIMS.forEach((d,i)=>{
        const angle=-Math.PI/2+(2*Math.PI/6)*i;
        const v=pct(d.key);
        const mainDist=195+30*(v/100);
        const mx=MMcx+mainDist*Math.cos(angle);
        const my=MMcy+mainDist*Math.sin(angle);
        mmSVG+=`<line x1="${MMcx}" y1="${MMcy}" x2="${mx}" y2="${my}" stroke="${d.color}" stroke-width="2" opacity=".35"/>`;
        // main node
        const nr=36+Math.round(v/20);
        mmSVG+=`<circle cx="${mx}" cy="${my}" r="${nr+6}" fill="${d.color}" opacity=".07"/>`;
        mmSVG+=`<circle cx="${mx}" cy="${my}" r="${nr}" fill="#0d0d0f" stroke="${d.color}" stroke-width="2"/>`;
        mmSVG+=`<text x="${mx}" y="${my-8}" text-anchor="middle" fill="${d.color}" font-size="10" font-weight="700" font-family="Arial">${d.short}</text>`;
        mmSVG+=`<text x="${mx}" y="${my+7}" text-anchor="middle" fill="${getLvlClr(v)}" font-size="13" font-weight="700" font-family="monospace">${s10(d.key)}/10</text>`;
        // sub-branches
        const topics=(mmSubtopics[d.key]||[]).slice(0,5);
        topics.forEach((t,ti)=>{
          const spread=0.55;
          const sa=angle+(ti-(topics.length-1)/2)*spread;
          const sd=85+20*(v/100);
          const sx=mx+sd*Math.cos(sa);
          const sy=my+sd*Math.sin(sa);
          const isActive=v>=60;
          mmSVG+=`<line x1="${mx}" y1="${my}" x2="${sx}" y2="${sy}" stroke="${d.color}" stroke-width="${isActive?1.2:.7}" opacity=".4"/>`;
          mmSVG+=`<ellipse cx="${sx}" cy="${sy}" rx="30" ry="13" fill="${d.color}${isActive?'16':'0a'}" stroke="${d.color}" stroke-width="${isActive?.9:.4}" opacity="${isActive?.9:.5}"/>`;
          mmSVG+=`<text x="${sx}" y="${sy+1}" text-anchor="middle" dominant-baseline="middle" fill="${d.color}" font-size="8" font-weight="${isActive?'600':'400'}" font-family="Arial" opacity="${isActive?.9:.6}">${t}</text>`;
        });
      });
      // center
      mmSVG+=`<circle cx="${MMcx}" cy="${MMcy}" r="54" fill="#c9a22710" stroke="#c9a227" stroke-width="2"/>`;
      mmSVG+=`<circle cx="${MMcx}" cy="${MMcy}" r="44" fill="#0a0a0c" stroke="#c9a22740" stroke-width="1"/>`;
      mmSVG+=`<text x="${MMcx}" y="${MMcy-14}" text-anchor="middle" fill="#c9a227" font-size="26">${pf?.emoji||'🎯'}</text>`;
      mmSVG+=`<text x="${MMcx}" y="${MMcy+8}" text-anchor="middle" fill="#c9a227" font-size="12" font-weight="700" font-family="Arial">${assessment.overall}%</text>`;
      mmSVG+=`<text x="${MMcx}" y="${MMcy+22}" text-anchor="middle" fill="#c9a22760" font-size="8" font-family="Arial">score geral</text>`;
      // connecting hex
      const hexPts=DIMS.map((_,i)=>{const a=-Math.PI/2+(2*Math.PI/6)*i;const d2=195+30*(pct(DIMS[i].key)/100);return`${MMcx+d2*Math.cos(a)},${MMcy+d2*Math.sin(a)}`;}).join(' ');
      mmSVG=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:600px" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#090908"/>${mmSVG}<polygon points="${hexPts}" fill="#c9a22705" stroke="#c9a22725" stroke-width="1" stroke-dasharray="4,6"/></svg>`;

      const html=`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Diagnóstico Relacional — ${profile?.name||""}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-size:13px}
@page{size:A4;margin:0}
@media print{.no-print{display:none!important}.pb{page-break-before:always}}
.print-btn{position:fixed;bottom:20px;right:20px;background:#c9a227;color:#000;border:none;border-radius:8px;padding:12px 20px;font-size:13px;font-weight:700;cursor:pointer;z-index:999;box-shadow:0 4px 20px #c9a22760}

/* ── COVER ─────────────────────────────────────── */
.cover{display:grid;grid-template-columns:195px 1fr 185px;min-height:100vh;background:#0d0d0f}
.col-l{background:#111010;border-right:1px solid #222;padding:28px 16px;overflow:hidden}
.col-c{padding:36px 24px;display:flex;flex-direction:column;justify-content:space-between;background:linear-gradient(135deg,#0d0d0f 0%,#100e0c 100%)}
.col-r{background:#111010;border-left:1px solid #222;padding:24px 14px;overflow:hidden}

/* dim card */
.dc{margin-bottom:13px;padding-bottom:13px;border-bottom:1px solid #1c1a18}
.dc-lbl{font-size:11px;font-weight:700;color:#c9a227;margin-bottom:3px}
.dc-score{font-family:'Courier New',monospace;font-size:20px;font-weight:700;float:right;line-height:1.1}
.dc-badge{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:1px 6px;border-radius:2px;display:inline-block;margin-bottom:3px}
.dc-bar-wrap{height:5px;border-radius:3px;background:#1e1c18;clear:both}
.dc-bar{height:5px;border-radius:3px}
.dc-note{font-size:9px;color:#3a3835;margin-top:3px;line-height:1.35}

/* center elements */
.profile-badge{display:inline-flex;align-items:center;gap:8px;border:1px solid #c9a22730;background:#c9a22710;border-radius:6px;padding:7px 14px;margin-bottom:10px}
.tag{display:inline-block;background:#ffffff08;border:1px solid #2a2825;color:#666;padding:3px 10px;border-radius:20px;font-size:9.5px;margin-right:5px;margin-bottom:5px}
.score-grid{display:flex;border:1px solid #222;border-radius:8px;overflow:hidden;margin-bottom:20px}
.score-cell{padding:14px 16px;border-right:1px solid #222;text-align:center;flex:1}
.score-cell:last-child{border-right:none}
.tensao-box{background:#c9a22706;border:1px solid #c9a22720;border-radius:7px;padding:14px;margin-bottom:14px}
.quote{border-left:2px solid #c9a22740;padding-left:14px;margin-bottom:12px}

/* right sidebar cards */
.sc{background:#161614;border:1px solid #242220;border-radius:8px;padding:13px;margin-bottom:9px}
.sc-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin-bottom:7px}

/* ── SECTIONS ───────────────────────────────────── */
.sec{padding:36px 40px;border-top:1px solid #eee;background:#fff;color:#111}
.sec-dark{padding:36px 40px;border-top:1px solid #1a1816;background:#0d0d0f;color:#e8e4da}
.sec-lbl{font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#c9a227;margin-bottom:12px}
h2{font-size:22px;font-weight:700;margin-bottom:12px;color:inherit}
h3{font-size:13px;font-weight:600;color:#c9a227;margin-bottom:6px;margin-top:16px}
p{font-size:13px;line-height:1.75;margin-bottom:10px;color:#555}
p.light{color:#8a8480}
.card{border:1px solid #e0ddd8;border-radius:10px;padding:18px;margin-bottom:12px}
.card-dark{background:#161618;border:1px solid #2a2825;border-radius:10px;padding:18px;margin-bottom:12px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.bar-w{height:6px;border-radius:3px;background:#e5e2dc;margin-top:5px}
.bar-w-dark{height:6px;border-radius:3px;background:#2a2825;margin-top:5px}
.bar-f{height:6px;border-radius:3px}
.act-num{width:30px;height:30px;border-radius:8px;background:#c9a22715;border:1px solid #c9a22730;display:flex;align-items:center;justify-content:center;font-weight:700;color:#c9a227;font-size:13px;flex-shrink:0;font-family:'Courier New',monospace}
.week-box{display:grid;grid-template-columns:54px 1fr;margin-bottom:14px;border:1px solid #e0ddd8;border-radius:10px;overflow:hidden}
.week-num{background:#f7f5f0;border-right:1px solid #e0ddd8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;gap:5px}
.week-body{padding:14px}
.thermo-row{display:grid;grid-template-columns:130px 55px 65px 1fr;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid #eee;font-size:12px}
.footer{background:#0d0d0f;border-top:1px solid #1a1816;padding:18px 40px;display:flex;justify-content:space-between;align-items:center}

/* sintese */
.sq{display:flex;gap:10px;margin-bottom:9px;font-size:11.5px}
.sq-num{font-family:'Courier New',monospace;font-size:10px;font-weight:700;color:#c9a227;background:#c9a22712;border:1px solid #c9a22730;width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sq-q{font-weight:600;color:#333;margin-bottom:2px}
.sq-a{color:#666;line-height:1.5}

/* gatilhos */
.gtcard{border-radius:8px;padding:14px;margin-bottom:10px}
.gt-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}

/* mm */
.mm-legend-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #1a1816}
</style></head><body>

<button class="print-btn no-print" onclick="window.print()">⬇ Salvar como PDF</button>

<!-- ════ CAPA ════════════════════════════════════════════════ -->
<div class="cover">

  <!-- LEFT: MAPA DIMENSIONAL -->
  <div class="col-l">
    <div style="font-size:8.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c9a22760;margin-bottom:18px;padding-bottom:10px;border-bottom:1px solid #222">Mapa Dimensional</div>
    ${DIMS.map(d=>{const v=pct(d.key);const t=s10(d.key);const clr=getLvlClr(v);const isCrit=v<40;const isStr=v>=80;return`
    <div class="dc">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div class="dc-lbl" style="color:${d.color}">${d.label}</div>
        <div class="dc-score" style="color:${clr}">${t}/10</div>
      </div>
      ${isCrit?`<div class="dc-badge" style="color:#ef5350;background:#ef535012;border:1px solid #ef535025">⚠ GAP CRÍTICO</div>`:isStr?`<div class="dc-badge" style="color:#4caf50;background:#4caf5012;border:1px solid #4caf5025">■ ${getLvlLbl(v)}</div>`:''}
      <div class="dc-bar-wrap"><div class="dc-bar" style="width:${v}%;background:${d.color}"></div></div>
      <div class="dc-note">${dimContent[d.key]?.interp?.[getLvl(v)]||''}</div>
    </div>`;}).join('')}
  </div>

  <!-- CENTER: PROFILE -->
  <div class="col-c">
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid #2a2825">
        <div style="font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#c9a22760">Diagnóstico Relacional Profissional</div>
        <div style="font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c9a22740">CONÉXIA</div>
      </div>

      <div style="font-size:8px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;margin-bottom:4px" class="col-c">
        <span style="color:${percColor};background:${percColor}18;border:1px solid ${percColor}30;padding:3px 10px;border-radius:4px">${percLabel}</span>
        <span style="color:#c9a22760;margin-left:10px">· SCORE MÉDIO ${overallTen}/10</span>
      </div>

      <div style="font-size:60px;font-weight:800;color:#e8e4da;line-height:.95;margin:14px 0 18px;letter-spacing:-2px">${profile?.name||profile?.first_name||""}</div>

      <div class="profile-badge">
        <span style="font-size:24px">${pf?.emoji||"🎯"}</span>
        <div>
          <div style="font-size:13px;font-weight:700;color:#c9a227;letter-spacing:.04em">${pf?.name||""}</div>
          <div style="font-size:10px;color:#6a6460;font-style:italic">${pf?.tagline||""}</div>
        </div>
      </div>

      <div style="margin-bottom:16px">
        ${profile?.role?`<span class="tag">${profile.role}</span>`:''}
        ${profile?.segment?`<span class="tag">${profile.segment}</span>`:''}
        ${profile?.state?`<span class="tag">${profile.state}</span>`:''}
      </div>

      <div class="score-grid">
        <div class="score-cell" style="background:#c9a22710">
          <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;color:#c9a227;line-height:1">${assessment.overall}%</div>
          <div style="font-size:8px;color:#6a6460;text-transform:uppercase;letter-spacing:.1em;margin-top:3px">Score Geral</div>
        </div>
        ${DIMS.slice(0,3).map(d=>{const v=pct(d.key);return`<div class="score-cell"><div style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:${d.color}">${v}%</div><div style="font-size:8px;color:#3a3830;margin-top:2px">${d.short}</div></div>`;}).join('')}
      </div>

      <div class="tensao-box">
        <div style="font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c9a22790;margin-bottom:7px">Tensão Central</div>
        <div style="font-size:12px;color:#9a8870;line-height:1.7">${tensao}</div>
      </div>

      <div class="quote">
        <div style="font-size:13px;color:#b8b0a0;font-style:italic;line-height:1.6">"${pf?.tagline||""}"</div>
      </div>
    </div>
    <div style="font-size:9px;color:#2a2820">Gerado em ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>

  <!-- RIGHT: HIGHLIGHTS -->
  <div class="col-r">
    <div style="font-size:8px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#c9a22760;margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid #222">Destaques</div>

    <div class="sc" style="border-color:#4caf5030">
      <div class="sc-lbl" style="color:#4caf50">■ Maior Força</div>
      <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#4caf50;line-height:1">${s10(maxD.key)}/10</div>
      <div style="font-size:10px;font-weight:700;color:#e8e4da;margin-top:3px">${maxD.label}</div>
      ${top3.length>1?`<div style="font-size:9px;color:#3a5830;margin-top:4px">${top3.slice(1,3).map(d=>`${d.label.split(' ')[0]} ${s10(d.key)}/10`).join(' + ')}</div>`:''}
      <div style="font-size:9px;color:#2a3820;margin-top:4px;line-height:1.35">Três dimensões no pico — capital relacional diferenciado</div>
    </div>

    ${bot2[0]&&pct(bot2[0].key)<65?`<div class="sc" style="border-color:#ef535030">
      <div class="sc-lbl" style="color:#ef5350">⚠ Gap Crítico</div>
      <div style="font-family:'Courier New',monospace;font-size:30px;font-weight:700;color:#ef5350;line-height:1">${s10(bot2[0].key)}/10</div>
      <div style="font-size:10px;font-weight:700;color:#e8e4da;margin-top:3px">${bot2[0].label}</div>
      <div style="font-size:9px;color:#5a2820;margin-top:4px;line-height:1.35">${bot2[0]&&pct(bot2[0].key)<40?'Extremamente baixo apesar de potencial declarado':'Maior ponto de alavancagem disponível'}</div>
    </div>`:''}

    <div class="sc" style="border-color:#8a6fb030">
      <div class="sc-lbl" style="color:#8a6fb0">👁 Sombra do Perfil</div>
      ${pf?.risks?.slice(0,2).map(r=>`<div style="font-size:10px;color:#e8e4da;margin-bottom:4px">${r}</div>`).join('')||''}
      <div style="font-size:9px;color:#3a2850;margin-top:4px;line-height:1.35">Rede ${pct('presenca_mercado')<60?'pequena':'relevante'} em volume para o potencial que tem</div>
    </div>

    <div class="sc" style="border-color:#c9a22725">
      <div class="sc-lbl" style="color:#c9a227">🚀 Potencial Futuro</div>
      ${(pf?.actions||[]).map((a,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px"><span style="font-family:'Courier New',monospace;font-size:9px;font-weight:700;color:#c9a22760;flex-shrink:0">${i+1}</span><span style="font-size:9px;color:#5a5040;line-height:1.4">${a.split('.')[0]}</span></div>`).join('')}
    </div>

    <div style="background:#0a0a0c;border:1px solid #1a1816;border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:8px;font-weight:700;color:#c9a22760;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Radar</div>
      ${(()=>{const r2=52,cx2=67,cy2=67;const p2=(i,v)=>{const a=-Math.PI/2+(2*Math.PI/6)*i;const d=r2*(v/100);return[cx2+d*Math.cos(a),cy2+d*Math.sin(a)];};const dv2=DIMS.map(d=>pct(d.key));const poly2=dv2.map((v,i)=>p2(i,v).join(',')).join(' ');const rngs=[20,40,60,80,100].map(v=>`<polygon points="${Array.from({length:6},(_,i)=>p2(i,v).join(',')).join(' ')}" fill="none" stroke="#2a2825" stroke-width=".6"/>`).join('');const axs=dv2.map((_,i)=>{const[x,y]=p2(i,100);return`<line x1="${cx2}" y1="${cy2}" x2="${x}" y2="${y}" stroke="#2a2825" stroke-width=".4"/>`;}).join('');const dts=dv2.map((v,i)=>{const[x,y]=p2(i,v);return`<circle cx="${x}" cy="${y}" r="3.5" fill="${DIMS[i].color}"/>`;}).join('');return`<svg viewBox="0 0 134 134" width="130" height="130">${rngs}${axs}<polygon points="${poly2}" fill="#c9a22715" stroke="#c9a227" stroke-width="1.5"/>${dts}</svg>`;})()}
    </div>
  </div>
</div>

<!-- ════ SÍNTESE + ANÁLISE ═════════════════════════════════ -->
<div class="sec pb" style="background:#0d0d0f;color:#e8e4da;border-top:none">
  <div style="display:grid;grid-template-columns:1fr 260px;gap:28px">
    <div>
      <div class="sec-lbl">Síntese das Respostas</div>
      <h2 style="color:#e8e4da;margin-bottom:16px">O que suas respostas revelam sobre você</h2>
      ${sintese12.map((item,i)=>`<div class="sq">
        <div class="sq-num">${String(i+1).padStart(2,'0')}</div>
        <div><div class="sq-q">${item.q}</div><div class="sq-a">${item.a}</div></div>
      </div>`).join('')}
    </div>
    <div>
      <div class="sec-lbl">Potencial Futuro</div>
      <div class="card-dark" style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:#4caf50;margin-bottom:6px">Referência de Mercado</div>
        <div style="font-size:11px;color:#6a6460;line-height:1.5">${dimContent['presenca_mercado'].sintese[getLvl(pct('presenca_mercado'))]?.split('.')[0]||''}</div>
      </div>
      <div class="card-dark" style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:#4caf50;margin-bottom:6px">Rede Estratégica Ampla</div>
        <div style="font-size:11px;color:#6a6460;line-height:1.5">${dimContent['reciprocidade_ativa'].sintese[getLvl(pct('reciprocidade_ativa'))]?.split('.')[0]||''}</div>
      </div>
      <div class="card-dark">
        <div style="font-size:11px;font-weight:600;color:#c9a227;margin-bottom:6px">Vantagem Única</div>
        <div style="font-size:11px;color:#6a6460;line-height:1.5">${pf?.desc?.split('.')[0]||''}</div>
      </div>
    </div>
  </div>
</div>

<!-- ════ ANÁLISE PROFUNDA ═══════════════════════════════════ -->
<div class="sec" style="background:#0d0d0f;color:#e8e4da">
  <div class="sec-lbl">Análise Profunda do Perfil</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
    <div>
      <h2 style="color:#e8e4da">O que seu diagnóstico revela sobre você</h2>
      <p class="light" style="font-size:14px;line-height:1.8">${pf?.desc||""}</p>

      <h3>Sua arquitetura relacional — como você está sendo percebido</h3>
      <p class="light">${top3[0]?`${top3[0].label} ${s10(top3[0].key)}/10 ${top3[1]?`e ${top3[1].label} ${s10(top3[1].key)}/10`:''} criam a percepção de ${dimContent[top3[0].key]?.sintese?.high?.split('.')[0]?.toLowerCase()||'profissional de alto impacto'}. ${bot2[0]?`O desafio central é ${bot2[0].label} ${s10(bot2[0].key)}/10 — ${dimContent[bot2[0].key]?.sintese?.[getLvl(pct(bot2[0].key))]?.split('.')[0]||''}.`:''}`:''}</p>

      <div style="background:#ef535008;border:1px solid #ef535020;border-left:3px solid #ef5350;border-radius:0 8px 8px 0;padding:14px;margin:14px 0">
        <div style="font-size:8px;font-weight:700;color:#ef5350;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">A sombra do seu perfil — o ponto cego que mais te custa</div>
        <p class="light" style="margin:0;font-size:12px">${bot2[0]?`A sombra mais profunda é o gap entre a intenção declarada e a execução. ${bot2[0].label} ${s10(bot2[0].key)}/10 é o padrão que mais custa — não pela ausência de vontade, mas pela ausência de sistema. ${dimContent[bot2[0].key]?.sintese?.[getLvl(pct(bot2[0].key))]||''}`:''}</p>
      </div>

      <div style="background:#c9a22706;border:1px solid #c9a22720;border-left:3px solid #c9a227;border-radius:0 8px 8px 0;padding:14px">
        <div style="font-size:8px;font-weight:700;color:#c9a227;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">⚑ Não ignore isso</div>
        <p class="light" style="margin:0;font-size:12px">${bot2[0]?`${bot2[0].label} baixo é o padrão clássico do profissional que confunde intenção com execução. A diferença entre quem constrói capital relacional real e quem acumula contatos está exatamente nessa dimensão.`:pf?.risks?.[0]||''}</p>
      </div>
    </div>

    <div>
      <div style="display:flex;justify-content:center;margin-bottom:16px">${radarSVG}</div>
      ${DIMS.map(d=>{const v=pct(d.key);return`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="font-size:11px;font-weight:600;color:${d.color};min-width:90px">${d.label}</div>
        <div style="flex:1"><div class="bar-w-dark"><div class="bar-f" style="width:${v}%;background:${d.color}"></div></div></div>
        <div style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:${getLvlClr(v)};min-width:35px">${s10(d.key)}/10</div>
      </div>`;}).join('')}
    </div>
  </div>
</div>

<!-- ════ FORÇAS + AÇÕES ════════════════════════════════════ -->
<div class="sec pb">
  <div class="sec-lbl">Perfil e Potencial</div>
  <h2>Forças, Riscos e Ações Prioritárias</h2>
  <div class="g2">
    <div class="card" style="border-color:#4caf5040">
      <div style="font-size:9px;font-weight:700;color:#4caf50;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">✓ Suas Forças</div>
      ${(pf?.strengths||[]).map(s=>`<div style="display:flex;gap:8px;margin-bottom:8px"><span style="background:#4caf5015;border:1px solid #4caf5030;color:#4caf50;font-size:9px;font-weight:700;padding:1px 7px;border-radius:3px;flex-shrink:0">✓</span><span style="font-size:12px;color:#444;line-height:1.5">${s}</span></div>`).join('')}
    </div>
    <div class="card" style="border-color:#ef535040">
      <div style="font-size:9px;font-weight:700;color:#ef5350;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">⚠ Pontos de Atenção</div>
      ${(pf?.risks||[]).map(r=>`<div style="display:flex;gap:8px;margin-bottom:8px"><span style="background:#ef535015;border:1px solid #ef535030;color:#ef5350;font-size:9px;font-weight:700;padding:1px 7px;border-radius:3px;flex-shrink:0">!</span><span style="font-size:12px;color:#444;line-height:1.5">${r}</span></div>`).join('')}
    </div>
  </div>

  <h2 style="margin-top:20px">Suas 3 Ações Prioritárias</h2>
  <p style="color:#555">Com base no seu perfil relacional, estas são as ações de maior retorno agora:</p>
  <div class="card" style="border-color:#c9a22730">
    ${(pf?.actions||[]).map((a,i)=>`<div style="display:flex;gap:14px;margin-bottom:${i<(pf?.actions?.length-1)?'14':'0'}px;padding-bottom:${i<(pf?.actions?.length-1)?'14':'0'}px;border-bottom:${i<(pf?.actions?.length-1)?'1px solid #f0ece4':'none'}">
      <div class="act-num">${i+1}</div>
      <div style="font-size:13px;color:#222;line-height:1.55">${a}</div>
    </div>`).join('')}
  </div>
</div>

<!-- ════ GATILHOS RELACIONAIS ══════════════════════════════ -->
<div class="sec" style="background:#0d0d0f;color:#e8e4da">
  <div class="sec-lbl">Comportamento Relacional</div>
  <h2 style="color:#e8e4da">Gatilhos — Os padrões que ativam e travam seu comportamento relacional</h2>
  <div class="g2">
    <div>
      <h3 style="color:#4caf50;margin-bottom:10px;margin-top:0">⚡ Gatilhos de Ativação</h3>
      ${DIMS.filter(d=>pct(d.key)>=60).slice(0,3).map(d=>{const v=pct(d.key);const ct=dimContent[d.key];return`<div class="gtcard" style="background:#4caf5008;border:1px solid #4caf5020">
        <div class="gt-lbl" style="color:#4caf50">${ct?.gatilho_at?.label||d.label}</div>
        <div style="font-size:12px;color:#6a6460;margin-bottom:6px;line-height:1.5">${ct?.gatilho_at?.desc||''}</div>
        <div style="font-size:9px;color:#4caf5070">Ação: ${ct?.gatilho_at?.acao||''}</div>
      </div>`;}).join('')}
    </div>
    <div>
      <h3 style="color:#ef5350;margin-bottom:10px;margin-top:0">🔴 Gatilhos de Bloqueio</h3>
      ${DIMS.filter(d=>pct(d.key)<70).slice(-3).map(d=>{const v=pct(d.key);const ct=dimContent[d.key];return`<div class="gtcard" style="background:#ef535008;border:1px solid #ef535020">
        <div class="gt-lbl" style="color:#ef5350">${ct?.gatilho_bl?.label||d.label}</div>
        <div style="font-size:12px;color:#6a6460;margin-bottom:6px;line-height:1.5">${ct?.gatilho_bl?.desc||''}</div>
        <div style="font-size:9px;color:#ef535070">Antídoto: ${ct?.gatilho_bl?.antidoto||''}</div>
      </div>`;}).join('')}
    </div>
  </div>
</div>

<!-- ════ PLANO DE ATIVAÇÃO ═════════════════════════════════ -->
<div class="sec pb">
  <div class="sec-lbl">Plano de Ativação — 4 Semanas</div>
  <h2>Quatro semanas para transformar intenção em hábito sistemático</h2>
  <p style="color:#555">Cada semana tem um comportamento, reflexão e ação concreta.</p>
  ${PLAN.map((w,i)=>`<div class="week-box">
    <div class="week-num">
      <div style="font-size:22px">${w.icon}</div>
      <div style="font-family:'Courier New',monospace;font-size:12px;font-weight:700;color:#c9a227">${w.week}</div>
    </div>
    <div class="week-body">
      <div style="font-size:9px;font-weight:700;color:#c9a22790;text-transform:uppercase;letter-spacing:.1em;margin-bottom:3px">Semana ${w.week}</div>
      <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:3px">${w.title}</div>
      <div style="font-size:11px;color:#888;font-style:italic;margin-bottom:8px">${w.goal}</div>
      ${w.tasks.map(t=>`<div style="font-size:12px;color:#555;margin-bottom:3px;display:flex;gap:7px"><span style="color:#c9a22770">→</span>${t}</div>`).join('')}
      <div style="margin-top:8px;background:#c9a22710;border:1px solid #c9a22725;border-radius:5px;padding:6px 10px;font-family:'Courier New',monospace;font-size:10px;color:#c9a227">Meta: ${w.metric}</div>
    </div>
  </div>`).join('')}
</div>

<!-- ════ TERMÔMETRO + VANTAGEM ════════════════════════════ -->
<div class="sec" style="background:#0d0d0f;color:#e8e4da">
  <div class="sec-lbl">Termômetro Relacional — 90 Dias</div>
  <h2 style="color:#e8e4da">O que é possível construir se você aplicar o plano com consistência</h2>
  <div class="card-dark" style="margin:16px 0">
    <div class="thermo-row" style="border-bottom:2px solid #2a2825;padding-bottom:10px">
      <div style="font-size:9px;font-weight:700;color:#4a4840;text-transform:uppercase">Dimensão</div>
      <div style="font-size:9px;font-weight:700;color:#4a4840;text-transform:uppercase">Hoje</div>
      <div style="font-size:9px;font-weight:700;color:#4a4840;text-transform:uppercase">90 dias</div>
      <div style="font-size:9px;font-weight:700;color:#4a4840;text-transform:uppercase">O que muda</div>
    </div>
    ${DIMS.map(d=>{const v=pct(d.key);const p2=proj(v);const delta=p2-v;return`<div class="thermo-row">
      <div style="font-size:12px;font-weight:600;color:${d.color}">${d.label}</div>
      <div style="font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:${getLvlClr(v)}">${s10(d.key)}/10</div>
      <div style="font-family:'Courier New',monospace;font-size:14px;font-weight:700;color:#4caf50">${Math.round(p2/10)}/10</div>
      <div style="font-size:11px;color:#6a6460;line-height:1.4">${delta>0?`+${delta}pts — `:''}${dimContent[d.key]?.sintese?.high?.split('.')[0]||''}</div>
    </div>`;}).join('')}
  </div>

  <div style="background:#c9a22708;border:1px solid #c9a22720;border-radius:10px;padding:18px;margin-top:14px">
    <div style="font-size:9px;font-weight:700;color:#c9a227;text-transform:uppercase;letter-spacing:.1em;margin-bottom:10px">A Vantagem Única do Seu Perfil</div>
    <p class="light" style="font-size:13px;line-height:1.8;margin-bottom:12px">${pf?.desc?.split('.').slice(0,2).join('.')||''}.</p>
    <div style="border-top:1px solid #2a2825;padding-top:12px;font-size:12px;color:#8a7870;font-style:italic">"Toda semana: em quantas conversas você genuinamente aprendeu algo sobre o outro que não sabia antes — e o que isso diz sobre a qualidade da sua presença?"</div>
  </div>

  <div style="margin-top:24px">
    <div class="sec-lbl" style="margin-top:0">Pergunta Provocativa</div>
    <div style="font-size:18px;color:#c9a227;font-style:italic;line-height:1.6">"Se você fosse ${pct('presenca_mercado')>=70?'20%':'100%'} mais presente e ${pct('escuta_relacional')>=70?'20%':'100%'} mais profundo nas conexões, quais portas se abririam?"</div>
  </div>
</div>

<!-- ════ MAPA MENTAL ═══════════════════════════════════════ -->
<div class="pb" style="background:#090908;padding:32px;min-height:100vh;display:flex;flex-direction:column">
  <div style="margin-bottom:16px">
    <div style="font-size:9px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#c9a227;margin-bottom:8px">Mapa Mental</div>
    <div style="font-size:26px;font-weight:700;color:#e8e4da">Arquitetura Relacional — <span style="color:#c9a227;font-style:italic">${pf?.name||""}</span></div>
    <div style="font-size:12px;color:#4a4840;margin-top:4px">Mapa das 6 dimensões relacionais com sub-temas, padrões comportamentais e capital relacional atual. Dimensões mais fortes aparecem mais distantes do centro.</div>
  </div>

  <div style="flex:1;display:flex;justify-content:center;align-items:center">${mmSVG}</div>

  <div class="g3" style="margin-top:16px">
    ${DIMS.map(d=>{const v=pct(d.key);return`<div style="background:#111010;border:1px solid ${d.color}25;border-radius:8px;padding:11px;border-top:2px solid ${d.color}">
      <div style="font-size:10px;font-weight:700;color:${d.color};margin-bottom:3px">${d.label}</div>
      <div style="font-family:'Courier New',monospace;font-size:20px;font-weight:700;color:${getLvlClr(v)}">${s10(d.key)}/10</div>
      <div style="height:4px;border-radius:2px;background:#1a1816;margin:5px 0"><div style="height:4px;border-radius:2px;background:${d.color};width:${v}%"></div></div>
      <div style="font-size:9px;color:#3a3830">${getLvlLbl(v)}</div>
    </div>`;}).join('')}
  </div>
</div>

<!-- ════ FRASE FINAL ═══════════════════════════════════════ -->
<div style="background:linear-gradient(135deg,#0d0d0f 0%,#141210 100%);padding:48px 40px;text-align:center;border-top:1px solid #1a1816">
  <div style="font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#c9a22760;margin-bottom:16px">Essência do Perfil</div>
  <div style="font-size:20px;color:#e8e4da;line-height:1.65;max-width:640px;margin:0 auto 20px">
    <span style="color:#c9a227">Você já sabe chegar.</span> O próximo nível é fazer as pessoas quererem que você fique — e isso se constrói na qualidade das relações, não no volume das conexões.
  </div>
  <div style="font-size:11px;color:#4a4840;font-style:italic">"Relacionamento não é sobre ter muitos contatos. É sobre ser indispensável para os que importam."</div>
</div>

<!-- FOOTER -->
<div class="footer">
  <div>
    <div style="font-size:20px;font-weight:700;color:#c9a227;letter-spacing:.04em">CONÉXIA</div>
    <div style="font-size:10px;color:#3a3830">"Networking, além do cafezinho" · Rafael Milléo</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:12px;color:#e8e4da;font-weight:600">${profile?.name||""}</div>
    <div style="font-size:10px;color:#3a3830">Diagnóstico Relacional Profissional · ${new Date().toLocaleDateString('pt-BR')}</div>
  </div>
</div>

</body></html>`;

      const win=window.open("","_blank");
      if(!win){alert("Permita pop-ups para abrir o relatório.");return;}
      win.document.write(html);
      win.document.close();
    }
    return (
      <div style={{ overflowY: "auto", paddingBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 44, marginBottom: 8 }}>{pf?.emoji}</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.gold, margin: "0 0 4px", fontStyle: "italic" }}>{pf?.name}</h1>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, fontStyle: "italic", margin: "0 0 6px" }}>{pf?.tagline}</p>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: C.gold }}>Score geral: {assessment.overall}%</div>
          </div>
          {isPro ? (
            <Btn small onClick={downloadReport}>⬇ Baixar relatório</Btn>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.gold, marginBottom: 4 }}>🔒 PRO</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>Download completo</div>
            </div>
          )}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", justifyContent: "center" }}><RadarChart scores={sc} /></div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Suas 6 dimensões</div>
          {DIMS.map((d, i) => { const v = sc[d.key] || 0; return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{d.label}</span><span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: d.color }}>{v}%</span></div>
              <div style={{ height: 7, borderRadius: 4, background: C.w06 }}><div style={{ height: 7, borderRadius: 4, background: d.color, width: `${v}%` }} /></div>
            </div>
          ); })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {(pf?.strengths || []).map((s, i) => <div key={i} style={{ background: C.grnD, border: `1px solid ${C.grn}28`, borderRadius: 10, padding: 12 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 4 }}>✓ Força</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{s}</div></div>)}
          {(pf?.risks || []).map((r, i) => <div key={i} style={{ background: C.corD, border: `1px solid ${C.cor}28`, borderRadius: 10, padding: 12 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.cor, marginBottom: 4 }}>⚠ Risco</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{r}</div></div>)}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Análise profunda</div>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, lineHeight: 1.65, margin: 0 }}>{pf?.desc}</p>
        </div>
        <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 4 }}>Você é {pf?.name}.</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, marginBottom: 14 }}>Suas 3 ações prioritárias:</div>
          {(pf?.actions || []).map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: C.gD, border: `1px solid ${C.gL}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 600, color: C.gold, flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5, margin: 0 }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
      {!isMobile && (
        <nav style={{ width: 190, flexShrink: 0, background: C.sf, borderRight: `1px solid ${C.brd}`, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px", borderBottom: `1px solid ${C.brd}`, marginBottom: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg,${C.gold},${C.gB})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 700, color: C.bg }}>C</div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: C.txt }}>CONÉXIA</div>
          </div>
          {NAVS.map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setSelId(null); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: view === n.id ? C.gD : "transparent", border: view === n.id ? `1px solid ${C.gL}` : "1px solid transparent", borderRadius: 7, padding: "9px 12px", cursor: "pointer", marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: view === n.id ? C.gold : C.txL }}>{n.icon}</span>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: view === n.id ? C.gold : C.txM }}>{n.label}</span>
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ padding: "6px 12px" }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{profile?.name}</div>
            {admin && <Tag color={C.vio} small>Admin</Tag>}
          </div>
          <Btn variant="ghost" small onClick={onReset}>Sair</Btn>
        </nav>
      )}

      {isMobile && (
        <div style={{ background: C.sf, borderBottom: `1px solid ${C.brd}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${C.gold},${C.gB})`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 12, fontWeight: 700, color: C.bg }}>C</div>
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 700, color: C.txt }}>CONÉXIA</span>
          </div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{profile?.name}</div>
        </div>
      )}

      <main style={{ flex: 1, padding: isMobile ? "16px" : "24px 28px", overflowY: "auto", maxHeight: isMobile ? "calc(100vh - 110px)" : "100vh", paddingBottom: isMobile ? 70 : 24 }}>
        {view === "dash" && renderDash()}
        {view === "contacts" && renderContacts()}
        {view === "teia" && renderTeia()}
        {view === "plano" && renderPlan()}
        {view === "report" && renderReport()}
        {view === "mentor" && admin && renderMentor()}
        {view === "export" && admin && renderExport()}
      </main>

      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.sf, borderTop: `1px solid ${C.brd}`, display: "flex", justifyContent: "space-around", padding: "6px 0", zIndex: 50 }}>
          {NAVS.map(n => (
            <button key={n.id} onClick={() => { setView(n.id); setSelId(null); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 8px", minWidth: 0 }}>
              <span style={{ fontSize: 16, color: view === n.id ? C.gold : C.txL }}>{n.icon}</span>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: view === n.id ? C.gold : C.txL }}>{n.label}</span>
            </button>
          ))}
        </nav>
      )}

      {modal === "addC" && <Modal title="Novo contato" onClose={() => setModal(null)}>
        <Inp label="Nome *" value={cf.name} onChange={v => setCf({ ...cf, name: v })} placeholder="Nome completo" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Empresa" value={cf.company} onChange={v => setCf({ ...cf, company: v })} placeholder="Empresa" />
          <Inp label="Cargo" value={cf.role} onChange={v => setCf({ ...cf, role: v })} placeholder="Cargo" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="📱 WhatsApp" value={cf.whatsapp} onChange={v => setCf({ ...cf, whatsapp: v })} placeholder="(00) 00000-0000" />
          <Inp label="✉️ Email" value={cf.contactEmail} onChange={v => setCf({ ...cf, contactEmail: v })} placeholder="email@empresa.com" type="email" />
        </div>
        <Inp label="🔗 LinkedIn" value={cf.linkedin} onChange={v => setCf({ ...cf, linkedin: v })} placeholder="linkedin.com/in/nome" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="🎂 Aniversário" value={cf.birthday} onChange={v => setCf({ ...cf, birthday: v })} type="date" />
          <Sel label="🌱 Cultura principal" value={cf.mainCulture} onChange={v => setCf({ ...cf, mainCulture: v })} options={MAIN_CULTURES} placeholder="Selecione..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="📍 Cidade" value={cf.city} onChange={v => setCf({ ...cf, city: v })} placeholder="Cidade" />
          <Sel label="Estado" value={cf.stateCode} onChange={v => setCf({ ...cf, stateCode: v })} options={UFS} placeholder="UF" />
        </div>
        <Inp label="🎯 Hobbies / Interesses" value={cf.hobbies} onChange={v => setCf({ ...cf, hobbies: v })} placeholder="Pesca, futebol, leitura..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Sel label="Categoria" value={cf.category} onChange={v => setCf({ ...cf, category: v })} options={CATS.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))} />
          <Sel label="Proximidade" value={cf.proximity} onChange={v => setCf({ ...cf, proximity: v })} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n}/5` }))} />
          <Inp label="Freq. (dias)" value={cf.idealFreq} onChange={v => setCf({ ...cf, idealFreq: v })} type="number" />
        </div>
        <Inp label="Como conheceu?" value={cf.howMet} onChange={v => setCf({ ...cf, howMet: v })} placeholder="Evento, indicação, campo..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="📋 Próxima ação" value={cf.nextAction} onChange={v => setCf({ ...cf, nextAction: v })} placeholder="Ligar, enviar artigo..." />
          <Inp label="📅 Data da ação" value={cf.nextActionDate} onChange={v => setCf({ ...cf, nextActionDate: v })} type="date" />
        </div>
        <Inp label="📝 Notas" value={cf.notes} onChange={v => setCf({ ...cf, notes: v })} placeholder="O que importa saber sobre essa pessoa..." textarea />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => setModal(null)}>Cancelar</Btn><Btn small onClick={addC} disabled={!cf.name.trim()}>Salvar</Btn></div>
      </Modal>}
      {modal === "addI" && <Modal title="Registrar interação" onClose={() => setModal(null)}>
        <div style={{ marginBottom: 16 }}><label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>Tipo</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ITYPES.map(t => <button key={t.value} onClick={() => setInf({ ...inf, type: t.value })} style={{ background: inf.type === t.value ? C.gD : C.sf, border: `1px solid ${inf.type === t.value ? C.gL : C.brd}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 12, color: inf.type === t.value ? C.gold : C.txM }}>{t.icon} {t.label}</button>)}</div></div>
        <Inp label="O que aconteceu? *" value={inf.desc} onChange={v => setInf({ ...inf, desc: v })} placeholder="Descreva a interação..." textarea />
        <div style={{ marginBottom: 16 }}><label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>Sentimento</label><div style={{ display: "flex", gap: 8 }}>{SENTS.map(s => <button key={s.value} onClick={() => setInf({ ...inf, sentiment: s.value })} style={{ flex: 1, background: inf.sentiment === s.value ? `${s.color}14` : C.sf, border: `1px solid ${inf.sentiment === s.value ? `${s.color}40` : C.brd}`, borderRadius: 6, padding: "10px 0", cursor: "pointer", textAlign: "center", fontFamily: "'DM Sans'", fontSize: 12, color: inf.sentiment === s.value ? s.color : C.txL }}>{s.icon} {s.label}</button>)}</div></div>
        <div style={{ marginBottom: 16 }}><button onClick={() => setInf({ ...inf, valueGen: !inf.valueGen })} style={{ display: "flex", alignItems: "center", gap: 10, background: inf.valueGen ? C.grnD : C.sf, border: `1px solid ${inf.valueGen ? `${C.grn}40` : C.brd}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", width: "100%" }}><span style={{ fontSize: 16 }}>{inf.valueGen ? "💎" : "○"}</span><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: inf.valueGen ? C.grn : C.txM }}>Gerei valor nesta interação</span></button></div>
        <Inp label="Tags (vírgula)" value={inf.tags} onChange={v => setInf({ ...inf, tags: v })} placeholder="café, projeto, follow-up..." />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => setModal(null)}>Cancelar</Btn><Btn variant="success" small onClick={addI} disabled={!inf.desc.trim()}>Registrar</Btn></div>
      </Modal>}
    </div>
  );
}

/* ═══ ROOT ════════════════════════════════════════════════ */
/* ═══ AUTH ═════════════════════════════════════════════════ */
function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("Informe seu nome."); setBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (data?.session) { onAuth(data.session, data.user); return; }
        if (data?.user) { setErr("Conta criada! Faça login."); setMode("login"); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (data?.session) { onAuth(data.session, data.user); return; }
      }
    } catch (e) { setErr(e.message || "Erro de conexão."); }
    setBusy(false);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg,${C.gold},${C.gB})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.bg }}>C</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.txt, margin: "0 0 6px" }}>CONÉXIA</h1>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, margin: "0 0 28px" }}>Seu sistema pessoal de inteligência relacional.</p>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 28, textAlign: "left" }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, background: "none", border: "none", borderBottom: mode === m ? `2px solid ${C.gold}` : `2px solid ${C.brd}`, padding: "10px 0", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: mode === m ? C.gold : C.txL }}>{m === "login" ? "Entrar" : "Criar conta"}</button>
            ))}
          </div>
          {err && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor, background: C.corD, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>{err}</div>}
          {mode === "signup" && <Inp label="Seu nome" value={name} onChange={setName} placeholder="Como podemos te chamar?" />}
          <Inp label="Email" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" />
          <Inp label="Senha" value={pass} onChange={setPass} placeholder="Mínimo 6 caracteres" type="password" />
          <Btn onClick={submit} disabled={busy || !email || pass.length < 6} full>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</Btn>
        </div>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 18 }}>"Networking, além do cafezinho" · Rafael Milléo</p>
      </div>
    </div>
  );
}

/* ═══ ROOT ════════════════════════════════════════════════ */
export default function App() {
  const [state, setState] = useState("loading");
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        setState("auth");
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setState("auth"); setUser(null); setProfile(null); setAssessment(null); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    const lsKey = "conexia_done_" + userId;
    try {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (p) p.name = p.name || p.first_name || "";
      setProfile(p);
      const { data: a } = await supabase.from("assessments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      const assess = a?.[0] || null;
      if (assess) {
        const rawScores = assess.scores || {};
        const profileKey = rawScores.profileKey || getProfile(rawScores);
        setAssessment({
          id: assess.id,
          scores: rawScores,
          overall: assess.overall || rawScores.overall || 0,
          profileKey,
          profileName: rawScores.profileName || PROFILES[profileKey]?.name || "Perfil Relacional",
          createdAt: assess.created_at,
        });
        localStorage.setItem(lsKey, "1");
        setState("app");
        return;
      }
      // Sem assessment no DB — verifica fallbacks
      if (p?.assessment_completed || localStorage.getItem(lsKey)) { setState("app"); return; }
      if (!p?.onboarding_completed) setState("onboard");
      else setState("assess");
    } catch (e) {
      console.error("[Load]", e);
      if (localStorage.getItem(lsKey)) { setState("app"); return; }
      setState("onboard");
    }
  };

  const handleAuth = async (session, authUser) => {
    setUser(authUser);
    await new Promise(r => setTimeout(r, 500));
    await loadUserData(authUser.id);
  };

  const handleOnboard = async (form) => {
    try {
      await supabase.from("profiles").upsert({
        id: user.id, first_name: form.name, name: form.name, email: form.email,
        role: form.role, segment: form.segment, state: form.state,
        objective: form.objectives.join(","), onboarding_completed: true,
      });
      setProfile({ ...profile, ...form, first_name: form.name, onboarding_completed: true });
    } catch (e) { console.error(e); }
    setState("assess");
  };

  const sendToMake = async (result) => {
    try {
      const p = profile || {};
      const payload = {
        timestamp: new Date().toISOString(),
        userId: user?.id || "",
        nome: p.first_name || p.name || "",
        email: user?.email || p.email || "",
        cargo: p.role || "",
        segmento: p.segment || "",
        estado: p.state || "",
        objetivos: p.objective || "",
        perfilKey: result.profileKey || "",
        perfilNome: result.profileName || "",
        scoreGeral: result.overall || 0,
        scoreEstrategia: result.scores?.intencao_estrategica || 0,
        scoreEmpatia: result.scores?.escuta_relacional || 0,
        scorePresenca: result.scores?.presenca_mercado || 0,
        scoreReciprocidade: result.scores?.reciprocidade_ativa || 0,
        scoreConsistencia: result.scores?.ritual_consistencia || 0,
        scoreAutenticidade: result.scores?.confianca_autentica || 0,
        p01: result.answers?.p01 || "", p02: result.answers?.p02 || "",
        p03: result.answers?.p03 || "", p04: result.answers?.p04 || "",
        p05: result.answers?.p05 || "", p06: result.answers?.p06 || "",
        p07: result.answers?.p07 || "", p08: result.answers?.p08 || "",
        p09: result.answers?.p09 || "", p10: result.answers?.p10 || "",
        p11: result.answers?.p11 || "", p12: result.answers?.p12 || "",
        onboardingOk: true,
        assessmentOk: true,
      };
      await fetch(MAKE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) { console.warn("[Make webhook]", e); }
  };

  const handleAssess = async (result) => {
    try {
      const scores = result.scores;
      await supabase.from("assessments").insert({
        user_id: user.id,
        scores: { ...scores, profileKey: result.profileKey, profileName: result.profileName, overall: result.overall },
        overall: result.overall,
      });
      await supabase.from("profiles").update({
        assessment_completed: true,
        onboarding_completed: true,
      }).eq("id", user.id);
    } catch (e) { console.error(e); }
    sendToMake(result);
    setAssessment(result);
    setState("app");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setAssessment(null); setState("auth");
  };

  if (state === "loading") return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, color: C.gold }}>CONÉXIA</div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>Carregando...</div>
    </div>
  );

  return (
    <>
      {state === "auth" && <Auth onAuth={handleAuth} />}
      {state === "onboard" && <Onboard onDone={handleOnboard} />}
      {state === "assess" && <Assess profile={profile} onDone={handleAssess} />}
      {state === "app" && <CRM profile={profile} assessment={assessment} onReset={handleLogout} user={user} />}
    </>
  );
}
