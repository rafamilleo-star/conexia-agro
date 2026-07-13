import ConexiaDashboard from './components/ConexiaDashboard';
import { AbaIA } from './components/AbaIA';
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./utils/supabase";
import { C, ADMIN_EMAIL, ENABLE_ADMIN_TOOLS, isAdmin } from "./utils/theme";
import { DIMS, QS, SEGMENTS, OBJECTIVES, UFS, CATS, ITYPES, SENTS } from "./data/constants";
import iconeDark from "./assets/brand/conexia_icone_fundo-escuro.svg";
import iconeTransp from "./assets/brand/conexia_icone_transparente.svg";
import logoTexto from "./assets/brand/conexia_logo_texto-dourado_fundo-transparente.webp";

/* ─── Logo Components ─────────────────────────────────── */
// Ícone isolado (para splash, headers, favicons)
const ConexiaIcon = ({ size = 64, dark = true, style = {} }) => (
  <img
    src={dark ? iconeDark : iconeTransp}
    alt="CONÉXIA"
    style={{ width: size, height: size, objectFit: 'contain', ...style }}
  />
);
// Logo completo com texto dourado (para landing, onboarding)
const ConexiaLogo = ({ height = 48, style = {} }) => (
  <img
    src={logoTexto}
    alt="CONÉXIA — Diagnóstico Relacional"
    style={{ height, objectFit: 'contain', ...style }}
  />
);

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
// Normaliza WhatsApp para sempre incluir o código do país 55 — formato que o bot do WhatsApp espera
const normalizeWhatsapp = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
};

// ── RELEVANCE SCORE utils ──────────────────────────────────
const calculateRelevanceScore = (c) => {
  const fields = [c.influenciaPessoas, c.geraOportunidade, c.abrePortas, c.momentoAtual];
  const valid = fields.filter(v => v !== null && v !== undefined && v !== "");
  if (valid.length < 4) return null;
  const nums = valid.map(Number);
  if (nums.some(isNaN)) return null;
  return Math.round((nums.reduce((a,b)=>a+b,0) / 4) * 10);
};

const getRelevanceLabel = (rs) => {
  if (rs === null || rs === undefined) return null;
  if (rs >= 80) return "Estratégico";
  if (rs >= 60) return "Relevante";
  if (rs >= 40) return "Manter no radar";
  return "Baixa prioridade";
};

const getRelevanceLabelColor = (rs) => {
  if (rs === null || rs === undefined) return "#5a5650";
  if (rs >= 80) return "#c9a227";
  if (rs >= 60) return "#4caf50";
  if (rs >= 40) return "#ff9800";
  return "#6a6460";
};

const getContactPriorityStatus = (health, rs) => {
  if (rs === null || rs === undefined) return {
    status: "Completar relevância",
    msg: "Preencha os 4 critérios para entender a prioridade real deste contato.",
    color: "#5a5650"
  };
  if (health >= 70 && rs >= 70) return {
    status: "Proteger e expandir",
    msg: "Relacionamento quente e estratégico. Mantenha proximidade e gere valor recorrente.",
    color: "#4caf50"
  };
  if (health < 70 && rs >= 70) return {
    status: "Reativar urgente",
    msg: "Contato estratégico esfriando. Prioridade máxima de reativação.",
    color: "#ef5350"
  };
  if (health >= 70 && rs < 70) return {
    status: "Manter leve",
    msg: "Relação saudável, mas com menor prioridade estratégica.",
    color: "#ff9800"
  };
  return {
    status: "Baixa prioridade",
    msg: "Não consumir energia agora, salvo contexto específico.",
    color: "#6a6460"
  };
};

const generateWeeklyMoves = (contacts, interactions) => {
  const today = new Date(); const moves = []; const used = new Set();
  const addMove = (c, priorityLevel, reason, suggestedAction, suggestedDeadline) => {
    if (used.has(c.id) || moves.length >= 5) return;
    used.add(c.id);
    const ci = interactions ? interactions.filter(i => i.contactId === c.id) : [];
    const cat = c.category || "";
    moves.push({ contactId: c.id, contactName: c.name, companyOrCategory: c.company || cat, reason, suggestedAction, suggestedDeadline, priorityLevel, health: c.health });
  };
  // 1. Alta relevância + health baixo
  contacts.filter(c => { const rs = calculateRelevanceScore(c); return rs !== null && rs >= 70 && c.health < 70; })
    .sort((a,b) => (calculateRelevanceScore(b)||0) - (calculateRelevanceScore(a)||0))
    .forEach(c => addMove(c, 1, "Contato estratégico esfriando.", "Reative com uma mensagem genuína e específica.", "Próximas 48h"));
  // 2. Próxima ação vencida
  contacts.filter(c => c.nextActionDate && new Date(c.nextActionDate) < today)
    .sort((a,b) => new Date(a.nextActionDate) - new Date(b.nextActionDate))
    .forEach(c => addMove(c, 2, "Próxima ação vencida.", "Retome o combinado ou atualize o próximo passo.", "Hoje"));
  // 3. Aniversário 7 dias
  contacts.filter(c => { const d = birthdayDaysAway(c.birthday); return d !== null && d >= 0 && d <= 7; })
    .sort((a,b) => (birthdayDaysAway(a.birthday)||99) - (birthdayDaysAway(b.birthday)||99))
    .forEach(c => { const d = birthdayDaysAway(c.birthday); addMove(c, 3, `Aniversário em ${d === 0 ? "hoje" : d + " dia(s)"}.`, "Envie uma mensagem pessoal, sem pedido comercial.", d === 0 ? "Hoje" : `Até ${fD(c.birthday)}`); });
  // 4. Alta relevância sem próxima ação
  contacts.filter(c => { const rs = calculateRelevanceScore(c); return rs !== null && rs >= 70 && !c.nextAction; })
    .sort((a,b) => (calculateRelevanceScore(b)||0) - (calculateRelevanceScore(a)||0))
    .forEach(c => addMove(c, 4, "Contato estratégico sem próximo passo.", "Defina uma próxima ação clara.", "Esta semana"));
  // 5. Muito tempo sem interação
  contacts.filter(c => c.health < 60 && c.health > 0)
    .sort((a,b) => a.health - b.health)
    .forEach(c => addMove(c, 5, "Relação sem interação recente.", "Faça um contato leve para manter presença.", "Esta semana"));
  // 6. Sem valor gerado recente
  contacts.filter(c => { const rs = calculateRelevanceScore(c); if (!rs || rs < 60) return false;
    const recent = interactions ? interactions.filter(i => i.contactId === c.id && i.valueGen && dSince(i.createdAt) <= 30) : [];
    return recent.length === 0; })
    .forEach(c => addMove(c, 6, "Contato relevante sem valor gerado recente.", "Compartilhe algo útil, faça uma indicação ou ofereça ajuda.", "Esta semana"));
  return moves;
};

