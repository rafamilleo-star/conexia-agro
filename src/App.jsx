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
const STRIPE_MENSAL = "https://buy.stripe.com/test_7sY6oz7eW0u2dUu7HQ7g401";
const STRIPE_ANUAL  = "https://buy.stripe.com/test_eVq3cnar8gt06s29PY7g400";

/* ═══ CRM APP ═════════════════════════════════════════════ */
function CRM({ profile, assessment, onReset, user }) {
  const [view, setView] = useState("dash");
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cts, setCts] = useState([]);
  const [its, setIts] = useState([]);
  const [selId, setSelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(null);
  const [intCid, setIntCid] = useState(null);
  const [dbgMsg, setDbgMsg] = useState("");
  const [cf, setCf] = useState({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "", influenciaPessoas: "", geraOportunidade: "", abrePortas: "", momentoAtual: "" });
  const [inf, setInf] = useState({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });

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
        {cts.length > 0 && (() => {
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

  const UpgradeModal = () => (
    <Modal title="" onClose={() => setShowUpgrade(false)}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.gold, marginBottom: 4 }}>CONÉXIA PRO</div>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>Relatório completo, mapa mental e acesso ilimitado</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.txL, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Mensal</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.txt, lineHeight: 1 }}>R$50</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 16 }}>/mês</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 16, lineHeight: 1.5 }}>Cancele quando quiser</div>
          <button onClick={() => window.open(STRIPE_MENSAL, "_blank")} style={{ width: "100%", background: C.w06, border: `1px solid ${C.brd}`, color: C.txt, borderRadius: 8, padding: "10px 0", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Assinar mensal</button>
        </div>
        <div style={{ background: `${C.gold}10`, border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: 20, textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#0d0d0f", fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>2 meses grátis</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Anual</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.gold, lineHeight: 1 }}>R$500</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 4 }}>/ano · R$41,67/mês</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginBottom: 16, lineHeight: 1.5 }}>Economia de R$100 vs mensal</div>
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
    const isPro = profile?.is_pro || user?.email === "rafaelmilleo@yahoo.com.br" || user?.email === "rafamilleo@gmail.com";
    const downloadReport = () => {
      const nomePessoa = profile?.name || profile?.first_name ||
        (user?.email ? user.email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) : '') ||
        "Profissional";
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
.sq{display:flex;gap:8px;margin-bottom:7px;padding-bottom:7px;border-bottom:1px solid #f0ede8}
.sq:last-child{border-bottom:none;margin-bottom:0}
.sq-num{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#c9a227;background:#c9a22712;border:1px solid #c9a22730;min-width:24px;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sq-q{font-weight:600;font-size:8.5pt;color:#1a1a1a;margin-bottom:1px}
.sq-a{font-size:8pt;color:#555;line-height:1.5}

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
.gt-block{border-radius:3px;padding:9px 11px;margin-bottom:8px}
.gt-at{background:#f0faf0;border-left:2.5px solid #2e7d32}
.gt-bl{background:#fff5f5;border-left:2.5px solid #c62828}
.gt-title{font-size:8.5pt;font-weight:700;margin-bottom:3px}
.gt-desc{font-size:8pt;color:#444;line-height:1.5;margin-bottom:3px}
.gt-action{font-size:7.5pt;font-style:italic;color:#c9a227}

/* ── PLANO ── */
.week-box{display:grid;grid-template-columns:48px 1fr;border:1px solid #e0ddd8;border-radius:3px;overflow:hidden;margin-bottom:10px}
.week-num{background:#f9f7f3;border-right:1px solid #e0ddd8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px;gap:3px;font-size:18pt}
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
  <p style="font-size:8.5pt;color:#444;line-height:1.65;margin:0">${bot2[0]?`${bot2[0].label} baixo é o padrão clássico do profissional que confunde intenção com execução. A diferença entre quem constrói capital relacional real e quem acumula contatos está exatamente nessa dimensão.`:pf?.risks?.[1]||''}</p>
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

<!-- ════ P4: GATILHOS + PLANO ════════════════════════════════════════ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÓSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} · CONÉXIA</div>
</div>

<div class="lbl">Gatilhos Relacionais</div>
<div class="h1" style="margin-bottom:12px">Os padrões automáticos que ativam e travam o comportamento relacional</div>

<div class="g2" style="margin-bottom:18px">
  <div>
    <div style="font-size:8pt;font-weight:700;color:#2e7d32;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">⚡ Gatilhos de Ativação</div>
    ${DIMS.filter(d=>pct(d.key)>=65).slice(0,3).map(d=>`<div class="gt-block gt-at">
      <div class="gt-title" style="color:#2e7d32">${d.label} ${s10(d.key)}/10</div>
      <div class="gt-desc">${dimInterp[d.key]?.high?.split('.')[0]||''}</div>
      <div class="gt-action">→ Use este ponto forte para priorizar onde e com quem investir energia relacional.</div>
    </div>`).join('')}
  </div>
  <div>
    <div style="font-size:8pt;font-weight:700;color:#c62828;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">🔴 Gatilhos de Bloqueio</div>
    ${DIMS.filter(d=>pct(d.key)<70).slice(-3).map(d=>`<div class="gt-block gt-bl">
      <div class="gt-title" style="color:#c62828">${d.label} ${s10(d.key)}/10</div>
      <div class="gt-desc">${dimInterp[d.key]?.[getLvl(pct(d.key))]?.split('.')[0]||''}</div>
      <div class="gt-action">Antídoto: Implemente um sistema mínimo — intenção sem estrutura não vira hábito.</div>
    </div>`).join('')}
  </div>
</div>

<div class="lbl">Plano de Ativação — 4 Semanas</div>
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
                <span>0 — Nenhuma</span><span>5 — Moderada</span><span>10 — Alta</span>
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
