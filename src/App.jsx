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

/* ─── Helpers ─────────────────────────────────────────── */
const dSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999;
const hScore = (last, freq) => { const d = dSince(last); if (!last || d > freq * 3) return 0; return Math.max(0, Math.round((1 - d / (freq * 1.5)) * 100)); };
const fD = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

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
    const result = { scores, overall, profileKey: pKey, profileName: prof.name, createdAt: new Date().toISOString() };
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

/* ═══ CRM APP ═════════════════════════════════════════════ */
function CRM({ profile, assessment, onReset, user }) {
  const [view, setView] = useState("dash");
  const [cts, setCts] = useState([]);
  const [its, setIts] = useState([]);
  const [selId, setSelId] = useState(null);
  const [modal, setModal] = useState(null);
  const [intCid, setIntCid] = useState(null);
  const [cf, setCf] = useState({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "" });
  const [inf, setInf] = useState({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data: c } = await supabase.from("contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: i } = await supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setCts((c || []).map(ct => ({ ...ct, health: hScore(ct.last_interaction_at, ct.ideal_frequency_days || 30), notes: ct.personal_notes, howMet: ct.how_met, idealFreq: ct.ideal_frequency_days, lastInteraction: ct.last_interaction_at, nextAction: ct.next_action })));
    setIts((i || []).map(it => ({ ...it, desc: it.description, contactId: it.contact_id, createdAt: it.created_at, valueGen: it.value_generated })));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const addC = async () => {
    if (!cf.name.trim() || !user?.id) return;
    await supabase.from("contacts").insert({
      user_id: user.id, name: cf.name.trim(), company: cf.company.trim(),
      role: cf.role.trim(), category: cf.category, proximity: parseInt(cf.proximity),
      ideal_frequency_days: parseInt(cf.idealFreq) || 30, how_met: cf.howMet.trim(),
      personal_notes: cf.notes.trim(),
    });
    setCf({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "" });
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
    if (cts.length < 2) return <div><h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 12px" }}>Teia</h2><div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 50, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 14, color: C.txL }}>Cadastre ao menos 2 contatos.</div></div>;
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
    return (
      <div style={{ overflowY: "auto", paddingBottom: 40 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>{pf?.emoji}</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.gold, margin: "0 0 4px", fontStyle: "italic" }}>{pf?.name}</h1>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, fontStyle: "italic" }}>{pf?.tagline}</p>
          <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: C.gold, marginTop: 6 }}>Score geral: {assessment.overall}%</div>
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", justifyContent: "center" }}><RadarChart scores={sc} /></div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          {DIMS.map((d, i) => { const v = sc[d.key] || 0; return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{d.label}</span><span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: d.color }}>{v}%</span></div>
              <div style={{ height: 7, borderRadius: 4, background: C.w06 }}><div style={{ height: 7, borderRadius: 4, background: d.color, width: `${v}%` }} /></div>
            </div>
          ); })}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Análise</div>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, lineHeight: 1.65 }}>{pf?.desc}</p>
        </div>
        <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 4 }}>Você é {pf?.name}.</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, marginBottom: 14 }}>Agora faça estas 3 ações:</div>
          {pf?.actions.map((a, i) => (
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
          <Btn variant="ghost" small onClick={onReset}>Recomeçar</Btn>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Sel label="Categoria" value={cf.category} onChange={v => setCf({ ...cf, category: v })} options={CATS.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))} />
          <Sel label="Proximidade" value={cf.proximity} onChange={v => setCf({ ...cf, proximity: v })} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n}/5` }))} />
          <Inp label="Freq. (dias)" value={cf.idealFreq} onChange={v => setCf({ ...cf, idealFreq: v })} type="number" />
        </div>
        <Inp label="Como conheceu?" value={cf.howMet} onChange={v => setCf({ ...cf, howMet: v })} placeholder="Evento, indicação..." />
        <Inp label="Notas" value={cf.notes} onChange={v => setCf({ ...cf, notes: v })} placeholder="O que importa sobre essa pessoa..." textarea />
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
    try {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      setProfile(p);
      const { data: a } = await supabase.from("assessments").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
      const assess = a?.[0] || null;
      if (assess) {
        setAssessment({
          id: assess.id,
          scores: Object.fromEntries(DIMS.map(d => [d.key, assess[d.key]])),
          overall: assess.overall_score,
          profileKey: assess.profile_key,
          profileName: assess.profile_name,
          createdAt: assess.created_at,
        });
      }
      if (!p?.onboarding_completed) setState("onboard");
      else if (!p?.assessment_completed) setState("assess");
      else setState("app");
    } catch (e) {
      console.error("[Load]", e);
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
        id: user.id, first_name: form.name, email: form.email,
        role: form.role, segment: form.segment, state: form.state,
        objective: form.objectives.join(","), onboarding_completed: true,
      });
      setProfile({ ...profile, ...form, first_name: form.name, onboarding_completed: true });
    } catch (e) { console.error(e); }
    setState("assess");
  };

  const handleAssess = async (result) => {
    try {
      const scores = result.scores;
      await supabase.from("assessments").insert({
        user_id: user.id,
        ...Object.fromEntries(DIMS.map(d => [d.key, scores[d.key]])),
        overall_score: result.overall,
        profile_key: result.profileKey,
        profile_name: result.profileName,
        report_json: result,
      });
      await supabase.from("profiles").update({
        assessment_completed: true,
        profile_key: result.profileKey,
        profile_name: result.profileName,
        overall_score: result.overall,
      }).eq("id", user.id);
    } catch (e) { console.error(e); }
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