const generateImmediateActionPlan = (sc) => {
  if (!sc) return null;
  const pct = (k) => sc[k] || 0;
  const low = Object.entries(sc).filter(([k,v]) => DIMS.find(d=>d.key===k) && v <= 60).sort((a,b)=>a[1]-b[1]);
  const dimActions = {
    presenca_mercado: {
      h48: "Escolha 3 pessoas estratégicas e retome o contato com mensagem personalizada ainda esta semana.",
      d7: ["Faça uma publicação, comentário ou interação pública ligada ao seu tema de atuação.", "Marque uma conversa sem agenda comercial com alguém relevante para você agora."],
      d30: ["Crie uma cadência semanal de presença: 1 conteúdo, 1 evento, 1 conversa por semana.", "Identifique 3 ambientes onde seu público está e apareça com regularidade.", "Revise sua bio e perfil: eles comunicam claramente o que você entrega?"]
    },
    reciprocidade_ativa: {
      h48: "Envie algo útil para 3 contatos sem pedir nada em troca — um artigo, uma indicação, um reconhecimento.",
      d7: ["Faça uma indicação entre duas pessoas da sua rede que deveriam se conhecer.", "Reconheça publicamente ou em privado alguém que te ajudou recentemente."],
      d30: ["Crie o hábito de gerar valor antes de pedir: analise cada contato e defina o que pode oferecer.", "Faça 2 indicações por mês — elas constroem a reputação de quem conecta.", "Mantenha um registro simples de favores feitos e recebidos."]
    },
    escuta_relacional: {
      h48: "Faça uma conversa com o objetivo exclusivo de entender o momento do outro. Zero agenda própria.",
      d7: ["Use uma pergunta aberta antes de falar sobre você em conversas importantes.", "Registre no cadastro do contato algo pessoal ou profissional que você aprendeu."],
      d30: ["Revise suas últimas 5 conversas: você ouviu mais do que falou?", "Adote a regra 70/30: 70% escutando, 30% falando em conversas estratégicas.", "Crie o hábito de anotar o contexto do outro após cada conversa relevante."]
    },
    intencao_estrategica: {
      h48: "Liste os 10 contatos mais importantes para seus próximos 90 dias e defina por que cada um importa.",
      d7: ["Defina o objetivo relacional de cada contato-chave: o que quer construir com essa pessoa?", "Remova da lista de prioridade relações que consomem energia sem conexão com seu momento."],
      d30: ["Crie um mapa mental da sua rede: quem você quer adicionar, manter e reduzir nos próximos 90 dias.", "Revise sua estratégia relacional mensalmente — ela precisa acompanhar seus objetivos.", "Classifique seus contatos por relevância para o que você está construindo agora."]
    },
    ritual_consistencia: {
      h48: "Defina uma próxima ação clara para seus 5 contatos mais importantes e cadastre no sistema.",
      d7: ["Crie um ritual semanal de 30 minutos para revisar sua rede — coloque no calendário agora.", "Faça follow-up em até 48h após conversas relevantes: uma mensagem curta já basta."],
      d30: ["Configure alertas para contatos estratégicos que você não pode deixar esfriar.", "Revise e atualize o CRM toda segunda-feira — 20 minutos mudam a qualidade da sua rede.", "Transforme intenção em sistema: sem ritual fixo, bons contatos somem da agenda."]
    },
    confianca_autentica: {
      h48: "Faça uma conversa sem pedir, vender ou apresentar nada. Apareça pelo outro, não por você.",
      d7: ["Revise se suas interações recentes estão muito transacionais — equilíbrio é chave.", "Compartilhe uma percepção honesta e útil com alguém da sua rede."],
      d30: ["Analise a coerência entre o que você diz que faz e como você de fato se comporta nas relações.", "Busque aprofundar 3 relações: da superfície para conversa real.", "Seja o mesmo em reuniões formais e conversas informais — isso é o que gera confiança duradoura."]
    }
  };
  const allHighPlan = {
    h48: "Escolha um contato estratégico e faça uma interação de valor sem pedir nada em troca.",
    d7: ["Reative 3 contatos com alta relevância e pouca presença recente.", "Defina próxima ação para os 5 contatos mais importantes."],
    d30: ["Crie ritual semanal fixo de revisão da rede — 30 minutos toda segunda.", "Organize seus contatos por relevância e defina próximos passos claros.", "Transforme pelo menos 3 contatos em relações com continuidade clara."]
  };
  if (low.length === 0) return allHighPlan;
  const worstKey = low[0][0];
  const plan = dimActions[worstKey] || allHighPlan;
  // Complement 7-day and 30-day with second-worst if exists
  if (low.length > 1) {
    const secondKey = low[1][0];
    const secondPlan = dimActions[secondKey];
    if (secondPlan) {
      if (plan.d7.length < 2 && secondPlan.d7.length > 0) plan.d7.push(secondPlan.d7[0]);
      if (plan.d30.length < 3 && secondPlan.d30.length > 0) plan.d30.push(secondPlan.d30[0]);
    }
  }
  return plan;
};
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
function Onboard({ onDone, initialKey = "" }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: "", email: "", role: "", company: "", segment: "", state: "", city: "",
    whatsapp: "", instagram: "", linkedin: "",
    hobbies: "", birthday: "",
    objectives: [], challenge: "", networkSize: "",
  });
  const [voucher, setVoucher] = useState(initialKey || "");
  const tog = (v) => setForm(p => ({ ...p, objectives: p.objectives.includes(v) ? p.objectives.filter(x => x !== v) : [...p.objectives, v] }));
  const s = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const NETWORK_SIZES = [
    { value: "1-20", label: "1-20 contatos" },
    { value: "21-50", label: "21-50 contatos" },
    { value: "51-100", label: "51-100 contatos" },
    { value: "100+", label: "Mais de 100 contatos" },
  ];

  const CHALLENGES = [
    { value: "consistencia", label: "Manter consistência" },
    { value: "expansao", label: "Expandir a rede" },
    { value: "reativacao", label: "Reativar relações" },
    { value: "valor", label: "Gerar valor genuíno" },
    { value: "visibilidade", label: "Aumentar visibilidade" },
    { value: "estrategia", label: "Ter estratégia clara" },
  ];

  if (step === 1) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <Tag>Passo 1 de 3 · Quem você é</Tag>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "12px 0 6px" }}>Conte sobre você</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 24px" }}>Personaliza seu diagnóstico e os insights da IA.</p>
        <Inp label="Seu nome" value={form.name} onChange={s('name')} placeholder="Como podemos te chamar?" />
        <Inp label="Email" value={form.email} onChange={s('email')} placeholder="seu@email.com" type="email" />
        <Inp label="Empresa" value={form.company} onChange={s('company')} placeholder="Ex: BASF, Syngenta, Bayer..." />
        <Inp label="Função/cargo" value={form.role} onChange={s('role')} placeholder="Ex: Gerente Comercial, RTV..." />
        <Sel label="Segmento" value={form.segment} onChange={s('segment')} options={SEGMENTS} placeholder="Selecione..." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Sel label="Estado" value={form.state} onChange={s('state')} options={UFS} placeholder="UF" />
          <Inp label="Cidade" value={form.city} onChange={s('city')} placeholder="Ex: São Paulo" />
        </div>
        <Inp label="WhatsApp" value={form.whatsapp} onChange={s('whatsapp')} placeholder="(11) 99999-9999" type="tel" />
        <Btn onClick={() => setStep(2)} disabled={!form.name.trim() || !form.email.trim() || !form.role.trim() || !form.segment} full>Continuar →</Btn>
      </div>
    </div>
  );

  if (step === 2) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <Tag>Passo 2 de 3 · O que você busca</Tag>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "12px 0 6px" }}>Seus objetivos de networking</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Selecione tudo que faz sentido.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
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
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Maior desafio no networking hoje</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {CHALLENGES.map(c => {
              const sel = form.challenge === c.value;
              return (
                <button key={c.value} onClick={() => setForm(p => ({ ...p, challenge: c.value }))} style={{ background: sel ? C.gD : C.sf, border: `1px solid ${sel ? C.gL : C.brd}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? C.gold : C.txM, textAlign: 'left' }}>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txM, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Tamanho atual da sua rede profissional</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {NETWORK_SIZES.map(ns => {
              const sel = form.networkSize === ns.value;
              return (
                <button key={ns.value} onClick={() => setForm(p => ({ ...p, networkSize: ns.value }))} style={{ background: sel ? C.gD : C.sf, border: `1px solid ${sel ? C.gL : C.brd}`, borderRadius: 8, padding: '10px 12px', cursor: 'pointer', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: sel ? 600 : 400, color: sel ? C.gold : C.txM, textAlign: 'left' }}>
                  {ns.label}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={() => setStep(1)} style={{ flex: 1, background: C.sf, color: C.txM }}>← Voltar</Btn>
          <Btn onClick={() => setStep(3)} disabled={form.objectives.length === 0} style={{ flex: 2 }}>Continuar →</Btn>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <Tag>Passo 3 de 3 · O lado humano</Tag>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "12px 0 6px" }}>Detalhes que fazem diferença</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Opcional — mas a IA usa isso para insights mais precisos.</p>
        <Inp label="Hobbies e interesses" value={form.hobbies} onChange={s('hobbies')} placeholder="Ex: futebol, leitura, viagens..." />
        <Inp label="Aniversário" value={form.birthday} onChange={s('birthday')} placeholder="DD/MM/AAAA" type="date" />
        <Inp label="LinkedIn (usuário ou URL)" value={form.linkedin} onChange={s('linkedin')} placeholder="linkedin.com/in/..." />
        <Inp label="Instagram (@)" value={form.instagram} onChange={s('instagram')} placeholder="@seuperfil" />
        {/* Chave de acesso opcional */}
        <div style={{ borderTop:`1px solid ${C.brd}`, paddingTop:16, marginTop:4, marginBottom:16 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:6 }}>Tem uma chave de acesso PRO? (opcional)</div>
          <input
            value={voucher}
            onChange={e => setVoucher(e.target.value.toUpperCase())}
            placeholder="Ex: MILLEO-PRO-15"
            style={{ width:"100%", background:C.sf, border:`1px solid ${voucher?C.gL:C.brd}`, borderRadius:8, padding:"10px 14px", fontFamily:"'JetBrains Mono'", fontSize:13, fontWeight:voucher?700:400, color:voucher?C.gold:C.txM, outline:"none", letterSpacing:".08em", boxSizing:"border-box" }}
          />
          {voucher && <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.gold, marginTop:4 }}>✓ Chave será ativada após o diagnóstico</div>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn onClick={() => setStep(2)} style={{ flex: 1, background: C.sf, color: C.txM }}>← Voltar</Btn>
          <Btn onClick={() => onDone(form, voucher.trim())} style={{ flex: 2 }}>Iniciar assessment →</Btn>
        </div>
      </div>
    </div>
  );
}

/* ═══ ASSESSMENT ══════════════════════════════════════════ */
function Assess({ profile, onDone }) {
  const [qi, setQi] = useState(0);
  const [ans, setAns] = useState({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const { scores, overall } = useMemo(() => calcScores(ans), [ans]);
  const pKey = useMemo(() => getProfile(scores), [scores]);
  const prof = PROFILES[pKey];
  const q = QS[qi];
  const cur = ans[q?.id];

  const save = async () => {
    if (saving) return; // evita duplo-clique criar registros duplicados
    setSaving(true);
    const result = { scores, overall, profileKey: pKey, profileName: prof.name, createdAt: new Date().toISOString(), answers: ans };
    await onDone(result);
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
          <Btn onClick={save} disabled={saving} full>{saving ? "Salvando..." : "Entrar no CONÉXIA →"}</Btn>
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
const STRIPE_MENSAL = "https://buy.stripe.com/test_7sY6oz7eW0u2dUu7HQ7g401";
const STRIPE_ANUAL  = "https://buy.stripe.com/test_eVq3cnar8gt06s29PY7g400";
const MENTORIA_LINK = ""; // Preencher com link WhatsApp/Calendly

const ADMIN_EMAILS      = ["rafaelmilleo@yahoo.com.br", "rafamilleo@gmail.com"];
const FREE_CT_LIMIT     = 10;
const FREE_IT_LIMIT     = 20;

const isProUser = (prof, email) => {
  if (!prof && !email) return false;
  if (ADMIN_EMAILS.includes(email)) return true;
  if (prof?.is_pro) return true;
  if (prof?.plan === "pro") {
    if (!prof.pro_expires_at) return true;
    return new Date(prof.pro_expires_at) > new Date();
  }
  return false;
};

const isAdminEmail = (email) => ADMIN_EMAILS.includes(email);

const getPlanLabel = (prof, email) => {
  if (isAdminEmail(email)) return "Admin";
  if (!isProUser(prof, email)) return "Free";
  if (prof?.pro_access_source === "access_key") return "PRO Beta";
  return "PRO";
};

/* ═══ IA PROATIVA ════════════════════════════════════════ */
function PainelIAProativa({ userId, contacts, interactions, assessment, profile }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [errMsg, setErrMsg] = useState(null);

  const cacheKey = `conexia_ai_insights_${userId}`;

  const generateInsights = async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      // ── Dados ricos de cada contato correlacionados com interações ──
      const contactsDetail = contacts.map(c => {
        const cIts = interactions.filter(i => i.contactId === c.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const negIts = cIts.filter(i => i.sentiment === 'negativo');
        const posIts = cIts.filter(i => i.sentiment === 'positivo');
        const lastIt = cIts[0];
        const diasSemContato = lastIt
          ? Math.floor((Date.now() - new Date(lastIt.createdAt).getTime()) / 86400000)
          : null;
        // Frequência real vs ideal
        const freqIdeal = c.idealFreq || 30;
        const atrasado = diasSemContato !== null && diasSemContato > freqIdeal;
        const diasAtraso = atrasado ? diasSemContato - freqIdeal : 0;
        // Valor gerado nas interações
        const valorGerado = cIts.filter(i => i.valueGen).length;
        return {
          nome: c.name,
          empresa: c.company || '',
          cargo: c.role || '',
          categoria: c.category || '',         // aliado, ponte, mentor, potencial, dormindo
          proximidade: c.proximity || 3,       // 1=muito próximo, 5=distante
          frequenciaIdealDias: freqIdeal,
          saudeRelacional: c.health || 0,      // 0-100
          status: c.status,
          proximaAcao: c.nextAction || null,
          proximaAcaoData: c.nextActionDate || null,
          comoConheceu: c.howMet || null,
          notas: c.notes || null,
          cidade: c.city || null,
          aniversario: c.birthday || null,
          // Campos de potencial estratégico
          influenciaPessoas: c.influenciaPessoas,   // boolean
          geraOportunidade: c.geraOportunidade,     // boolean
          abrePortas: c.abrePortas,                 // boolean
          momentoAtual: c.momentoAtual || null,     // contexto atual do contato
          // Histórico de interações
          totalInteracoes: cIts.length,
          interacoesPositivas: posIts.length,
          interacoesNegativas: negIts.length,
          vezesMandouValor: valorGerado,
          diasSemContato,
          atrasadoNaFrequencia: atrasado,
          diasDeAtraso: diasAtraso,
          ultimaInteracaoTipo: lastIt?.type || null,
          ultimaInteracaoSentimento: lastIt?.sentiment || null,
          tiposDeInteracao: [...new Set(cIts.map(i => i.type))],
        };
      });

      // ── Assessment completo do usuário ──
      const sc = assessment?.scores || {};
      const assessmentScores = {
        perfil: assessment?.profileName || assessment?.profileKey || '',
        scoreGeral: assessment?.overall || 0,
        intencaoEstrategica: sc.intencao_estrategica || 0,
        escutaRelacional: sc.escuta_relacional || 0,
        presencaMercado: sc.presenca_mercado || 0,
        reciprocidadeAtiva: sc.reciprocidade_ativa || 0,
        ritualConsistencia: sc.ritual_consistencia || 0,
        confiancaAutentica: sc.confianca_autentica || 0,
      };

      // ── Análises agregadas ──
      const empCount = {};
      contacts.forEach(c => { if (c.company) empCount[c.company] = (empCount[c.company] || 0) + 1; });
      const catCount = {};
      contacts.forEach(c => { catCount[c.category || 'outro'] = (catCount[c.category || 'outro'] || 0) + 1; });

      // Contatos estratégicos de alto potencial sem interação recente
      const altoPotencialSemContato = contactsDetail.filter(c =>
        (c.influenciaPessoas || c.geraOportunidade || c.abrePortas) &&
        (c.diasSemContato === null || c.diasSemContato > 14)
      );

      // Contatos com relacionamento deteriorando (negativos recentes)
      const relacionamentoDeterirorando = contactsDetail.filter(c =>
        c.interacoesNegativas > 0 && c.interacoesNegativas >= c.interacoesPositivas
      );

      // Contatos atrasados na frequência ideal
      const atrasadosNaFrequencia = contactsDetail
        .filter(c => c.atrasadoNaFrequencia)
        .sort((a, b) => b.diasDeAtraso - a.diasDeAtraso)
        .slice(0, 5);

      // Contatos sem nenhuma interação
      const semInteracao = contactsDetail.filter(c => c.totalInteracoes === 0);

      // Contatos ponte/mentor sem interação recente (crítico)
      const ponteMentorSemContato = contactsDetail.filter(c =>
        (c.categoria === 'ponte' || c.categoria === 'mentor') &&
        (c.diasSemContato === null || c.diasSemContato > 21)
      );

      // Reciprocidade: contatos com muitas interações mas sem valor gerado
      const semReciprocidade = contactsDetail.filter(c =>
        c.totalInteracoes >= 3 && c.vezesMandouValor === 0
      );

      const ctx = {
        assessment: assessmentScores,
        objetivo: profile?.objective || '',
        totalContatos: contacts.length,
        distribuicaoEmpresas: empCount,
        distribuicaoCategorias: catCount,
        // Situações críticas
        altoPotencialSemContato: altoPotencialSemContato.map(c => ({
          nome: c.nome, empresa: c.empresa, cargo: c.cargo, categoria: c.categoria,
          influencia: c.influenciaPessoas, geraOportunidade: c.geraOportunidade,
          abrePortas: c.abrePortas, diasSemContato: c.diasSemContato,
          momentoAtual: c.momentoAtual, proximaAcao: c.proximaAcao
        })),
        relacionamentoDeterirorando: relacionamentoDeterirorando.map(c => ({
          nome: c.nome, empresa: c.empresa, cargo: c.cargo, categoria: c.categoria,
          positivas: c.interacoesPositivas, negativas: c.interacoesNegativas,
          ultimaSentimento: c.ultimaInteracaoSentimento, proximidade: c.proximidade
        })),
        atrasadosNaFrequencia: atrasadosNaFrequencia.map(c => ({
          nome: c.nome, empresa: c.empresa, categoria: c.categoria,
          frequenciaIdeal: c.frequenciaIdealDias, diasSemContato: c.diasSemContato,
          diasDeAtraso: c.diasDeAtraso, proximaAcao: c.proximaAcao, saudeRelacional: c.saudeRelacional
        })),
        ponteMentorSemContato: ponteMentorSemContato.map(c => ({
          nome: c.nome, empresa: c.empresa, cargo: c.cargo,
          diasSemContato: c.diasSemContato, proximaAcao: c.proximaAcao
        })),
        semInteracao: semInteracao.map(c => ({
          nome: c.nome, empresa: c.empresa, categoria: c.categoria,
          proximaAcao: c.proximaAcao, abrePortas: c.abrePortas
        })),
        semReciprocidade: semReciprocidade.map(c => ({
          nome: c.nome, empresa: c.empresa, totalInteracoes: c.totalInteracoes
        })),
        todosContatos: contactsDetail,
      };

      const prompt = `Você é um coach de networking estratégico de alto nível. Analise os dados REAIS da rede do usuário e gere exatamente 3 insights PODEROSOS, ESPECÍFICOS e CORRELACIONADOS.

Regras obrigatórias:
- Use NOMES REAIS dos contatos — nunca seja genérico
- Cruze os dados do assessment com os dados da rede:
  * Se reciprocidadeAtiva está baixa mas tem contatos com muitas interações sem valor gerado, aponte isso
  * Se ritualConsistencia está alto mas tem contatos atrasados na frequência, aponte a contradição
  * Se presencaMercado está baixo e não há contatos "ponte" ativos, conecte os pontos
- Priorize situações críticas: relacionamentos deteriorando, alto potencial sem contato, pontes/mentores esquecidos
- Para cada insight, a "acao" deve ser IMEDIATA e ESPECÍFICA: diga O QUE fazer, COM QUEM e COMO (ex: "Ligue para Katty Corrente hoje — pergunte sobre o projeto X que ela mencionou")
- Se houver relacionamento deteriorando, gere um plano de reversão em 3 passos
- Se houver contato de alto potencial (abrePortas/geraOportunidade/influenciaPessoas) sem contato recente, trate como urgência máxima
- Considere a categoria do contato: pontes e mentores têm peso estratégico maior que dormindo
- Considere a proximidade (1=muito próximo, 5=distante) para calibrar a urgência

Dados reais: ${JSON.stringify(ctx)}

Responda APENAS com JSON no formato:
{"insights": [{"titulo": "...", "observacao": "...", "acao": "...", "urgencia": "alta|media|baixa"}]}
Sem texto extra.`;

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 600 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.insights?.length) {
        setInsights(parsed.insights);
        setLastRefresh(new Date());
        localStorage.setItem(cacheKey, JSON.stringify({ data: parsed.insights, ts: Date.now() }));
      }
    } catch (e) {
      console.error('AI insights error:', e);
      setErrMsg('Erro ao gerar insights: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 4 * 60 * 60 * 1000) {
          setInsights(data);
          setLastRefresh(new Date(ts));
          return;
        }
      } catch (e) {}
    }
    if (contacts.length >= 3) generateInsights();
  }, [userId]);

  const urgColor = { alta: C.cor, media: C.amb, baixa: C.grn };

  return (
    <div style={{ background: `${C.gold}04`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.08em' }}>🧠 Inteligência da sua rede</div>
          {lastRefresh && <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginTop: 2 }}>Atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
        <button onClick={generateInsights} disabled={loading}
          style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '5px 12px', fontFamily: "'DM Sans'", fontSize: 11, color: C.gold, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Analisando...' : '🔄 Atualizar'}
        </button>
      </div>

      {loading && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, textAlign: 'center', padding: '16px 0' }}>
          A IA está analisando sua rede...
        </div>
      )}

      {errMsg && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.cor, marginBottom: 8, padding: '8px 10px', background: `${C.cor}10`, borderRadius: 6 }}>
          ⚠️ {errMsg}
        </div>
      )}
      {!loading && !insights && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>
          Clique em Atualizar para gerar insights personalizados da sua rede.
        </div>
      )}

      {insights && insights.map((ins, i) => {
        const uc = urgColor[ins.urgencia] || C.txL;
        return (
          <div key={i} style={{ background: `${uc}06`, border: `1px solid ${uc}20`, borderRadius: 10, padding: 14, marginBottom: i < insights.length - 1 ? 10 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: uc, flexShrink: 0 }} />
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt }}>{ins.titulo}</div>
              <div style={{ marginLeft: 'auto', fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: uc, textTransform: 'uppercase', letterSpacing: '.06em' }}>{ins.urgencia}</div>
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, marginBottom: 8 }}>{ins.observacao}</div>
            <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 6, padding: '7px 10px' }}>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.06em' }}>→ Ação: </span>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{ins.acao}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══ PLANO INTERATIVO ══════════════════════════════════ */
function PlanInterativo({ userId, week, isPro, openAccessKey, pf }) {
  const [done, setDone] = useState({});
  const [metaDone, setMetaDone] = useState({});
  const [aiGoals, setAiGoals] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Carregar estado salvo do localStorage (persistência simples e rápida)
  useEffect(() => {
    if (!userId) return;
    const saved = localStorage.getItem(`conexia_plan_${userId}`);
    if (saved) {
      try {
        const { tasks, metas, goals } = JSON.parse(saved);
        if (tasks) setDone(tasks);
        if (metas) setMetaDone(metas);
        if (goals) setAiGoals(goals);
      } catch (e) {}
    }
  }, [userId]);

  const save = (newDone, newMeta, newGoals) => {
    localStorage.setItem(`conexia_plan_${userId}`, JSON.stringify({
      tasks: newDone ?? done,
      metas: newMeta ?? metaDone,
      goals: newGoals ?? aiGoals,
    }));
  };

  const toggleTask = (weekNum, taskIdx) => {
    const key = `${weekNum}_${taskIdx}`;
    const newDone = { ...done, [key]: !done[key] };
    setDone(newDone);
    save(newDone, null, null);
  };

  const toggleMeta = (weekNum) => {
    const newMeta = { ...metaDone, [weekNum]: !metaDone[weekNum] };
    setMetaDone(newMeta);
    save(null, newMeta, null);
  };

  const generateAiGoals = async () => {
    if (!pf) return;
    setAiLoading(true);
    try {
      const prompt = `Você é um coach de networking estratégico. O usuário tem o perfil relacional "${pf.name}" (${pf.tagline}). Pontos fortes: ${pf.strengths?.join(', ')}. Riscos: ${pf.risks?.join(', ')}. Gere exatamente 3 metas personalizadas para os próximos 90 dias, específicas e mensuráveis para esse perfil. Responda APENAS com JSON no formato: {"goals": ["meta 1", "meta 2", "meta 3"]}. Sem texto extra.`;
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 300 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.goals?.length) {
        setAiGoals(parsed.goals);
        save(null, null, parsed.goals);
      }
    } catch (e) {
      console.error('AI goals error:', e);
    }
    setAiLoading(false);
  };

  return (
    <div>
      {/* Metas de IA */}
      <div style={{ background: `${C.gold}06`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.08em' }}>🎯 Suas metas para 90 dias</div>
          {!aiGoals && (
            <button onClick={generateAiGoals} disabled={aiLoading || !pf}
              style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '6px 14px', fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, cursor: aiLoading || !pf ? 'default' : 'pointer', opacity: aiLoading || !pf ? 0.6 : 1 }}>
              {aiLoading ? 'Gerando...' : 'Gerar com IA'}
            </button>
          )}
          {aiGoals && (
            <button onClick={generateAiGoals} disabled={aiLoading}
              style={{ background: 'transparent', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: 'pointer', textDecoration: 'underline' }}>
              {aiLoading ? '...' : 'Regenerar'}
            </button>
          )}
        </div>
        {!aiGoals && !aiLoading && (
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>
            {pf ? 'Clique em "Gerar com IA" para receber metas personalizadas para o seu perfil.' : 'Complete o diagnóstico para gerar metas personalizadas.'}
          </div>
        )}
        {aiLoading && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>A IA está analisando seu perfil...</div>}
        {aiGoals && aiGoals.map((g, i) => (
          <div key={i} onClick={() => toggleMeta(`goal_${i}`)}
            style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10, cursor: 'pointer', padding: '8px 10px', borderRadius: 8, background: metaDone[`goal_${i}`] ? C.grnD : 'transparent', border: `1px solid ${metaDone[`goal_${i}`] ? C.grn + '40' : 'transparent'}`, transition: 'all .2s' }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${metaDone[`goal_${i}`] ? C.grn : C.gL}`, background: metaDone[`goal_${i}`] ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {metaDone[`goal_${i}`] && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
            </div>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: metaDone[`goal_${i}`] ? C.txL : C.txM, lineHeight: 1.5, textDecoration: metaDone[`goal_${i}`] ? 'line-through' : 'none' }}>{g}</span>
          </div>
        ))}
      </div>

      {/* Semanas do plano */}
      {PLAN.map((w, i) => {
        const isCurrent = w.week === week;
        const isDone = w.week < week;
        const isLocked = !isPro && w.week > 1;
        const weekTasksDone = w.tasks.filter((_, j) => done[`${w.week}_${j}`]).length;
        const allTasksDone = weekTasksDone === w.tasks.length;

        if (isLocked) return (
          <div key={i} style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 10, opacity: 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.w06, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔒</div>
              <div><Tag color={C.txL} small>Semana {w.week}</Tag><div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txL, marginTop: 3 }}>{w.title}</div></div>
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>Continue seu plano no PRO.</div>
            {i === 1 && <button onClick={openAccessKey} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: 'pointer', textDecoration: 'underline', marginTop: 6, display: 'block' }}>Tenho uma chave de acesso</button>}
          </div>
        );

        return (
          <div key={i} style={{ background: isCurrent ? `${C.gold}06` : C.card, border: `1px solid ${isCurrent ? C.gL : C.brd}`, borderRadius: 12, padding: 20, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: allTasksDone ? C.grnD : isCurrent ? C.gD : C.w06, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {allTasksDone ? '✅' : w.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={isCurrent ? C.gold : allTasksDone ? C.grn : C.txL} small>Semana {w.week}</Tag>
                  {isCurrent && <Tag color={C.gold} small>↑ Agora</Tag>}
                  {weekTasksDone > 0 && <Tag color={C.grn} small>{weekTasksDone}/{w.tasks.length}</Tag>}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600, color: C.txt, marginTop: 3 }}>{w.title}</div>
              </div>
            </div>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, margin: '0 0 10px', fontStyle: 'italic' }}>{w.goal}</p>

            {/* Tarefas com checkbox */}
            {w.tasks.map((t, j) => {
              const key = `${w.week}_${j}`;
              const checked = !!done[key];
              return (
                <div key={j} onClick={() => toggleTask(w.week, j)}
                  style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: checked ? C.grnD : 'transparent', border: `1px solid ${checked ? C.grn + '30' : 'transparent'}`, transition: 'all .2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? C.grn : isCurrent ? C.gL : C.brd}`, background: checked ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {checked && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                  </div>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: checked ? C.txL : isCurrent ? C.txt : C.txM, lineHeight: 1.5, textDecoration: checked ? 'line-through' : 'none' }}>{t}</span>
                </div>
              );
            })}

            {/* Meta da semana com flag */}
            <div onClick={() => toggleMeta(w.week)}
              style={{ marginTop: 12, background: metaDone[w.week] ? C.grnD : C.w06, border: `1px solid ${metaDone[w.week] ? C.grn + '40' : 'transparent'}`, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${metaDone[w.week] ? C.grn : C.txL}`, background: metaDone[w.week] ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {metaDone[w.week] && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
              </div>
              <div>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, textTransform: 'uppercase' }}>Meta: </span>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: metaDone[w.week] ? C.txL : isCurrent ? C.gold : C.txM, fontWeight: isCurrent ? 600 : 400, textDecoration: metaDone[w.week] ? 'line-through' : 'none' }}>{w.metric}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Dicas */}
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginTop: 8 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Dicas de uso do CONÉXIA</div>
        {[
          { icon: '📅', title: 'Ritual semanal', desc: 'Toda segunda-feira, 15 minutos: veja os alertas do Dashboard e escolha 2 contatos para contatar.' },
          { icon: '📋', title: 'Registre interações', desc: 'Sempre que falar com alguém relevante, registre na aba Contatos. Quanto mais você registra, mais preciso o Health Score fica.' },
          { icon: '🎯', title: 'Próxima ação', desc: 'Todo contato deve ter sempre uma próxima ação definida. Relacionamento sem direção esfria.' },
          { icon: '🌱', title: 'Diversifique categorias', desc: 'Equilibre sua rede entre Mentores, Aliados, Pontes e Potenciais. Redes diversas geram mais oportunidades.' },
        ].map((tip, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: i < 3 ? `1px solid ${C.brd}` : 'none' }}>
            <span style={{ fontSize: 20 }}>{tip.icon}</span>
            <div><div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt, marginBottom: 3 }}>{tip.title}</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>{tip.desc}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ PERFIL FORM ════════════════════════════════════════ */
function PerfilForm({ profile, userId, onSaved }) {
  const NETWORK_SIZES = [
    { value: "1-20",   label: "1-20 contatos" },
    { value: "21-50",  label: "21-50 contatos" },
    { value: "51-100", label: "51-100 contatos" },
    { value: "100+",   label: "Mais de 100 contatos" },
  ];
  const CHALLENGES = [
    { value: "consistencia", label: "Manter consistência" },
    { value: "expansao",    label: "Expandir a rede" },
    { value: "reativacao",  label: "Reativar relações" },
    { value: "valor",       label: "Gerar valor genuíno" },
    { value: "visibilidade",label: "Aumentar visibilidade" },
    { value: "estrategia",  label: "Ter estratégia clara" },
  ];
  const [pf, setPf] = useState({
    name:         profile?.name || profile?.first_name || "",
    company:      profile?.company || "",
    role:         profile?.role || "",
    segment:      profile?.segment || "",
    state:        profile?.state || "",
    city:         profile?.city || "",
    whatsapp:     profile?.whatsapp || "",
    instagram:    profile?.instagram || "",
    linkedin:     profile?.linkedin || "",
    hobbies:      profile?.hobbies || "",
    birthday:     profile?.birthday || "",
    network_size: profile?.network_size || "",
    challenges:   profile?.challenge ? profile.challenge.split(",").map(s => s.trim()).filter(Boolean) : [],
  });
  // Ressincronizar quando o profile chega do Supabase (carregamento assíncrono)
  useEffect(() => {
    if (!profile) return;
    setPf({
      name:         profile.name || profile.first_name || "",
      company:      profile.company || "",
      role:         profile.role || "",
      segment:      profile.segment || "",
      state:        profile.state || "",
      city:         profile.city || "",
      whatsapp:     profile.whatsapp || "",
      instagram:    profile.instagram || "",
      linkedin:     profile.linkedin || "",
      hobbies:      profile.hobbies || "",
      birthday:     profile.birthday || "",
      network_size: profile.network_size || "",
      challenges:   profile.challenge ? profile.challenge.split(",").map(s => s.trim()).filter(Boolean) : [],
    });
  }, [profile]);

  const toggleChallenge = (val) => setPf(p => ({
    ...p,
    challenges: p.challenges.includes(val)
      ? p.challenges.filter(x => x !== val)
      : [...p.challenges, val],
  }));
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [err,    setErr]    = useState("");
  const sp = (k) => (v) => setPf(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setErr(""); setSaved(false);
    const payload = {
      name:         pf.name || null,
      first_name:   pf.name || null,
      company:      pf.company || null,
      role:         pf.role || null,
      segment:      pf.segment || null,
      state:        pf.state || null,
      city:         pf.city || null,
      whatsapp:     normalizeWhatsapp(pf.whatsapp),
      instagram:    pf.instagram || null,
      linkedin:     pf.linkedin || null,
      hobbies:      pf.hobbies || null,
      birthday:     pf.birthday || null,
      network_size: pf.network_size || null,
      challenge:    pf.challenges.length > 0 ? pf.challenges.join(",") : null,
    };
    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) { console.error("[PerfilForm] update error:", error); throw error; }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Atualiza o estado do profile no componente pai para que a aba
      // Perfil não volte a mostrar dados antigos/vazios ao ser reaberta.
      onSaved && onSaved(payload);
    } catch (e) {
      console.error("[PerfilForm] save error:", e);
      setErr("Erro ao salvar: " + (e?.message || "Tente novamente."));
    }
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 0 40px" }}>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.txt, margin: "0 0 6px" }}>Meu Perfil</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: 0 }}>Mantenha suas informações atualizadas para personalizar os insights da IA.</p>
      </div>
      <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📱</span>
        <div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Cadastre seu WhatsApp para usar o Assistente de IA</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Com seu número cadastrado, você pode conversar com o assistente CONÉXIA diretamente pelo WhatsApp e receber insights personalizados sobre sua rede.</div>
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 16 }}>Dados Pessoais</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="Nome completo" value={pf.name} onChange={sp('name')} placeholder="Seu nome" /></div>
          <Inp label="Empresa" value={pf.company} onChange={sp('company')} placeholder="Empresa onde atua" />
          <Inp label="Cargo / Função" value={pf.role} onChange={sp('role')} placeholder="Ex: Gerente Comercial" />
          <div><Sel label="Segmento" value={pf.segment} onChange={sp('segment')} options={SEGMENTS} placeholder="Selecione..." /></div>
          <Inp label="Cidade" value={pf.city} onChange={sp('city')} placeholder="Sua cidade" />
          <Sel label="Estado" value={pf.state} onChange={sp('state')} options={UFS} placeholder="UF" />
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 16 }}>Contato & Redes Sociais</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.gold, display: "block", marginBottom: 6 }}>📱 WhatsApp <span style={{ color: C.txL, fontWeight: 400 }}>(para o Assistente de IA)</span></label>
              <input type="tel" value={pf.whatsapp || ""} onChange={e => sp('whatsapp')(e.target.value)} placeholder="Ex: 11999999999 (DDD + número, sem 55)" style={{ width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.gold}50`, borderRadius: 8, padding: "12px 14px", fontFamily: "'DM Sans'", fontSize: 14, color: C.txt, outline: "none" }} />
            </div>
          </div>
          <Inp label="Instagram" value={pf.instagram} onChange={sp('instagram')} placeholder="@seuinstagram" />
          <Inp label="LinkedIn" value={pf.linkedin} onChange={sp('linkedin')} placeholder="linkedin.com/in/voce" />
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 16 }}>Contexto Profissional</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Sel label="Tamanho da rede" value={pf.network_size} onChange={sp('network_size')} options={NETWORK_SIZES} placeholder="Selecione..." />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 8 }}>Principais desafios <span style={{ color: C.txL, fontWeight: 400 }}>(selecione quantos quiser)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CHALLENGES.map(c => (
                <button key={c.value} onClick={() => toggleChallenge(c.value)} style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 20, cursor: "pointer", border: pf.challenges.includes(c.value) ? `1px solid ${C.gold}` : `1px solid ${C.brd}`, background: pf.challenges.includes(c.value) ? `${C.gold}18` : "transparent", color: pf.challenges.includes(c.value) ? C.gold : C.txM, transition: "all .15s" }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="Aniversário" value={pf.birthday} onChange={sp('birthday')} type="date" /></div>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="Hobbies & Interesses" value={pf.hobbies} onChange={sp('hobbies')} placeholder="Ex: Pesca, Agro, Tecnologia..." textarea /></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <Btn onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Btn>
        {saved && <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.grn }}>✓ Perfil atualizado com sucesso!</span>}
        {err   && <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.cor }}>{err}</span>}
      </div>
    </div>
  );
}

/* ═══ CRM APP ═════════════════════════════════════════════ */
function CRM({ profile, assessment, onReset, user }) {
  const [view, setView] = useState("dash");
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [akCode, setAkCode]   = useState("");
  const [akMsg, setAkMsg]     = useState("");
  const [akBusy, setAkBusy]   = useState(false);
  const [proToast, setProToast] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cts, setCts] = useState([]);
  const [its, setIts] = useState([]);
  const [selId, setSelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(null);
  const [intCid, setIntCid] = useState(null);
  const [teiaFilter, setTeiaFilter] = useState("todos");
  const [teiaSel, setTeiaSel] = useState(null);
  const [dbgMsg, setDbgMsg] = useState("");
  const [cf, setCf] = useState({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "", influenciaPessoas: "", geraOportunidade: "", abrePortas: "", momentoAtual: "" });
  const [inf, setInf] = useState({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });

  // ── Computed plan ─────────────────────────────────────────
  const isPro         = isProUser(profile, user?.email);
  const planLabel     = getPlanLabel(profile, user?.email);
  const canAddContact = isPro || cts.length < FREE_CT_LIMIT;

  const redeemKey = async () => {
    if (!akCode.trim()) return;
    setAkBusy(true); setAkMsg("");
    try {
      const { data, error } = await supabase.rpc("redeem_access_key", {
        p_code: akCode.trim().toUpperCase(),
        p_user_id: user?.id,
        p_user_email: user?.email || "",
      });
      if (error) throw error;
      const msgs = { invalid:"Chave de acesso inválida.", inactive:"Essa chave não está mais ativa.", expired:"Essa chave expirou.", limit_reached:"Essa chave já atingiu o limite de ativações.", already_used:"Essa chave já foi utilizada por este usuário." };
      if (!data?.ok) { setAkMsg(msgs[data?.error] || "Erro ao ativar chave."); setAkBusy(false); return; }
      await loadUserData(user.id);
      setShowAccessKey(false); setAkCode(""); setAkMsg("");
      setProToast(true); setTimeout(() => setProToast(false), 4000);
    } catch (e) { setAkMsg("Erro ao conectar. Tente novamente."); }
    setAkBusy(false);
  };
  const openAccessKey = () => { setAkCode(""); setAkMsg(""); setShowAccessKey(true); };

  // ── Analytics: rastrear navegação de abas ───────────────
  const trackEvent = useCallback(async (eventType, tabName, metadata = {}) => {
    if (!user?.id) return;
    try {
      await supabase.from("page_events").insert({
        user_id: user.id,
        event_type: eventType,
        tab_name: tabName,
        metadata: Object.keys(metadata).length ? metadata : null,
      });
    } catch (_) { /* silencioso — não interrompe o fluxo */ }
  }, [user?.id]);

  // Rastrear toda vez que a aba muda
  useEffect(() => {
    trackEvent("tab_view", view);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!user?.id) { setDbgMsg("⚠️ user.id ausente — não autenticado"); return; }
    const { data: c, error: ce } = await supabase.from("contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: i, error: ie } = await supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (ce) { setDbgMsg("❌ Erro ao buscar contatos: " + ce.message); return; }
    if (ie) { setDbgMsg("❌ Erro ao buscar interações: " + ie.message); return; }
    setDbgMsg("✅ user:" + user.id.slice(0,8) + " | contatos:" + (c?.length || 0));
    setCts((c || []).map(ct => ({ ...ct, health: hScore(ct.last_interaction_at, ct.ideal_frequency_days || 30), notes: ct.personal_notes, howMet: ct.how_met, idealFreq: ct.ideal_frequency_days, lastInteraction: ct.last_interaction_at, nextAction: ct.next_action, nextActionDate: ct.next_action_date, whatsapp: ct.whatsapp, contactEmail: ct.contact_email, linkedin: ct.linkedin, birthday: ct.birthday, hobbies: ct.hobbies, mainCulture: ct.main_culture, city: ct.city, stateCode: ct.state_code, influenciaPessoas: ct.influencia_pessoas ?? null, geraOportunidade: ct.gera_oportunidade ?? null, abrePortas: ct.abre_portas ?? null, momentoAtual: ct.momento_atual ?? null })));
    setIts((i || []).map(it => ({ ...it, desc: it.description, contactId: it.contact_id, createdAt: it.created_at, valueGen: it.value_generated })));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const addC = async () => {
    if (!cf.name.trim() || !user?.id) { setDbgMsg("⚠️ Bloqueado: " + (!user?.id ? "sem user.id" : "nome vazio")); return; }
    if (!isPro && cts.length >= FREE_CT_LIMIT) { setModal("limiteCt"); return; }
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
      influencia_pessoas: cf.influenciaPessoas !== "" ? parseInt(cf.influenciaPessoas) : null,
      gera_oportunidade: cf.geraOportunidade !== "" ? parseInt(cf.geraOportunidade) : null,
      abre_portas: cf.abrePortas !== "" ? parseInt(cf.abrePortas) : null,
      momento_atual: cf.momentoAtual !== "" ? parseInt(cf.momentoAtual) : null,
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
    setCf({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "", influenciaPessoas: "", geraOportunidade: "", abrePortas: "", momentoAtual: "" });
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

  const openEditC = (c) => {
    setCf({
      name: c.name || "", company: c.company || "", role: c.role || "",
      category: c.category || "potencial", proximity: String(c.proximity || 3),
      idealFreq: String(c.idealFreq || c.ideal_frequency_days || 30),
      notes: c.notes || c.personal_notes || "",
      howMet: c.howMet || c.how_met || "",
      whatsapp: c.whatsapp || "", contactEmail: c.contactEmail || c.contact_email || "",
      linkedin: c.linkedin || "", birthday: c.birthday || "",
      hobbies: c.hobbies || "", mainCulture: c.mainCulture || c.main_culture || "",
      city: c.city || "", stateCode: c.stateCode || c.state_code || "",
      nextAction: c.nextAction || c.next_action || "",
      nextActionDate: c.nextActionDate || c.next_action_date || "",
      influenciaPessoas: c.influenciaPessoas !== null && c.influenciaPessoas !== undefined ? String(c.influenciaPessoas) : "",
      geraOportunidade:  c.geraOportunidade  !== null && c.geraOportunidade  !== undefined ? String(c.geraOportunidade)  : "",
      abrePortas:        c.abrePortas        !== null && c.abrePortas        !== undefined ? String(c.abrePortas)        : "",
      momentoAtual:      c.momentoAtual      !== null && c.momentoAtual      !== undefined ? String(c.momentoAtual)      : "",
    });
    setEditId(c.id);
    setModal("editC");
  };

  const saveEditC = async () => {
    if (!editId || !cf.name.trim()) return;
    const { error } = await supabase.from("contacts").update({
      name: cf.name.trim(), company: cf.company.trim(), role: cf.role.trim(),
      category: cf.category, proximity: parseInt(cf.proximity),
      ideal_frequency_days: parseInt(cf.idealFreq) || 30,
      how_met: cf.howMet.trim(), personal_notes: cf.notes.trim(),
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
      influencia_pessoas: cf.influenciaPessoas !== "" ? parseInt(cf.influenciaPessoas) : null,
      gera_oportunidade:  cf.geraOportunidade  !== "" ? parseInt(cf.geraOportunidade)  : null,
      abre_portas:        cf.abrePortas        !== "" ? parseInt(cf.abrePortas)        : null,
      momento_atual:      cf.momentoAtual      !== "" ? parseInt(cf.momentoAtual)      : null,
    }).eq("id", editId).eq("user_id", user.id);
    if (!error) { setModal(null); setEditId(null); await load(); }
  };

  const sel = cts.find(c => c.id === selId);
  const cI = sel ? its.filter(i => i.contactId === sel.id) : [];
  const pf = assessment ? PROFILES[assessment.profileKey] : null;
  const sc = assessment?.scores || {};
  const admin = isAdmin(profile?.email);
  const NAVS = [
    { id: "dashboard", icon: "📈", label: "Analytics" },
    { id: "dash", icon: "◎", label: "Dashboard" },
    { id: "contacts", icon: "◈", label: "Contatos" },
    { id: "teia", icon: "⊛", label: "Teia" },
    { id: "plano", icon: "🗺️", label: "Plano" },
    { id: "ia", icon: "🧠", label: "IA" },
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
            {isPro ? <Btn small onClick={exportCSV}>Baixar CSV</Btn> : <button onClick={openAccessKey} style={{ background:`${C.gold}10`, border:`1px solid ${C.gL}`, borderRadius:8, padding:"6px 12px", fontFamily:"'DM Sans'", fontSize:11, color:C.gold, cursor:"pointer" }}>🔒 CSV — PRO</button>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>💾</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 6 }}>Backup completo</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 12 }}>Perfil + assessment + CRM</div>
            {isPro ? <Btn small onClick={exportJSON}>Baixar JSON</Btn> : null}
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
        <PlanInterativo userId={user?.id} week={week} isPro={isPro} openAccessKey={openAccessKey} pf={pf} />
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
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.txt, margin: "0 0 4px", textAlign: "center" }}>Olá, {profile?.name || ""}</h2>
        {pf && <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.gold, margin: "0 0 4px", fontWeight: 500, textAlign: "center" }}>{pf.emoji} {pf.name}</p>}
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 16px" }}>{cts.length === 0 ? "Cadastre seu primeiro contato para ativar sua rede." : `${cts.length} contatos · ${active} ativos · ${wk} interações esta semana`}</p>

        {/* ── Descoberta do Assistente via WhatsApp ── */}
        {profile?.whatsapp ? (
          <div style={{ background: `${C.grn}08`, border: `1px solid ${C.grn}30`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>💬</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.grn, marginBottom: 3 }}>Assistente por WhatsApp ativo</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, marginBottom: 8 }}>Manda mensagem pro CONÉXIA a qualquer hora: <em>"Liguei pro André hoje, foi positivo"</em>, <em>"Minhas próximas ações"</em> ou <em>"Saúde da minha rede"</em>.</div>
              <a href="https://wa.me/14155238886?text=join%20regular-realize" target="_blank" rel="noreferrer" style={{ display: "inline-block", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.grn, textDecoration: "none" }}>Abrir conversa →</a>
            </div>
          </div>
        ) : (
          <div onClick={() => { setView("perfil"); setSelId(null); }} style={{ cursor: "pointer", background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📱</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Ative o Assistente por WhatsApp</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Registre interações e consulte sua rede direto pelo WhatsApp. Toque aqui pra cadastrar seu número.</div>
            </div>
            <span style={{ fontSize: 16, color: C.gold, flexShrink: 0 }}>→</span>
          </div>
        )}

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
            {/* IA removida daqui — disponível apenas na aba IA */}
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

            {/* ── Movimento da Semana ── */}
            {(() => {
              const moves = generateWeeklyMoves(cts, its);
              const top = moves[0];
              if (!top) return null;
              const prioColor = top.priorityLevel===1?C.cor:top.priorityLevel===2?C.cor:top.priorityLevel===3?C.vio:top.priorityLevel===4?C.amb:C.blu;
              const prioIcon = top.priorityLevel===1?"🔥":top.priorityLevel===2?"📋":top.priorityLevel===3?"🎂":top.priorityLevel===4?"⚡":"⏰";
              return (
                <div style={{ background:`linear-gradient(135deg,${C.card} 0%,${C.gD} 100%)`, border:`1.5px solid ${C.gL}`, borderRadius:14, padding:18, marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:16 }}>{prioIcon}</span>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:10, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".12em" }}>Movimento da Semana</div>
                    </div>
                    <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:prioColor, background:`${prioColor}14`, border:`1px solid ${prioColor}30`, padding:"2px 8px", borderRadius:4, fontWeight:600 }}>{top.suggestedDeadline}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:10, background:`${prioColor}14`, border:`1px solid ${prioColor}30`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans'", fontSize:15, fontWeight:700, color:prioColor, flexShrink:0 }}>{top.contactName[0]}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:700, color:C.txt, marginBottom:2 }}>{top.contactName}</div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:6 }}>{top.companyOrCategory}</div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:prioColor, fontWeight:500, marginBottom:4 }}>{top.reason}</div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM }}>→ {top.suggestedAction}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:14 }}>
                    <button onClick={e=>{e.stopPropagation();setSelId(top.contactId);setIntCid(top.contactId);setModal("addI");}} style={{ flex:1, background:C.gold, border:"none", borderRadius:8, padding:"9px 0", fontFamily:"'DM Sans'", fontSize:12, fontWeight:700, color:C.bg, cursor:"pointer" }}>+ Registrar interação</button>
                    <button onClick={e=>{e.stopPropagation();setSelId(top.contactId);setView("contacts");}} style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"9px 14px", fontFamily:"'DM Sans'", fontSize:12, color:C.txM, cursor:"pointer" }}>Ver contato</button>
                  </div>
                </div>
              );
            })()}

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

        {/* ── Top 5 Movimentos da Semana ── */}
        {cts.length > 0 && !isPro && (
          <ProLock
            title="Desbloqueie seus 5 movimentos da semana"
            desc="Saiba exatamente quem acionar, por que acionar e qual ação fazer para manter sua rede viva."
            onKey={openAccessKey}
          />
        )}
        {cts.length > 0 && isPro && (() => {
          const moves = generateWeeklyMoves(cts, its);
          const prioColor = (p) => p===1?C.cor:p===2?C.cor:p===3?C.vio:p===4?C.amb:C.blu;
          const prioIcon = (p) => p===1?"🔥":p===2?"📋":p===3?"🎂":p===4?"⚡":"⏰";
          return (
            <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 18, marginBottom: 14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <span style={{ fontSize:18 }}>🎯</span>
                <div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:11, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".08em" }}>Seus 5 movimentos da semana</div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL }}>Quem acionar, por quê e o que fazer</div>
                </div>
              </div>
              {moves.length === 0 ? (
                <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, textAlign:"center", padding:"16px 0", fontStyle:"italic" }}>
                  Sua rede está organizada esta semana. Revise seus contatos estratégicos ou cadastre novas relações.
                </div>
              ) : moves.map((m, i) => (
                <div key={m.contactId} style={{ borderBottom: i < moves.length-1 ? `1px solid ${C.brd}` : "none", paddingBottom: i < moves.length-1 ? 12 : 0, marginBottom: i < moves.length-1 ? 12 : 0 }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                    <div style={{ width:32, height:32, borderRadius:8, background:`${prioColor(m.priorityLevel)}14`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>{prioIcon(m.priorityLevel)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:13, fontWeight:600, color:C.txt, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.contactName}</div>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:prioColor(m.priorityLevel), background:`${prioColor(m.priorityLevel)}12`, padding:"2px 7px", borderRadius:4, flexShrink:0, marginLeft:6 }}>{m.suggestedDeadline}</div>
                      </div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:4 }}>{m.companyOrCategory}</div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:prioColor(m.priorityLevel), marginBottom:3, fontWeight:500 }}>{m.reason}</div>
                      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>→ {m.suggestedAction}</div>
                      <div style={{ marginTop:8, display:"flex", gap:8 }}>
                        <button onClick={() => { setSelId(m.contactId); setIntCid(m.contactId); setModal("addI"); }} style={{ background:C.gD, border:`1px solid ${C.gL}`, borderRadius:6, padding:"5px 10px", fontFamily:"'DM Sans'", fontSize:11, fontWeight:600, color:C.gold, cursor:"pointer" }}>+ Registrar interação</button>
                        <button onClick={() => { setSelId(m.contactId); setView("contacts"); }} style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:6, padding:"5px 10px", fontFamily:"'DM Sans'", fontSize:11, color:C.txM, cursor:"pointer" }}>Ver contato</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
                })()}

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
              {(() => {
                const rs = calculateRelevanceScore(sel);
                const priority = getContactPriorityStatus(sel.health, rs);
                const badgeColors = {"Reativar urgente":"#ef5350","Proteger e expandir":"#4caf50","Manter leve":"#ff9800","Baixa prioridade":"#5a5650","Completar relevância":"#9B59B6"};
                const bc = badgeColors[priority.status] || C.txL;
                return (
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                      <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>Health Score</div>
                        <div style={{ fontFamily:"'JetBrains Mono'", fontSize:20, fontWeight:700, color:sel.health>=70?C.grn:sel.health>=40?C.amb:C.cor, marginBottom:5 }}>{sel.health}%</div>
                        <HBar score={sel.health} />
                      </div>
                      <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>Relevance Score</div>
                        {rs !== null
                          ? (<><div style={{ fontFamily:"'JetBrains Mono'", fontSize:20, fontWeight:700, color:getRelevanceLabelColor(rs), marginBottom:5 }}>{rs}%</div>
                             <div style={{ height:6, borderRadius:3, background:C.w06 }}><div style={{ height:6, borderRadius:3, background:getRelevanceLabelColor(rs), width:`${rs}%` }}/></div></>)
                          : (<><div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, fontStyle:"italic", marginTop:4 }}>Não avaliado</div>
                             <button onClick={()=>openEditC(sel)} style={{ marginTop:6, background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:10, color:C.gold, cursor:"pointer", padding:0, textAlign:"left" }}>→ Completar relevância</button></>)}
                      </div>
                    </div>
                    <div style={{ background:`${bc}10`, border:`1px solid ${bc}25`, borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"flex-start", gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:3, background:bc, flexShrink:0, marginTop:4 }}/>
                      <div>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:11, fontWeight:700, color:bc, marginBottom:2 }}>{priority.status}</div>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, lineHeight:1.4 }}>{priority.msg}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <Btn small onClick={() => openEditC(sel)}>✏️ Editar</Btn>
              <Btn variant="danger" small onClick={() => { if (confirm("Remover contato?")) delC(sel.id); }}>Remover</Btn>
            </div>
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
        {/* ── Matriz Health × Relevance ── */}
        {cts.length >= 2 && (() => {
          const q = { protect:[], reactivate:[], maintain:[], low:[], incomplete:[] };
          cts.forEach(c => {
            const rs = calculateRelevanceScore(c);
            if (rs === null) { q.incomplete.push(c); return; }
            if (c.health >= 70 && rs >= 70) q.protect.push(c);
            else if (c.health < 70 && rs >= 70) q.reactivate.push(c);
            else if (c.health >= 70 && rs < 70) q.maintain.push(c);
            else q.low.push(c);
          });
          const QCell = ({ label, color, contacts, icon }) => (
            <div style={{ background:`${color}08`, border:`1px solid ${color}20`, borderRadius:8, padding:"10px 12px", minHeight:80 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:7 }}>
                <span style={{ fontSize:12 }}>{icon}</span>
                <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color, textTransform:"uppercase", letterSpacing:".08em" }}>{label}</div>
                <div style={{ marginLeft:"auto", fontFamily:"'JetBrains Mono'", fontSize:12, fontWeight:700, color }}>{contacts.length}</div>
              </div>
              {contacts.slice(0,3).map((c,i) => (
                <div key={c.id} onClick={()=>setSelId(c.id)} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, cursor:"pointer", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>· {c.name}</div>
              ))}
              {contacts.length > 3 && <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:`${color}80`, marginTop:2 }}>+{contacts.length-3} mais</div>}
              {contacts.length === 0 && <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, fontStyle:"italic" }}>Nenhum contato</div>}
            </div>
          );
          return (
            <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontFamily:"'DM Sans'", fontSize:11, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".08em" }}>Matriz de Prioridade</div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:C.txL }}>Health × Relevância</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom: q.incomplete.length ? 8 : 0 }}>
                <QCell label="Reativar urgente" color="#ef5350" icon="🔥" contacts={q.reactivate} />
                <QCell label="Proteger e expandir" color="#4caf50" icon="⭐" contacts={q.protect} />
                <QCell label="Baixa prioridade" color="#5a5650" icon="○" contacts={q.low} />
                <QCell label="Manter leve" color="#ff9800" icon="→" contacts={q.maintain} />
              </div>
              {q.incomplete.length > 0 && (
                <div style={{ background:`${"#9B59B6"}08`, border:`1px solid ${"#9B59B6"}20`, borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12 }}>◎</span>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:"#9B59B6", textTransform:"uppercase", letterSpacing:".08em", flex:1 }}>Sem relevância avaliada — {q.incomplete.length} contato{q.incomplete.length>1?"s":""}</div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:"#9B59B6", cursor:"pointer" }} onClick={()=>q.incomplete[0]&&setSelId(q.incomplete[0].id)}>Avaliar →</div>
                </div>
              )}
            </div>
          );
        })()}

        {cts.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 40, textAlign: "center" }}><Btn small onClick={() => setModal("addC")}>+ Primeiro contato</Btn></div>
        : cts.map(c => { const ci = CATS.find(x => x.value === c.category); return (
          <div key={c.id} onClick={() => setSelId(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: "12px 14px", marginBottom: 6, cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ci?.color || C.gold}14`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 700, color: ci?.color }}>{c.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{c.company || "—"}</span>
                {(() => { const rs = calculateRelevanceScore(c); const p = getContactPriorityStatus(c.health, rs);
                  const badgeColors = { "Reativar urgente":"#ef5350","Proteger e expandir":"#4caf50","Manter leve":"#ff9800","Baixa prioridade":"#5a5650","Completar relevância":"#9B59B6" };
                  const bc = badgeColors[p.status] || C.txL;
                  return p.status !== "Completar relevância" ? (
                    <span style={{ fontFamily:"'DM Sans'",fontSize:8,fontWeight:700,color:bc,background:`${bc}14`,border:`1px solid ${bc}25`,padding:"1px 5px",borderRadius:3,textTransform:"uppercase",letterSpacing:".04em",flexShrink:0 }}>{p.status}</span>
                  ) : null; })()}
              </div>
            </div>
            <div style={{ width: 60 }}><HBar score={c.health} small /></div>
            <Tag small color={ci?.color}>{ci?.label}</Tag>
          </div>
        ); })}
      </div>
    );
  };

  const renderTeia = () => {
    if (!isPro) return (
      <div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:700, color:C.txt, margin:"0 0 14px" }}>Teia da Rede</h2>
        {cts.length < 2 ? (
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:50, textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>⊛</div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:14, fontWeight:600, color:C.txt, marginBottom:8 }}>Cadastre mais contatos para visualizar sua Teia</div>
            <Btn small onClick={() => { setView("contacts"); setModal("addC"); }}>+ Adicionar contato</Btn>
          </div>
        ) : (() => {
          const CX=280,CY=240,R=180; const step=(2*Math.PI)/cts.length;
          const nodes=cts.map((c,i)=>{const a=-Math.PI/2+i*step;const d=R*Math.max(0.15,c.health/100);const ci=CATS.find(x=>x.value===c.category);return{c,x:CX+d*Math.cos(a),y:CY+d*Math.sin(a),col:ci?.color||C.gold,r:Math.max(7,Math.min(18,7+its.filter(x=>x.contactId===c.id).length*2))};});
          return (<div>
            <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:16, marginBottom:12 }}>
              <svg viewBox="0 0 560 480" style={{ width:"100%", height:"auto" }}>
                {[0.2,0.4,0.6,0.8,1].map((p,i)=><circle key={i} cx={CX} cy={CY} r={R*p} fill="none" stroke={C.brd} strokeWidth={0.5} strokeDasharray={p<1?"3,7":"none"} opacity={0.4}/>)}
                <circle cx={CX} cy={CY} r={7} fill={C.gold} opacity={0.9}/>
                {nodes.map((n,i)=>{const lx=CX+(R+28)*Math.cos(-Math.PI/2+i*step);const ly=CY+(R+28)*Math.sin(-Math.PI/2+i*step);const ta=-Math.PI/2+i*step;return(<g key={i} onClick={()=>{setSelId(n.c.id);setView("contacts");}} style={{cursor:"pointer"}}><circle cx={n.x} cy={n.y} r={n.r} fill={`${n.col}25`} stroke={n.col} strokeWidth={1.5}/><text x={lx} y={ly} textAnchor={ta>Math.PI/2||ta<-Math.PI/2?"end":"start"} dominantBaseline="middle" fill={C.txM} fontSize={10} fontFamily="'DM Sans'">{n.c.name.length>13?n.c.name.slice(0,12)+"…":n.c.name}</text></g>);})}
              </svg>
            </div>
            <ProLock title="Teia avançada disponível no PRO" desc="Veja quem é estratégico, quem está esfriando e onde sua rede precisa de ação — com filtros, cores de prioridade e painel estratégico." onKey={openAccessKey} />
          </div>);
        })()}
      </div>
    );
    const PRIO_COLORS = {
      "Proteger e expandir": "#4caf50",
      "Reativar urgente":    "#ef5350",
      "Manter leve":         "#ff9800",
      "Baixa prioridade":    "#6a6460",
      "Completar relevância":"#5B9BD5",
    };

    // Apply filter
    const filtered = cts.filter(c => {
      const rs = calculateRelevanceScore(c);
      const p  = getContactPriorityStatus(c.health, rs);
      if (teiaFilter === "todos")          return true;
      if (teiaFilter === "estrategicos")   return p.status === "Proteger e expandir";
      if (teiaFilter === "reativar")       return p.status === "Reativar urgente";
      if (teiaFilter === "sem_acao")       return !c.nextAction;
      if (teiaFilter === "frios")          return c.health < 40;
      if (CATS.find(ct => ct.value === teiaFilter)) return c.category === teiaFilter;
      return true;
    });

    if (cts.length < 2) return (
      <div>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:700, color:C.txt, margin:"0 0 12px" }}>Teia da Rede</h2>
        <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:50, textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⊛</div>
          <div style={{ fontFamily:"'DM Sans'", fontSize:14, fontWeight:600, color:C.txt, marginBottom:8 }}>Você tem {cts.length} contato cadastrado</div>
          <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, marginBottom:16 }}>Cadastre mais contatos para visualizar sua rede com mais clareza.</div>
          <Btn small onClick={() => { setView("contacts"); setModal("addC"); }}>+ Adicionar contato</Btn>
        </div>
      </div>
    );

    const CX = 280, CY = 255, R = 190;
    const step = filtered.length > 0 ? (2 * Math.PI) / filtered.length : 0;
    const nodes = filtered.map((c, i) => {
      const a   = -Math.PI / 2 + i * step;
      const d   = R * Math.max(0.15, c.health / 100);
      const rs  = calculateRelevanceScore(c);
      const p   = getContactPriorityStatus(c.health, rs);
      const col = PRIO_COLORS[p.status] || C.txL;
      const nInt = its.filter(x => x.contactId === c.id).length;
      const nr  = Math.max(8, Math.min(22, 8 + nInt * 2.5));
      return { c, x: CX + d * Math.cos(a), y: CY + d * Math.sin(a),
               lx: CX + (R + 32) * Math.cos(a), ly: CY + (R + 32) * Math.sin(a),
               a, col, nr, p, rs, nInt };
    });
    const wp = nodes.length >= 3 ? nodes.map((n,i) => `${i===0?"M":"L"} ${n.x} ${n.y}`).join(" ") + " Z" : "";

    const FILTERS = [
      { key:"todos",        label:"Todos" },
      { key:"estrategicos", label:"Estratégicos" },
      { key:"reativar",     label:"Reativar urgente" },
      { key:"sem_acao",     label:"Sem próxima ação" },
      { key:"frios",        label:"Frios" },
      ...CATS.map(ct => ({ key: ct.value, label: ct.label })),
    ];

    const selContact = teiaSel ? cts.find(c => c.id === teiaSel) : null;
    const selRS  = selContact ? calculateRelevanceScore(selContact) : null;
    const selP   = selContact ? getContactPriorityStatus(selContact.health, selRS) : null;
    const selCat = selContact ? CATS.find(x => x.value === selContact.category) : null;
    const selInt = selContact ? its.filter(i => i.contactId === selContact.id) : [];

    return (
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:700, color:C.txt, margin:0 }}>Teia da Rede</h2>
          <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL }}>{filtered.length} de {cts.length} contatos</div>
        </div>

        {/* Filtros */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:14 }}>
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setTeiaFilter(f.key)}
              style={{ background: teiaFilter===f.key ? C.gold : C.sf,
                       border:`1px solid ${teiaFilter===f.key ? C.gold : C.brd}`,
                       color: teiaFilter===f.key ? C.bg : C.txM,
                       borderRadius:20, padding:"5px 12px", fontFamily:"'DM Sans'",
                       fontSize:11, fontWeight: teiaFilter===f.key?700:400, cursor:"pointer" }}>
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns: teiaSel ? "1fr 280px" : "1fr", gap:12 }}>
          {/* SVG Teia */}
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:16 }}>
            {filtered.length === 0 ? (
              <div style={{ padding:"40px 20px", textAlign:"center", fontFamily:"'DM Sans'", fontSize:13, color:C.txL }}>
                Nenhum contato neste filtro.
              </div>
            ) : (
              <svg viewBox="0 0 560 510" style={{ width:"100%", height:"auto" }}>
                {/* Rings */}
                {[0.2,0.4,0.6,0.8,1].map((pct,i) => (
                  <circle key={i} cx={CX} cy={CY} r={R*pct} fill="none"
                    stroke={C.brd} strokeWidth={0.5} strokeDasharray={pct<1?"3,7":"none"} opacity={0.4} />
                ))}
                {/* Ring labels */}
                {[{p:0.2,l:"20%"},{p:0.6,l:"60%"},{p:1,l:"100%"}].map((t,i) => (
                  <text key={i} x={CX+4} y={CY-R*t.p+3} fill={C.txL} fontSize={7} fontFamily="'DM Sans'" opacity={0.5}>{t.l}</text>
                ))}
                {/* Web polygon */}
                {wp && <path d={wp} fill={`${C.gold}06`} stroke={`${C.gold}20`} strokeWidth={1} />}
                {/* Connections to center */}
                {nodes.map((n,i) => (
                  <line key={i} x1={CX} y1={CY} x2={n.x} y2={n.y}
                    stroke={n.col} strokeWidth={Math.max(0.5, n.nInt * 0.4)} opacity={0.2} />
                ))}
                {/* Center node */}
                <circle cx={CX} cy={CY} r={8} fill={C.gold} opacity={0.9} />
                <circle cx={CX} cy={CY} r={4} fill={C.bg} />
                {/* Contact nodes */}
                {nodes.map((n,i) => {
                  const isSel = teiaSel === n.c.id;
                  return (
                    <g key={i} onClick={() => setTeiaSel(teiaSel===n.c.id ? null : n.c.id)} style={{ cursor:"pointer" }}>
                      {/* Glow when selected */}
                      {isSel && <circle cx={n.x} cy={n.y} r={n.nr+6} fill={n.col} opacity={0.15} />}
                      {/* Outer ring */}
                      <circle cx={n.x} cy={n.y} r={n.nr} fill={`${n.col}20`}
                        stroke={n.col} strokeWidth={isSel?2.5:1.5} />
                      {/* Inner dot */}
                      <circle cx={n.x} cy={n.y} r={3} fill={n.col} opacity={0.8} />
                      {/* Label */}
                      <text x={n.lx} y={n.ly} textAnchor={n.a>Math.PI/2||n.a<-Math.PI/2?"end":"start"}
                        dominantBaseline="middle" fill={isSel?n.col:C.txM} fontSize={isSel?10.5:10}
                        fontWeight={isSel?700:400} fontFamily="'DM Sans'">
                        {n.c.name.length>14?n.c.name.slice(0,13)+"…":n.c.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Side panel */}
          {teiaSel && selContact && (
            <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:16, position:"relative" }}>
              <button onClick={() => setTeiaSel(null)}
                style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:C.txL, fontSize:18, cursor:"pointer", lineHeight:1 }}>×</button>

              {/* Avatar + Name */}
              <div style={{ display:"flex", gap:10, alignItems:"flex-start", marginBottom:14, paddingRight:20 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:`${selCat?.color||C.gold}18`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'DM Sans'", fontSize:14, fontWeight:700, color:selCat?.color||C.gold, flexShrink:0 }}>
                  {selContact.name[0]}
                </div>
                <div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:14, fontWeight:600, color:C.txt }}>{selContact.name}</div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL }}>{[selContact.role, selContact.company].filter(Boolean).join(" · ") || "—"}</div>
                  {selCat && <div style={{ marginTop:4 }}><Tag small color={selCat.color}>{selCat.label}</Tag></div>}
                </div>
              </div>

              {/* Scores side by side */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:8, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>Health</div>
                  <div style={{ fontFamily:"'JetBrains Mono'", fontSize:18, fontWeight:700,
                    color:selContact.health>=70?C.grn:selContact.health>=40?C.amb:C.cor }}>{selContact.health}%</div>
                </div>
                <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"8px 10px" }}>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:8, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:4 }}>Relevância</div>
                  {selRS !== null
                    ? <div style={{ fontFamily:"'JetBrains Mono'", fontSize:18, fontWeight:700, color:getRelevanceLabelColor(selRS) }}>{selRS}%</div>
                    : <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, fontStyle:"italic", marginTop:4 }}>Não avaliado</div>}
                </div>
              </div>

              {/* Priority status */}
              <div style={{ background:`${PRIO_COLORS[selP?.status]||C.txL}12`,
                border:`1px solid ${PRIO_COLORS[selP?.status]||C.txL}25`,
                borderRadius:8, padding:"8px 10px", marginBottom:12 }}>
                <div style={{ fontFamily:"'DM Sans'", fontSize:10, fontWeight:700,
                  color:PRIO_COLORS[selP?.status]||C.txL, marginBottom:3 }}>{selP?.status}</div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, lineHeight:1.4 }}>{selP?.msg}</div>
              </div>

              {/* Last interaction + next action */}
              {selContact.lastInteraction && (
                <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:5 }}>
                  <span style={{ color:C.txM, fontWeight:500 }}>Última interação: </span>
                  {fD(selContact.lastInteraction)}
                  {selInt.length > 0 && <span style={{ color:C.txL }}> · {selInt.length} registros</span>}
                </div>
              )}
              {selContact.nextAction && (
                <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:12 }}>
                  <span style={{ color:C.txM, fontWeight:500 }}>Próxima ação: </span>
                  {selContact.nextAction}
                  {selContact.nextActionDate && <span style={{ color:C.amb }}> · {fD(selContact.nextActionDate)}</span>}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                <button onClick={() => { setIntCid(selContact.id); setModal("addI"); }}
                  style={{ background:C.gold, border:"none", color:C.bg, borderRadius:8, padding:"9px 0",
                  fontFamily:"'DM Sans'", fontSize:12, fontWeight:700, cursor:"pointer", width:"100%" }}>
                  + Registrar interação
                </button>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                  <button onClick={() => { openEditC(selContact); }}
                    style={{ background:C.sf, border:`1px solid ${C.brd}`, color:C.txM, borderRadius:8,
                    padding:"8px 0", fontFamily:"'DM Sans'", fontSize:11, cursor:"pointer" }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => { setSelId(selContact.id); setView("contacts"); }}
                    style={{ background:C.sf, border:`1px solid ${C.brd}`, color:C.txM, borderRadius:8,
                    padding:"8px 0", fontFamily:"'DM Sans'", fontSize:11, cursor:"pointer" }}>
                    📋 Histórico
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Legenda */}
        <div style={{ marginTop:14, background:C.card, border:`1px solid ${C.brd}`, borderRadius:10, padding:"12px 16px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:10, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:10 }}>Legenda</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:14, height:14, borderRadius:7, background:"transparent", border:"2px solid #4caf50", flexShrink:0 }}/>
              Proteger e expandir
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:14, height:14, borderRadius:7, background:"transparent", border:"2px solid #ef5350", flexShrink:0 }}/>
              Reativar urgente
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:14, height:14, borderRadius:7, background:"transparent", border:"2px solid #ff9800", flexShrink:0 }}/>
              Manter leve
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:14, height:14, borderRadius:7, background:"transparent", border:"2px solid #6a6460", flexShrink:0 }}/>
              Baixa prioridade
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:14, height:14, borderRadius:7, background:"transparent", border:"2px solid #5B9BD5", flexShrink:0 }}/>
              Completar relevância
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <div style={{ width:28, height:8, background:`linear-gradient(to right,${C.brd},${C.txM})`, borderRadius:4, flexShrink:0 }}/>
              Espessura = interações
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <svg width="28" height="16"><circle cx="6" cy="8" r="5" fill="none" stroke={C.txL} strokeWidth="1.5"/><circle cx="22" cy="8" r="8" fill="none" stroke={C.txL} strokeWidth="1.5"/></svg>
              Tamanho = interações
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, fontFamily:"'DM Sans'", fontSize:11, color:C.txM }}>
              <svg width="28" height="16"><circle cx="14" cy="8" r="6" fill="none" stroke={C.txL} strokeWidth="1.5" strokeDasharray="2,2"/></svg>
              Distância = Health Score
            </div>
          </div>
        </div>
      </div>
    );
  };

  const UpgradeModal = () => (
    <Modal title="" onClose={() => setShowUpgrade(false)}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.gold, marginBottom: 4 }}>CONÉXIA PRO</div>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>Transforme diagnóstico em execução</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:10, padding:14 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Free — R$ 0</div>
          {["1 diagnóstico","Até 10 contatos","Health Score","Teia simples","Semana 1 do plano"].map((f,i)=><div key={i} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:4 }}>✓ {f}</div>)}
        </div>
        <div style={{ background:`${C.gold}08`, border:`1.5px solid ${C.gold}`, borderRadius:10, padding:14 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>PRO — R$ 39,90/mês</div>
          {["Contatos ilimitados","Relevance Score","Top 5 movimentos","Relatório completo","Plano 4 semanas","Teia avançada","Exportação"].map((f,i)=><div key={i} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, marginBottom:4 }}>⭐ {f}</div>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.txL, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Mensal</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.txt, lineHeight: 1 }}>R$39,90</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 16 }}>/mês</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 16, lineHeight: 1.5 }}>Cancele quando quiser</div>
          <button onClick={() => window.open(STRIPE_MENSAL, "_blank")} style={{ width: "100%", background: C.w06, border: `1px solid ${C.brd}`, color: C.txt, borderRadius: 8, padding: "10px 0", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Assinar mensal</button>
          <button onClick={() => { setShowUpgrade(false); openAccessKey(); }} style={{ width:"100%", background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", textDecoration:"underline", marginTop:4 }}>Tenho uma chave de acesso</button>
        </div>
        <div style={{ background: `${C.gold}10`, border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: 20, textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#0d0d0f", fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>2 meses grátis</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Anual</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.gold, lineHeight: 1 }}>R$399</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 4 }}>/ano · R$33,25/mês</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginBottom: 16, lineHeight: 1.5 }}>Economia de R$79,80 vs mensal</div>
          <button onClick={() => window.open(STRIPE_ANUAL, "_blank")} style={{ width: "100%", background: C.gold, border: "none", color: "#0d0d0f", borderRadius: 8, padding: "10px 0", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Assinar anual ⚡</button>
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txt, marginBottom: 8 }}>O que está incluído no PRO:</div>
        {["📄 Relatório PDF completo personalizado", "🗺️ Mapa mental da sua arquitetura relacional", "📊 Termômetro de evolução 90 dias", "🎯 Gatilhos relacionais do seu perfil", "⚡ Acesso a todas as futuras funcionalidades"].map((f,i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>{f}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 12, fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>
        Após o pagamento, seu acesso PRO é liberado automaticamente. ✓
      </div>
    </Modal>
  );

  const renderReport = () => {
    if (!assessment) return <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 40, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 14, color: C.txL }}>Relatório não encontrado.</div>;
    const downloadReport = () => {
      const formatarNome = (raw) => {
        if (!raw) return '';
        // Se tem espaço, assumir que foi digitado pelo usuário — respeitar exatamente
        if (raw.includes(' ')) return raw.trim();
        // Sem espaço: tentar capitalizar corretamente (ex: "rafaelmilleo" → "Rafaelmilleo" como fallback legível)
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      };
      const nomeRaw = profile?.name || profile?.first_name || '';
      const nomePessoa = nomeRaw.includes(' ')
        ? nomeRaw.trim()  // nome completo digitado pelo usuário — usar como está
        : nomeRaw
          ? formatarNome(nomeRaw)  // nome sem espaço — capitalizar
          : user?.email
            ? user.email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase())
            : 'Profissional';
      const s10 = (k) => Math.round((sc[k]||0)/10);
      const pct = (k) => sc[k]||0;
      const sortedD = [...DIMS].sort((a,b)=>(sc[b.key]||0)-(sc[a.key]||0));
      const top2 = sortedD.slice(0,2);
      const bot2 = sortedD.slice(-2);
      const proj = (v) => v<30?Math.min(100,v+40):v<50?Math.min(100,v+30):v<70?Math.min(100,v+20):Math.min(100,v+10);
      const getLvl = (v) => v>=75?'high':v>=50?'mid':'low';
      const getLvlLbl = (v) => v>=80?'Excelente':v>=65?'Forte':v>=50?'Médio':v>=35?'Relevante':'Gap Crítico';
      const getLvlClr = (v) => v>=75?'#2e7d32':v>=50?'#e65100':'#c62828';
      const percLabel = assessment.overall>=85?'TOP 10%':assessment.overall>=75?'TOP 20%':assessment.overall>=65?'TOP 30%':'EM DESENVOLVIMENTO';
      const overallTen = Math.round(assessment.overall/10);

      const dimInterp = {
        intencao_estrategica:{
          high:"Use sua clareza estratégica para escolher melhor onde investir energia. Nem toda conexão merece o mesmo esforço — seu ganho está em priorizar quem amplia confiança, reputação e oportunidade.",
          mid:"Você tem direção, mas nem sempre age com intenção deliberada. Defina os 10 contatos mais importantes para seus próximos 90 dias e estabeleça o que quer construir com cada um.",
          low:"Antes de ampliar sua rede, defina quem realmente importa para os próximos 90 dias. Sem clareza de propósito, networking vira ruído."
        },
        escuta_relacional:{
          high:"Sua escuta cria abertura. Use isso para aprofundar conversas e captar necessidades antes de propor qualquer movimento — quem escuta bem é lembrado como parceiro, não apenas como contato.",
          mid:"Você escuta bem em momentos importantes, mas a agenda própria às vezes interfere. Antes de cada conversa relevante, defina 2 perguntas que você genuinamente não sabe a resposta.",
          low:"Você pode estar ouvindo pouco antes de conduzir a conversa. Faça mais perguntas, registre o contexto do outro e resista ao impulso de posicionar antes de entender."
        },
        presenca_mercado:{
          high:"Sua presença mantém você lembrado. Use essa força para ocupar espaços certos com constância e intenção — aparecendo antes de precisar pedir.",
          mid:"Sua competência pode estar maior que sua visibilidade. Crie uma cadência mínima: 1 conteúdo, 1 evento, 1 conversa por semana — sem consistência, presença vira episódio.",
          low:"O mercado não reconhece o que não vê com frequência. Sua competência está invisível para quem deveria conhecê-la. Aparecer com regularidade é o primeiro passo."
        },
        reciprocidade_ativa:{
          high:"Você gera valor antes de pedir. Esse comportamento cria confiança e aumenta a chance de retorno espontâneo — continue antecipando, indicando e conectando.",
          mid:"Você se importa em contribuir, mas nem sempre toma a iniciativa. Antecipe valor: antes de cada contato estratégico, defina o que pode oferecer sem pedir nada.",
          low:"Você pode estar esperando ser acionado para ajudar. Inverta: indique, compartilhe, reconheça e facilite antes de receber qualquer demanda."
        },
        ritual_consistencia:{
          high:"Sua disciplina evita que relações importantes esfriem. Use isso para transformar contato em continuidade — e continue aparecendo mesmo quando não há agenda comercial.",
          mid:"Sem ritual, boas intenções somem da agenda. Crie uma cadência mínima semanal: 30 minutos, 3 contatos, toda segunda. O sistema faz o que a motivação não consegue.",
          low:"Sem ritual fixo, networking vira reativo. Você só age quando precisa — e quando precisa já é tarde. Crie um sistema mínimo e coloque no calendário agora."
        },
        confianca_autentica:{
          high:"Sua coerência gera confiança. As pessoas confiam mais quando percebem alinhamento entre fala, intenção e atitude — continue sendo o mesmo em reuniões formais e conversas informais.",
          mid:"Cuidado para parecer estratégico demais e humano de menos. Relações fortes precisam de intenção, mas também de verdade — compartilhe mais do que está construindo e enfrentando.",
          low:"Você pode estar mantendo um personagem profissional que impede conexões genuínas. Seja vulnerável em pelo menos 2 conversas esta semana — isso transforma contato em aliado."
        },
      };

      const sintese = [
        {q:"O que mais te impressiona?", a: pct('intencao_estrategica')>=70?`A clareza sobre quem quer ter na rede e por quê — vê o networking como investimento, não evento.`:`A intenção existe, mas a estratégia de rede ainda está em construção.`},
        {q:"Como gostaria de ser descrito?", a: pct('presenca_mercado')>=70?`Uma referência — domínio técnico e visão que geram reconhecimento de mercado.`:`Um profissional sólido, construindo visibilidade consistente.`},
        {q:"Sua relação com networking?", a: pct('intencao_estrategica')>=70?`Como investimento estratégico a ser gerenciado com propósito e disciplina.`:`Importante, mas ainda compete com a rotina na priorização.`},
        {q:"Como se comporta em eventos?", a: pct('presenca_mercado')>=70?`Circulando ativamente — objetivo é conectar com pessoas relevantes com clareza de propósito.`:`Presente, mas sem sempre ter clareza do que quer gerar em cada conversa.`},
        {q:"Alguém pede ajuda. Sua reação?", a: pct('reciprocidade_ativa')>=70?`Responde com generosidade — conecta, indica, compartilha. Reciprocidade é valor genuíno.`:`Ajuda quando solicitado, mas raramente oferece antes de ser chamado.`},
        {q:"Qual situação te representa?", a: pct('ritual_consistencia')>=70?`Contatos que evoluem para aliados — porque cultiva com consistência, não só por necessidade.`:`Muitos contatos, mas poucos que chamaria de aliados reais.`},
        {q:"Maior bloqueio?", a: pct('ritual_consistencia')>=70?`A escala — manter qualidade quando o volume de relações cresce.`:`O tempo — a intenção existe, mas a rotina engole a execução.`},
        {q:"O que faz nas 48h após conversa?", a: pct('reciprocidade_ativa')>=70?`Envia mensagem personalizada com algo de valor — artigo, indicação, reconhecimento.`:`Depende da conversa — nas mais relevantes faz follow-up; nas demais, aguarda.`},
        {q:"Onde sua energia vai em conversas?", a: pct('escuta_relacional')>=70?`Para entender o outro genuinamente — o que está construindo, enfrentando, precisando.`:`Para se posicionar bem — como está sendo percebido e que impressão gera.`},
        {q:"Papel dos relacionamentos?", a: pct('confianca_autentica')>=70?`É o que define o legado — impacto gerado nas pessoas e no mercado.`:`Essencial para o crescimento, mas ainda não gerenciado com atenção suficiente.`},
        {q:"Uma coisa que mudaria?", a: pct('ritual_consistencia')>=70?`Aprofundar as conexões que já tem — transformar mais contatos em aliados reais.`:`Ser mais consistente no follow-up — manter o contato vivo entre os encontros.`},
        {q:"O que rede representa?", a: pct('confianca_autentica')>=70?`Segurança — pessoas que estarão lá quando precisar, porque cultivou com autenticidade.`:`Oportunidade — mas ainda não operacionalizada com a consistência que o potencial merece.`},
      ];

      const tensao = top2.length>=2&&bot2.length>=2
        ? `${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1].label} ${s10(top2[1].key)}/10 — mas ${bot2[1].label} ${s10(bot2[1].key)}/10 e ${bot2[0].label} ${s10(bot2[0].key)}/10. Os pontos mais fortes coexistem com gaps que limitam a conversão do potencial em resultado relacional real.`
        : `Score geral ${overallTen}/10. ${pf?.desc?.split('.')[0]||''}.`;

      const termometro = DIMS.map(d => ({
        label: d.label, hoje: `${s10(d.key)}/10`, d90: `${Math.round(proj(pct(d.key))/10)}/10`,
        muda: dimInterp[d.key]?.high?.split('—')[1]?.trim() || dimInterp[d.key]?.high?.split('.')[0] || ''
      }));

      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Diagnóstico Relacional — ${nomePessoa}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:10pt;line-height:1.5}
@page{size:A4;margin:18mm 20mm 16mm 20mm}
@media print{.no-print{display:none!important}.pb{page-break-before:always}}
.print-btn{position:fixed;top:16px;right:16px;background:#c9a227;color:#000;border:none;border-radius:6px;padding:10px 18px;font-weight:700;cursor:pointer;font-size:12px;z-index:99}

/* ── CABEÇALHO DE PÁGINA ── */
.pg-hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:14px}
.pg-hdr-title{font-size:8pt;color:#888;letter-spacing:.05em}
.pg-hdr-right{font-size:8pt;color:#888}

/* ── CAPA ── */
.cover{min-height:90vh;display:flex;flex-direction:column;justify-content:space-between;padding:24px 0}
.lbl{font-size:7.5pt;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#888;margin-bottom:6px}
.name-big{font-size:36pt;font-weight:800;color:#1a1a1a;line-height:1;margin-bottom:6px}
.profile-tag{display:inline-flex;align-items:center;gap:8px;border:1px solid #c9a22750;background:#c9a22710;border-radius:4px;padding:5px 12px;margin-bottom:8px}
.profile-tag-name{font-size:12pt;font-weight:700;color:#c9a227}
.profile-tagline{font-size:9pt;color:#666;font-style:italic}
.ctx-tags{font-size:8pt;color:#666;margin-bottom:16px}
.score-row{display:flex;align-items:stretch;border:1px solid #ddd;border-radius:4px;overflow:hidden;margin-bottom:16px;width:fit-content}
.score-cell{padding:10px 18px;border-right:1px solid #ddd;text-align:center}
.score-cell:last-child{border-right:none}
.score-val{font-family:'Courier New',monospace;font-size:22pt;font-weight:800;color:#c9a227;line-height:1}
.score-lbl{font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
.score-dim{font-family:'Courier New',monospace;font-size:14pt;font-weight:700;line-height:1}
.tensao-box{background:#f9f7f3;border:1px solid #e0ddd8;border-radius:4px;padding:12px;margin-bottom:14px}
.tensao-lbl{font-size:7.5pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-bottom:5px}
.tensao-txt{font-size:9pt;color:#444;line-height:1.65}
.quote{border-left:2px solid #c9a22750;padding-left:12px;font-style:italic;color:#555;font-size:10pt}
.footer-bar{display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1.5px solid #c9a22760;margin-top:auto}
.footer-bar-l{font-size:12pt;font-weight:700;color:#c9a227}
.footer-bar-r{font-size:7.5pt;color:#888;text-align:right}

/* ── DIM TABLE ── */
.dim-table{width:100%;border-collapse:collapse;margin-bottom:8px}
.dim-table td{padding:5px 4px;vertical-align:middle}
.dim-key{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;text-align:center;width:28px}
.dim-info{font-size:8.5pt}
.dim-name{font-weight:700}
.dim-note{color:#666;font-size:7.5pt}
.dim-badge{font-size:6.5pt;font-weight:700;text-transform:uppercase;padding:1px 5px;border-radius:2px;display:inline-block}
.dim-score{font-family:'Courier New',monospace;font-size:14pt;font-weight:800;text-align:right;white-space:nowrap;width:44px}
.dim-bar-cell{width:80px}
.dim-bar-bg{height:4px;border-radius:2px;background:#e5e2dc}
.dim-bar-fg{height:4px;border-radius:2px}
.dim-sep{border-bottom:1px solid #f0ede8}

/* ── SINTESE ── */
.sq{display:flex;gap:8px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid #f0ede8;break-inside:avoid}
.sq:last-child{border-bottom:none;margin-bottom:0}
.sq-num{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#c9a227;background:#c9a22712;border:1px solid #c9a22730;min-width:24px;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sq-q{font-weight:600;font-size:8.5pt;color:#1a1a1a;margin-bottom:2px}
.sq-a{font-size:8pt;color:#555;line-height:1.6;word-break:break-word;overflow-wrap:anywhere}

/* ── SECTIONS ── */
.section{margin-bottom:20px}
.h1{font-size:16pt;font-weight:800;color:#1a1a1a;margin-bottom:8px}
.h2{font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:5px;margin-top:14px}
.h3{font-size:9pt;font-weight:700;color:#c9a227;margin-bottom:4px;margin-top:10px}
.body-p{font-size:9pt;color:#333;line-height:1.75;margin-bottom:8px;text-align:justify}
.box{border-radius:3px;padding:10px 12px;margin-bottom:10px}
.box-warn{background:#fff5f5;border-left:3px solid #c62828}
.box-gold{background:#fdf9ec;border-left:3px solid #c9a227}
.box-grey{background:#f9f7f3;border:1px solid #e0ddd8}
.box-lbl{font-size:7pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}

/* ── GATILHOS ── */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gt-block{border-radius:6px;padding:11px 13px;margin-bottom:10px;break-inside:avoid}
.gt-at{background:#f0faf0;border-left:2.5px solid #2e7d32}
.gt-bl{background:#fff5f5;border-left:2.5px solid #c62828}
.gt-title{font-size:8.5pt;font-weight:700;margin-bottom:4px}
.gt-desc{font-size:8pt;color:#444;line-height:1.55;margin-bottom:4px}
.gt-action{font-size:7.5pt;font-style:italic;color:#c9a227}

/* ── PLANO ── */
.week-box{display:grid;grid-template-columns:56px 1fr;border:1px solid #e0ddd8;border-radius:6px;overflow:hidden;margin-bottom:12px;break-inside:avoid}
.week-num{background:#f9f7f3;border-right:1px solid #e0ddd8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;gap:3px;font-size:18pt}
.week-num-txt{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#c9a227}
.week-body{padding:10px}
.week-sem{font-size:7pt;color:#888;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.week-title{font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:2px}
.week-goal{font-size:8pt;color:#666;font-style:italic;margin-bottom:6px}
.week-task{font-size:8pt;color:#333;margin-bottom:2px;display:flex;gap:6px}
.week-meta{margin-top:6px;background:#fdf9ec;border:1px solid #c9a22720;border-radius:2px;padding:4px 8px;font-family:'Courier New',monospace;font-size:7.5pt;color:#c9a227}

/* ── TERMÔMETRO ── */
.thermo{width:100%;border-collapse:collapse}
.thermo th{background:#f3f0ea;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border:1px solid #ddd;color:#666}
.thermo td{padding:6px 8px;border:1px solid #ddd;font-size:8.5pt;vertical-align:middle}
.thermo tr:nth-child(even) td{background:#faf8f4}

/* ── VANTAGEM ── */
.vant-box{background:#fdf9ec;border-left:3px solid #c9a227;border-radius:0 3px 3px 0;padding:12px;margin-bottom:10px}
.frase-box{text-align:center;padding:20px;background:#f9f7f3;border:1px solid #e0ddd8;border-radius:3px}
.frase-big{font-size:14pt;color:#c9a227;font-weight:700;margin-bottom:8px;line-height:1.4}
.frase-sub{font-size:8.5pt;color:#666;font-style:italic}
</style></head><body>

<button class="print-btn no-print" onclick="window.print()">⬇ Salvar como PDF</button>

<!-- ════ CAPA ══════════════════════════════════════════════════════ -->
<div class="cover">
  <div>
    <div class="lbl">Diagnóstico Relacional Profissional · CONÉXIA</div>
    <div class="name-big">${nomePessoa}</div>
    <div class="profile-tag">
      <span class="profile-tag-name">${pf?.name||""}</span>
    </div>
    <div class="profile-tagline">${pf?.tagline||""}</div>
    <div class="ctx-tags" style="margin-top:8px">
      ${[profile?.role,profile?.segment,profile?.state].filter(Boolean).join("  ·  ")}
    </div>

    <div class="score-row">
      <div class="score-cell" style="background:#fdf9ec">
        <div class="score-val">${assessment.overall}%</div>
        <div class="score-lbl">Score Geral</div>
      </div>
      <div class="score-cell" style="background:#fdf9ec">
        <div style="font-family:'Courier New',monospace;font-size:14pt;font-weight:700;color:#c9a227">${overallTen}/10</div>
        <div class="score-lbl">${percLabel}</div>
      </div>
      ${DIMS.slice(0,3).map(d=>{const v=pct(d.key);return`<div class="score-cell"><div class="score-dim" style="color:${d.color}">${v}%</div><div class="score-lbl">${d.short}</div></div>`;}).join('')}
    </div>

    <div class="tensao-box">
      <div class="tensao-lbl">Tensão Central</div>
      <div class="tensao-txt">${tensao}</div>
    </div>

    <div class="quote">"${pf?.tagline||""}"</div>
  </div>

  <div class="footer-bar">
    <div class="footer-bar-l">CONÉXIA</div>
    <div class="footer-bar-r">"Networking, além do cafezinho" · Rafael Milléo<br>${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
</div>

<!-- ════ P2: MAPA DIMENSIONAL + SÍNTESE ═════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div style="display:grid;grid-template-columns:47% 53%;gap:16px">
  <div>
    <div class="lbl">Mapa Dimensional</div>
    <table class="dim-table">
      ${DIMS.map(d=>{const v=pct(d.key);const isCrit=v<40;const isStr=v>=80;const clr=getLvlClr(v);return`
      <tr class="dim-sep">
        <td class="dim-key" style="color:${d.color}">${d.key}</td>
        <td class="dim-info">
          <div class="dim-name" style="color:${d.color}">${d.label}</div>
          ${isCrit?`<span class="dim-badge" style="color:#c62828;background:#fff0f0;border:1px solid #ffcccc">⚠ GAP CRÍTICO</span>`:isStr?`<span class="dim-badge" style="color:#2e7d32;background:#f0faf0;border:1px solid #c8e6c9">■ Excelente</span>`:''}
          <div class="dim-note">${dimInterp[d.key]?.[getLvl(v)]?.split('.')[0]||''}</div>
        </td>
        <td class="dim-bar-cell"><div class="dim-bar-bg"><div class="dim-bar-fg" style="width:${v}%;background:${d.color}"></div></div></td>
        <td class="dim-score" style="color:${clr}">${s10(d.key)}/10</td>
      </tr>`;}).join('')}
    </table>
  </div>
  <div>
    <div class="lbl">Síntese das Respostas</div>
    ${sintese.map((item,i)=>`<div class="sq">
      <div class="sq-num">${String(i+1).padStart(2,'0')}</div>
      <div><div class="sq-q">${item.q}</div><div class="sq-a">${item.a}</div></div>
    </div>`).join('')}
  </div>
</div>

<!-- ════ P3: ANÁLISE PROFUNDA ════════════════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div class="lbl">Análise Profunda do Perfil</div>
<div class="h1">O que suas respostas revelam sobre você</div>

<p class="body-p">${pf?.desc||""} ${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1]?.label} ${s10(top2[1]?.key)}/10 criam a percepção de profissional com propósito e coerência. ${bot2[0]?`O desafio central é ${bot2[0].label} ${s10(bot2[0].key)}/10 — ${dimInterp[bot2[0].key]?.[getLvl(pct(bot2[0].key))]?.split('.')[0]||''}.`:''}`:''}.</p>

<div class="h3">Sua arquitetura relacional — como você está sendo percebido</div>
<p class="body-p">${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 ${top2[1]?`combinado com ${top2[1].label} ${s10(top2[1].key)}/10`:''} cria a impressão de alguém que sabe o que está fazendo e para onde vai. Isso é um ativo real — as pessoas confiam em quem demonstra clareza de propósito. O problema é que essa percepção ainda não é suficientemente nutrida ${bot2[0]?`pela ausência de ${bot2[0].label.toLowerCase()} ativa`:''}.`:''}</p>

<div class="box box-warn" style="margin-top:12px">
  <div class="box-lbl" style="color:#c62828">A sombra do seu perfil — o ponto cego que mais te custa</div>
  <p style="font-size:8.5pt;color:#444;line-height:1.65;margin:0">${bot2[0]?`A sombra mais profunda é o gap entre a intenção declarada e a execução. ${bot2[0].label} ${s10(bot2[0].key)}/10 é o padrão que mais custa — não pela ausência de vontade, mas pela ausência de sistema. ${dimInterp[bot2[0].key]?.[getLvl(pct(bot2[0].key))]||''}`:pf?.risks?.[0]||''}</p>
</div>

<div class="box box-gold">
  <div class="box-lbl" style="color:#c9a227">⚑ Não ignore isso</div>
  <p style="font-size:8.5pt;color:#444;line-height:1.65;margin:0">${bot2[0]?`${(['presenca_mercado','escuta_relacional','reciprocidade_ativa','confianca_autentica'].includes(bot2[0].key)?bot2[0].label+' baixa':bot2[0].label+' baixo')} é o padrão clássico do profissional que confunde intenção com execução. A diferença entre quem constrói capital relacional real e quem acumula contatos está exatamente nessa dimensão.`:pf?.risks?.[1]||''}</p>
</div>

<div style="margin-top:14px">
  <div class="lbl">Forças e Riscos</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="box box-grey">
      <div class="box-lbl" style="color:#2e7d32">✓ Suas Forças</div>
      ${(pf?.strengths||[]).map(s=>`<div style="display:flex;gap:6px;margin-bottom:5px;font-size:8.5pt"><span style="color:#2e7d32;flex-shrink:0">✓</span><span style="color:#333">${s}</span></div>`).join('')}
    </div>
    <div class="box box-grey">
      <div class="box-lbl" style="color:#c62828">⚠ Pontos de Atenção</div>
      ${(pf?.risks||[]).map(r=>`<div style="display:flex;gap:6px;margin-bottom:5px;font-size:8.5pt"><span style="color:#c62828;flex-shrink:0">!</span><span style="color:#333">${r}</span></div>`).join('')}
    </div>
  </div>
</div>

<div class="box box-gold" style="margin-top:10px">
  <div class="box-lbl" style="color:#c9a227">Suas 3 Ações Prioritárias</div>
  ${(pf?.actions||[]).map((a,i)=>`<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<(pf?.actions?.length-1)?'1px solid #e5d89a':'none'}"><span style="font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#c9a227;flex-shrink:0">${i+1}</span><span style="font-size:8.5pt;color:#333;line-height:1.5">${a}</span></div>`).join('')}
</div>

<!-- ════ PLANO DE AÇÃO IMEDIATO ═══════════════════════════════════════ -->
${(() => {
  const plan = generateImmediateActionPlan(sc);
  if (!plan) return '';
  return `<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>
<div class="lbl">Plano de Ação Imediato</div>
<h2 style="margin-bottom:6px">De diagnóstico para execução</h2>
<p style="font-size:8.5pt;color:#666;margin-bottom:16px">Ações concretas baseadas nos seus menores scores. Sem teoria — só o próximo passo.</p>
<div style="display:grid;grid-template-columns:1fr;gap:12px">
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #e8d89a;border-radius:8px;overflow:hidden">
    <div style="background:#fdf6d8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #e8d89a">
      <div style="font-size:18px">⚡</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#a07814;text-align:center;line-height:1.2">48h</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#a07814;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">Próximas 48 horas</div>
      <p style="font-size:9pt;color:#333;line-height:1.65;margin:0">${plan.h48}</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:#f9f7f3;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #ddd">
      <div style="font-size:18px">📅</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#888;text-align:center;line-height:1.2">7d</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Próximos 7 dias</div>
      ${plan.d7.map((a,i) => `<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<plan.d7.length-1?'1px solid #f0ede4':'none'}">
        <div style="width:20px;height:20px;border-radius:5px;background:#f0ede4;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#888;flex-shrink:0">${i+1}</div>
        <span style="font-size:8.5pt;color:#333;line-height:1.55">${a}</span>
      </div>`).join('')}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:#f9f7f3;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #ddd">
      <div style="font-size:18px">📆</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#888;text-align:center;line-height:1.2">30d</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Próximos 30 dias</div>
      ${plan.d30.map((a,i) => `<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<plan.d30.length-1?'1px solid #f0ede4':'none'}">
        <div style="width:20px;height:20px;border-radius:5px;background:#f0ede4;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#888;flex-shrink:0">${i+1}</div>
        <span style="font-size:8.5pt;color:#333;line-height:1.55">${a}</span>
      </div>`).join('')}
    </div>
  </div>
</div>`;
})()}

<!-- ════ P4: GATILHOS ══════════════════════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div class="lbl">Gatilhos Relacionais</div>
<div class="h1" style="margin-bottom:6px">Os padrões automáticos que ativam e travam o comportamento relacional</div>
<p style="font-size:8.5pt;color:#666;margin-bottom:14px">O que faz você aparecer com energia total — e o que te impede de avançar.</p>

<div class="g2" style="margin-bottom:18px">
  <div>
    <div style="font-size:8pt;font-weight:700;color:#2e7d32;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">⚡ Gatilhos de Ativação</div>
    ${(()=>{
      const acoes = {
        intencao_estrategica: "Escolha melhor onde colocar energia. Seu ganho está em priorizar relações que ampliam reputação, oportunidade e confiança.",
        escuta_relacional: "Use sua escuta para entender o momento do outro antes de propor qualquer próximo passo.",
        presenca_mercado: "Use sua visibilidade para ocupar os ambientes certos com constância e intenção.",
        reciprocidade_ativa: "Continue gerando valor antes de pedir. Indicações, reconhecimento e ajuda prática fortalecem retorno espontâneo.",
        ritual_consistencia: "Mantenha cadência. Relações importantes não esfriam quando existe ritual.",
        confianca_autentica: "Sua coerência gera confiança. Preserve o mesmo tom em conversas formais e informais."
      };
      return DIMS.filter(d=>pct(d.key)>=65).slice(0,3).map(d=>`<div class="gt-block gt-at">
        <div class="gt-title" style="color:#2e7d32">${d.label} ${s10(d.key)}/10</div>
        <div class="gt-desc">${dimInterp[d.key]?.high?.split('.')[0]||''}</div>
        <div class="gt-action">→ ${acoes[d.key]||'Use este ponto como vantagem relacional.'}</div>
      </div>`).join('');
    })()}
  </div>
  <div>
    <div style="font-size:8pt;font-weight:700;color:#c62828;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">🔴 Gatilhos de Bloqueio</div>
    ${(()=>{
      const antidotos = {
        intencao_estrategica: "Defina seus 10 contatos prioritários e o motivo de cada um importar nos próximos 90 dias.",
        escuta_relacional: "Entre em conversas importantes com uma pergunta aberta e a intenção real de entender.",
        presenca_mercado: "Crie uma cadência mínima: 1 conteúdo, 1 conversa e 1 aparição relevante por semana.",
        reciprocidade_ativa: "Antecipe valor: faça uma indicação, compartilhe algo útil ou reconheça alguém antes de precisar pedir.",
        ritual_consistencia: "Coloque um ritual fixo de 30 minutos por semana para revisar contatos e próximos passos.",
        confianca_autentica: "Reduza interações transacionais. Faça uma conversa sem vender, pedir ou apresentar nada."
      };
      return DIMS.filter(d=>pct(d.key)<70).slice(-3).map(d=>`<div class="gt-block gt-bl">
        <div class="gt-title" style="color:#c62828">${d.label} ${s10(d.key)}/10</div>
        <div class="gt-desc">${dimInterp[d.key]?.[getLvl(pct(d.key))]?.split('.')[0]||''}</div>
        <div class="gt-action">Antídoto: ${antidotos[d.key]||'Crie um sistema mínimo para esta dimensão.'}</div>
      </div>`).join('');
    })()}
  </div>
</div>

<!-- ════ P5: PLANO ═════════════════════════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div class="lbl">Plano de Ativação — 4 Semanas</div>
<div class="h1" style="margin-bottom:6px">Quatro semanas para transformar o gap mais custoso em hábito</div>
<p style="font-size:8.5pt;color:#666;margin-bottom:14px">Cada semana tem um foco, um comportamento concreto e uma meta mensurável.</p>
${PLAN.map((w,i)=>`<div class="week-box">
  <div class="week-num"><span>${w.icon}</span><span class="week-num-txt">${w.week}</span></div>
  <div class="week-body">
    <div class="week-sem">Semana ${w.week}</div>
    <div class="week-title">${w.title}</div>
    <div class="week-goal">${w.goal}</div>
    ${w.tasks.map(t=>`<div class="week-task"><span style="color:#c9a22760">→</span>${t}</div>`).join('')}
    <div class="week-meta">Meta: ${w.metric}</div>
  </div>
</div>`).join('')}

<!-- ════ P5: TERMÔMETRO + VANTAGEM ══════════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div class="lbl">Termômetro Relacional — 90 Dias</div>
<div class="h1" style="margin-bottom:10px">O que é possível construir com consistência de aplicação</div>

<table class="thermo" style="margin-bottom:16px">
  <tr><th>Dimensão</th><th>Hoje</th><th>90 dias</th><th>O que muda</th></tr>
  ${termometro.map(t=>`<tr><td style="font-weight:600">${t.label}</td><td style="font-family:'Courier New',monospace;font-weight:700;text-align:center">${t.hoje}</td><td style="font-family:'Courier New',monospace;font-weight:700;color:#2e7d32;text-align:center">${t.d90}</td><td style="font-size:8pt;color:#555">${t.muda}</td></tr>`).join('')}
</table>

<div class="lbl">A Vantagem Única do Seu Perfil</div>
<div class="vant-box">
  <p style="font-size:9pt;color:#333;line-height:1.75;margin:0">${pf?.desc?.split('.').slice(0,2).join('.')||''}. ${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1]?.label} ${s10(top2[1]?.key)}/10 é uma combinação que já posiciona como referência. O próximo nível não exige mudar o que você faz — exige ampliar como o mercado enxerga o que você entrega.`:''}</p>
</div>

<p style="text-align:center;font-style:italic;color:#666;font-size:9pt;margin-bottom:20px">"Toda semana: em quantas conversas você genuinamente aprendeu algo sobre o outro que não sabia antes — e o que isso diz sobre a qualidade da sua presença?"</p>

<div class="frase-box">
  <div class="frase-big">${nomePessoa.split(" ")[0]||"Você"}, você já sabe chegar.<br>O próximo nível é fazer as pessoas quererem que você fique.</div>
  <div class="frase-sub">"Relacionamento não é sobre ter muitos contatos. É sobre ser indispensável para os que importam."</div>
</div>

${MENTORIA_LINK || true ? `
<div class="pb" style="background:#f9f7f3;border-top:1px solid #e0ddd8;padding:28px 40px;text-align:center">
  <div style="font-size:8pt;font-weight:700;color:#a07814;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Mentoria Individual</div>
  <div style="font-size:14pt;font-weight:700;color:#1a1a1a;margin-bottom:8px">Quer desenvolver esse plano com mais profundidade?</div>
  <p style="font-size:9pt;color:#555;line-height:1.7;margin:0 auto 14px;max-width:500px">Se fizer sentido para você, posso te ajudar em uma mentoria individual para transformar esse diagnóstico em um plano prático de relacionamento, posicionamento e geração de oportunidades.</p>
  ${MENTORIA_LINK ? `<a href="${MENTORIA_LINK}" target="_blank" style="display:inline-block;background:#c9a227;color:#0d0d0f;border-radius:6px;padding:10px 24px;font-size:10pt;font-weight:700;text-decoration:none">Quero desenvolver meu plano</a>` : `<div style="font-size:9pt;color:#888;font-style:italic">Em breve você poderá solicitar sua mentoria por aqui.</div>`}
</div>` : ''}

<div class="footer-bar" style="margin-top:20px">
  <div class="footer-bar-l">CONÉXIA</div>
  <div class="footer-bar-r">"Networking, além do cafezinho" · Rafael Milléo<br>Diagnóstico Relacional Profissional · ${new Date().toLocaleDateString('pt-BR')}</div>
</div>

</body></html>`;

      const win=window.open("","_blank");
      if(!win){alert("Permita pop-ups para abrir o relatório.");return;}
      win.document.write(html);
      win.document.close();
    };

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
            <button onClick={() => setShowUpgrade(true)} style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}50`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 2 }}>🔒 PRO</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>Fazer upgrade</div>
            </button>
          )}
          {showUpgrade && <UpgradeModal />}
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

        {/* ══ Análise da Rede ══ */}
        {cts.length > 0 && (() => {
          // Distribuição por categoria
          const catCount = {};
          cts.forEach(c => { catCount[c.category] = (catCount[c.category] || 0) + 1; });
          const catEntries = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
          const dominantCat = catEntries[0];
          const dominantPct = Math.round((dominantCat?.[1] || 0) / cts.length * 100);
          const catLabel = (v) => CATS.find(c => c.value === v)?.label || v;
          const catColor = (v) => CATS.find(c => c.value === v)?.color || C.gold;

          // Distribuição por empresa
          const empCount = {};
          cts.forEach(c => { if (c.company) { empCount[c.company] = (empCount[c.company] || 0) + 1; } });
          const empEntries = Object.entries(empCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const topEmp = empEntries[0];
          const topEmpPct = topEmp ? Math.round(topEmp[1] / cts.length * 100) : 0;

          // Contatos sem próxima ação
          const semAcao = cts.filter(c => !c.nextAction && c.status === 'active').length;
          const semInteracao = cts.filter(c => !c.lastInteraction).length;

          // Interações recentes
          const recentIts = its.slice(0, 8);
          const sentPos = its.filter(i => i.sentiment === 'positivo').length;
          const sentNeg = its.filter(i => i.sentiment === 'negativo').length;
          const sentPct = its.length > 0 ? Math.round(sentPos / its.length * 100) : 0;

          return (
            <>
              {/* Painel: Sua Rede em Números */}
              <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>📊 Sua rede em números</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[{ l: 'Total de contatos', v: cts.length, c: C.gold }, { l: 'Sem próxima ação', v: semAcao, c: semAcao > 0 ? C.amb : C.grn }, { l: 'Sem interação registrada', v: semInteracao, c: semInteracao > 0 ? C.cor : C.grn }, { l: 'Interações positivas', v: `${sentPct}%`, c: sentPct >= 70 ? C.grn : C.amb }].map((m, i) => (
                    <div key={i} style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginBottom: 4 }}>{m.l}</div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>

                {/* Distribuição por categoria */}
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Distribuição por categoria</div>
                {catEntries.map(([cat, count], i) => {
                  const pct = Math.round(count / cts.length * 100);
                  const cc = catColor(cat);
                  return (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{catLabel(cat)}</span>
                        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: cc }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: C.w06 }}>
                        <div style={{ height: 6, borderRadius: 3, background: cc, width: `${pct}%`, transition: 'width .4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Alerta de concentração */}
              {(dominantPct > 60 || topEmpPct > 60) && (
                <div style={{ background: `${C.amb}08`, border: `1px solid ${C.amb}30`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>⚠ Alerta de concentração</div>
                  {dominantPct > 60 && (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, marginBottom: 6 }}>
                      <strong style={{ color: C.txt }}>{dominantPct}% dos seus contatos são "{catLabel(dominantCat[0])}".</strong> Redes diversas geram mais oportunidades. Busque contatos nas categorias menos representadas.
                    </div>
                  )}
                  {topEmpPct > 60 && (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
                      <strong style={{ color: C.txt }}>{topEmpPct}% dos seus contatos são da {topEmp[0]}.</strong> Diversifique para reduzir dependência e ampliar oportunidades externas.
                    </div>
                  )}
                  <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: 'uppercase' }}>→ Ação: </span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>Cadastre 2 contatos de empresas ou categorias diferentes nos próximos 7 dias.</span>
                  </div>
                </div>
              )}

              {/* Distribuição por empresa */}
              {empEntries.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>🏢 Empresas na sua rede</div>
                  {empEntries.map(([emp, count], i) => {
                    const pct = Math.round(count / cts.length * 100);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: C.gD, border: `1px solid ${C.gL}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: C.gold, flexShrink: 0 }}>{emp[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{emp}</span>
                            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.txL }}>{count} ({pct}%)</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: C.w06 }}>
                            <div style={{ height: 4, borderRadius: 2, background: C.gold, width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Interações recentes */}
              {recentIts.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em' }}>💬 Interações recentes</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.grn, background: `${C.grn}12`, border: `1px solid ${C.grn}30`, borderRadius: 4, padding: '2px 8px' }}>↑ {sentPos} positivas</span>
                      {sentNeg > 0 && <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.cor, background: `${C.cor}12`, border: `1px solid ${C.cor}30`, borderRadius: 4, padding: '2px 8px' }}>↓ {sentNeg} negativas</span>}
                    </div>
                  </div>
                  {recentIts.map((it, i) => {
                    const contact = cts.find(c => c.id === it.contactId);
                    const typeLabel = { ligacao: 'Ligança', mensagem: 'Mensagem', reuniao: 'Reunião', email: 'E-mail', outro: 'Outro' }[it.type] || it.type;
                    const sentColor = it.sentiment === 'positivo' ? C.grn : it.sentiment === 'negativo' ? C.cor : C.txL;
                    const sentIcon = it.sentiment === 'positivo' ? '↑' : it.sentiment === 'negativo' ? '↓' : '→';
                    const daysAgo = Math.floor((Date.now() - new Date(it.createdAt).getTime()) / 86400000);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: i < recentIts.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${sentColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{sentIcon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, fontWeight: 500 }}>{contact?.name || 'Contato'}</div>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{typeLabel} · {daysAgo === 0 ? 'hoje' : `${daysAgo}d atrás`}</div>
                        </div>
                        <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: sentColor, background: `${sentColor}12`, border: `1px solid ${sentColor}30`, borderRadius: 4, padding: '2px 8px', flexShrink: 0 }}>{it.sentiment || 'neutro'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          );
        })()}
      </div>
    );
  };

  // ── Aba Perfil ────────────────────────────────────────────
  const renderPerfil = () => (
    <PerfilForm
      profile={profile}
      userId={user?.id}
      onSaved={(updated) => setProfile(prev => ({ ...(prev || {}), ...updated }))}
    />
  );

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
      {/* PRO Activation Toast */}
      {proToast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.gold, color:C.bg, borderRadius:10, padding:"12px 24px", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, zIndex:9999, boxShadow:"0 4px 20px #c9a22740", whiteSpace:"nowrap" }}>✨ PRO ativado com sucesso!</div>}
      {!isMobile && (
        <nav style={{ width: 190, flexShrink: 0, background: C.sf, borderRight: `1px solid ${C.brd}`, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px", borderBottom: `1px solid ${C.brd}`, marginBottom: 14 }}>
            <ConexiaIcon size={30} dark={true} />
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
            <div style={{ marginTop:4, display:"flex", alignItems:"center", gap:6 }}>
              <span style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", padding:"2px 7px", borderRadius:3, background: isPro?`${C.gold}20`:C.w06, color: isPro?C.gold:C.txL, border:`1px solid ${isPro?C.gL:C.brd}` }}>{planLabel}</span>
              {!isPro && <button onClick={openAccessKey} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:9, color:C.txL, cursor:"pointer", padding:0 }}>Chave</button>}
            </div>
            {admin && <Tag color={C.vio} small>Admin</Tag>}
          </div>
          <button onClick={() => setView("perfil")} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, background: view==="perfil" ? C.gD : "transparent", border: view==="perfil" ? `1px solid ${C.gL}` : "1px solid transparent", borderRadius:7, padding:"9px 12px", cursor:"pointer", marginBottom:3 }}>
            <span style={{ fontSize:12, color: view==="perfil" ? C.gold : C.txL }}>👤</span>
            <span style={{ fontFamily:"'DM Sans'", fontSize:13, fontWeight:500, color: view==="perfil" ? C.gold : C.txM }}>Perfil</span>
          </button>
          <Btn variant="ghost" small onClick={onReset}>Sair</Btn>
        </nav>
      )}

      {isMobile && (
        <div style={{ background: C.sf, borderBottom: `1px solid ${C.brd}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ConexiaIcon size={26} dark={true} />
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 700, color: C.txt }}>CONÉXIA</span>
          </div>
          <button onClick={() => { setView("perfil"); setSelId(null); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6 }}>
            <span style={{ fontSize: 14 }}>👤</span>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: view === "perfil" ? C.gold : C.txL, fontWeight: view === "perfil" ? 700 : 400 }}>{profile?.name || "Perfil"}</span>
          </button>
        </div>
      )}

      <main style={{ flex: 1, padding: isMobile ? "16px" : "24px 28px", overflowY: "auto", maxHeight: isMobile ? "calc(100vh - 110px)" : "100vh", paddingBottom: isMobile ? 70 : 24 }}>
        {view === "dashboard" && <ConexiaDashboard userId={user?.id} />}
        {view === "dash" && renderDash()}
        {view === "contacts" && renderContacts()}
        {view === "teia" && renderTeia()}
        {view === "plano" && renderPlan()}
        {view === "ia" && <AbaIA userId={user?.id} contacts={cts} interactions={its} assessment={assessment} profile={profile} pf={pf} />}
        {view === "report" && renderReport()}
        {view === "mentor" && admin && renderMentor()}
        {view === "export" && admin && renderExport()}
        {view === "perfil" && renderPerfil()}
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
        {isPro ? (
          <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Relevância estratégica</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 14 }}>Avalie de 0 a 10. Preencha os 4 para calcular o Relevance Score.</div>
            {[
              { field: "influenciaPessoas", label: "Influencia outras pessoas?", micro: "Essa pessoa movimenta opinião, decisões ou conexões ao redor dela?" },
              { field: "geraOportunidade",  label: "Pode gerar oportunidade?",  micro: "Existe chance real de parceria, negócio, projeto, indicação ou aprendizado?" },
              { field: "abrePortas",        label: "Pode abrir portas?",        micro: "Essa pessoa pode conectar você a pessoas, ambientes ou conversas importantes?" },
              { field: "momentoAtual",      label: "Faz sentido para meu momento atual?", micro: "Essa relação tem conexão com seus objetivos dos próximos meses?" },
            ].map(({ field, label, micro }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM }}>{label}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{micro}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: C.gold, minWidth: 28, textAlign: "right" }}>{cf[field] !== "" ? cf[field] : "—"}</div>
                </div>
                <input type="range" min="0" max="10" step="1" value={cf[field] !== "" ? cf[field] : 5} onChange={e => setCf({ ...cf, [field]: e.target.value })} style={{ width: "100%", accentColor: C.gold, height: 4, cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans'", fontSize: 9, color: C.txL, marginTop: 2 }}><span>0</span><span>5</span><span>10</span></div>
              </div>
            ))}
            {(() => { const rs = calculateRelevanceScore({ influenciaPessoas: cf.influenciaPessoas !== "" ? parseInt(cf.influenciaPessoas) : null, geraOportunidade: cf.geraOportunidade !== "" ? parseInt(cf.geraOportunidade) : null, abrePortas: cf.abrePortas !== "" ? parseInt(cf.abrePortas) : null, momentoAtual: cf.momentoAtual !== "" ? parseInt(cf.momentoAtual) : null }); return rs !== null ? (<div style={{ background:`${C.gold}10`, border:`1px solid ${C.gL}`, borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM }}>Relevance Score</span><span style={{ fontFamily:"'JetBrains Mono'", fontSize:14, fontWeight:700, color:getRelevanceLabelColor(rs) }}>{rs}% — {getRelevanceLabel(rs)}</span></div>) : (<div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, fontStyle:"italic" }}>Preencha os 4 campos para calcular.</div>); })()}
          </div>
        ) : (
          <div style={{ borderTop:`1px solid ${C.brd}`, marginTop:16, paddingTop:16, background:`${C.gold}06`, borderRadius:8, padding:14 }}>
            <div style={{ fontFamily:"'DM Sans'", fontSize:12, fontWeight:600, color:C.gold, marginBottom:4 }}>🔒 Relevância estratégica — PRO</div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:8 }}>Quer saber quem realmente importa na sua rede? O Relevance Score está disponível no PRO.</div>
            <button onClick={openAccessKey} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:10, color:C.txL, cursor:"pointer", textDecoration:"underline" }}>Tenho uma chave de acesso</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => setModal(null)}>Cancelar</Btn><Btn small onClick={addC} disabled={!cf.name.trim()}>Salvar</Btn></div>
      </Modal>}
      {modal === "editC" && <Modal title="Editar contato" onClose={() => { setModal(null); setEditId(null); }}>
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
          <Sel label="Proximidade" value={cf.proximity} onChange={v => setCf({ ...cf, proximity: v })} options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}/5` }))} />
          <Inp label="Freq. (dias)" value={cf.idealFreq} onChange={v => setCf({ ...cf, idealFreq: v })} type="number" />
        </div>
        <Inp label="Como conheceu?" value={cf.howMet} onChange={v => setCf({ ...cf, howMet: v })} placeholder="Evento, indicação, campo..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="📋 Próxima ação" value={cf.nextAction} onChange={v => setCf({ ...cf, nextAction: v })} placeholder="Ligar, enviar artigo..." />
          <Inp label="📅 Data da ação" value={cf.nextActionDate} onChange={v => setCf({ ...cf, nextActionDate: v })} type="date" />
        </div>
        <Inp label="📝 Notas" value={cf.notes} onChange={v => setCf({ ...cf, notes: v })} placeholder="O que importa saber sobre essa pessoa..." textarea />
        <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Relevância estratégica</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 14 }}>Avalie de 0 a 10. Preencha os 4 para calcular o Relevance Score.</div>
          {[
            { field: "influenciaPessoas", label: "Influencia outras pessoas?", micro: "Essa pessoa movimenta opinião, decisões ou conexões ao redor dela?" },
            { field: "geraOportunidade",  label: "Pode gerar oportunidade?",  micro: "Existe chance real de parceria, negócio, projeto, indicação ou aprendizado?" },
            { field: "abrePortas",        label: "Pode abrir portas?",        micro: "Essa pessoa pode conectar você a pessoas, ambientes ou conversas importantes?" },
            { field: "momentoAtual",      label: "Faz sentido para meu momento atual?", micro: "Essa relação tem conexão com seus objetivos dos próximos meses?" },
          ].map(({ field, label, micro }) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{micro}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: C.gold, minWidth: 28, textAlign: "right" }}>
                  {cf[field] !== "" ? cf[field] : "—"}
                </div>
              </div>
              <input type="range" min="0" max="10" step="1"
                value={cf[field] !== "" ? cf[field] : 5}
                onChange={e => setCf({ ...cf, [field]: e.target.value })}
                style={{ width: "100%", accentColor: C.gold, height: 4, cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans'", fontSize: 9, color: C.txL, marginTop: 2 }}>
                <span>0</span><span>5</span><span>10</span>
              </div>
            </div>
          ))}
          {(() => {
            const rs = calculateRelevanceScore({ influenciaPessoas: cf.influenciaPessoas !== "" ? parseInt(cf.influenciaPessoas) : null, geraOportunidade: cf.geraOportunidade !== "" ? parseInt(cf.geraOportunidade) : null, abrePortas: cf.abrePortas !== "" ? parseInt(cf.abrePortas) : null, momentoAtual: cf.momentoAtual !== "" ? parseInt(cf.momentoAtual) : null });
            return rs !== null ? (
              <div style={{ background: `${C.gold}10`, border: `1px solid ${C.gL}`, borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>Relevance Score</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: getRelevanceLabelColor(rs) }}>{rs}% — {getRelevanceLabel(rs)}</span>
              </div>
            ) : (
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, fontStyle: "italic" }}>Preencha os 4 campos para calcular.</div>
            );
          })()}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => { setModal(null); setEditId(null); }}>Cancelar</Btn><Btn small onClick={saveEditC} disabled={!cf.name.trim()}>Salvar alterações</Btn></div>
      </Modal>}
      {/* Access Key Modal */}
      {showAccessKey && <Modal title="Ativar chave de acesso" onClose={() => setShowAccessKey(false)}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, marginBottom:12, lineHeight:1.6 }}>
            Digite sua chave de acesso PRO para liberar todos os recursos por 90 dias.
          </div>
          <input
            value={akCode}
            onChange={e => setAkCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && redeemKey()}
            placeholder="Ex: MILLEO-PRO-15"
            style={{ width:"100%", background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"12px 14px", fontFamily:"'JetBrains Mono'", fontSize:15, fontWeight:700, color:C.gold, outline:"none", letterSpacing:".1em", boxSizing:"border-box" }}
          />
          {akMsg && <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.cor, marginTop:8 }}>{akMsg}</div>}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <Btn variant="ghost" small onClick={() => setShowAccessKey(false)}>Cancelar</Btn>
          <Btn small onClick={redeemKey} disabled={akBusy || !akCode.trim()}>{akBusy ? "Ativando..." : "Ativar PRO"}</Btn>
        </div>
      </Modal>}

      {/* Limite contatos Free */}
      {modal === "limiteCt" && <Modal title="Limite do plano gratuito" onClose={() => setModal(null)}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>🔒</div>
          <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, lineHeight:1.7 }}>
            No plano Free você pode gerenciar até <strong style={{ color:C.txt }}>10 contatos</strong>. Assine o PRO para contatos ilimitados, Relevance Score e ações inteligentes.
          </p>
        </div>
        <a href={STRIPE_MENSAL} target="_blank" rel="noreferrer" onClick={() => setModal(null)}
          style={{ display:"block", background:C.gold, color:C.bg, borderRadius:8, padding:"11px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, textDecoration:"none", textAlign:"center", marginBottom:10 }}>
          Assinar PRO — R$ 39,90/mês
        </a>
        <button onClick={() => { setModal(null); openAccessKey(); }}
          style={{ display:"block", width:"100%", background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", textDecoration:"underline" }}>
          Tenho uma chave de acesso
        </button>
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

/* ═══ SPLASH SCREEN ════════════════════════════════════════ */
function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in'); // 'in' | 'hold' | 'out'
  const done = useCallback(() => { setPhase('out'); setTimeout(onDone, 1000); }, [onDone]);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 1500);
    const t2 = setTimeout(() => setPhase('out'), 10500);
    const t3 = setTimeout(onDone, 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);
  const opacity = phase === 'in' ? 0 : phase === 'hold' ? 1 : 0;
  const transition = phase === 'in' ? 'opacity 1.2s ease-in' : phase === 'out' ? 'opacity 1s ease-out' : 'none';
  return (
    <div onClick={done} style={{ background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, cursor: 'pointer', userSelect: 'none' }}>
      <div style={{ opacity, transition, textAlign: 'center', maxWidth: 360 }}>
        <ConexiaIcon size={96} dark={true} style={{ margin: '0 auto 32px', display: 'block' }} />
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 600, color: C.gold, lineHeight: 1.5, margin: '0 0 28px', letterSpacing: '.02em' }}>
          "Para ser intencional<br/>precisa ser estratégico."
        </p>
        <div style={{ width: 40, height: 1, background: C.gD, margin: '0 auto 20px' }} />
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, letterSpacing: '.12em', textTransform: 'uppercase' }}>CONÉXIA</div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, opacity: 0.35, letterSpacing: '.06em' }}>toque para continuar</div>
    </div>
  );
}

/* ═══ ROOT ════════════════════════════════════════════════ */
/* ═══ PUBLIC LANDING ═══════════════════════════════════════ */
function PublicLanding({ onSignup, onLogin, urlKey = "" }) {
  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      {/* Logo */}
      <div style={{ textAlign:"center", marginBottom:40 }}>
        <ConexiaLogo height={72} style={{ margin: "0 auto 12px", display: "block" }} />
        <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, letterSpacing:".08em", textTransform:"uppercase" }}>Plataforma IAGRO</div>
      </div>

      {/* Headline */}
      <div style={{ maxWidth:480, textAlign:"center", marginBottom:40 }}>
        <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, color:C.txt, lineHeight:1.2, margin:"0 0 16px" }}>
          Rede que funciona.
        </h1>
        <div style={{ background:`${C.gold}12`, border:`1px solid ${C.gL}`, borderRadius:10, padding:"14px 20px", marginBottom:16 }}>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontWeight:600, color:C.gold, lineHeight:1.4, margin:0 }}>
            "Para ser intencional precisa ser estratégico."
          </p>
        </div>
        <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, lineHeight:1.5, margin:0 }}>
          Diagnóstico seu perfil relacional em 5 minutos.
        </p>
      </div>

      {/* CTAs */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:360 }}>
        <button onClick={onSignup}
          style={{ background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:12, padding:"16px 0", fontFamily:"'DM Sans'", fontSize:14, fontWeight:700, color:C.bg, cursor:"pointer", width:"100%" }}>
          Fazer diagnóstico gratuito
        </button>
        <button onClick={onLogin}
          style={{ background:"transparent", border:`1.5px solid ${C.brd}`, borderRadius:12, padding:"14px 0", fontFamily:"'DM Sans'", fontSize:14, fontWeight:500, color:C.txM, cursor:"pointer", width:"100%" }}>
          Já tenho conta — Entrar
        </button>
      </div>



      {urlKey && (
        <div style={{ marginTop:20, background:`${C.gold}12`, border:`1px solid ${C.gL}`, borderRadius:10, padding:"10px 20px", textAlign:"center" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.gold, fontWeight:600 }}>🎁 Chave de acesso detectada: <span style={{ fontFamily:"'JetBrains Mono'", letterSpacing:".06em" }}>{urlKey}</span></div>
          <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, marginTop:3 }}>Crie sua conta para ativar o acesso PRO automaticamente</div>
        </div>
      )}
      <div style={{ marginTop:20, fontFamily:"'DM Sans'", fontSize:11, color:C.txL, textAlign:"center" }}>
        Gratuito · Sem cadastro
      </div>
    </div>
  );
}

/* ═══ AUTH ═════════════════════════════════════════════════ */
function Auth({ onAuth, initialMode = "signup" }) {
  const [mode, setMode] = useState(initialMode || "signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("Informe seu nome."); setBusy(false); return; }
        if (!lgpd) { setErr("Você precisa aceitar a Política de Privacidade para continuar."); setBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email, password: pass,
          options: { data: {
            name: name.trim(),
            lgpd_accepted: "true",
            lgpd_version: "v1.0",
            user_agent: navigator.userAgent,
          } },
        });
        if (error) throw error;
        // O aceite LGPD é gravado no servidor pelo gatilho handle_new_user,
        // de forma confiável independente de haver sessão ativa neste momento
        // (necessário pois signUp pode não retornar sessão se a confirmação
        // de e-mail estiver habilitada no projeto).
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
          {mode === "signup" && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:16, marginTop:4 }}>
              <div
                onClick={() => setLgpd(!lgpd)}
                style={{ width:18, height:18, minWidth:18, borderRadius:4, border:`2px solid ${lgpd ? C.gold : C.brd}`, background: lgpd ? C.gold : "transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginTop:1 }}
              >
                {lgpd && <span style={{ color:C.bg, fontSize:11, fontWeight:700, lineHeight:1 }}>✓</span>}
              </div>
              <span style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, lineHeight:1.5 }}>
                Li e aceito a{" "}
                <span
                  onClick={() => setShowPrivacy(true)}
                  style={{ color:C.gold, cursor:"pointer", textDecoration:"underline" }}
                >
                  Política de Privacidade
                </span>
                {" "}e os{" "}
                <span
                  onClick={() => setShowPrivacy(true)}
                  style={{ color:C.gold, cursor:"pointer", textDecoration:"underline" }}
                >
                  Termos de Uso
                </span>
                , incluindo o tratamento dos meus dados conforme a LGPD (Lei 13.709/2018).
              </span>
            </div>
          )}
          {showPrivacy && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
              <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"80vh", overflowY:"auto" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:0 }}>Política de Privacidade e Termos de Uso</h2>
                  <button onClick={() => setShowPrivacy(false)} style={{ background:"none", border:"none", color:C.txL, fontSize:20, cursor:"pointer", lineHeight:1 }}>×</button>
                </div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, lineHeight:1.7 }}>
                  <p><strong style={{color:C.txt}}>1. Responsável pelo tratamento</strong><br/>CONÉXIA, plataforma de inteligência relacional para profissionais do agronegócio.</p>
                  <p><strong style={{color:C.txt}}>2. Dados coletados</strong><br/>Coletamos nome, e-mail, empresa, cargo, WhatsApp, LinkedIn, Instagram, cidade, estado, objetivos profissionais e histórico de interações com contatos.</p>
                  <p><strong style={{color:C.txt}}>3. Finalidade</strong><br/>Os dados são utilizados exclusivamente para personalizar os insights de inteligência relacional, gerar diagnósticos e recomendações dentro da plataforma.</p>
                  <p><strong style={{color:C.txt}}>4. Base legal (LGPD — Lei 13.709/2018)</strong><br/>O tratamento é realizado com base no consentimento do titular (Art. 7º, I) e para execução do contrato de uso da plataforma (Art. 7º, V).</p>
                  <p><strong style={{color:C.txt}}>5. Compartilhamento</strong><br/>Seus dados não são vendidos ou compartilhados com terceiros. Utilizamos provedores de infraestrutura (Supabase, Vercel, Google Gemini) sob acordos de confidencialidade.</p>
                  <p><strong style={{color:C.txt}}>6. Seus direitos</strong><br/>Você pode solicitar acesso, correção, exclusão ou portabilidade dos seus dados a qualquer momento pelo e-mail: <strong>contato@conexia.app</strong>.</p>
                  <p><strong style={{color:C.txt}}>7. Retenção</strong><br/>Os dados são mantidos enquanto a conta estiver ativa. Após exclusão, os dados são removidos em até 30 dias.</p>
                  <p><strong style={{color:C.txt}}>8. Termos de Uso</strong><br/>O uso da plataforma é pessoal e intransferível. É vedado o uso para fins ilícitos, spam ou coleta de dados de terceiros sem consentimento.</p>
                </div>
                <button onClick={() => { setLgpd(true); setShowPrivacy(false); }} style={{ width:"100%", marginTop:16, background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer" }}>Li e aceito os termos</button>
              </div>
            </div>
          )}
          <Btn onClick={submit} disabled={busy || !email || pass.length < 6 || (mode === "signup" && !lgpd)} full>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</Btn>
        </div>
        <button onClick={() => window.history.back()} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", marginTop:14, display:"block", width:"100%", textAlign:"center" }}>← Voltar para a página inicial</button>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 8 }}>"Networking, além do cafezinho" · Rafael Milléo</p>
      </div>
    </div>
  );
}

/* ═══ ROOT ════════════════════════════════════════════════ */
function ProLock({ title = "Recurso disponível no PRO", desc = "Desbloqueie o CONÉXIA completo para transformar diagnóstico em ação prática.", cta = "Assinar PRO — R$ 39,90/mês", onKey }) {
  return (
    <div style={{ background:"#161618", border:"1px solid #2a2825", borderRadius:12, padding:24, textAlign:"center", margin:"8px 0" }}>
      <div style={{ fontSize:28, marginBottom:10 }}>🔒</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:"#e8e4da", marginBottom:6 }}>{title}</div>
      <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:"#6a6460", lineHeight:1.6, marginBottom:16, maxWidth:340, margin:"0 auto 16px" }}>{desc}</div>
      <a href={STRIPE_MENSAL} target="_blank" rel="noreferrer"
        style={{ display:"block", background:"#c9a227", color:"#0d0d0f", borderRadius:8, padding:"11px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, textDecoration:"none", marginBottom:10 }}>
        {cta}
      </a>
      {onKey && <button onClick={onKey}
        style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:"#5a5650", cursor:"pointer", textDecoration:"underline" }}>
        Tenho uma chave de acesso
      </button>}
    </div>
  );
}

function App() {
  const [state, setState]       = useState("loading"); // loading | landing | auth_signup | auth_login | onboard | assess | app
  const [splashDone, setSplashDone] = useState(false);
  const [splashShown, setSplashShown] = useState(false); // splash já foi exibida nesta sessão
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [assessment, setAssessment] = useState(null);
  const urlKey = new URLSearchParams(window.location.search).get("key") || "";
  const [pendingKey, setPendingKey] = useState(urlKey ? urlKey.toUpperCase() : "");
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);

  useEffect(() => {
    // Verificar sessão atual ao iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        setState("landing");   // Sem sessão → landing pública
      }
    });

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null); setProfile(null); setAssessment(null);
        localStorage.clear();
        setState("landing");
      }
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    const lsKey = "conexia_done_" + userId;
    try {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (p) p.name = p.name || p.first_name || "";
      setProfile(p);

      // Contas criadas antes da correção do registro de consentimento LGPD
      // não têm esse aceite gravado. Verifica e pede pra confirmar agora.
      try {
        const { data: consent } = await supabase.from("consent_logs").select("id").eq("user_id", userId).maybeSingle();
        if (!consent) setNeedsConsent(true);
      } catch { setNeedsConsent(true); }

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
    await new Promise(r => setTimeout(r, 300));
    await loadUserData(authUser.id);
  };

  const handleOnboard = async (form, voucherCode) => {
    if (voucherCode) setPendingKey(voucherCode);
    try {
      await supabase.from("profiles").upsert({
        id: user.id, first_name: form.name, name: form.name, email: form.email,
        role: form.role, company: form.company || null, segment: form.segment,
        state: form.state, city: form.city || null,
        whatsapp: normalizeWhatsapp(form.whatsapp),
        instagram: form.instagram || null,
        linkedin: form.linkedin || null,
        hobbies: form.hobbies || null,
        birthday: form.birthday || null,
        challenge: form.challenge || null,
        network_size: form.networkSize || null,
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
        event: "novo_assessment",
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
      const fullScores = { ...scores, profileKey: result.profileKey, profileName: result.profileName, overall: result.overall };
      const { error: insertError } = await supabase.from("assessments").insert({
        user_id: user.id,
        scores: fullScores,
        overall: result.overall,
      });
      if (insertError) console.error("[Assess] insert em assessments falhou:", insertError);

      const profileUpdate = {
        assessment_completed: true,
        onboarding_completed: true,
        last_assessment_at: new Date().toISOString(),
        overall_score: result.overall,
        profile_key: result.profileKey,
        profile_name: result.profileName,
        assessment_scores: fullScores,
      };
      const { error: updateError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
      if (updateError) {
        console.error("[Assess] update em profiles falhou, tentando novamente:", updateError);
        const { error: retryError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
        if (retryError) console.error("[Assess] retry do update em profiles falhou:", retryError);
      }
    } catch (e) { console.error("[Assess] excecao:", e); }
    sendToMake(result);
    setAssessment(result);
    setState("app");
    // Auto-aplicar chave pendente (de URL param ou onboarding)
    if (pendingKey && user?.id) {
      supabase.rpc("redeem_access_key", {
        p_code: pendingKey.toUpperCase().trim(),
        p_user_id: user.id,
        p_user_email: user?.email || "",
      }).then(({ data }) => {
        if (data?.ok) {
          loadUserData(user.id);
        }
      }).catch(() => {});
      setPendingKey("");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setAssessment(null);
    // onAuthStateChange disparará SIGNED_OUT e irá para landing
  };

  const acceptConsentNow = async () => {
    if (!user) return;
    setConsentBusy(true);
    try {
      await supabase.from("consent_logs").insert({
        user_id: user.id,
        email: user.email,
        name: profile?.name || "",
        accepted_at: new Date().toISOString(),
        user_agent: navigator.userAgent,
        version: "v1.0",
      });
      setNeedsConsent(false);
    } catch (e) {
      console.error("[Consent]", e);
    }
    setConsentBusy(false);
  };

  // Splash aparece imediatamente na primeira abertura, independente do estado de auth
  if (!splashShown) return <SplashScreen onDone={() => setSplashShown(true)} />;

  if (state === "loading") return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:44, height:44, borderRadius:11, background:`linear-gradient(135deg,${C.gold},${C.gB})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.bg }}>C</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:C.gold, letterSpacing:".06em" }}>CONÉXIA</div>
      <div style={{ width:32, height:2, borderRadius:1, background:C.gD, animation:"none", marginTop:4 }}/>
      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, letterSpacing:".08em" }}>Verificando acesso...</div>
    </div>
  );

  return (
    <>
      {needsConsent && user && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"85vh", overflowY:"auto" }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:"0 0 6px" }}>Atualizamos nossa Política de Privacidade</h2>
            <p style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:16, lineHeight:1.6 }}>Pra continuar usando o CONÉXIA, precisamos que você confirme sua ciência sobre o tratamento dos seus dados, conforme a LGPD.</p>
            <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, lineHeight:1.7, marginBottom:16 }}>
              <p><strong style={{color:C.txt}}>1. Responsável pelo tratamento</strong><br/>CONÉXIA, plataforma de inteligência relacional para profissionais do agronegócio.</p>
              <p><strong style={{color:C.txt}}>2. Dados coletados</strong><br/>Nome, e-mail, empresa, cargo, WhatsApp, LinkedIn, Instagram, cidade, estado, objetivos profissionais e histórico de interações com contatos.</p>
              <p><strong style={{color:C.txt}}>3. Finalidade</strong><br/>Personalizar os insights de inteligência relacional, gerar diagnósticos e recomendações dentro da plataforma.</p>
              <p><strong style={{color:C.txt}}>4. Base legal (LGPD — Lei 13.709/2018)</strong><br/>Consentimento do titular (Art. 7º, I) e execução do contrato de uso da plataforma (Art. 7º, V).</p>
              <p><strong style={{color:C.txt}}>5. Compartilhamento</strong><br/>Seus dados não são vendidos ou compartilhados com terceiros. Utilizamos provedores de infraestrutura (Supabase, Vercel, Google Gemini) sob acordos de confidencialidade.</p>
              <p><strong style={{color:C.txt}}>6. Seus direitos</strong><br/>Acesso, correção, exclusão ou portabilidade dos seus dados a qualquer momento: <strong>contato@conexia.app</strong>.</p>
            </div>
            <button onClick={acceptConsentNow} disabled={consentBusy} style={{ width:"100%", background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer" }}>{consentBusy ? "Aguarde..." : "Li e aceito"}</button>
          </div>
        </div>
      )}
      {state === "landing"      && <PublicLanding onSignup={() => setState("auth_signup")} onLogin={() => setState("auth_login")} urlKey={urlKey} />}
      {state === "auth_signup"  && <Auth onAuth={handleAuth} initialMode="signup" />}
      {state === "auth_login"   && <Auth onAuth={handleAuth} initialMode="login" />}
      {state === "onboard"      && user && <Onboard onDone={handleOnboard} initialKey={pendingKey} />}
      {state === "assess"       && user && <Assess profile={profile} onDone={handleAssess} />}
      {state === "app"          && user && <CRM profile={profile} assessment={assessment} onReset={handleLogout} user={user} />}
    </>
  );
}

export default App;
