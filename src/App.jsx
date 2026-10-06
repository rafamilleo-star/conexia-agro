import { flushSync } from "react-dom";
import { AbaIA } from './components/AbaIA';
import HomeToday from './components/HomeToday';
import ConexiaLabHome from './components/ConexiaLabHome';
import ConexiaCircleNetwork from "./components/ConexiaCircleNetwork";
import ContactCircleField from "./components/ContactCircleField";
import ContactCircleAssignment from "./components/ContactCircleAssignment";
import useNetworkCircles from "./lib/useNetworkCircles";
import GuidedNetworkStart from './components/GuidedNetworkStart';
import { computePriorities, calculateRelevance as calculateRelevanceCanonical, relationshipMomentum } from '../shared/priorityEngine.js';
import { detectPatterns, PATTERN_NOTES } from '../shared/relationshipPatternDetector.js';
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { buildDimensionInsight } from "../shared/dimensionObservation.js";
import { supabase } from "./utils/supabase";
import { C, MOTION, TYPE, ADMIN_EMAIL, ENABLE_ADMIN_TOOLS, isAdmin } from "./utils/theme";
import { BRAND } from "./config/brand";
import { DIMS, QS, SEGMENTS, OBJECTIVES, UFS, CATS, ITYPES, SENTS } from "./data/constants";
import { buildTaskMicroresponse, buildMetaMicroresponse } from "./lib/evolutionCopy";
import DannaLive from "./lib/dannaLive";
import iconeDark from "./assets/brand/conexia_icone_fundo-escuro.svg";
import iconeTransp from "./assets/brand/conexia_icone_transparente.svg";
import logoTexto from "./assets/brand/conexia_logo_texto-dourado_fundo-transparente.webp";


/* âââ Logo Components âââââââââââââââââââââââââââââââââââ */
// Ãcone isolado (para splash, headers, favicons)
const ConexiaIcon = ({ size = 64, dark = true, style = {} }) => (
  <img
    src={dark ? iconeDark : iconeTransp}
    alt={BRAND.name}
    style={{ width: size, height: size, objectFit: 'contain', ...style }}
  />
);
// Logo completo com texto dourado (para landing, onboarding)
const ConexiaLogo = ({ height = 48, style = {} }) => (
  <img
    src={logoTexto}
    alt={`${BRAND.name} â DiagnÃ³stico Relacional`}
    style={{ height, objectFit: 'contain', ...style }}
  />
);


/* âââ Profiles ââââââââââââââââââââââââââââââââââââââââââ */
const PROFILES = {
  estrategista: { name: "O Estrategista", emoji: "ð¯", tagline: "VocÃª joga xadrez relacional.", desc: "VocÃª nÃ£o faz networking por acaso. Sabe exatamente quem precisa na sua rede, por quÃª, e cultiva com disciplina. Sua forÃ§a estÃ¡ na clareza de intenÃ§Ã£o combinada com consistÃªncia.", strengths: ["VisÃ£o estratÃ©gica de longo prazo", "Disciplina no follow-up", "Capacidade de priorizar relaÃ§Ãµes"], risks: ["Pode parecer transacional", "Subestima conexÃµes sem utilidade imediata"], actions: ["Liste 3 pessoas que mantÃ©m contato por obrigaÃ§Ã£o â existe algo genuÃ­no ali?", "Tenha 1 conversa sem agenda nas prÃ³ximas 2 semanas.", "Envie reconhecimento para alguÃ©m que te ajudou, sem pedir nada."] },
  influenciador: { name: "O Influenciador", emoji: "ð", tagline: "Onde vocÃª estÃ¡, as coisas acontecem.", desc: "PresenÃ§a de mercado e generosidade natural. As pessoas te procuram porque sabem que vocÃª conecta, indica e gera valor. Rede viva e diversa.", strengths: ["Alta visibilidade", "Generosidade natural", "ConfianÃ§a rÃ¡pida"], risks: ["Pode se sobrecarregar", "Rede ampla mas nem sempre profunda"], actions: ["Transforme 2 contatos superficiais em relaÃ§Ãµes profundas.", "Crie critÃ©rio claro para dizer nÃ£o sem culpa.", "Documente os 10 contatos que mais geram valor mÃºtuo."] },
  conector: { name: "O Conector", emoji: "ð", tagline: "VocÃª tece redes vivas.", desc: "Escuta de verdade e conecta A com B criando valor para ambos. ConfianÃ§a natural porque se importa genuinamente.", strengths: ["Escuta ativa genuÃ­na", "Conecta pessoas certas", "Alta reciprocidade"], risks: ["Falta de direcionamento estratÃ©gico", "Pode dar mais do que recebe"], actions: ["Liste 10 conexÃµes valiosas que fez para outros â peÃ§a algo para 3.", "Defina 3 objetivos para sua rede nos prÃ³ximos 90 dias.", "Para cada conexÃ£o: isso me aproxima de qual objetivo?"] },
  tecnico_invisivel: { name: "O TÃ©cnico InvisÃ­vel", emoji: "ð¬", tagline: "Competente demais para ser ignorado â mas Ã© o que acontece.", desc: "CompetÃªncia inquestionÃ¡vel. Mas sua rede nÃ£o sabe porque vocÃª nÃ£o aparece. ConfianÃ§a alta, presenÃ§a baixa.", strengths: ["CompetÃªncia reconhecida por quem convive", "Autenticidade", "RelaÃ§Ãµes profundas"], risks: ["Invisibilidade profissional", "Perde oportunidades"], actions: ["Participe de 1 evento do setor nos prÃ³ximos 30 dias.", "Publique 1 conteÃºdo tÃ©cnico no LinkedIn esta semana.", "PeÃ§a a 3 pessoas: me indica para uma conversa importante."] },
  relacional_intuitivo: { name: "O Relacional Intuitivo", emoji: "ð«", tagline: "VocÃª sente as pessoas. Falta transformar em sistema.", desc: "Dom natural para relaÃ§Ãµes, opera por intuiÃ§Ã£o. Quando a vida aperta, networking cai primeiro â porque nÃ£o tem estrutura.", strengths: ["InteligÃªncia emocional alta", "RelaÃ§Ãµes autÃªnticas", "ConfianÃ§a rÃ¡pida"], risks: ["Networking inconsistente", "Reativo â sÃ³ cultiva quando precisa"], actions: [`Configure o ${BRAND.name} com 10 contatos mais importantes.`, "Ritual semanal: toda segunda, escolha 2 pessoas para contatar.", "Escreva o que cada contato precisa. Envie algo relevante sem pedir nada."] },
  ativador_intermitente: { name: "O Ativador Intermitente", emoji: "â¡", tagline: "Quando ativa, Ã© poderoso. O problema Ã© que nem sempre ativa.", desc: "VisÃ£o e presenÃ§a. Mas a inconsistÃªncia faz sua rede nunca saber se pode contar com vocÃª.", strengths: ["Alta capacidade quando engajado", "Boa visÃ£o estratÃ©gica", "PresenÃ§a forte"], risks: ["InconsistÃªncia crÃ´nica", "Perde credibilidade pela oscilaÃ§Ã£o"], actions: ["Ative alertas para contatos com mais de 15 dias sem interaÃ§Ã£o.", "Comprometa-se com 3 interaÃ§Ãµes por semana.", "Agende networking como reuniÃ£o fixa no calendÃ¡rio."] },
  construtor_confianca: { name: "O Construtor de ConfianÃ§a", emoji: "ðï¸", tagline: "VocÃª constrÃ³i devagar, mas o que constrÃ³i nÃ£o cai.", desc: "Rede sÃ³lida. Cultiva com consistÃªncia e autenticidade. O que falta Ã© expandir.", strengths: ["Alta confiabilidade", "ConsistÃªncia no cultivo", "Autenticidade reconhecida"], risks: ["Rede pode ser pequena demais", "Dificuldade em expandir zona de conforto"], actions: ["Identifique 3 pessoas FORA do seu cÃ­rculo que seriam estratÃ©gicas.", "PeÃ§a a um aliado para te apresentar a alguÃ©m novo.", "Participe de 1 evento onde nÃ£o conhece ninguÃ©m."] },
  explorador_rede: { name: "O Explorador de Rede", emoji: "ð§­", tagline: "VocÃª estÃ¡ no comeÃ§o. E isso Ã© vantagem.", desc: `Sem padrÃ£o dominante â pode construir do zero, com mÃ©todo, sem vÃ­cios. O ${BRAND.name} serÃ¡ sua fundaÃ§Ã£o.`, strengths: ["Mente aberta", "Sem vÃ­cios de networking", "Alto potencial"], risks: ["Pode se sentir perdido", "Risco de desistir cedo"], actions: [`Liste 15 pessoas que importam â classifique cada uma no ${BRAND.name}.`, "Escolha 3 e envie mensagem genuÃ­na esta semana.", "Leia o capÃ­tulo 1 do livro e aplique 1 conceito."] },
};


const PLAN = [
  { week: 1, title: "Mapear contatos", icon: "ðºï¸", goal: "Construir a fundaÃ§Ã£o da sua rede.", tasks: ["Cadastre 10 contatos estratÃ©gicos", "Classifique cada um", "Defina frequÃªncia ideal", "Escreva notas sobre cada pessoa"], metric: "10 contatos cadastrados" },
  { week: 2, title: "Reativar relaÃ§Ãµes", icon: "ð", goal: "Reconectar com quem esfriou.", tasks: ["Identifique 3 contatos com menor health", "Envie mensagem genuÃ­na para cada um", `Registre cada interaÃ§Ã£o no ${BRAND.name}`], metric: "3 relaÃ§Ãµes reativadas" },
  { week: 3, title: "Gerar valor", icon: "ð", goal: "Dar antes de pedir.", tasks: ["Para cada contato-chave: o que posso oferecer?", "FaÃ§a 2 indicaÃ§Ãµes", "Compartilhe conteÃºdo com 3 contatos"], metric: "2 indicaÃ§Ãµes + 3 conteÃºdos" },
  { week: 4, title: "Criar sistema", icon: "âï¸", goal: "Transformar aÃ§Ã£o em hÃ¡bito.", tasks: ["Defina ritual semanal", "Configure alertas", "Defina 3 metas para 90 dias"], metric: "Ritual + metas documentadas" },
];


/* âââ Culturas Agro âââââââââââââââââââââââââââââââââââââ */
const MAIN_CULTURES = [
  { value: "soja",        label: "ð± Soja" },
  { value: "milho",       label: "ð½ Milho" },
  { value: "cafe",        label: "â CafÃ©" },
  { value: "algodao",     label: "ð¿ AlgodÃ£o" },
  { value: "cana",        label: "ð Cana-de-aÃ§Ãºcar" },
  { value: "trigo",       label: "ð¾ Trigo" },
  { value: "hortifruti",  label: "ð¥¦ Hortifruti" },
  { value: "pecuaria",    label: "ð PecuÃ¡ria" },
  { value: "citrus",      label: "ð Citrus" },
  { value: "cacau",       label: "ð« Cacau" },
  { value: "feijao",      label: "ð« FeijÃ£o" },
  { value: "arroz",       label: "ð Arroz" },
  { value: "outro",       label: "ð Outro" },
];


/* âââ Helpers âââââââââââââââââââââââââââââââââââââââââââ */
const dSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 999;
const hScore = (last, freq) => { const d = dSince(last); if (!last || d > freq * 3) return 0; return Math.max(0, Math.round((1 - d / (freq * 1.5)) * 100)); };
const fD = (d) => d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "â";
// Gera um arquivo .ics padrÃ£o (RFC 5545) â funciona igual em Outlook, Google Calendar
// e Apple Calendar, sem precisar de OAuth nem integraÃ§Ã£o com nenhuma API externa.
const buildICS = ({ title, description, location, start, durationMinutes }) => {
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
  const dtStart = new Date(start);
  const dtEnd = new Date(dtStart.getTime() + (durationMinutes || 30) * 60000);
  const esc = (s = "") => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CONEXIA//Agendamento//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.round(Math.random() * 1e6)}@conexia-agro`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dtStart)}`,
    `DTEND:${fmt(dtEnd)}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
};
const downloadICS = (ics, filename) => {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
// Normaliza WhatsApp para sempre incluir o cÃ³digo do paÃ­s 55 â formato que o bot do WhatsApp espera
const normalizeWhatsapp = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
};


// ââ RELEVANCE SCORE utils ââââââââââââââââââââââââââââââââââ
const calculateRelevanceScore = (c) => {
  // CÃ¡lculo delegado a shared/priorityEngine.js (fonte Ãºnica de verdade para
  // relevÃ¢ncia). Mantemos aqui apenas a regra de exibiÃ§Ã£o: sÃ³ mostrar um
  // valor quando os 4 campos estratÃ©gicos estiverem completos â do
  // contrÃ¡rio, a UI cai em "Dados incompletos", como sempre se comportou.
  const fields = [c.influenciaPessoas, c.geraOportunidade, c.abrePortas, c.momentoAtual];
  const valid = fields.filter(v => v !== null && v !== undefined && v !== "");
  if (valid.length < 4) return null;
  const nums = valid.map(Number);
  if (nums.some(isNaN)) return null;
  return calculateRelevanceCanonical(c);
};


const getRelevanceLabel = (rs) => {
  if (rs === null || rs === undefined) return null;
  if (rs >= 80) return "EstratÃ©gico";
  if (rs >= 60) return "Relevante";
  if (rs >= 40) return "Manter no radar";
  return "Sem prioridade agora";
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
    status: "Dados incompletos",
    msg: "Preencha os 4 critÃ©rios para entender melhor essa relaÃ§Ã£o.",
    color: "#5a5650"
  };
  if (health >= 70 && rs >= 70) return {
    status: "Presente e importante",
    msg: "Uma relaÃ§Ã£o presente e importante para o seu momento atual.",
    color: "#4caf50"
  };
  if (health < 70 && rs >= 70) return {
    status: "Talvez mereÃ§a atenÃ§Ã£o",
    msg: "Uma relaÃ§Ã£o importante para vocÃª, com pouco registro recente.",
    color: "#E8A020"
  };
  if (health >= 70 && rs < 70) return {
    status: "RelaÃ§Ã£o tranquila",
    msg: "Uma relaÃ§Ã£o presente, em um ritmo tranquilo.",
    color: "#ff9800"
  };
  return {
    status: "Sem prioridade agora",
    msg: "Nada que precise da sua atenÃ§Ã£o nesta relaÃ§Ã£o agora.",
    color: "#6a6460"
  };
};


const generateImmediateActionPlan = (sc) => {
  if (!sc) return null;
  const pct = (k) => sc[k] || 0;
  const low = Object.entries(sc).filter(([k,v]) => DIMS.find(d=>d.key===k) && v <= 60).sort((a,b)=>a[1]-b[1]);
  const dimActions = {
    presenca_mercado: {
      h48: "Escolha 3 pessoas estratÃ©gicas e retome o contato com mensagem personalizada ainda esta semana.",
      d7: ["FaÃ§a uma publicaÃ§Ã£o, comentÃ¡rio ou interaÃ§Ã£o pÃºblica ligada ao seu tema de atuaÃ§Ã£o.", "Marque uma conversa sem agenda comercial com alguÃ©m relevante para vocÃª agora."],
      d30: ["Crie uma cadÃªncia semanal de presenÃ§a: 1 conteÃºdo, 1 evento, 1 conversa por semana.", "Identifique 3 ambientes onde seu pÃºblico estÃ¡ e apareÃ§a com regularidade.", "Revise sua bio e perfil: eles comunicam claramente o que vocÃª entrega?"]
    },
    reciprocidade_ativa: {
      h48: "Envie algo Ãºtil para 3 contatos sem pedir nada em troca â um artigo, uma indicaÃ§Ã£o, um reconhecimento.",
      d7: ["FaÃ§a uma indicaÃ§Ã£o entre duas pessoas da sua rede que deveriam se conhecer.", "ReconheÃ§a publicamente ou em privado alguÃ©m que te ajudou recentemente."],
      d30: ["Crie o hÃ¡bito de gerar valor antes de pedir: analise cada contato e defina o que pode oferecer.", "FaÃ§a 2 indicaÃ§Ãµes por mÃªs â elas constroem a reputaÃ§Ã£o de quem conecta.", "Mantenha um registro simples de favores feitos e recebidos."]
    },
    escuta_relacional: {
      h48: "FaÃ§a uma conversa com o objetivo exclusivo de entender o momento do outro. Zero agenda prÃ³pria.",
      d7: ["Use uma pergunta aberta antes de falar sobre vocÃª em conversas importantes.", "Registre no cadastro do contato algo pessoal ou profissional que vocÃª aprendeu."],
      d30: ["Revise suas Ãºltimas 5 conversas: vocÃª ouviu mais do que falou?", "Adote a regra 70/30: 70% escutando, 30% falando em conversas estratÃ©gicas.", "Crie o hÃ¡bito de anotar o contexto do outro apÃ³s cada conversa relevante."]
    },
    intencao_estrategica: {
      h48: "Liste os 10 contatos mais importantes para seus prÃ³ximos 90 dias e defina por que cada um importa.",
      d7: ["Defina o objetivo relacional de cada contato-chave: o que quer construir com essa pessoa?", "Remova da lista de prioridade relaÃ§Ãµes que consomem energia sem conexÃ£o com seu momento."],
      d30: ["Crie um mapa mental da sua rede: quem vocÃª quer adicionar, manter e reduzir nos prÃ³ximos 90 dias.", "Revise sua estratÃ©gia relacional mensalmente â ela precisa acompanhar seus objetivos.", "Classifique seus contatos por relevÃ¢ncia para o que vocÃª estÃ¡ construindo agora."]
    },
    ritual_consistencia: {
      h48: "Defina uma prÃ³xima aÃ§Ã£o clara para seus 5 contatos mais importantes e cadastre no sistema.",
      d7: ["Crie um ritual semanal de 30 minutos para revisar sua rede â coloque no calendÃ¡rio agora.", "FaÃ§a follow-up em atÃ© 48h apÃ³s conversas relevantes: uma mensagem curta jÃ¡ basta."],
      d30: ["Configure alertas para contatos estratÃ©gicos que vocÃª nÃ£o pode deixar esfriar.", "Revise e atualize o CRM toda segunda-feira â 20 minutos mudam a qualidade da sua rede.", "Transforme intenÃ§Ã£o em sistema: sem ritual fixo, bons contatos somem da agenda."]
    },
    confianca_autentica: {
      h48: "FaÃ§a uma conversa sem pedir, vender ou apresentar nada. ApareÃ§a pelo outro, nÃ£o por vocÃª.",
      d7: ["Revise se suas interaÃ§Ãµes recentes estÃ£o muito transacionais â equilÃ­brio Ã© chave.", "Compartilhe uma percepÃ§Ã£o honesta e Ãºtil com alguÃ©m da sua rede."],
      d30: ["Analise a coerÃªncia entre o que vocÃª diz que faz e como vocÃª de fato se comporta nas relaÃ§Ãµes.", "Busque aprofundar 3 relaÃ§Ãµes: da superfÃ­cie para conversa real.", "Seja o mesmo em reuniÃµes formais e conversas informais â isso Ã© o que gera confianÃ§a duradoura."]
    }
  };
  const allHighPlan = {
    h48: "Escolha um contato estratÃ©gico e faÃ§a uma interaÃ§Ã£o de valor sem pedir nada em troca.",
    d7: ["Reative 3 contatos com alta relevÃ¢ncia e pouca presenÃ§a recente.", "Defina prÃ³xima aÃ§Ã£o para os 5 contatos mais importantes."],
    d30: ["Crie ritual semanal fixo de revisÃ£o da rede â 30 minutos toda segunda.", "Organize seus contatos por relevÃ¢ncia e defina prÃ³ximos passos claros.", "Transforme pelo menos 3 contatos em relaÃ§Ãµes com continuidade clara."]
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


/* âââ UI Components âââââââââââââââââââââââââââââââââââââ */
function Btn({ children, onClick, variant = "primary", disabled, small, full }) {
  const base = { fontFamily: "'DM Sans',sans-serif", fontSize: small ? 12 : 15, fontWeight: 600, border: "none", borderRadius: 8, cursor: disabled ? "default" : "pointer", padding: small ? "8px 16px" : "14px 28px", transition: `all ${MOTION.fast}`, opacity: disabled ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, width: full ? "100%" : "auto" };
  const v = { primary: { color: C.bg, background: `linear-gradient(135deg,${C.gold},${C.gB})` }, secondary: { color: C.txt, background: C.w06 }, ghost: { color: C.txM, background: "transparent" }, danger: { color: C.cor, background: C.corD }, success: { color: C.grn, background: C.grnD } };
  return <button onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant] }}>{children}</button>;
}


function Inp({ label, value, onChange, placeholder, type = "text", textarea }) {
  const [showPass, setShowPass] = useState(false);
  const isPassword = type === "password";
  const s = { width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 8, padding: isPassword ? "12px 42px 12px 14px" : "12px 14px", fontFamily: "'DM Sans'", fontSize: 14, color: C.txt, outline: "none" };
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>{label}</label>}
      {textarea ? (
        <textarea value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...s, resize: "vertical" }} />
      ) : isPassword ? (
        <div style={{ position: "relative" }}>
          <input type={showPass ? "text" : "password"} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", color: C.txL, fontSize: 16, lineHeight: 1 }}
          >
            {showPass ? "ð" : "ðï¸"}
          </button>
        </div>
      ) : (
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
      )}
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
        <div style={{ height: h, borderRadius: h, background: cl, width: `${score}%`, transition: `width ${MOTION.slow}` }} />
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
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.txL, fontSize: 22, cursor: "pointer" }}>Ã</button>
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


/* âââ TENDÃNCIA DE EQUIPE (LINHA) âââââââââââââââââââââââââââââ
   % da equipe evoluindo, semana a semana. JÃ¡ vem filtrado (>=3 pessoas
   por semana) pela function get_org_team_trend â aqui Ã© sÃ³ desenhar.
   Tooltip no hover mostra o valor exato + quantas pessoas contribuÃ­ram
   pro nÃºmero daquela semana. */
function TeamTrendChart({ data, width = 640, height = 170 }) {
  const [hover, setHover] = useState(null);
  if (!data || data.length < 2) return null;
  const pad = { l: 32, r: 16, t: 16, b: 24 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const x = (i) => pad.l + (w * i) / (data.length - 1);
  const y = (v) => pad.t + h - (h * v) / 100;
  const linePts = data.map((d, i) => `${x(i)},${y(d.pct_evoluindo)}`).join(" ");
  const areaPts = `${x(0)},${y(0)} ${linePts} ${x(data.length - 1)},${y(0)}`;
  const nearestIndex = (mouseX) => {
    let best = 0, bestDist = Infinity;
    data.forEach((_, i) => { const d = Math.abs(x(i) - mouseX); if (d < bestDist) { bestDist = d; best = i; } });
    return best;
  };
  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = ((e.clientX - rect.left) / rect.width) * width;
          setHover(nearestIndex(mouseX));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} y1={y(v)} x2={width - pad.r} y2={y(v)} stroke={C.brd} strokeWidth={0.5} opacity={0.5} />
            <text x={pad.l - 8} y={y(v)} textAnchor="end" dominantBaseline="middle" fill={C.txL} fontSize={9} fontFamily="'DM Sans'">{v}%</text>
          </g>
        ))}
        <polygon points={areaPts} fill={`${C.grn}15`} />
        <polyline points={linePts} fill="none" stroke={C.grn} strokeWidth={2} />
        {data.map((d, i) => (
          <g key={i}>
            {hover === i && <line x1={x(i)} y1={pad.t} x2={x(i)} y2={pad.t + h} stroke={C.txL} strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />}
            <circle cx={x(i)} cy={y(d.pct_evoluindo)} r={hover === i ? 5 : 3.5} fill={C.grn} stroke={C.bg} strokeWidth={1.5} />
            {hover !== i && <text x={x(i)} y={y(d.pct_evoluindo) - 10} textAnchor="middle" fill={C.txt} fontSize={10} fontWeight={600} fontFamily="'DM Sans'">{d.pct_evoluindo}%</text>}
            <text x={x(i)} y={height - 6} textAnchor="middle" fill={hover === i ? C.txt : C.txL} fontSize={9} fontFamily="'DM Sans'">Sem {d.week}</text>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div style={{
          position: "absolute", left: `${(x(hover) / width) * 100}%`, top: 4, transform: "translateX(-50%)",
          background: C.bg, border: `1px solid ${C.brdH}`, borderRadius: 8, padding: "6px 10px", pointerEvents: "none",
          fontFamily: "'DM Sans'", fontSize: 11, color: C.txt, whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,.4)",
        }}>
          <div style={{ fontWeight: 700 }}>Semana {data[hover].week} Â· {data[hover].pct_evoluindo}% evoluindo</div>
          <div style={{ color: C.txL, marginTop: 2 }}>{data[hover].member_count} pessoas com dado nessa semana</div>
        </div>
      )}
    </div>
  );
}


/* âââ RADAR CATEGÃRICO DE EQUIPE ââââââââââââââââââââââââââââââ
   Mesma geometria hexagonal do RadarChart acima, mas sem nÃºmero de
   desempenho: cada eixo vai pra 1 de 3 raios fixos conforme o estado
   categÃ³rico (Evoluindo/EstÃ¡vel/Perdendo/Sem dados). Cor por ESTADO
   (verde/Ã¢mbar/vermelho/cinza), nÃ£o por dimensÃ£o â o que importa aqui Ã©
   "onde a equipe estÃ¡ indo bem ou mal", nÃ£o a identidade da dimensÃ£o. */
const TEAM_STATE_RADIUS = { evoluindo: 100, estavel: 60, perdendo_intensidade: 30 };
const TEAM_STATE_COLOR = { evoluindo: C.grn, estavel: C.amb, perdendo_intensidade: C.cor, sem_dados: C.txL };
function TeamDimensionRadar({ observation, size = 128 }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 22;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI / 6) * i; const d = r * (v / 100); return [cx + d * Math.cos(a), cy + d * Math.sin(a)]; };
  const states = DIMS.map(d => observation?.[d.key]?.state);
  const vals = states.map(s => TEAM_STATE_RADIUS[s] ?? 6);
  const poly = vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: "100%", maxWidth: size, flexShrink: 0 }}>
      {[33, 66, 100].map(v => <polygon key={v} points={Array.from({ length: 6 }, (_, i) => pt(i, v).join(",")).join(" ")} fill="none" stroke={C.brd} strokeWidth={0.5} opacity={0.5} />)}
      {vals.map((_, i) => { const [x, y] = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={C.brd} strokeWidth={0.5} opacity={0.3} />; })}
      <polygon points={poly} fill={`${C.gold}12`} stroke={C.gold} strokeWidth={1.5} />
      {vals.map((v, i) => <circle key={i} cx={pt(i, v)[0]} cy={pt(i, v)[1]} r={3.5} fill={TEAM_STATE_COLOR[states[i]] || C.txL} stroke={C.bg} strokeWidth={1.5} />)}
      {DIMS.map((d, i) => { const [x, y] = pt(i, 118); return <text key={`l${i}`} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill={C.txL} fontSize={8} fontWeight={600} fontFamily="'DM Sans'">{d.short}</text>; })}
    </svg>
  );
}


/* âââ WELCOME âââââââââââââââââââââââââââââââââââââââââââââ */
/* âââ ONBOARDING ââââââââââââââââââââââââââââââââââââââââââ */
function Onboard({ onDone, initialKey = "", authEmail = "", authName = "" }) {
  const initialName = String(authName || "").trim();
  const [phase, setPhase] = useState("intro"); // intro | interview | review
  const [questionIndex, setQuestionIndex] = useState(0);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processingAnswer, setProcessingAnswer] = useState(false);
  const [heard, setHeard] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [useText, setUseText] = useState(false);
  const [error, setError] = useState("");
  const [voucher, setVoucher] = useState(initialKey || "");
  const recognitionRef = useRef(null);
  const processingRef = useRef(false);

  const [form, setForm] = useState({
    name: initialName,
    email: authEmail || "",
    role: "",
    company: "",
    segment: "",
    state: "",
    city: "",
    whatsapp: "",
    instagram: "",
    linkedin: "",
    hobbies: "",
    birthday: "",
    objectives: [],
    challenge: "",
    networkSize: "",
  });

  const normalizeAnswer = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const segmentFromSpeech = (value) => {
    const n = normalizeAnswer(value);
    if (!n) return "outros";
    if (/(agro|agric|fazenda|rural|sement|defensiv|fertiliz|pecuar)/.test(n)) return "agronegocio";
    if (/(tecnolog|software|saas|ti|digital|dados|inteligencia artificial|ia\b)/.test(n)) return "tecnologia";
    if (/(financ|banco|invest|credito|seguros)/.test(n)) return "financas";
    if (/(saude|medic|hospital|clinica|farmac)/.test(n)) return "saude";
    if (/(educa|univers|escola|ensino|treinamento)/.test(n)) return "educacao";
    if (/(varejo|consumo|loja|retail)/.test(n)) return "varejo";
    if (/(industr|fabrica|manufat)/.test(n)) return "industria";
    if (/(construc|engenharia civil|imobili)/.test(n)) return "construcao";
    if (/(consult|assessoria)/.test(n)) return "consultoria";
    if (/(jurid|advoc|direito)/.test(n)) return "juridico";
    if (/(marketing|comunic|publicidade|midia)/.test(n)) return "marketing";
    if (/(rh|recursos humanos|gente|talentos)/.test(n)) return "rh";
    if (/(logistic|supply|transport)/.test(n)) return "logistica";
    if (/(energia|eletric|solar|petroleo|gas)/.test(n)) return "energia";
    return "outros";
  };

  const objectiveFromSpeech = (value) => {
    const n = normalizeAnswer(value);
    if (/(cliente|venda|comercial|negocio)/.test(n)) return "novos_clientes";
    if (/(oportunidade|crescer|crescimento|carreira)/.test(n)) return "oportunidades";
    if (/(parceria|parceiro|alianca)/.test(n)) return "parcerias";
    if (/(aprender|conhecimento|especialista)/.test(n)) return "conhecimento";
    if (/(visibilidade|marca pessoal|ser conhecido|presenca)/.test(n)) return "visibilidade";
    if (/(mentor|mentoria)/.test(n)) return "mentoria";
    if (/(talento|contratar|equipe)/.test(n)) return "talentos";
    if (/(investidor|investimento|capital)/.test(n)) return "investidores";
    if (/(recoloc|emprego|vaga|nova posicao)/.test(n)) return "recolocacao";
    if (/(comunidade|grupo|rede)/.test(n)) return "comunidade";
    return "oportunidades";
  };

  // O nome jÃ¡ vem da criaÃ§Ã£o da conta. SÃ³ perguntamos novamente em contas
  // antigas onde ele nÃ£o esteja disponÃ­vel.
  const questions = [
    ...(!initialName ? [{
      key: "name",
      prompt: "Antes de tudo, como vocÃª prefere que eu te chame?",
    }] : []),
    {
      key: "company",
      prompt: "Qual empresa faz parte do seu momento hoje?",
    },
    {
      key: "role",
      prompt: "E qual Ã© o seu cargo ou funÃ§Ã£o principal?",
    },
    {
      key: "segment",
      prompt: "Em que setor vocÃª atua hoje?",
    },
    {
      key: "objective",
      prompt: "O que vocÃª mais quer que o CONÃXIA te ajude a construir agora?",
    },
  ];

  const currentQuestion = questions[questionIndex];

  const firstNameForVoice = String(form.name || initialName || "")
    .trim()
    .split(/\s+/)[0] || "";

  const chooseVoice = () => {
    if (!("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const score = (voice) => {
      const name = normalizeAnswer(voice?.name);
      const lang = normalizeAnswer(voice?.lang);
      let s = lang === "pt-br" ? 100 : lang.startsWith("pt") ? 60 : -100;
      if (name.includes("google")) s += 30;
      if (name.includes("microsoft")) s += 25;
      if (name.includes("natural")) s += 25;
      if (name.includes("neural")) s += 25;
      if (/(compact|robot|child|espeak|festival)/.test(name)) s -= 50;
      return s;
    };
    return [...voices].sort((a,b) => score(b) - score(a))[0] || null;
  };

  const speak = (value, after) => {
    const line = String(value || "").trim();
    if (!line || !("speechSynthesis" in window)) {
      after?.();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const u = new SpeechSynthesisUtterance(line);
      const voice = chooseVoice();
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang || "pt-BR";
      } else {
        u.lang = "pt-BR";
      }
      u.rate = 1.08;
      u.pitch = 1.01;
      u.volume = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => {
        setSpeaking(false);
        after?.();
      };
      u.onerror = () => {
        setSpeaking(false);
        after?.();
      };
      setTimeout(() => window.speechSynthesis.speak(u), 20);
    } catch {
      setSpeaking(false);
      after?.();
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
  };

  useEffect(() => {
    return () => {
      stopListening();
      try { window.speechSynthesis?.cancel(); } catch {}
    };
  }, []);

  const parseModelJson = (raw) => {
    const source = String(raw || "");
    const match = source.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  };

  const fallbackInterpretation = (question, value) => {
    const clean = String(value || "").trim();
    if (!clean) {
      return {
        intent: "clarify",
        confidence: "low",
        accepted: false,
        reply: "NÃ£o consegui entender sua resposta. Me conta de outro jeito.",
        value: null,
        normalizedValue: null,
      };
    }

    if (question.key === "segment") {
      return {
        intent: "answer",
        confidence: "medium",
        accepted: true,
        reply: "Entendi.",
        value: clean,
        normalizedValue: segmentFromSpeech(clean),
      };
    }

    if (question.key === "objective") {
      return {
        intent: "answer",
        confidence: "medium",
        accepted: true,
        reply: "Entendi.",
        value: clean,
        normalizedValue: objectiveFromSpeech(clean),
      };
    }

    return {
      intent: "answer",
      confidence: "medium",
      accepted: true,
      reply: "Entendi.",
      value: clean,
      normalizedValue: null,
    };
  };

  // A Danna nÃ£o trata qualquer fala como se fosse automaticamente uma resposta.
  // Ela distingue resposta, pedido de explicaÃ§Ã£o, recusa/pular e fala fora de
  // contexto. SÃ³ avanÃ§a sem confirmaÃ§Ã£o quando hÃ¡ confianÃ§a suficiente.
  const interpretAnswer = async (question, value) => {
    const allowedSegments = SEGMENTS.map(s => s.value);
    const allowedObjectives = OBJECTIVES.map(o => o.value);

    const prompt = `
VocÃª Ã© DANNA, a voz de onboarding do CONÃXIA, uma plataforma de inteligÃªncia relacional.

Seu trabalho Ã© interpretar UMA fala do usuÃ¡rio dentro de UMA pergunta de cadastro.
VocÃª deve funcionar bem independentemente do que o usuÃ¡rio disser: resposta direta,
frase longa, dÃºvida, pedido de explicaÃ§Ã£o, correÃ§Ã£o, recusa, brincadeira ou algo sem relaÃ§Ã£o.

CONTEXTO JÃ CAPTURADO:
${JSON.stringify({
  name: form.name || null,
  company: form.company || null,
  role: form.role || null,
  segment: form.segment || null,
  objective: form.objectives?.[0] || null,
})}

PERGUNTA ATUAL:
${question.prompt}

CAMPO ESPERADO:
${question.key}

FALA DO USUÃRIO:
${value}

VALORES VÃLIDOS PARA segment:
${JSON.stringify(allowedSegments)}

VALORES VÃLIDOS PARA objective:
${JSON.stringify(allowedObjectives)}

REGRAS:
- nunca invente informaÃ§Ã£o;
- se a fala responder claramente, intent="answer";
- se o usuÃ¡rio pedir explicaÃ§Ã£o ("por quÃª?", "o que quer dizer?", "nÃ£o entendi"),
  intent="clarify" e responda a dÃºvida de modo curto, terminando de forma que ele possa responder;
- se disser que prefere nÃ£o responder, intent="skip";
- se for irrelevante ou impossÃ­vel extrair com seguranÃ§a, intent="other";
- confidence deve ser "high", "medium" ou "low";
- accepted=true somente quando vocÃª pode armazenar o dado com seguranÃ§a;
- para company, role e name, "value" deve conter apenas o dado limpo extraÃ­do,
  nÃ£o a frase inteira;
- para segment, normalizedValue deve ser exatamente um valor da lista de segmentos;
- para objective, normalizedValue deve ser exatamente um valor da lista de objetivos;
- se nÃ£o houver base suficiente para normalizar, confidence="low" e accepted=false;
- reply Ã© o que DANNA vai FALAR. Deve soar humana, curta e especÃ­fica.
- NÃ£o bajule. NÃ£o diga "perfeito", "sensacional", "incrÃ­vel" a cada resposta.
- Para uma resposta aceita, reconheÃ§a em no mÃ¡ximo 12 palavras.
- NÃ£o repita o que o usuÃ¡rio disse inteiro.
- Para clarify/other/baixa confianÃ§a, explique ou faÃ§a UMA pergunta curta de esclarecimento.
- NÃ£o fale sobre tecnologia, modelo, JSON ou classificaÃ§Ã£o.

Responda SOMENTE JSON vÃ¡lido:
{
  "intent":"answer|clarify|skip|other",
  "confidence":"high|medium|low",
  "accepted":true,
  "reply":"frase curta da Danna",
  "value":"valor extraÃ­do ou null",
  "normalizedValue":"valor normalizado ou null"
}
`.trim();

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          maxTokens: 350,
          temperature: 0.15,
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

      const parsed = parseModelJson(data.content?.[0]?.text || "");
      if (!parsed) throw new Error("Resposta nÃ£o estruturada.");

      return {
        intent: parsed.intent || "other",
        confidence: parsed.confidence || "low",
        accepted: parsed.accepted === true,
        reply: String(parsed.reply || "").trim() || "Me conta de outro jeito.",
        value: parsed.value == null ? null : String(parsed.value).trim(),
        normalizedValue:
          parsed.normalizedValue == null
            ? null
            : String(parsed.normalizedValue).trim(),
      };
    } catch (e) {
      console.warn("[Danna onboarding] fallback de interpretaÃ§Ã£o:", e);
      return fallbackInterpretation(question, value);
    }
  };

  const applyInterpretedAnswer = (question, result, originalValue) => {
    const raw = String(result?.value || originalValue || "").trim();

    if (question.key === "name") {
      setForm(p => ({ ...p, name: raw }));
      return;
    }

    if (question.key === "company") {
      setForm(p => ({ ...p, company: raw }));
      return;
    }

    if (question.key === "role") {
      setForm(p => ({ ...p, role: raw }));
      return;
    }

    if (question.key === "segment") {
      const allowed = new Set(SEGMENTS.map(s => s.value));
      const normalized =
        allowed.has(result?.normalizedValue)
          ? result.normalizedValue
          : segmentFromSpeech(originalValue);
      setForm(p => ({ ...p, segment: normalized }));
      return;
    }

    if (question.key === "objective") {
      const allowed = new Set(OBJECTIVES.map(o => o.value));
      const normalized =
        allowed.has(result?.normalizedValue)
          ? result.normalizedValue
          : objectiveFromSpeech(originalValue);
      setForm(p => ({ ...p, objectives: [normalized] }));
    }
  };

  const advanceAfterAcceptedAnswer = (reply) => {
    setHeard("");
    setTextAnswer("");
    setUseText(false);
    setError("");

    if (questionIndex >= questions.length - 1) {
      setPhase("review");
      speak(
        `${reply ? `${reply} ` : ""}Pronto. Eu organizei o essencial. Confere se estÃ¡ tudo certo.`
      );
      return;
    }

    const next = questionIndex + 1;
    setQuestionIndex(next);

    speak(
      reply || "Entendi.",
      () => setTimeout(() => speak(questions[next].prompt, beginListening), 60)
    );
  };

  const processAnswer = async (value) => {
    const clean = String(value || "").trim();
    if (!clean || !currentQuestion || processingRef.current) return;

    processingRef.current = true;
    setProcessingAnswer(true);
    setError("");
    stopListening();

    try {
      const result = await interpretAnswer(currentQuestion, clean);

      if (result.intent === "skip") {
        const skippable = ["company", "segment", "objective"].includes(currentQuestion.key);

        if (!skippable) {
          const msg = result.reply || "Essa informaÃ§Ã£o Ã© importante para eu comeÃ§ar. Como vocÃª descreveria isso?";
          setError(msg);
          speak(msg, () => setTimeout(beginListening, 100));
          return;
        }

        if (currentQuestion.key === "segment") {
          setForm(p => ({ ...p, segment: "outros" }));
        }
        if (currentQuestion.key === "objective") {
          setForm(p => ({ ...p, objectives: ["oportunidades"] }));
        }

        advanceAfterAcceptedAnswer(result.reply || "Tudo bem, seguimos.");
        return;
      }

      const confidentEnough =
        result.accepted &&
        (result.confidence === "high" || result.confidence === "medium");

      if (!confidentEnough || result.intent !== "answer") {
        const msg =
          result.reply ||
          "NÃ£o quero presumir. Me conta isso de outro jeito.";
        setError(msg);
        setHeard(clean);
        speak(msg, () => setTimeout(beginListening, 100));
        return;
      }

      applyInterpretedAnswer(currentQuestion, result, clean);
      advanceAfterAcceptedAnswer(result.reply);
    } finally {
      processingRef.current = false;
      setProcessingAnswer(false);
    }
  };

  const beginListening = () => {
    if (processingRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setUseText(true);
      setError("Seu navegador nÃ£o liberou reconhecimento de voz. VocÃª pode responder por texto.");
      return;
    }

    setError("");
    setHeard("");
    setTextAnswer("");

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;

    rec.onstart = () => setListening(true);

    rec.onresult = (event) => {
      let finalText = "";
      let interim = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += `${t} `;
        else interim += `${t} `;
      }

      const value = (finalText || interim).trim();
      setHeard(value);

      if (finalText.trim()) {
        const finalValue = finalText.trim();
        setTextAnswer(finalValue);
        setTimeout(() => processAnswer(finalValue), 40);
      }
    };

    rec.onerror = (e) => {
      recognitionRef.current = null;
      setListening(false);
      if (e?.error !== "aborted" && e?.error !== "no-speech") {
        setError("NÃ£o entendi bem. VocÃª pode tentar de novo ou responder por texto.");
      }
    };

    rec.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    try {
      rec.start();
    } catch {
      setUseText(true);
      setError("NÃ£o consegui abrir o microfone. Responda por texto.");
    }
  };

  const askCurrentQuestion = () => {
    if (!currentQuestion || processingAnswer) return;
    speak(currentQuestion.prompt, beginListening);
  };

  const startInterview = () => {
    setPhase("interview");
    setQuestionIndex(0);
    setError("");
    setUseText(false);

    const intro =
      firstNameForVoice
        ? `${firstNameForVoice}, eu sou a Danna, a voz do CONÃXIA. Vou te fazer algumas perguntas rÃ¡pidas e organizar tudo para vocÃª.`
        : "Eu sou a Danna, a voz do CONÃXIA. Vou te fazer algumas perguntas rÃ¡pidas e organizar tudo para vocÃª.";

    setTimeout(() => {
      speak(
        intro,
        () => speak(questions[0].prompt, beginListening)
      );
    }, 120);
  };

  const submitTypedAnswer = () => {
    const value = String(textAnswer || heard || "").trim();
    if (!value) {
      setError("Me diga uma resposta antes de continuar.");
      return;
    }
    void processAnswer(value);
  };

  const updateField = (key, value) => {
    setForm(p => ({ ...p, [key]: value }));
  };

  const finish = () => {
    const ready = {
      ...form,
      email: form.email || authEmail || "",
      name: form.name.trim(),
      company: form.company.trim(),
      role: form.role.trim(),
      segment: form.segment || "outros",
      objectives: form.objectives?.length ? form.objectives : ["oportunidades"],
    };

    if (!ready.name || !ready.role) {
      setError("Nome e funÃ§Ã£o sÃ£o necessÃ¡rios para comeÃ§ar.");
      return;
    }

    onDone(ready, voucher.trim());
  };

  if (phase === "intro") {
    return (
      <div style={{
        minHeight: "100dvh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 22,
      }}>
        <div style={{
          width: "100%",
          maxWidth: 440,
          textAlign: "center",
        }}>
          <ConexiaIcon size={92} dark={false} style={{ margin: "0 auto 24px", display: "block" }} />
          <Tag>Primeiro contato</Tag>
          <h2 style={{
            fontFamily: "'Cormorant Garamond',serif",
            fontSize: 31,
            color: C.txt,
            margin: "14px 0 8px",
            lineHeight: 1.08,
          }}>
            {firstNameForVoice ? `${firstNameForVoice}, vamos comeÃ§ar conversando.` : "Vamos comeÃ§ar conversando."}
          </h2>
          <p style={{
            fontFamily: "'DM Sans'",
            fontSize: 13,
            color: C.txM,
            lineHeight: 1.65,
            margin: "0 auto 22px",
            maxWidth: 360,
          }}>
            A Danna conversa com vocÃª, interpreta as respostas e organiza o essencial. Se algo nÃ£o estiver claro, ela pergunta antes de salvar.
          </p>
          <Btn full onClick={startInterview}>ComeÃ§ar conversa</Btn>
        </div>
      </div>
    );
  }

  if (phase === "interview") {
    return (
      <div style={{
        minHeight: "100dvh",
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}>
        <div style={{
          width: "100%",
          maxWidth: 520,
          background: C.card,
          border: `1px solid ${C.brd}`,
          borderRadius: 22,
          padding: "24px 20px",
          boxShadow: "0 18px 48px rgba(0,0,0,.24)",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}>
            <div>
              <div style={{
                fontFamily: "'DM Sans'",
                color: C.gold,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".12em",
                textTransform: "uppercase",
              }}>
                DANNA Â· PRIMEIRO CONTATO
              </div>
              <div style={{
                fontFamily: "'DM Sans'",
                color: C.txL,
                fontSize: 11,
                marginTop: 4,
              }}>
                {questionIndex + 1} de {questions.length}
              </div>
            </div>

            <div style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              border: `1px solid ${C.gL}`,
              display: "grid",
              placeItems: "center",
              background: C.gD,
            }}>
              <ConexiaIcon size={28} dark={false} />
            </div>
          </div>

          <div style={{
            fontFamily: "'Cormorant Garamond',serif",
            color: C.txt,
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.15,
            marginBottom: 18,
          }}>
            {currentQuestion?.prompt}
          </div>

          <button
            onClick={() => {
              if (processingAnswer || speaking) return;
              if (listening) stopListening();
              else askCurrentQuestion();
            }}
            style={{
              width: 118,
              height: 118,
              borderRadius: "50%",
              margin: "0 auto 14px",
              display: "grid",
              placeItems: "center",
              border: `1px solid ${listening ? C.gold : C.brd}`,
              background: listening ? `${C.gold}12` : C.sf,
              color: listening ? C.gold : C.txM,
              cursor: processingAnswer ? "wait" : "pointer",
              boxShadow: listening ? `0 0 0 10px ${C.gold}08` : "none",
              opacity: processingAnswer ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: 28 }}>
              {processingAnswer ? "â" : listening ? "â" : speaking ? "â" : "â"}
            </span>
          </button>

          <div style={{
            textAlign: "center",
            fontFamily: "'DM Sans'",
            fontSize: 11,
            color: C.txL,
            marginBottom: 16,
          }}>
            {processingAnswer
              ? "Danna entendendo sua resposta..."
              : speaking
                ? "Danna falando..."
                : listening
                  ? "Ouvindo..."
                  : "Toque no cÃ­rculo para responder"}
          </div>

          {(heard || useText) && (
            <div style={{
              background: C.sf,
              border: `1px solid ${C.brd}`,
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}>
              <textarea
                value={textAnswer || heard}
                onChange={(e) => {
                  setTextAnswer(e.target.value);
                  setHeard("");
                }}
                placeholder="Sua resposta..."
                rows={3}
                disabled={processingAnswer}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: C.txt,
                  resize: "vertical",
                  fontFamily: "'DM Sans'",
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              />
            </div>
          )}

          {error && (
            <div style={{
              fontFamily: "'DM Sans'",
              color: C.cor,
              fontSize: 11,
              lineHeight: 1.5,
              marginBottom: 10,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn
              variant="ghost"
              onClick={() => setUseText(true)}
              disabled={processingAnswer}
            >
              Escrever
            </Btn>

            {useText && (
              <Btn
                onClick={submitTypedAnswer}
                disabled={
                  processingAnswer ||
                  !String(textAnswer || heard || "").trim()
                }
              >
                Enviar
              </Btn>
            )}
          </div>

          <div style={{
            marginTop: 13,
            fontFamily: "'DM Sans'",
            fontSize: 10.5,
            color: C.txL,
            lineHeight: 1.5,
          }}>
            Respostas claras avanÃ§am automaticamente. Se a Danna tiver dÃºvida, ela pergunta antes de continuar.
          </div>
        </div>
      </div>
    );
  }

  const objectiveLabel =
    OBJECTIVES.find(o => o.value === form.objectives?.[0])?.label ||
    "Encontrar oportunidades";

  const segmentLabel =
    SEGMENTS.find(s => s.value === form.segment)?.label ||
    "Outros";

  return (
    <div style={{
      minHeight: "100dvh",
      background: C.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <div style={{
        width: "100%",
        maxWidth: 520,
        background: C.card,
        border: `1px solid ${C.brd}`,
        borderRadius: 22,
        padding: 22,
      }}>
        <Tag>ConfirmaÃ§Ã£o</Tag>

        <h2 style={{
          fontFamily: "'Cormorant Garamond',serif",
          fontSize: 29,
          color: C.txt,
          margin: "12px 0 6px",
        }}>
          Foi isso que eu entendi.
        </h2>

        <p style={{
          fontFamily: "'DM Sans'",
          color: C.txM,
          fontSize: 12.5,
          lineHeight: 1.55,
          margin: "0 0 18px",
        }}>
          A Danna jÃ¡ organizou as respostas. Ajuste qualquer coisa antes de continuarmos.
        </p>

        <Inp label="Como devo te chamar" value={form.name} onChange={v => updateField("name", v)} />
        <Inp label="Empresa" value={form.company} onChange={v => updateField("company", v)} />
        <Inp label="Cargo / funÃ§Ã£o" value={form.role} onChange={v => updateField("role", v)} />

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: "'DM Sans'",
            fontSize: 11,
            fontWeight: 600,
            color: C.txM,
            marginBottom: 6,
          }}>
            Setor entendido
          </div>
          <select
            value={form.segment || "outros"}
            onChange={e => updateField("segment", e.target.value)}
            style={{
              width: "100%",
              background: C.sf,
              border: `1px solid ${C.brd}`,
              borderRadius: 8,
              padding: "11px 12px",
              color: C.txt,
              fontFamily: "'DM Sans'",
              fontSize: 13,
            }}
          >
            {SEGMENTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontFamily: "'DM Sans'",
            fontSize: 11,
            fontWeight: 600,
            color: C.txM,
            marginBottom: 6,
          }}>
            Principal objetivo
          </div>
          <select
            value={form.objectives?.[0] || "oportunidades"}
            onChange={e => updateField("objectives", [e.target.value])}
            style={{
              width: "100%",
              background: C.sf,
              border: `1px solid ${C.brd}`,
              borderRadius: 8,
              padding: "11px 12px",
              color: C.txt,
              fontFamily: "'DM Sans'",
              fontSize: 13,
            }}
          >
            {OBJECTIVES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div style={{
          background: C.sf,
          border: `1px solid ${C.brd}`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          display: "grid",
          gap: 5,
        }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>
            Leitura atual
          </div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12.5, color: C.txt }}>
            {segmentLabel} Â· {objectiveLabel}
          </div>
        </div>

        <Inp
          label="Chave PRO (opcional)"
          value={voucher}
          onChange={setVoucher}
          placeholder="Se vocÃª recebeu uma chave"
        />

        {error && (
          <div style={{
            fontFamily: "'DM Sans'",
            color: C.cor,
            fontSize: 11,
            lineHeight: 1.5,
            marginBottom: 10,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => {
            setPhase("interview");
            setQuestionIndex(0);
            setError("");
            setUseText(true);
          }}>
            Rever conversa
          </Btn>
          <Btn onClick={finish}>EstÃ¡ certo â</Btn>
        </div>
      </div>
    </div>
  );
}


/* âââ ASSESSMENT ââââââââââââââââââââââââââââââââââââââââââ */
// Tela final do assessment â reescrita para terminar em 1 CTA Ãºnico
// ("ComeÃ§ar minha rede"), em vez de radar + 6 dimensÃµes + plano de 4
// semanas + PDF antes de qualquer botÃ£o. Essa pilha de conteÃºdo era
// exatamente o ponto identificado de maior abandono (assessment concluÃ­do,
// usuÃ¡rio nunca chega a cadastrar ninguÃ©m). O diagnÃ³stico completo continua
// existindo â como um link secundÃ¡rio que nÃ£o bloqueia o prÃ³ximo passo.
function AssessResult({ prof, overall, maxD, minD, scores, saving, saveError, onSave, userId }) {
  const [showFull, setShowFull] = useState(false);
  const [showHelp, setShowHelp] = useState(false);


  useEffect(() => {
    if (!userId) return;
    supabase.from("page_events").insert({ user_id: userId, event_type: "assessment_result_viewed", tab_name: "assess" }).then(() => {}, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleStartNetwork = () => {
    if (userId) supabase.from("page_events").insert({ user_id: userId, event_type: "start_network_clicked", tab_name: "assess" }).then(() => {}, () => {});
    onSave();
  };


  const forcaLabel = (maxD?.label || "").toLowerCase();
  const desafioLabel = (minD?.label || "").toLowerCase();


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      {showHelp && <TourModal onClose={() => setShowHelp(false)} onFinish={() => setShowHelp(false)} steps={getHelpSteps("assessResult")} />}
      <HelpButton onClick={() => setShowHelp(true)} />
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{prof.emoji}</div>
          <Tag color={C.grn}>DiagnÃ³stico concluÃ­do</Tag>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: TYPE.display, fontWeight: 700, color: C.gold, margin: "12px 0 4px", fontStyle: "italic" }}>{prof.name}</h1>
          <p style={{ fontFamily: "'DM Sans'", fontSize: TYPE.body, color: C.txM, fontStyle: "italic" }}>{prof.tagline}</p>
        </div>


        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 22, marginBottom: 20 }}>
          <p style={{ fontFamily: "'DM Sans'", fontSize: TYPE.body, color: C.txt, lineHeight: 1.7, margin: 0 }}>
            {maxD && minD ? (
              <>Seu perfil mostra facilidade em <strong style={{ color: C.gold }}>{forcaLabel}</strong>, mas indica que <strong style={{ color: C.gold }}>{desafioLabel}</strong> pode ser um desafio. Agora vamos transformar esse diagnÃ³stico em uma rede que vocÃª consegue cuidar no dia a dia.</>
            ) : (
              <>Seu diagnÃ³stico estÃ¡ pronto. Agora vamos transformar isso em uma rede que vocÃª consegue cuidar no dia a dia.</>
            )}
          </p>
        </div>


        <Btn onClick={handleStartNetwork} disabled={saving} full>{saving ? "Salvando..." : "ComeÃ§ar minha rede â"}</Btn>
        {saveError && (
          <div style={{ fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.cor, textAlign: "center", marginTop: 10 }}>{saveError}</div>
        )}


        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => setShowFull(s => !s)} style={{ background: "none", border: "none", color: C.txL, fontFamily: "'DM Sans'", fontSize: TYPE.caption, cursor: "pointer", textDecoration: "underline" }}>
            {showFull ? "Ocultar diagnÃ³stico completo" : "Ver diagnÃ³stico completo"}
          </button>
        </div>


        {showFull && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: C.gold, textAlign: "center", marginBottom: 12 }}>Score geral: {overall}%</div>
            <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", justifyContent: "center" }}><RadarChart scores={scores} /></div>
            <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16 }}>Suas 6 dimensÃµes</div>
              {DIMS.map((d, i) => { const v = scores[d.key] || 0; return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 500, color: C.txt }}>{d.label}</span><span style={{ fontFamily: "'JetBrains Mono'", fontSize: TYPE.caption, fontWeight: 600, color: d.color }}>{v}%</span></div>
                  <div style={{ height: 8, borderRadius: 4, background: C.w06 }}><div style={{ height: 8, borderRadius: 4, background: d.color, width: `${v}%`, transition: `width ${MOTION.slow}` }} /></div>
                </div>
              ); })}
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>AnÃ¡lise profunda</div>
              <p style={{ fontFamily: "'DM Sans'", fontSize: TYPE.body, color: C.txM, lineHeight: 1.65 }}>{prof.desc}</p>
            </div>
            <div style={{ textAlign: "center", fontFamily: "'DM Sans'", fontSize: TYPE.caption, color: C.txL }}>
              O plano de 4 semanas completo e o PDF continuam disponÃ­veis depois, dentro de "Eu".
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function Assess({ profile, onDone }) {
  // ââ Rascunho persistente (retomada entre sessÃµes/dispositivos) ââ
  // Restaura de profile.assessment_draft/assessment_draft_step no primeiro
  // render â nÃ£o localStorage, porque precisa sobreviver a troca de
  // dispositivo/navegador, e profile jÃ¡ vem carregado do Supabase.
  const hadDraft = !!(profile?.assessment_draft && Object.keys(profile.assessment_draft).length > 0);
  const [qi, setQi] = useState(() => (hadDraft ? (profile.assessment_draft_step || 0) : 0));
  const [ans, setAns] = useState(() => (hadDraft ? profile.assessment_draft : {}));
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  // Guard sÃ­ncrono: useRef nÃ£o depende de re-render, entÃ£o cobre o caso de
  // duplo-clique disparando dois eventos antes do React aplicar `disabled`.
  // O useState continua existindo sÃ³ para controlar o texto/estado visual do botÃ£o.
  const savingRef = useRef(false);
  const { scores, overall } = useMemo(() => calcScores(ans), [ans]);
  const pKey = useMemo(() => getProfile(scores), [scores]);
  const prof = PROFILES[pKey];
  const q = QS[qi];
  const cur = ans[q?.id];


  const trackAssess = (eventType, metadata) => {
    if (!profile?.id) return;
    supabase.from("page_events").insert({ user_id: profile.id, event_type: eventType, tab_name: "assess", metadata: metadata || null }).then(() => {}, () => {});
  };


  // Dispara 1x no mount: assessment_started (rascunho novo) ou
  // assessment_resumed (jÃ¡ havia respostas salvas).
  useEffect(() => {
    trackAssess(hadDraft ? "assessment_resumed" : "assessment_started", hadDraft ? { resumedAtStep: qi } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Salva o rascunho automaticamente a cada resposta/mudanÃ§a de pergunta.
  // Erro de salvamento nunca bloqueia o preenchimento â sÃ³ fica registrado
  // no console; a prÃ³xima resposta tenta salvar de novo.
  const draftSaveRef = useRef(null);
  useEffect(() => {
    if (done || !profile?.id) return;
    if (Object.keys(ans).length === 0) return; // nada ainda para salvar
    clearTimeout(draftSaveRef.current);
    draftSaveRef.current = setTimeout(() => {
      supabase.from("profiles")
        .update({ assessment_draft: ans, assessment_draft_step: qi })
        .eq("id", profile.id)
        .then(({ error }) => { if (error) console.warn("[Assess] falha ao salvar rascunho:", error); });
    }, 400); // pequeno debounce â nÃ£o salva a cada tecla, salva por resposta
    return () => clearTimeout(draftSaveRef.current);
  }, [ans, qi, done, profile?.id]);


  const answerQuestion = (questionId, value) => {
    setAns(p => ({ ...p, [questionId]: value }));
    trackAssess("assessment_step_completed", { step: qi, questionId });
  };


  const save = async () => {
    if (savingRef.current) return; // evita duplo-clique criar registros duplicados
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const result = { scores, overall, profileKey: pKey, profileName: prof.name, createdAt: new Date().toISOString(), answers: ans };
      await onDone(result);
      // Sucesso: mantÃ©m o guard travado de propÃ³sito â a navegaÃ§Ã£o para o
      // app acontece dentro de onDone, entÃ£o nÃ£o deve haver novo envio.
    } catch (e) {
      // Erro real: libera o guard para o usuÃ¡rio poder tentar de novo, sem
      // perder as respostas (ans/qi continuam intactos no estado).
      console.error("[Assess] falha ao concluir o assessment:", e);
      savingRef.current = false;
      setSaving(false);
      setSaveError("NÃ£o consegui salvar seu diagnÃ³stico agora. Suas respostas continuam aqui â tenta de novo?");
    }
  };


  if (done) {


    const vals = Object.entries(scores);
    const maxD = DIMS.find(d => d.key === vals.sort((a, b) => b[1] - a[1])[0]?.[0]);
    const minD = DIMS.find(d => d.key === vals.sort((a, b) => a[1] - b[1])[0]?.[0]);


    return <AssessResult prof={prof} overall={overall} maxD={maxD} minD={minD} scores={scores} saving={saving} saveError={saveError} onSave={save} userId={profile?.id} />;
  }


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      {showHelp && <TourModal onClose={() => setShowHelp(false)} onFinish={() => setShowHelp(false)} steps={getHelpSteps("assess")} />}
      <HelpButton onClick={() => setShowHelp(true)} />
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <Tag color={DIMS[q.dim].color}>{DIMS[q.dim].label}</Tag>
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: C.txL }}>{qi + 1}/{QS.length}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: C.w06, marginBottom: 32 }}><div style={{ height: 4, borderRadius: 2, background: C.gold, width: `${((qi + 1) / QS.length) * 100}%`, transition: `width ${MOTION.slow}` }} /></div>
        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: C.txt, lineHeight: 1.35, margin: "0 0 28px", minHeight: 80 }}>{q.text}</p>
        {(q.opcoes || []).map(o => (
          <button key={o.v} onClick={() => answerQuestion(q.id, o.v)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, background: cur === o.v ? C.gD : C.sf, border: `1.5px solid ${cur === o.v ? C.gold : C.brd}`, borderRadius: 10, padding: "14px 18px", cursor: "pointer", marginBottom: 8, textAlign: "left" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${cur === o.v ? C.gold : C.brd}`, display: "flex", alignItems: "center", justifyContent: "center", background: cur === o.v ? C.gold : "transparent", flexShrink: 0 }}>{cur === o.v && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.bg }} />}</div>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 14, color: cur === o.v ? C.gold : C.txM, fontWeight: cur === o.v ? 600 : 400, lineHeight: 1.4 }}><strong style={{ color: cur === o.v ? C.gold : C.txL, marginRight: 6 }}>{o.v}.</strong>{o.l}</span>
          </button>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {qi > 0 && <Btn variant="ghost" onClick={() => setQi(qi - 1)} small>â Anterior</Btn>}
          <div style={{ flex: 1 }} />
          {qi < QS.length - 1 ? <Btn onClick={() => setQi(qi + 1)} disabled={!cur}>PrÃ³xima â</Btn> : <Btn onClick={() => setDone(true)} disabled={!cur}>Ver meu perfil</Btn>}
        </div>
      </div>
    </div>
  );
}


/* âââ MAKE WEBHOOK ââââââââââââââââââââââââââââââââââââââââ
   A URL real do webhook Make NUNCA fica no frontend (era um segredo exposto
   no bundle pÃºblico, acionÃ¡vel por qualquer pessoa via DevTools). O push
   agora passa por /api/track-crm-event, que lÃª MAKE_WEBHOOK_URL do ambiente
   Vercel e repassa no servidor. */
const MAKE_WEBHOOK = "/api/track-crm-event";
const MENTORIA_LINK = ""; // Preencher com link WhatsApp/Calendly


/* âââ STRIPE â CONFIGURAÃÃO CENTRALIZADA âââââââââââââââââââ
   Um Ãºnico Payment Link (modo Live) com os dois preÃ§os cadastrados
   dentro dele â o cliente escolhe mensal (R$39,90) ou anual (R$399)
   na prÃ³pria tela de checkout da Stripe. NÃ£o sÃ£o dois links separados. */
const STRIPE = {
  checkoutUrl: "https://buy.stripe.com/dRm5kF9Rs4oKguA388gfu02",
};
// Mantidos por compatibilidade com o restante do arquivo â todos apontam
// pro mesmo link Ãºnico, jÃ¡ que mensal e anual vivem dentro dele.
const STRIPE_MENSAL = STRIPE.checkoutUrl;
const STRIPE_ANUAL  = STRIPE.checkoutUrl;


/* Monta a URL do Payment Link jÃ¡ associada ao usuÃ¡rio logado.
   client_reference_id e prefilled_email sÃ£o parÃ¢metros oficiais da Stripe
   para Payment Links â voltam intactos no evento checkout.session.completed,
   Ã© assim que o webhook (api/stripe-webhook.js) sabe pra qual usuÃ¡rio do
   Supabase ativar o PRO. Sem isso, o pagamento acontece mas nÃ£o tem como
   saber automaticamente de quem foi. */
const buildStripeCheckoutUrl = (baseUrl, user) => {
  if (!user?.id) return baseUrl; // usuÃ¡rio nÃ£o logado â nÃ£o deveria acontecer, mas nÃ£o quebra o link
  const params = new URLSearchParams();
  params.set("client_reference_id", user.id);
  if (user.email) params.set("prefilled_email", user.email);
  return `${baseUrl}?${params.toString()}`;
};


const ADMIN_EMAILS           = ["rafaelmilleo@yahoo.com.br", "rafamilleo@gmail.com"];
const FREE_CT_LIMIT          = 5;
const FREE_IT_PER_CT_LIMIT   = 3; // interaÃ§Ãµes por contato no plano Free


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


/* âââ IA PROATIVA ââââââââââââââââââââââââââââââââââââââââ */
function PainelIAProativa({ userId, contacts, interactions, assessment, profile }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [errMsg, setErrMsg] = useState(null);


  const cacheKey = `${BRAND.storagePrefix}_ai_insights_${userId}`;


  const generateInsights = async () => {
    if (contacts.length < 3) return;
    setLoading(true);
    setErrMsg(null);
    try {
      // ââ Dados ricos de cada contato correlacionados com interaÃ§Ãµes ââ
      const contactsDetail = contacts.map(c => {
        const cIts = interactions.filter(i => i.contactId === c.id)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const negIts = cIts.filter(i => i.sentiment === 'negativo');
        const posIts = cIts.filter(i => i.sentiment === 'positivo');
        const lastIt = cIts[0];
        const diasSemContato = lastIt
          ? Math.floor((Date.now() - new Date(lastIt.createdAt).getTime()) / 86400000)
          : null;
        // FrequÃªncia real vs ideal
        const freqIdeal = c.idealFreq || 30;
        const atrasado = diasSemContato !== null && diasSemContato > freqIdeal;
        const diasAtraso = atrasado ? diasSemContato - freqIdeal : 0;
        // Valor gerado nas interaÃ§Ãµes
        const valorGerado = cIts.filter(i => i.valueGen).length;
        return {
          nome: c.name,
          empresa: c.company || '',
          cargo: c.role || '',
          categoria: c.category || '',         // aliado, ponte, mentor, potencial, dormindo
          proximidade: c.proximity || 3,       // 1=muito prÃ³ximo, 5=distante
          frequenciaIdealDias: freqIdeal,
          saudeRelacional: c.health || 0,      // 0-100
          status: c.status,
          proximaAcao: c.nextAction || null,
          proximaAcaoData: c.nextActionDate || null,
          comoConheceu: c.howMet || null,
          notas: c.notes || null,
          cidade: c.city || null,
          aniversario: c.birthday || null,
          // Campos de potencial estratÃ©gico
          influenciaPessoas: c.influenciaPessoas,   // boolean
          geraOportunidade: c.geraOportunidade,     // boolean
          abrePortas: c.abrePortas,                 // boolean
          momentoAtual: c.momentoAtual || null,     // contexto atual do contato
          // HistÃ³rico de interaÃ§Ãµes
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


      // ââ Assessment completo do usuÃ¡rio ââ
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


      // ââ AnÃ¡lises agregadas ââ
      const empCount = {};
      contacts.forEach(c => { if (c.company) empCount[c.company] = (empCount[c.company] || 0) + 1; });
      const catCount = {};
      contacts.forEach(c => { catCount[c.category || 'outro'] = (catCount[c.category || 'outro'] || 0) + 1; });


      // Contatos estratÃ©gicos de alto potencial sem interaÃ§Ã£o recente
      const altoPotencialSemContato = contactsDetail.filter(c =>
        (c.influenciaPessoas || c.geraOportunidade || c.abrePortas) &&
        (c.diasSemContato === null || c.diasSemContato > 14)
      );


      // Contatos com relacionamento deteriorando (negativos recentes)
      const relacionamentoDeterirorando = contactsDetail.filter(c =>
        c.interacoesNegativas > 0 && c.interacoesNegativas >= c.interacoesPositivas
      );


      // Contatos atrasados na frequÃªncia ideal
      const atrasadosNaFrequencia = contactsDetail
        .filter(c => c.atrasadoNaFrequencia)
        .sort((a, b) => b.diasDeAtraso - a.diasDeAtraso)
        .slice(0, 5);


      // Contatos sem nenhuma interaÃ§Ã£o
      const semInteracao = contactsDetail.filter(c => c.totalInteracoes === 0);


      // Contatos ponte/mentor sem interaÃ§Ã£o recente (crÃ­tico)
      const ponteMentorSemContato = contactsDetail.filter(c =>
        (c.categoria === 'ponte' || c.categoria === 'mentor') &&
        (c.diasSemContato === null || c.diasSemContato > 21)
      );


      // Reciprocidade: contatos com muitas interaÃ§Ãµes mas sem valor gerado
      const semReciprocidade = contactsDetail.filter(c =>
        c.totalInteracoes >= 3 && c.vezesMandouValor === 0
      );


      const ctx = {
        assessment: assessmentScores,
        objetivo: profile?.objectives || '',
        totalContatos: contacts.length,
        distribuicaoEmpresas: empCount,
        distribuicaoCategorias: catCount,
        // SituaÃ§Ãµes crÃ­ticas
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


      const prompt = `VocÃª Ã© um coach de networking estratÃ©gico de alto nÃ­vel. Analise os dados REAIS da rede do usuÃ¡rio e gere exatamente 3 insights PODEROSOS, ESPECÃFICOS e CORRELACIONADOS.


Regras obrigatÃ³rias:
- Use NOMES REAIS dos contatos â nunca seja genÃ©rico
- Cruze os dados do assessment com os dados da rede:
  * Se reciprocidadeAtiva estÃ¡ baixa mas tem contatos com muitas interaÃ§Ãµes sem valor gerado, aponte isso
  * Se ritualConsistencia estÃ¡ alto mas tem contatos atrasados na frequÃªncia, aponte a contradiÃ§Ã£o
  * Se presencaMercado estÃ¡ baixo e nÃ£o hÃ¡ contatos "ponte" ativos, conecte os pontos
- Priorize situaÃ§Ãµes crÃ­ticas: relacionamentos deteriorando, alto potencial sem contato, pontes/mentores esquecidos
- Para cada insight, a "acao" deve ser IMEDIATA e ESPECÃFICA: diga O QUE fazer, COM QUEM e COMO (ex: "Ligue para Katty Corrente hoje â pergunte sobre o projeto X que ela mencionou")
- Se houver relacionamento deteriorando, gere um plano de reversÃ£o em 3 passos
- Se houver contato de alto potencial (abrePortas/geraOportunidade/influenciaPessoas) sem contato recente, trate como urgÃªncia mÃ¡xima
- Considere a categoria do contato: pontes e mentores tÃªm peso estratÃ©gico maior que dormindo
- Considere a proximidade (1=muito prÃ³ximo, 5=distante) para calibrar a urgÃªncia


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
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.08em' }}>ð§  InteligÃªncia da sua rede</div>
          {lastRefresh && <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginTop: 2 }}>Atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>}
        </div>
        <button onClick={generateInsights} disabled={loading || contacts.length < 3}
          title={contacts.length < 3 ? 'Cadastre pelo menos 3 contatos pra habilitar' : undefined}
          style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '5px 12px', fontFamily: "'DM Sans'", fontSize: 11, color: C.gold, cursor: (loading || contacts.length < 3) ? 'default' : 'pointer', opacity: (loading || contacts.length < 3) ? 0.6 : 1 }}>
          {loading ? 'Analisando...' : 'ð Atualizar'}
        </button>
      </div>


      {loading && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, textAlign: 'center', padding: '16px 0' }}>
          A IA estÃ¡ analisando sua rede...
        </div>
      )}


      {errMsg && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.cor, marginBottom: 8, padding: '8px 10px', background: `${C.cor}10`, borderRadius: 6 }}>
          â ï¸ {errMsg}
        </div>
      )}
      {!loading && !insights && (
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, lineHeight: 1.5 }}>
          {contacts.length < 3
            ? `â¨ Cadastre pelo menos 3 contatos (vocÃª tem ${contacts.length}) pra eu comeÃ§ar a analisar sua rede e trazer recomendaÃ§Ãµes personalizadas aqui.`
            : 'Clique em Atualizar para gerar insights personalizados da sua rede.'}
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
              <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.06em' }}>â AÃ§Ã£o: </span>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{ins.acao}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* âââ AÃÃES DO ARQUÃTIPO (compartilhado entre Plano e TrajetÃ³ria) âââ
   Antes existiam 2 blocos estÃ¡ticos idÃªnticos e desconectados â um em
   "Plano de AtivaÃ§Ã£o" (PlanInterativo) e outro em "TrajetÃ³ria"
   (renderReport). Nenhum dos dois era clicÃ¡vel. Agora Ã© 1 componente sÃ³,
   com estado prÃ³prio salvo em plan_step_completion (phase=0), usado nos
   dois lugares â marcar numa aba reflete na outra. */
function ArchetypeActionsChecklist({ userId, pf, hideHeader = false }) {
  const [archetypeDone, setArchetypeDone] = useState({});
  const [loaded, setLoaded] = useState(false);


  const load = async () => {
    if (!userId) return;
    const { data } = await supabase.from('plan_step_completion').select('step_number').eq('user_id', userId).eq('phase', 0);
    const next = {};
    (data || []).forEach(s => { next[s.step_number] = true; });
    setArchetypeDone(next);
    setLoaded(true);
  };
  useEffect(() => { load(); }, [userId]);


  const toggle = async (idx) => {
    const wasDone = !!archetypeDone[idx];
    setArchetypeDone(a => ({ ...a, [idx]: !wasDone }));
    if (wasDone) {
      await supabase.from('plan_step_completion').delete()
        .eq('user_id', userId).eq('phase', 0).eq('week', 0).eq('step_number', idx);
    } else {
      const { error } = await supabase.from('plan_step_completion')
        .upsert({ user_id: userId, phase: 0, week: 0, step_number: idx, completed_at: new Date().toISOString() },
          { onConflict: 'user_id,phase,week,step_number' });
      if (error) { console.error('[AÃ§ÃµesArquÃ©tipo] falha ao salvar:', error); setArchetypeDone(a => ({ ...a, [idx]: wasDone })); }
    }
  };


  if (!pf || !pf.actions?.length) return null;
  return (
    <div style={hideHeader ? {} : { background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      {!hideHeader && <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>Suas 3 aÃ§Ãµes como {pf.name}</div>}
      {pf.actions.map((a, i) => {
        const checked = loaded && !!archetypeDone[i];
        return (
          <div key={i} onClick={() => toggle(i)}
            style={{ display: "flex", gap: 10, marginBottom: 6, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: checked ? C.grnD : 'transparent', border: `1px solid ${checked ? C.grn + '30' : 'transparent'}`, transition: `all ${MOTION.base}` }}>
            <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? C.grn : C.gL}`, background: checked ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
              {checked && <span style={{ color: '#fff', fontSize: 11 }}>â</span>}
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: checked ? C.txL : C.txM, lineHeight: 1.5, textDecoration: checked ? 'line-through' : 'none' }}>{a}</div>
          </div>
        );
      })}
    </div>
  );
}


/* âââ PLANO INTERATIVO ââââââââââââââââââââââââââââââââââ */
function PlanInterativo({ userId, week, isPro, openAccessKey, pf }) {
  const [done, setDone] = useState({});
  const [metaDone, setMetaDone] = useState({});
  const [aiGoals, setAiGoals] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [regeneratingGoalId, setRegeneratingGoalId] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState({}); // semanas concluÃ­das que o usuÃ¡rio abriu manualmente
  const [realProgress, setRealProgress] = useState(null); // atividade real (interactions/contacts) vinda do banco
  const [loaded, setLoaded] = useState(false);
  // Microrresposta contextual ao concluir tarefa/meta â some sozinha, nÃ£o
  // fica acumulando (nada de log de "conquistas"). Ver src/lib/evolutionCopy.js.
  const [microMsg, setMicroMsg] = useState(null);
  useEffect(() => {
    if (!microMsg) return;
    const t = setTimeout(() => setMicroMsg(null), 6000);
    return () => clearTimeout(t);
  }, [microMsg]);


  // Carrega estado real do Supabase: checklist (plan_step_completion), metas de IA
  // com progresso calculado (ai_goals_progress) e atividade real registrada (plan_progress).
  const loadAll = async () => {
    if (!userId) return;
    const [{ data: steps }, { data: goals }, { data: progress }] = await Promise.all([
      supabase.from('plan_step_completion').select('week, step_number').eq('user_id', userId).eq('phase', 1),
      supabase.from('ai_goals_progress').select('*').eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false }),
      supabase.from('plan_progress').select('*').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1),
    ]);
    const newDone = {}, newMeta = {};
    (steps || []).forEach(s => {
      if (s.step_number === -1) newMeta[s.week] = true;
      else newDone[`${s.week}_${s.step_number}`] = true;
    });
    setDone(newDone);
    setMetaDone(newMeta);
    setRealProgress(progress?.[0] || null);


    // Meta de 90 dias batida (100%) nÃ£o fecha sozinha â sem isso ela fica
    // "somando pra sempre" na tela mesmo jÃ¡ concluÃ­da. Aqui, ao carregar,
    // qualquer meta com progress_percentage >= 100 Ã© arquivada como
    // "achieved" e substituÃ­da por uma nova, com o mesmo salto (target -
    // baseline) a partir do valor atual â sem IA, sem mexer nas outras
    // metas que ainda estÃ£o em andamento (diferente do botÃ£o "Regenerar").
    const achieved = (goals || []).filter(g => (g.progress_percentage ?? 0) >= 100 && g.status !== 'achieved');
    if (achieved.length) {
      for (const g of achieved) {
        await supabase.from('ai_goals').update({ status: 'achieved', archived: true }).eq('id', g.id);
        const delta = Math.max(1, Number(g.target_value) - Number(g.baseline_value));
        await supabase.from('ai_goals').insert({
          user_id: userId,
          goal_text: g.goal_text,
          metric_type: g.metric_type,
          baseline_value: g.current_value,
          target_value: Number(g.current_value) + delta,
        });
      }
      const { data: freshGoals } = await supabase.from('ai_goals_progress').select('*').eq('user_id', userId).eq('archived', false).order('created_at', { ascending: false });
      setAiGoals(freshGoals || []);
    } else {
      setAiGoals(goals || []);
    }
    setLoaded(true);
  };


  useEffect(() => { loadAll(); }, [userId]);


  // Troca sÃ³ esta meta (arquiva 1, gera 1 nova), diferente de "Regenerar"
  // que substitui as 3 de uma vez â evita perder progresso de metas ainda
  // em andamento quando o usuÃ¡rio sÃ³ quer trocar uma especÃ­fica.
  const regenerateSingleGoal = async (goal) => {
    if (!pf) return;
    setRegeneratingGoalId(goal.id);
    try {
      const prompt = `VocÃª Ã© um coach de networking estratÃ©gico. O usuÃ¡rio tem o perfil relacional "${pf.name}" (${pf.tagline}). A meta atual dele Ã© "${goal.goal_text}" (mÃ©trica: ${goal.metric_type}), e ele quer trocÃ¡-la por outra. Hoje ele tem ${goal.current_value ?? 0} nessa mÃ©trica. Gere exatamente 1 meta mensurÃ¡vel nova e diferente da atual para os prÃ³ximos 90 dias, medida por "interactions_count" ou "contacts_engaged", com alvo numÃ©rico realista acima do valor atual. Responda APENAS com JSON: {"goal_text": "...", "metric_type": "interactions_count", "target_value": 40}. Sem texto extra.`;
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 300 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const g = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (g.goal_text) {
        await supabase.from('ai_goals').update({ archived: true }).eq('id', goal.id);
        await supabase.from('ai_goals').insert({
          user_id: userId,
          goal_text: g.goal_text,
          metric_type: g.metric_type === 'contacts_engaged' ? 'contacts_engaged' : 'interactions_count',
          baseline_value: goal.current_value ?? 0,
          target_value: Number(g.target_value) || (goal.current_value ?? 0) + 10,
        });
        await loadAll();
      }
    } catch (e) {
      console.error('regenerateSingleGoal error:', e);
    }
    setRegeneratingGoalId(null);
  };


  const toggleTask = async (weekNum, taskIdx) => {
    const key = `${weekNum}_${taskIdx}`;
    const wasDone = !!done[key];
    setDone(d => ({ ...d, [key]: !wasDone })); // otimista
    if (wasDone) {
      await supabase.from('plan_step_completion').delete()
        .eq('user_id', userId).eq('phase', 1).eq('week', weekNum).eq('step_number', taskIdx);
    } else {
      const { error } = await supabase.from('plan_step_completion')
        .upsert({ user_id: userId, phase: 1, week: weekNum, step_number: taskIdx, completed_at: new Date().toISOString() },
          { onConflict: 'user_id,phase,week,step_number' });
      if (error) { console.error('[Plano] falha ao salvar tarefa:', error); setDone(d => ({ ...d, [key]: wasDone })); }
      else setMicroMsg(buildTaskMicroresponse(realProgress));
    }
  };


  const toggleMeta = async (weekNum) => {
    const wasDone = !!metaDone[weekNum];
    setMetaDone(m => ({ ...m, [weekNum]: !wasDone }));
    if (wasDone) {
      await supabase.from('plan_step_completion').delete()
        .eq('user_id', userId).eq('phase', 1).eq('week', weekNum).eq('step_number', -1);
    } else {
      const { error } = await supabase.from('plan_step_completion')
        .upsert({ user_id: userId, phase: 1, week: weekNum, step_number: -1, completed_at: new Date().toISOString() },
          { onConflict: 'user_id,phase,week,step_number' });
      if (error) { console.error('[Plano] falha ao salvar meta:', error); setMetaDone(m => ({ ...m, [weekNum]: wasDone })); }
      else setMicroMsg(buildMetaMicroresponse(realProgress));
    }
  };


  // Gera metas de 90 dias com mÃ©trica real e mensurÃ¡vel (interaÃ§Ãµes ou contatos engajados),
  // nÃ£o texto solto: a IA define o alvo numÃ©rico, e o progresso evolui sozinho a partir do uso real da plataforma.
  const generateAiGoals = async () => {
    if (!pf) return;
    setAiLoading(true);
    try {
      const [{ count: interactionsCount }, { data: contactRows }] = await Promise.all([
        supabase.from('interactions').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('interactions').select('contact_id').eq('user_id', userId),
      ]);
      const contactsEngaged = new Set((contactRows || []).map(r => r.contact_id)).size;


      const prompt = `VocÃª Ã© um coach de networking estratÃ©gico. O usuÃ¡rio tem o perfil relacional "${pf.name}" (${pf.tagline}). Pontos fortes: ${pf.strengths?.join(', ')}. Riscos: ${pf.risks?.join(', ')}. Hoje ele tem ${interactionsCount || 0} interaÃ§Ãµes registradas e ${contactsEngaged} contatos engajados na plataforma. Gere exatamente 3 metas mensurÃ¡veis para os prÃ³ximos 90 dias, cada uma medida por UM destes dois indicadores: "interactions_count" (total de interaÃ§Ãµes registradas) ou "contacts_engaged" (contatos distintos com quem interagiu). Defina um alvo numÃ©rico realista acima do valor atual. Responda APENAS com JSON no formato: {"goals": [{"text": "descriÃ§Ã£o curta e especÃ­fica da meta", "metric_type": "interactions_count", "target_value": 40}]}. Sem texto extra.`;
      const res = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 500 })
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
      if (parsed.goals?.length) {
        const rows = parsed.goals.map(g => ({
          user_id: userId,
          goal_text: g.text,
          metric_type: g.metric_type === 'contacts_engaged' ? 'contacts_engaged' : 'interactions_count',
          baseline_value: g.metric_type === 'contacts_engaged' ? contactsEngaged : (interactionsCount || 0),
          target_value: Number(g.target_value) || (g.metric_type === 'contacts_engaged' ? contactsEngaged + 5 : (interactionsCount || 0) + 10),
        }));
        // Arquiva metas antigas (mantÃ©m histÃ³rico) e cria as novas
        await supabase.from('ai_goals').update({ archived: true }).eq('user_id', userId).eq('archived', false);
        const { error } = await supabase.from('ai_goals').insert(rows);
        if (error) console.error('[Plano] falha ao salvar metas de IA:', error);
        await loadAll();
      }
    } catch (e) {
      console.error('AI goals error:', e);
    }
    setAiLoading(false);
  };


  const hasActiveGoals = aiGoals && aiGoals.length > 0;


  return (
    <div>
      {/* Atividade real registrada (vem do trigger do banco, nÃ£o Ã© auto-declarada) */}
      {realProgress && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, textTransform: 'uppercase', letterSpacing: '.06em' }}>InteraÃ§Ãµes â semana atual</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 22, fontWeight: 700, color: C.txt, marginTop: 4 }}>{realProgress.interactions_count ?? 0}</div>
          </div>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, textTransform: 'uppercase', letterSpacing: '.06em' }}>Contatos engajados</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 22, fontWeight: 700, color: C.txt, marginTop: 4 }}>{realProgress.contacts_engaged ?? 0}</div>
          </div>
        </div>
      )}


      {/* Suas 3 aÃ§Ãµes do perfil â componente compartilhado com a aba TrajetÃ³ria (mesmo estado real) */}
      <ArchetypeActionsChecklist userId={userId} pf={pf} />


      {/* Metas de IA â mensurÃ¡veis, com progresso calculado a partir do uso real */}
      <div style={{ background: `${C.gold}06`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.08em' }}>ð¯ Suas metas para 90 dias</div>
          {!hasActiveGoals && (
            <button onClick={generateAiGoals} disabled={aiLoading || !pf}
              style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 8, padding: '6px 14px', fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, cursor: aiLoading || !pf ? 'default' : 'pointer', opacity: aiLoading || !pf ? 0.6 : 1 }}>
              {aiLoading ? 'Gerando...' : 'Gerar com IA'}
            </button>
          )}
          {hasActiveGoals && (
            <button onClick={generateAiGoals} disabled={aiLoading}
              style={{ background: 'transparent', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: 'pointer', textDecoration: 'underline' }}>
              {aiLoading ? '...' : 'Regenerar'}
            </button>
          )}
        </div>
        {!hasActiveGoals && !aiLoading && loaded && (
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>
            {pf ? 'Clique em "Gerar com IA" para receber metas personalizadas e mensurÃ¡veis para o seu perfil.' : 'Complete o diagnÃ³stico para gerar metas personalizadas.'}
          </div>
        )}
        {aiLoading && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>A IA estÃ¡ analisando seu perfil...</div>}
        {hasActiveGoals && aiGoals.map((g) => {
          const pct = Math.max(0, Math.min(100, g.progress_percentage ?? 0));
          const achieved = g.status === 'achieved' || pct >= 100;
          const daysLeft = Math.max(0, Math.ceil((new Date(g.deadline_at) - new Date()) / 86400000));
          return (
            <div key={g.id} style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: achieved ? C.grnD : C.w06, border: `1px solid ${achieved ? C.grn + '40' : C.brd}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt, lineHeight: 1.4 }}>{achieved ? 'â ' : ''}{g.goal_text}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{daysLeft}d restantes</span>
                  <button onClick={() => regenerateSingleGoal(g)} disabled={regeneratingGoalId === g.id}
                    title="Trocar sÃ³ esta meta, sem mexer nas outras"
                    style={{ background: 'transparent', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: regeneratingGoalId === g.id ? 'default' : 'pointer', textDecoration: 'underline' }}>
                    {regeneratingGoalId === g.id ? '...' : 'Trocar'}
                  </button>
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: C.brd, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: achieved ? C.grn : C.gold, transition: `width ${MOTION.slow}` }} />
              </div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM }}>
                {g.current_value ?? 0} / {g.target_value} {g.metric_type === 'contacts_engaged' ? 'contatos' : 'interaÃ§Ãµes'} Â· {pct}%
              </div>
            </div>
          );
        })}
      </div>


      {/* Microrresposta contextual â aparece ao concluir tarefa/meta, some sozinha */}
      {microMsg && (
        <div style={{ background: `${C.gold}0d`, border: `1px solid ${C.gL}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontFamily: "'DM Sans'", fontSize: 12.5, color: C.txt, lineHeight: 1.5 }}>
          {microMsg}
        </div>
      )}


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
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.w06, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>ð</div>
              <div><Tag color={C.txL} small>Semana {w.week}</Tag><div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txL, marginTop: 3 }}>{w.title}</div></div>
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>Continue seu plano no PRO.</div>
            {i === 1 && <button onClick={openAccessKey} style={{ background: 'none', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: 'pointer', textDecoration: 'underline', marginTop: 6, display: 'block' }}>Tenho uma chave de acesso</button>}
          </div>
        );


        // Semana jÃ¡ concluÃ­da (e nÃ£o Ã© a atual) fica colapsada por padrÃ£o â
        // antes ficava sempre expandida com o mesmo tamanho de uma semana
        // ativa, empurrando tudo pra baixo mesmo depois de feita.
        const isCollapsible = !isCurrent && allTasksDone;
        const isExpanded = !isCollapsible || !!expandedWeeks[w.week];


        if (isCollapsible && !isExpanded) return (
          <div key={i} onClick={() => setExpandedWeeks(e => ({ ...e, [w.week]: true }))}
            style={{ background: C.grnD, border: `1px solid ${C.grn}40`, borderRadius: 12, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <span style={{ fontSize: 16 }}>â</span>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: C.txt, flex: 1 }}>Semana {w.week} Â· {w.title}</span>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>ver detalhes</span>
          </div>
        );


        return (
          <div key={i} style={{ background: isCurrent ? `${C.gold}06` : C.card, border: `1px solid ${isCurrent ? C.gL : C.brd}`, borderRadius: 12, padding: 20, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: allTasksDone ? C.grnD : isCurrent ? C.gD : C.w06, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                {allTasksDone ? 'â' : w.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={isCurrent ? C.gold : allTasksDone ? C.grn : C.txL} small>Semana {w.week}</Tag>
                  {isCurrent && <Tag color={C.gold} small>â Agora</Tag>}
                  {weekTasksDone > 0 && <Tag color={C.grn} small>{weekTasksDone}/{w.tasks.length}</Tag>}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 600, color: C.txt, marginTop: 3 }}>{w.title}</div>
              </div>
              {isCollapsible && isExpanded && (
                <button onClick={() => setExpandedWeeks(e => ({ ...e, [w.week]: false }))}
                  style={{ background: 'none', border: 'none', fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, cursor: 'pointer', textDecoration: 'underline' }}>recolher</button>
              )}
            </div>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, margin: '0 0 10px', fontStyle: 'italic' }}>{w.goal}</p>


            {/* Tarefas com checkbox */}
            {w.tasks.map((t, j) => {
              const key = `${w.week}_${j}`;
              const checked = !!done[key];
              return (
                <div key={j} onClick={() => toggleTask(w.week, j)}
                  style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, background: checked ? C.grnD : 'transparent', border: `1px solid ${checked ? C.grn + '30' : 'transparent'}`, transition: `all ${MOTION.base}` }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${checked ? C.grn : isCurrent ? C.gL : C.brd}`, background: checked ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    {checked && <span style={{ color: '#fff', fontSize: 11 }}>â</span>}
                  </div>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: checked ? C.txL : isCurrent ? C.txt : C.txM, lineHeight: 1.5, textDecoration: checked ? 'line-through' : 'none' }}>{t}</span>
                </div>
              );
            })}


            {/* Meta da semana com flag */}
            <div onClick={() => toggleMeta(w.week)}
              style={{ marginTop: 12, background: metaDone[w.week] ? C.grnD : C.w06, border: `1px solid ${metaDone[w.week] ? C.grn + '40' : 'transparent'}`, borderRadius: 6, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: `all ${MOTION.base}` }}>
              <div style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${metaDone[w.week] ? C.grn : C.txL}`, background: metaDone[w.week] ? C.grn : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {metaDone[w.week] && <span style={{ color: '#fff', fontSize: 10 }}>â</span>}
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
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>Dicas de uso do {BRAND.name}</div>
        {[
          { icon: 'ð', title: 'Ritual semanal', desc: 'Toda segunda-feira, 15 minutos: veja os alertas do Dashboard e escolha 2 contatos para contatar.' },
          { icon: 'ð', title: 'Registre interaÃ§Ãµes', desc: 'Sempre que falar com alguÃ©m relevante, registre na aba Contatos. Quanto mais vocÃª registra, mais precisas as recomendaÃ§Ãµes ficam.' },
          { icon: 'ð¯', title: 'PrÃ³xima aÃ§Ã£o', desc: 'Todo contato deve ter sempre uma prÃ³xima aÃ§Ã£o definida. Relacionamento sem direÃ§Ã£o esfria.' },
          { icon: 'ð±', title: 'Diversifique categorias', desc: 'Equilibre sua rede entre Mentores, Aliados, Pontes e Potenciais. Redes diversas geram mais oportunidades.' },
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


/* âââ AJUDA CONTEXTUAL (primeira vez + lÃ¢mpada de dicas) âââââââââ
   Antes disso era um tour fixo com 9 passos descrevendo abas que nÃ£o
   existem mais ("Analytics", "Dashboard" separado, "IA" como aba prÃ³pria).
   Agora o conteÃºdo muda de acordo com onde a pessoa estÃ¡ â incluindo
   dentro do assessment e do cadastro guiado, que antes nÃ£o tinham nenhum
   tipo de ajuda. */
const WELCOME_STEP = { icon: "â¨", title: `Bem-vindo(a) ao ${BRAND.name}`, desc: "Isso aqui nÃ£o Ã© um CRM tradicional. Ã um assistente que te ajuda a cuidar das pessoas importantes, sem transformar relaÃ§Ãµes em tarefas." };


const HELP_STEPS = {
  // Onboarding e assessment â telas que hoje nÃ£o tinham ajuda nenhuma.
  onboard: [WELCOME_STEP, { icon: "ð", title: "Cadastro inicial", desc: "SÃ³ o essencial pra comeÃ§ar. O resto vocÃª completa depois, com calma, dentro de \"Eu\"." }],
  assess: [{ icon: "ð§­", title: "DiagnÃ³stico relacional", desc: "12 perguntas rÃ¡pidas. Suas respostas sÃ£o salvas automaticamente a cada uma â pode fechar e voltar quando quiser, sem perder nada." }],
  assessResult: [{ icon: "ð¯", title: "Seu resultado", desc: "Esse Ã© sÃ³ o resumo. Se quiser o diagnÃ³stico completo (grÃ¡fico, todas as dimensÃµes), tem um link \"Ver diagnÃ³stico completo\" logo abaixo do botÃ£o principal." }],
  startNetwork: [{ icon: "ð«", title: "Cadastro guiado", desc: "Uma pessoa de cada vez, sÃ³ o essencial. VocÃª pode pular a qualquer momento â nada aqui Ã© obrigatÃ³rio, e dÃ¡ pra completar o resto depois no perfil de cada pessoa." }],
  // App principal, jÃ¡ com as 3 Ã¢ncoras atuais.
  dash: [WELCOME_STEP, { icon: "â", title: "Hoje", desc: "A recomendaÃ§Ã£o mais importante do momento â no mÃ¡ximo 1 principal + 2 secundÃ¡rias. Sem lista acumulada, sem pressÃ£o." }],
  contacts: [{ icon: "â", title: "Rede", desc: "Suas pessoas e a Teia (mapa visual da sua rede) ficam juntas aqui â use o alternador \"Pessoas / Teia\" no topo pra trocar de visÃ£o." }],
  perfil: [{ icon: "ð¤", title: "Perfil", desc: "Seus dados pessoais e de contato. Mantenha atualizado pra IA personalizar melhor as sugestÃµes." }],
  insights: [{ icon: "ð§ ", title: "Insights", desc: "SugestÃµes, anÃ¡lises e prÃ³ximos passos da IA. Seu plano de ativaÃ§Ã£o e o relatÃ³rio em PDF tambÃ©m ficam aqui, nas abas do topo." }],
};


function getHelpSteps(context) {
  return HELP_STEPS[context] || [WELCOME_STEP];
}


// BotÃ£o flutuante reutilizÃ¡vel â usado dentro do app (CRM), do assessment
// e do cadastro guiado, sempre com o conteÃºdo certo pra onde a pessoa estÃ¡.
function HelpButton({ onClick, bottom = 20 }) {
  return (
    <button
      onClick={onClick}
      title="Dicas desta tela"
      aria-label="Dicas desta tela"
      style={{ position: "fixed", bottom, right: 20, width: 44, height: 44, borderRadius: "50%", background: C.gold, border: "none", boxShadow: "0 4px 14px #00000040", fontSize: 20, cursor: "pointer", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center" }}
    >ð¡</button>
  );
}




function TourModal({ onClose, onFinish, steps }) {
  const [step, setStep] = useState(0);
  const TOUR_STEPS = steps && steps.length ? steps : [WELCOME_STEP];
  const total = TOUR_STEPS.length;
  const s = TOUR_STEPS[step];
  const isLast = step === total - 1;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(5,12,9,0.72)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 16, padding: 28, maxWidth: 360, width: "100%", position: "relative" }}>
        <button onClick={onClose} aria-label="Fechar" style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: C.txL, fontSize: 20, cursor: "pointer", lineHeight: 1 }}>Ã</button>
        <div style={{ fontSize: 34, marginBottom: 12 }}>{s.icon}</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, marginBottom: 8 }}>{s.title}</div>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, marginBottom: 20 }}>{s.desc}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 5 }}>
            {TOUR_STEPS.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i === step ? C.gold : C.brd }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && <Btn variant="ghost" small onClick={() => setStep(step - 1)}>Voltar</Btn>}
            {!isLast && <Btn small onClick={() => setStep(step + 1)}>PrÃ³ximo</Btn>}
            {isLast && <Btn small onClick={onFinish}>Concluir</Btn>}
          </div>
        </div>
      </div>
    </div>
  );
}


/* âââ PERFIL FORM ââââââââââââââââââââââââââââââââââââââââ */
// Captura Passiva via CalendÃ¡rio â conexÃ£o OAuth com Google Calendar (sem
// copiar/colar link .ics). Outlook e Apple ainda nÃ£o tÃªm botÃ£o prÃ³prio;
// entram aqui quando os endpoints api/calendar-oauth/outlook-* e o fluxo
// CalDAV do Apple estiverem prontos.
function CalendarConnectionCard({ pf, sp }) {
  const [conn, setConn] = useState(null);       // linha de calendar_connections (provider=google) ou null
  const [loadingConn, setLoadingConn] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showLegacyIcs, setShowLegacyIcs] = useState(false);
  const [connectError, setConnectError] = useState(null);


  const refreshConn = useCallback(async () => {
    setLoadingConn(true);
    const { data } = await supabase
      .from('calendar_connections')
      .select('provider,status,last_synced_at,last_error,created_at')
      .eq('provider', 'google')
      .maybeSingle();
    setConn(data || null);
    setLoadingConn(false);
  }, []);


  useEffect(() => { refreshConn(); }, [refreshConn]);


  // Depois do redirect de volta do Google (?calendar=connected|error|denied)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('calendar');
    if (!status) return;
    refreshConn();
    // Limpa a query string pra nÃ£o reprocessar em refresh manual da pÃ¡gina.
    params.delete('calendar');
    const rest = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
  }, [refreshConn]);


  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setConnectError('SessÃ£o nÃ£o encontrada â saia e entre de novo no app.');
        setConnecting(false);
        return;
      }
      const res = await fetch('/api/calendar-oauth/google-start', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      let data;
      try {
        data = await res.json();
      } catch {
        setConnectError(`Resposta inesperada do servidor (status ${res.status}). O endpoint pode nÃ£o existir ainda.`);
        setConnecting(false);
        return;
      }
      if (data.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setConnectError(data.error || `Erro desconhecido (status ${res.status}).`);
        setConnecting(false);
      }
    } catch (err) {
      setConnectError(`Falha de rede: ${err.message}`);
      setConnecting(false);
    }
  };


  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/calendar-oauth/google-disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      await refreshConn();
    } finally {
      setDisconnecting(false);
    }
  };


  const conectado = conn?.status === 'active';
  const comErro = conn?.status === 'error';


  return (
    <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 6 }}>Captura Passiva via CalendÃ¡rio</div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, marginBottom: 14 }}>
        Conecte seu calendÃ¡rio e, quando vocÃª tiver uma reuniÃ£o com alguÃ©m da sua rede, o assistente {BRAND.name} te pergunta pelo WhatsApp se quer registrar como interaÃ§Ã£o â sem precisar abrir o app.
      </div>


      {!loadingConn && conectado && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: C.w06, border: `1px solid ${C.gold}30`, borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>ð¢ Google Calendar conectado</div>
          <button onClick={handleDisconnect} disabled={disconnecting} style={{ background: "transparent", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "6px 12px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, cursor: "pointer" }}>
            {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>
      )}


      {!loadingConn && !conectado && (
        <>
          {comErro && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: "#D97757", marginBottom: 10 }}>
              A conexÃ£o expirou ou foi revogada. Conecte novamente.
            </div>
          )}
          <button onClick={handleConnect} disabled={connecting} style={{ display: "flex", alignItems: "center", gap: 8, background: C.gold, border: "none", borderRadius: 8, padding: "12px 16px", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, color: "#0D0D0D", cursor: "pointer" }}>
            {connecting ? "Redirecionando..." : "Conectar Google Calendar"}
          </button>
          {connectError && (
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: "#D97757", marginTop: 10, lineHeight: 1.5 }}>
              {connectError}
            </div>
          )}
        </>
      )}


      <button onClick={() => setShowLegacyIcs(v => !v)} style={{ display: "block", marginTop: 14, background: "none", border: "none", padding: 0, fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, textDecoration: "underline", cursor: "pointer" }}>
        {showLegacyIcs ? "Ocultar opÃ§Ã£o avanÃ§ada" : "Uso Outlook, Apple, ou quero colar um link .ics manualmente"}
      </button>


      {showLegacyIcs && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.gold, display: "block", marginBottom: 6 }}>Link .ics do calendÃ¡rio</label>
          <input
            type="url"
            value={pf.calendarIcsUrl || ""}
            onChange={e => sp('calendarIcsUrl')(e.target.value)}
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            style={{ width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.gold}50`, borderRadius: 8, padding: "12px 14px", fontFamily: "'DM Sans'", fontSize: 13, color: C.txt, outline: "none" }}
          />
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, lineHeight: 1.5, marginTop: 8 }}>
            Funciona com qualquer calendÃ¡rio que gere um link pÃºblico .ics (Google, Outlook, Apple). Salve o formulÃ¡rio depois de colar o link.
          </div>
        </div>
      )}
    </div>
  );
}


function PerfilForm({ profile, userId, onSaved, isPro, openAccessKey, archetype }) {
  const NETWORK_SIZES = [
    { value: "1-20",   label: "1-20 contatos" },
    { value: "21-50",  label: "21-50 contatos" },
    { value: "51-100", label: "51-100 contatos" },
    { value: "100+",   label: "Mais de 100 contatos" },
  ];
  const CHALLENGES = [
    { value: "consistencia", label: "Manter consistÃªncia" },
    { value: "expansao",    label: "Expandir a rede" },
    { value: "reativacao",  label: "Reativar relaÃ§Ãµes" },
    { value: "valor",       label: "Gerar valor genuÃ­no" },
    { value: "visibilidade",label: "Aumentar visibilidade" },
    { value: "estrategia",  label: "Ter estratÃ©gia clara" },
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
    calendarIcsUrl: profile?.calendar_ics_url || "",
  });
  // Ressincronizar quando o profile chega do Supabase (carregamento assÃ­ncrono)
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
      calendarIcsUrl: profile.calendar_ics_url || "",
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
  const [justActivatedTrial, setJustActivatedTrial] = useState(false);
  const sp = (k) => (v) => setPf(p => ({ ...p, [k]: v }));


  // Carta de EvoluÃ§Ã£o e observaÃ§Ã£o por dimensÃ£o: vivem em Insights â
  // TrajetÃ³ria (renderReport, componente CRM), nÃ£o aqui. PerfilForm Ã© sÃ³
  // conta/dados pessoais â ver comentÃ¡rio acima de renderInsightsHub no
  // componente CRM.


  // Estado do trial gratuito do Assistente de WhatsApp (10 dias, contados a
  // partir do primeiro cadastro do nÃºmero â nÃ£o da criaÃ§Ã£o da conta).
  const trialStartedAt = profile?.whatsapp_trial_started_at || null;
  const diasDeTrial     = trialStartedAt ? (Date.now() - new Date(trialStartedAt).getTime()) / 86400000 : null;
  const trialExpirado   = !isPro && diasDeTrial !== null && diasDeTrial > 10;
  const diasRestantes   = diasDeTrial !== null ? Math.max(0, Math.ceil(10 - diasDeTrial)) : null;
  const canEditWhatsapp = isPro || !trialExpirado;


  const handleSave = async () => {
    setSaving(true); setErr(""); setSaved(false); setJustActivatedTrial(false);
    const calendarIcsUrlTrimmed = (pf.calendarIcsUrl || "").trim();
    if (calendarIcsUrlTrimmed && !/^https?:\/\//i.test(calendarIcsUrlTrimmed)) {
      setErr("O link do calendÃ¡rio precisa comeÃ§ar com http:// ou https://");
      setSaving(false);
      return;
    }
    const whatsappNormalizado = normalizeWhatsapp(pf.whatsapp);
    // Primeira vez que este usuÃ¡rio Free cadastra um WhatsApp: inicia o
    // relÃ³gio do trial de 10 dias. Nunca reinicia se jÃ¡ existir uma data.
    const primeiroCadastro = !isPro && !!whatsappNormalizado && !profile?.whatsapp_trial_started_at;
    const payload = {
      name:         pf.name || null,
      first_name:   pf.name || null,
      company:      pf.company || null,
      role:         pf.role || null,
      segment:      pf.segment || null,
      state:        pf.state || null,
      city:         pf.city || null,
      whatsapp:     whatsappNormalizado,
      instagram:    pf.instagram || null,
      linkedin:     pf.linkedin || null,
      hobbies:      pf.hobbies || null,
      birthday:     pf.birthday || null,
      network_size: pf.network_size || null,
      challenge:    pf.challenges.length > 0 ? pf.challenges.join(",") : null,
      calendar_ics_url: calendarIcsUrlTrimmed || null,
      ...(primeiroCadastro ? { whatsapp_trial_started_at: new Date().toISOString() } : {}),
    };
    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
      if (error) { console.error("[PerfilForm] update error:", error); throw error; }
      setSaved(true);
      if (primeiroCadastro) setJustActivatedTrial(true);
      setTimeout(() => setSaved(false), 3000);
      // Atualiza o estado do profile no componente pai para que a aba
      // Perfil nÃ£o volte a mostrar dados antigos/vazios ao ser reaberta.
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
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: 0 }}>Mantenha suas informaÃ§Ãµes atualizadas para personalizar os insights da IA.</p>
      </div>
      {isPro ? (
        <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>ð±</span>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Cadastre seu WhatsApp para usar o Assistente de IA</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Com seu nÃºmero cadastrado, vocÃª pode conversar com o assistente {BRAND.name} diretamente pelo WhatsApp e receber insights personalizados sobre sua rede.</div>
          </div>
        </div>
      ) : trialExpirado ? (
        <div style={{ background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>ð</span>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.txt, marginBottom: 3 }}>Seu teste grÃ¡tis do WhatsApp acabou</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>VocÃª testou o assistente {BRAND.name} por 10 dias grÃ¡tis pelo WhatsApp. Assine o PRO para continuar usando sem limite.</div>
            <button onClick={openAccessKey} style={{ background: "none", border: "none", fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: 6 }}>Tenho uma chave de acesso</button>
          </div>
        </div>
      ) : (
        <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>ð±</span>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>
              {trialStartedAt ? `Teste grÃ¡tis ativo â ${diasRestantes} dia(s) restante(s)` : "Cadastre seu WhatsApp e teste grÃ¡tis por 10 dias"}
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>
              {trialStartedAt
               ? `Seu assistente ${BRAND.name} jÃ¡ estÃ¡ disponÃ­vel no WhatsApp.`
                : `Ao salvar seu nÃºmero, vocÃª libera 10 dias grÃ¡tis do assistente ${BRAND.name} direto pelo WhatsApp.`}
            </div>
            {trialStartedAt && (
             <a href="https://wa.me/5511988630785" target="_blank" rel="noreferrer"
                style={{ display: "inline-block", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textDecoration: "none", marginTop: 6 }}>
                Abrir conversa e ativar â
              </a>
            )}
          </div>
        </div>
      )}
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 16 }}>Dados Pessoais</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="Nome completo" value={pf.name} onChange={sp('name')} placeholder="Seu nome" /></div>
          <Inp label="Empresa" value={pf.company} onChange={sp('company')} placeholder="Empresa onde atua" />
          <Inp label="Cargo / FunÃ§Ã£o" value={pf.role} onChange={sp('role')} placeholder="Ex: Gerente Comercial" />
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
              <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: canEditWhatsapp ? C.gold : C.txL, display: "block", marginBottom: 6 }}>ð± WhatsApp <span style={{ color: C.txL, fontWeight: 400 }}>{isPro ? "(para o Assistente de IA)" : trialExpirado ? "(teste grÃ¡tis encerrado)" : "(Assistente de IA â teste grÃ¡tis 10 dias)"}</span></label>
              <input type="tel" value={pf.whatsapp || ""} onChange={e => sp('whatsapp')(e.target.value)} disabled={!canEditWhatsapp} placeholder={canEditWhatsapp ? "Ex: 11999999999 (DDD + nÃºmero, sem 55)" : "Assine o PRO para ativar"} style={{ width: "100%", boxSizing: "border-box", background: canEditWhatsapp ? C.sf : C.w06, border: `1px solid ${canEditWhatsapp ? C.gold+"50" : C.brd}`, borderRadius: 8, padding: "12px 14px", fontFamily: "'DM Sans'", fontSize: 14, color: canEditWhatsapp ? C.txt : C.txL, outline: "none", cursor: canEditWhatsapp ? "text" : "not-allowed" }} />
            </div>
          </div>
          <Inp label="Instagram" value={pf.instagram} onChange={sp('instagram')} placeholder="@seuinstagram" />
          <Inp label="LinkedIn" value={pf.linkedin} onChange={sp('linkedin')} placeholder="linkedin.com/in/voce" />
        </div>
      </div>
      {isPro && <CalendarConnectionCard pf={pf} sp={sp} />}
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.txL, marginBottom: 16 }}>Contexto Profissional</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Sel label="Tamanho da rede" value={pf.network_size} onChange={sp('network_size')} options={NETWORK_SIZES} placeholder="Selecione..." />
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 8 }}>Principais desafios <span style={{ color: C.txL, fontWeight: 400 }}>(selecione quantos quiser)</span></label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {CHALLENGES.map(c => (
                <button key={c.value} onClick={() => toggleChallenge(c.value)} style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 20, cursor: "pointer", border: pf.challenges.includes(c.value) ? `1px solid ${C.gold}` : `1px solid ${C.brd}`, background: pf.challenges.includes(c.value) ? `${C.gold}18` : "transparent", color: pf.challenges.includes(c.value) ? C.gold : C.txM, transition: `all ${MOTION.fast}` }}>{c.label}</button>
              ))}
            </div>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="AniversÃ¡rio" value={pf.birthday} onChange={sp('birthday')} type="date" /></div>
          <div style={{ gridColumn: "1 / -1" }}><Inp label="Hobbies & Interesses" value={pf.hobbies} onChange={sp('hobbies')} placeholder="Ex: Pesca, Agro, Tecnologia..." textarea /></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <Btn onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar alteraÃ§Ãµes"}</Btn>
        {saved && <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.grn }}>â Perfil atualizado com sucesso!</span>}
        {err   && <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.cor }}>{err}</span>}
      </div>
      {justActivatedTrial && (
        <div style={{ background: `${C.gold}12`, border: `1px solid ${C.gold}40`, borderRadius: 12, padding: "14px 18px", marginTop: 16, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>ð</span>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>WhatsApp ativado! Seu teste grÃ¡tis de 10 dias comeÃ§ou agora.</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>Abra a conversa com o assistente no WhatsApp para comeÃ§ar.</div>
           <a href="https://wa.me/5511988630785" target="_blank" rel="noreferrer"
              style={{ display: "inline-block", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textDecoration: "none", marginTop: 6 }}>
              Abrir conversa e ativar â
            </a>
          </div>
        </div>
      )}
    </div>
  );
}


/* âââ CRM APP âââââââââââââââââââââââââââââââââââââââââââââ */
function CRM({ profile, assessment, onReset, user, onProfileUpdate }) {
  const network = useNetworkCircles(user?.id);
  const [contactCircleDraft, setContactCircleDraft] = useState("");
  const [circleFocus, setCircleFocus] = useState(null);
  const [openedFromCircle, setOpenedFromCircle] = useState(false);
  const [circleSaveNotice, setCircleSaveNotice] = useState("");
  const [view, setView] = useState("dash");
  const [orgOverview, setOrgOverview] = useState(null);
  const [orgOverviewLoading, setOrgOverviewLoading] = useState(false);
  const [orgOverviewError, setOrgOverviewError] = useState("");
  const [orgTrend, setOrgTrend] = useState(null);
  const [orgDeclineAlerts, setOrgDeclineAlerts] = useState(null);
  const [orgInfo, setOrgInfo] = useState(null);
  const [orgCodeBusy, setOrgCodeBusy] = useState(false);
  const [orgCodeCopied, setOrgCodeCopied] = useState(false);
  const [orgNameDraft, setOrgNameDraft] = useState("");
  const [orgNameBusy, setOrgNameBusy] = useState(false);
  const [orgNameEditing, setOrgNameEditing] = useState(false);
  const [orgAnalysisText, setOrgAnalysisText] = useState("");
  const [orgAnalysisLoading, setOrgAnalysisLoading] = useState(false);
  const [orgAnalysisError, setOrgAnalysisError] = useState("");
  const [orgAnalysisGeneratedAt, setOrgAnalysisGeneratedAt] = useState(null);
  const [orgConsentBusy, setOrgConsentBusy] = useState(false);
  const [joinOrgCode, setJoinOrgCode] = useState("");
  const [joinOrgBusy, setJoinOrgBusy] = useState(false);
  const [joinOrgMsg, setJoinOrgMsg] = useState("");
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [akCode, setAkCode]   = useState("");
  const [akMsg, setAkMsg]     = useState("");
  const [akBusy, setAkBusy]   = useState(false);
  const [proToast, setProToast] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [cts, setCts] = useState([]);
  const [savingContact, setSavingContact] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [schedOpenId, setSchedOpenId] = useState(null); // id do contato com o form de agendamento aberto inline
  const [schedForm, setSchedForm] = useState({ type: "reuniao", date: "", time: "09:00", duration: "30", location: "", topic: "" });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [its, setIts] = useState([]);
  const [selId, setSelId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [modal, setModal] = useState(null);
  useEffect(() => { setContactCircleDraft(""); }, [modal]);
  const [intCid, setIntCid] = useState(null);
  const [teiaFilter, setTeiaFilter] = useState("todos");
  const [teiaSel, setTeiaSel] = useState(null);
  const [teiaLegendOpen, setTeiaLegendOpen] = useState(false);
  const [dbgMsg, setDbgMsg] = useState("");
  const [cf, setCf] = useState({ name: "", company: "", role: "", category: "potencial", proximity: "3", idealFreq: "30", notes: "", howMet: "", whatsapp: "", contactEmail: "", linkedin: "", birthday: "", hobbies: "", mainCulture: "", city: "", stateCode: "", nextAction: "", nextActionDate: "", influenciaPessoas: "", geraOportunidade: "", abrePortas: "", momentoAtual: "" });
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsErr, setMetricsErr] = useState("");
  const [inf, setInf] = useState({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });


  // ââ Computed plan âââââââââââââââââââââââââââââââââââââââââ
  const isPro         = isProUser(profile, user?.email);
  const planLabel     = getPlanLabel(profile, user?.email);
  const canAddContact = isPro || cts.length < FREE_CT_LIMIT;
  // Caminho B (28/09): a Home padrÃ£o volta a ser o painel <HomeToday>.
  // A Danna (conversa por voz) vira opt-in: ligada por padrÃ£o sÃ³ para a
  // conta do laboratÃ³rio; qualquer usuÃ¡rio pode ativar/desativar pela Home.
  // PreferÃªncia salva por usuÃ¡rio no navegador ("on" | "off" | null).
  const CONEXIA_LAB_USER_ID = "848ebde1-dd60-4652-8f9a-3e86dd31482f";
  const dannaPrefKey = user?.id ? `conexia_danna_home_${user.id}` : "";
  // danna-single-click-v1
  const dannaStartRef = useRef(null);
  const [dannaPref, setDannaPref] = useState(null);
  useEffect(() => {
    if (!dannaPrefKey) { setDannaPref(null); return; }
    try { setDannaPref(window.localStorage.getItem(dannaPrefKey)); } catch { setDannaPref(null); }
  }, [dannaPrefKey]);
  const setDannaHome = (on) => {
    const value = on ? "on" : "off";
    setDannaPref(value);
    try { if (dannaPrefKey) window.localStorage.setItem(dannaPrefKey, value); } catch {}
  };
  const openDannaConversation = () => {
    flushSync(() => setDannaHome(true));
    dannaStartRef.current?.start();
  };
  // Voz BETA: somente pagantes (assinatura Stripe ativa) e admins.
  // Mesma regra validada no servidor (public.has_paid_voice_access).
  const [hasVoiceAccess, setHasVoiceAccess] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!user?.id) { setHasVoiceAccess(false); return; }
    supabase.rpc("my_voice_access").then(({ data, error }) => {
      if (!alive) return;
      if (error) console.warn("[Danna] my_voice_access", error);
      setHasVoiceAccess(data === true);
    });
    return () => { alive = false; };
  }, [user?.id]);
  // Motor de voz (BETA): admins escolhem entre Gemini e OpenAI para comparar.
  // Demais pagantes usam o padrÃ£o abaixo.
  const DEFAULT_VOICE_ENGINE = "gemini";
  const voiceEngineKey = user?.id ? `conexia_danna_engine_${user.id}` : "";
  const [voiceEngine, setVoiceEngineState] = useState(DEFAULT_VOICE_ENGINE);
  useEffect(() => {
    if (!voiceEngineKey) return;
    try {
      const saved = window.localStorage.getItem(voiceEngineKey);
      if (saved === "gemini" || saved === "openai") setVoiceEngineState(saved);
    } catch {}
  }, [voiceEngineKey]);
  const setVoiceEngine = (engine) => {
    setVoiceEngineState(engine);
    try { if (voiceEngineKey) window.localStorage.setItem(voiceEngineKey, engine); } catch {}
  };
  const canPickVoiceEngine = ADMIN_EMAILS.includes(user?.email);

  const isConexiaLab = Boolean(user?.id) && hasVoiceAccess && (
    dannaPref === "on" ||
    (dannaPref !== "off" && user?.id === CONEXIA_LAB_USER_ID)
  );


  // ObservaÃ§Ã£o comportamental por dimensÃ£o (declarado vs. observado) â
  // consumida em renderReport (Insights â TrajetÃ³ria). Ver
  // shared/dimensionObservation.js pra fundamentaÃ§Ã£o de cada dimensÃ£o.
  const [dimObservation, setDimObservation] = useState(null);
  const [expandedDim, setExpandedDim] = useState(null); // dimensÃ£o aberta em "Suas 6 dimensÃµes" (TrajetÃ³ria)
  useEffect(() => {
    if (!user?.id || !isPro) return;
    supabase.from('plan_insights')
      .select('description, created_at')
      .eq('user_id', user.id)
      .eq('insight_type', 'dimension_observation')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        if (error) { console.error('[CRM] falha ao carregar observaÃ§Ã£o por dimensÃ£o:', error); return; }
        if (data?.[0]?.description) {
          try { setDimObservation(JSON.parse(data[0].description)); }
          catch (e) { console.error('[CRM] observaÃ§Ã£o por dimensÃ£o em formato inesperado:', e); }
        }
      });
  }, [user?.id, isPro]);


  // Trial grÃ¡tis do Assistente de WhatsApp: 10 dias a partir do cadastro do
  // nÃºmero (whatsapp_trial_started_at), independente de virar PRO depois.
  const diasDeTrialCrm    = profile?.whatsapp_trial_started_at ? (Date.now() - new Date(profile.whatsapp_trial_started_at).getTime()) / 86400000 : null;
  const hasWhatsappAccess = isPro || (diasDeTrialCrm !== null && diasDeTrialCrm <= 10);


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
      const msgs = { invalid:"Chave de acesso invÃ¡lida.", inactive:"Essa chave nÃ£o estÃ¡ mais ativa.", expired:"Essa chave expirou.", limit_reached:"Essa chave jÃ¡ atingiu o limite de ativaÃ§Ãµes.", already_used:"Essa chave jÃ¡ foi utilizada por este usuÃ¡rio." };
      if (!data?.ok) { setAkMsg(msgs[data?.error] || "Erro ao ativar chave."); setAkBusy(false); return; }
      await loadUserData(user.id);
      setShowAccessKey(false); setAkCode(""); setAkMsg("");
      setProToast(true); setTimeout(() => setProToast(false), 4000);
    } catch (e) { setAkMsg("Erro ao conectar. Tente novamente."); }
    setAkBusy(false);
  };
  const openAccessKey = () => { setAkCode(""); setAkMsg(""); setShowAccessKey(true); };


  // ââ Analytics: rastrear navegaÃ§Ã£o de abas âââââââââââââââ
  const trackEvent = useCallback(async (eventType, tabName, metadata = {}) => {
    if (!user?.id) return;
    try {
      await supabase.from("page_events").insert({
        user_id: user.id,
        event_type: eventType,
        tab_name: tabName,
        metadata: Object.keys(metadata).length ? metadata : null,
      });
    } catch (_) { /* silencioso â nÃ£o interrompe o fluxo */ }
  }, [user?.id]);


  // Rastrear toda vez que a aba muda
  useEffect(() => {
    trackEvent("tab_view", view);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps


  const load = useCallback(async () => {
    if (!user?.id) { setDbgMsg("â ï¸ user.id ausente â nÃ£o autenticado"); return; }
    const { data: c, error: ce } = await supabase.from("contacts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    const { data: i, error: ie } = await supabase.from("interactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (ce) { setDbgMsg("â Erro ao buscar contatos: " + ce.message); return; }
    if (ie) { setDbgMsg("â Erro ao buscar interaÃ§Ãµes: " + ie.message); return; }
    setDbgMsg("â user:" + user.id.slice(0,8) + " | contatos:" + (c?.length || 0));
    setCts((c || []).map(ct => ({ ...ct, health: hScore(ct.last_interaction_at, ct.ideal_frequency_days || 30), notes: ct.personal_notes, howMet: ct.how_met, idealFreq: ct.ideal_frequency_days, lastInteraction: ct.last_interaction_at, nextAction: ct.next_action, nextActionDate: ct.next_action_date, whatsapp: ct.whatsapp, contactEmail: ct.contact_email, linkedin: ct.linkedin, birthday: ct.birthday, hobbies: ct.hobbies, mainCulture: ct.main_culture, city: ct.city, stateCode: ct.state_code, influenciaPessoas: ct.influencia_pessoas ?? null, geraOportunidade: ct.gera_oportunidade ?? null, abrePortas: ct.abre_portas ?? null, momentoAtual: ct.momento_atual ?? null })));
    setIts((i || []).map(it => ({ ...it, desc: it.description, contactId: it.contact_id, createdAt: it.created_at, valueGen: it.value_generated })));
  }, [user?.id]);


  useEffect(() => { load(); }, [load]);


  // ââ MÃ©tricas administrativas: acompanhamento do produto CONÃXIA ââ
  // Contas de teste do prÃ³prio admin ficam de fora de todas as agregaÃ§Ãµes,
  // para refletir apenas o comportamento de usuÃ¡rios reais.
  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true); setMetricsErr("");
    try {
      const [{ data: profs, error: pe }, { data: assess, error: ae }, { data: inter, error: ie }, { data: subs, error: se }] = await Promise.all([
        supabase.from("profiles").select("id,email,created_at,onboarding_completed,assessment_completed,is_pro,plan,pro_access_source,pro_expires_at"),
        supabase.from("assessments").select("id,user_id,created_at"),
        supabase.from("interactions").select("id,user_id"),
        supabase.from("stripe_subscriptions").select("id,user_id,status,stripe_price_id"),
      ]);
      if (pe || ae || ie || se) throw (pe || ae || ie || se);


      const testers = new Set((profs || []).filter(p => ADMIN_EMAILS.includes((p.email || "").toLowerCase())).map(p => p.id));
      const real = (profs || []).filter(p => !testers.has(p.id));


      const onboardingDone = real.filter(p => p.onboarding_completed).length;
      const assessmentDone = real.filter(p => p.assessment_completed).length;
      const usersWithInteraction = new Set((inter || []).filter(i => !testers.has(i.user_id)).map(i => i.user_id)).size;
      const proReal = real.filter(p => p.is_pro);
      const proBySource = proReal.reduce((acc, p) => { const k = p.pro_access_source || "desconhecido"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
      const payingReal = (subs || []).filter(s => !testers.has(s.user_id) && s.status === "active" && s.stripe_price_id !== "price_pro_monthly_test").length;


      const weekKey = (d) => { const dt = new Date(d); const day = dt.getUTCDay() || 7; dt.setUTCDate(dt.getUTCDate() - day + 1); return dt.toISOString().slice(0, 10); };
      const weekly = {};
      real.forEach(p => { const k = weekKey(p.created_at); weekly[k] = (weekly[k] || 0) + 1; });
      const weeklySignups = Object.entries(weekly).sort(([a], [b]) => a.localeCompare(b)).map(([week, count]) => ({ week, count }));


      setMetrics({
        totalReal: real.length,
        onboardingDone, onboardingPct: real.length ? Math.round(onboardingDone / real.length * 100) : 0,
        assessmentDone, assessmentPct: real.length ? Math.round(assessmentDone / real.length * 100) : 0,
        usersWithInteraction,
        proConcedido: proReal.length,
        proBySource,
        payingReal,
        weeklySignups,
      });
    } catch (e) {
      setMetricsErr(e?.message || "Erro ao carregar mÃ©tricas.");
    }
    setMetricsLoading(false);
  }, []);




  const addC = async () => {
    if (!cf.name.trim() || !user?.id) { setDbgMsg("â ï¸ Bloqueado: " + (!user?.id ? "sem user.id" : "nome vazio")); return; }
    if (!isPro && cts.length >= FREE_CT_LIMIT) { setModal("limiteCt"); return; }
    if (savingContact) return; // trava contra duplo clique / duplo submit
    setSavingContact(true);
    try {
    setDbgMsg("â³ Salvando...");
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
    if (error) { setDbgMsg("â " + error.message + " [" + error.code + "]"); return; }
    setDbgMsg("â Salvo: " + newContact?.name);
    if (newContact) {
      if (contactCircleDraft) {
        try { await network.assign(newContact.id, contactCircleDraft); }
        catch (e) {
          setCircleSaveNotice("Contato salvo. " + e.message + " Organize pela Minha rede.");
        }
      }
      trackEvent("contact_added", "contacts", { contactId: newContact.id });
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
    } finally {
      setSavingContact(false);
    }
  };


  const addI = async () => {
    if (!inf.desc.trim() || !intCid || !user?.id) return;
    if (!isPro) {
      const nIntContato = its.filter(i => i.contactId === intCid).length;
      if (nIntContato >= FREE_IT_PER_CT_LIMIT) { setModal("limiteIt"); return; }
    }
    if (savingInteraction) return; // trava contra duplo clique / duplo submit
    setSavingInteraction(true);
    try {
    await supabase.from("interactions").insert({
      user_id: user.id, contact_id: intCid, type: inf.type,
      description: inf.desc.trim(), sentiment: inf.sentiment,
      tags: inf.tags ? inf.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      value_generated: inf.valueGen,
    });
    // Atualiza last_interaction_at no contato (essencial para Health Score) e
    // limpa a prÃ³xima aÃ§Ã£o/data pendente â registrar uma interaÃ§Ã£o resolve a
    // pendÃªncia anterior, igual jÃ¡ acontece no assistente de WhatsApp. Sem isso,
    // um contato com "prÃ³xima aÃ§Ã£o vencida" nunca some da lista de Movimentos
    // da Semana, mesmo depois de jÃ¡ ter sido acionado.
    await supabase.from("contacts").update({
      last_interaction_at: new Date().toISOString(),
      next_action: null,
      next_action_date: null,
    }).eq("id", intCid).eq("user_id", user.id);
    trackEvent("interaction_logged", "contacts", { contactId: intCid, type: inf.type });
    // Push interaÃ§Ã£o para Make
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
      } catch (e) { console.warn("[Make push interaÃ§Ã£o]", e); }
    }
    setInf({ type: "mensagem", desc: "", sentiment: "positivo", tags: "", valueGen: false });
    setModal(null);
    await load();
    } finally {
      setSavingInteraction(false);
    }
  };


  const saveSchedule = async (contactId) => {
    if (!schedForm.date || !contactId || !user?.id) return;
    if (savingSchedule) return; // trava contra duplo clique / duplo submit
    setSavingSchedule(true);
    try {
      const scheduledAt = new Date(`${schedForm.date}T${schedForm.time || "09:00"}:00`).toISOString();
      const { error } = await supabase.from("scheduled_events").insert({
        user_id: user.id, contact_id: contactId, type: schedForm.type,
        scheduled_at: scheduledAt, duration_minutes: parseInt(schedForm.duration) || 30,
        location: schedForm.location.trim() || null, notes: schedForm.topic.trim() || null, source: "app",
      });
      if (error) { setDbgMsg("â Erro ao agendar: " + error.message); return; }
      // Espelha em contacts.next_action/next_action_date para nÃ£o quebrar nada que jÃ¡
      // depende desses campos hoje (lembrete automÃ¡tico do WhatsApp, HomeToday, intent
      // schedule_action do bot). A tabela scheduled_events Ã© a fonte de verdade nova;
      // isso aqui Ã© sÃ³ compatibilidade com o que jÃ¡ roda em produÃ§Ã£o.
      const tp = ITYPES.find(t => t.value === schedForm.type);
      const topic = schedForm.topic.trim();
      await supabase.from("contacts").update({
        next_action: `${tp?.icon || "ð"} ${topic || tp?.label || "Agendamento"}${schedForm.location.trim() ? ` Â· ${schedForm.location.trim()}` : ""}`,
        next_action_date: schedForm.date,
      }).eq("id", contactId).eq("user_id", user.id);
      trackEvent("scheduled_event_created", "contacts", { contactId, type: schedForm.type });
      // Gera e baixa o convite .ics na hora â Ã© o motivo de existir o agendamento:
      // cair na agenda de verdade do usuÃ¡rio (Outlook, Google ou Apple), sem OAuth.
      const contactName = cts.find(c => c.id === contactId)?.name || "contato";
      const ics = buildICS({
        title: `${tp?.icon || "ð"} ${topic || tp?.label || "Agendamento"} Â· ${contactName}`,
        description: topic ? `${topic}\n\nAgendado via CONÃXIA` : "Agendado via CONÃXIA",
        location: schedForm.location.trim(),
        start: scheduledAt,
        durationMinutes: parseInt(schedForm.duration) || 30,
      });
      downloadICS(ics, `conexia-${contactName.replace(/\s+/g, "_").toLowerCase()}.ics`);
      setSchedForm({ type: "reuniao", date: "", time: "09:00", duration: "30", location: "", topic: "" });
      setSchedOpenId(null);
      await load();
    } finally {
      setSavingSchedule(false);
    }
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
  const isMetricsAdmin = isAdminEmail(user?.email);
  // NavegaÃ§Ã£o principal reorganizada em 3 Ã¢ncoras (Hoje / Rede / Eu). Os ids
  // internos de view ("contacts", "perfil", "teia", "plano", "report", "ia")
  // continuam existindo exatamente como antes â sÃ³ o que aparece na barra
  // principal mudou, para nÃ£o quebrar nenhuma das chamadas diretas de
  // setView(...) espalhadas pelo restante do arquivo. "Analytics" saiu da
  // navegaÃ§Ã£o porque consulta uma tabela/coluna que nÃ£o existe no schema
  // atual (contacts.health_score, assessment_results) â estÃ¡ confirmado
  // quebrado, e a regra Ã© nÃ£o manter uma funcionalidade sabidamente quebrada
  // sÃ³ para preservar a estrutura anterior.
  // "Insights" Ã© o chamariz da IA na coluna lateral (com Plano e RelatÃ³rio
  // juntos). Cadastro/perfil ficou sÃ³ no botÃ£o de baixo, na Ã¡rea da conta
  // (view="perfil") â nÃ£o tem mais 2 caminhos pro mesmo lugar.
  const NAVS = [
    { id: "dash", icon: "â", label: "Hoje" },
    { id: "contacts", icon: "â", label: "Rede" },
    { id: "insights", icon: "ð§ ", label: "Insights" },
    ...(admin ? [{ id: "mentor", icon: "ð", label: "Mentor" }] : []),
    ...(admin ? [{ id: "export", icon: "â¬", label: "Exportar" }] : []),
    ...(isMetricsAdmin ? [{ id: "metrics", icon: "ð", label: "MÃ©tricas" }] : []),
    ...(profile?.organization_id && profile?.org_role === "admin" ? [{ id: "empresa", icon: "ð¢", label: "Empresa" }] : []),
  ];


  useEffect(() => {
    if (view === "metrics" && isMetricsAdmin && !metrics && !metricsLoading) loadMetrics();
  }, [view, isMetricsAdmin, metrics, metricsLoading, loadMetrics]);


  // CONÃXIA B2B â visÃ£o agregada da equipe, sÃ³ para org_role
  // 'admin'. LÃª exclusivamente get_org_team_overview() (SECURITY DEFINER),
  // que nunca expÃµe contacts/interactions/email â sÃ³ arquÃ©tipo e o estado
  // categÃ³rico semanal jÃ¡ computado por relationship-weekly-summary-cron.js.
  useEffect(() => {
    if (view !== "empresa" || !profile?.organization_id || profile?.org_role !== "admin") return;
    if (orgOverview || orgOverviewLoading) return;
    setOrgOverviewLoading(true);
    setOrgOverviewError("");
    Promise.all([
      supabase.rpc("get_org_team_overview", { p_organization_id: profile.organization_id }),
      supabase.from("organizations").select("name,invite_code").eq("id", profile.organization_id).maybeSingle(),
      supabase.rpc("get_org_team_trend", { p_organization_id: profile.organization_id, p_weeks: 8 }),
      supabase.from("org_ai_insights").select("insight_text,generated_at,week").eq("organization_id", profile.organization_id).order("week", { ascending: false }).limit(1).maybeSingle(),
      supabase.rpc("get_org_decline_alerts", { p_organization_id: profile.organization_id }),
    ])
      .then(([overviewRes, orgRes, trendRes, insightRes, alertsRes]) => {
        if (overviewRes.error) { setOrgOverviewError(overviewRes.error.message || "NÃ£o foi possÃ­vel carregar a visÃ£o da equipe."); return; }
        setOrgOverview(overviewRes.data || []);
        if (orgRes.data) { setOrgInfo(orgRes.data); setOrgNameDraft(orgRes.data.name || ""); }
        if (!trendRes.error) setOrgTrend(trendRes.data || []);
        if (!insightRes.error && insightRes.data) { setOrgAnalysisText(insightRes.data.insight_text); setOrgAnalysisGeneratedAt(insightRes.data.generated_at); }
        if (!alertsRes.error) setOrgDeclineAlerts(alertsRes.data || []);
      })
      .catch((e) => setOrgOverviewError(e?.message || "NÃ£o foi possÃ­vel carregar a visÃ£o da equipe."))
      .finally(() => setOrgOverviewLoading(false));
  }, [view, profile?.organization_id, profile?.org_role, orgOverview, orgOverviewLoading]);


  const regenerateOrgCode = async () => {
    if (!profile?.organization_id) return;
    setOrgCodeBusy(true);
    try {
      const { data, error } = await supabase.rpc("regenerate_org_invite_code", { p_organization_id: profile.organization_id });
      if (error) { console.error("[OrgCode]", error); return; }
      setOrgInfo((prev) => ({ ...(prev || {}), invite_code: data }));
    } catch (e) {
      console.error("[OrgCode]", e);
    } finally {
      setOrgCodeBusy(false);
    }
  };


  const copyOrgCode = async () => {
    if (!orgInfo?.invite_code) return;
    try {
      await navigator.clipboard.writeText(orgInfo.invite_code);
      setOrgCodeCopied(true);
      setTimeout(() => setOrgCodeCopied(false), 1800);
    } catch (e) { /* clipboard indisponÃ­vel â botÃ£o sÃ³ nÃ£o confirma visualmente */ }
  };


  const saveOrgName = async () => {
    const name = orgNameDraft.trim();
    if (!name || !profile?.organization_id) return;
    setOrgNameBusy(true);
    try {
      const { error } = await supabase.from("organizations").update({ name }).eq("id", profile.organization_id);
      if (error) { console.error("[OrgName]", error); return; }
      setOrgInfo((prev) => ({ ...(prev || {}), name }));
      setOrgNameEditing(false);
    } catch (e) {
      console.error("[OrgName]", e);
    } finally {
      setOrgNameBusy(false);
    }
  };


  // AnÃ¡lise de IA da equipe â a IA sÃ³ recebe percentuais agregados
  // (nunca nome, nunca dado individual). Sob demanda (botÃ£o), nÃ£o
  // automÃ¡tica, pra nÃ£o gerar custo/latÃªncia toda vez que o admin abre a
  // aba. NÃ£o faz cache no banco na v1 â cada clique gera de novo.
  const generateOrgAnalysis = async () => {
    if (!orgTeamStats) return;
    setOrgAnalysisLoading(true);
    setOrgAnalysisError("");
    setOrgAnalysisText("");
    try {
      const dimLines = Object.entries(orgTeamStats.perDimPct)
        .map(([dim, p]) => `- ${DIMENSION_LABELS[dim] || dim}: ${p.evoluindo}% evoluindo, ${p.estavel}% estÃ¡vel, ${p.perdendo_intensidade}% perdendo intensidade`)
        .join("\n");
      const activityLine = orgActivityStats
        ? `\nAtividade da equipe: ${orgActivityStats.totalContacts} contatos na carteira somada, ${orgActivityStats.totalLast30d} interaÃ§Ãµes nos Ãºltimos 30 dias (${orgActivityStats.totalInteractions} no histÃ³rico total), ${orgActivityStats.totalCooling} contas esfriando (60+ dias sem interaÃ§Ã£o).`
        : "";
      const prompt = `VocÃª Ã© um consultor de inteligÃªncia relacional (metodologia CONÃXIA) analisando o estado agregado e ANÃNIMO de uma equipe comercial de agronegÃ³cio, medido em 6 dimensÃµes relacionais e em volume de atividade. VocÃª nÃ£o recebe nome nem dado de nenhuma pessoa â sÃ³ percentuais e totais da equipe inteira.


Dados desta semana (${orgTeamStats.memberCount} pessoas com dado comportamental computado):
${dimLines}
${activityLine}


Escreva uma anÃ¡lise executiva curta para o gestor da equipe, em portuguÃªs, tom consultivo e direto, 4 a 6 frases corridas (sem bullet points, sem markdown):
1. Qual Ã© o padrÃ£o mais forte da equipe e o que isso indica sobre como ela constrÃ³i relaÃ§Ãµes.
2. Qual dimensÃ£o merece atenÃ§Ã£o e por que isso importa comercialmente.
3. Cruze com a atividade: se hÃ¡ contas esfriando ou baixa atividade recente, comente o risco disso combinado com o padrÃ£o comportamental.
4. Uma recomendaÃ§Ã£o prÃ¡tica e especÃ­fica de aÃ§Ã£o para a prÃ³xima semana.
NÃ£o invente nÃºmeros alÃ©m dos fornecidos. NÃ£o mencione nomes â vocÃª nÃ£o tem acesso a nenhum.`;
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, maxTokens: 500 }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text?.trim() || "";
      if (!text) { setOrgAnalysisError("A IA nÃ£o retornou anÃ¡lise. Tenta de novo."); return; }
      setOrgAnalysisText(text);
      setOrgAnalysisGeneratedAt(null);
    } catch (e) {
      setOrgAnalysisError("NÃ£o foi possÃ­vel gerar a anÃ¡lise agora. Tenta de novo.");
    } finally {
      setOrgAnalysisLoading(false);
    }
  };


  // Guardrail de consentimento: vÃ­nculo a organizaÃ§Ã£o nunca Ã© silencioso.
  // respond_to_org_invite() Ã© a Ãºnica via de escrita nesses campos vinda
  // do client â aceitar seta org_consent_status='accepted'; recusar limpa
  // organization_id por completo (a pessoa sai, dados individuais intactos).
  const respondOrgInvite = async (accept) => {
    setOrgConsentBusy(true);
    try {
      const { error } = await supabase.rpc("respond_to_org_invite", { p_accept: accept });
      if (error) { console.error("[OrgConsent]", error); return; }
      if (accept) {
        onProfileUpdate?.({ org_consent_status: "accepted", org_consent_at: new Date().toISOString() });
      } else {
        onProfileUpdate?.({ organization_id: null, org_role: null, org_consent_status: null, org_consent_at: null });
      }
    } catch (e) {
      console.error("[OrgConsent]", e);
    } finally {
      setOrgConsentBusy(false);
    }
  };


  const leaveOrganization = async () => {
    setOrgConsentBusy(true);
    try {
      const { error } = await supabase.rpc("leave_organization");
      if (error) { console.error("[OrgConsent]", error); return; }
      onProfileUpdate?.({ organization_id: null, org_role: null, org_consent_status: null, org_consent_at: null });
    } catch (e) {
      console.error("[OrgConsent]", e);
    } finally {
      setOrgConsentBusy(false);
    }
  };


  // Auto-declaraÃ§Ã£o: pessoa digita o cÃ³digo da prÃ³pria empresa e entra
  // sozinha. join_organization_by_code() jÃ¡ bloqueia quem jÃ¡ estÃ¡ em uma
  // organizaÃ§Ã£o, e o trigger do banco jÃ¡ forÃ§a org_consent_status de
  // volta pra 'pending' â o modal de consentimento assume dali em diante.
  const joinOrganization = async () => {
    const code = joinOrgCode.trim();
    if (!code) return;
    setJoinOrgBusy(true);
    setJoinOrgMsg("");
    try {
      const { data, error } = await supabase.rpc("join_organization_by_code", { p_code: code });
      if (error) {
        setJoinOrgMsg(
          error.message?.includes("invalid_code") ? "CÃ³digo invÃ¡lido." :
          error.message?.includes("already_in_organization") ? "VocÃª jÃ¡ estÃ¡ em uma organizaÃ§Ã£o â saia dela antes de entrar em outra." :
          "NÃ£o foi possÃ­vel entrar. Confira o cÃ³digo e tente de novo."
        );
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      onProfileUpdate?.({ organization_id: row?.organization_id, org_role: "membro", org_consent_status: "pending" });
      setJoinOrgCode("");
      setJoinOrgMsg("");
    } catch (e) {
      setJoinOrgMsg("NÃ£o foi possÃ­vel entrar. Tente de novo.");
    } finally {
      setJoinOrgBusy(false);
    }
  };


  const renderMentor = () => {
    // In localStorage mode, mentor sees shared data. In Supabase mode, RLS handles cross-user reads.
    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Painel do Mentor</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>VisÃ£o administrativa â apenas para {ADMIN_EMAIL}</p>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, marginBottom: 14 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.vio, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Seus dados locais</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
            {profile?.name} Â· {profile?.email}<br />
            {profile?.role} Â· {profile?.segment} Â· {profile?.state}<br />
            Perfil: {pf?.emoji} {pf?.name} Â· Score: {assessment?.overall}%<br />
            {cts.length} contatos Â· {its.length} interaÃ§Ãµes
          </div>
        </div>
        <div style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 8 }}>Quando migrar para Supabase</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.6 }}>Este painel mostrarÃ¡ todos os mentorados, seus assessments, contatos e interaÃ§Ãµes. A RLS do Supabase garante que sÃ³ o mentor (is_mentor=true) consegue leitura cross-user.</div>
        </div>
      </div>
    );
  };


  // RÃ³tulos legÃ­veis das 6 dimensÃµes, usados nos cards de resumo agregado.
  const DIMENSION_LABELS = {
    intencao_estrategica: "EstratÃ©gia",
    escuta_relacional: "Empatia",
    presenca_mercado: "PresenÃ§a",
    reciprocidade_ativa: "Reciprocidade",
    ritual_consistencia: "ConsistÃªncia",
    confianca_autentica: "Autenticidade",
  };


  // Resumo agregado de equipe â estatÃ­stica do time, nunca de uma pessoa.
  // SÃ³ calcula/mostra com >=3 membros consentidos com dado, senÃ£o o
  // "agregado" vira o dado individual disfarÃ§ado (n=1 ou n=2 identifica).
  const orgTeamStats = useMemo(() => {
    const withData = (orgOverview || []).filter((m) => m.dimension_observation);
    if (withData.length < 3) return null;
    const perDim = {};
    withData.forEach((m) => {
      Object.entries(m.dimension_observation).forEach(([dim, entry]) => {
        const state = entry?.state;
        if (!perDim[dim]) perDim[dim] = { evoluindo: 0, estavel: 0, perdendo_intensidade: 0, total: 0 };
        if (perDim[dim][state] !== undefined) perDim[dim][state] += 1;
        perDim[dim].total += 1;
      });
    });
    let totalEvoluindo = 0, totalPairs = 0;
    let bestDim = null, bestPct = -1, attentionDim = null, attentionPct = -1;
    const perDimPct = {};
    Object.entries(perDim).forEach(([dim, c]) => {
      totalEvoluindo += c.evoluindo;
      totalPairs += c.total;
      const evolPct = c.total ? c.evoluindo / c.total : 0;
      const estPct = c.total ? c.estavel / c.total : 0;
      const perdPct = c.total ? c.perdendo_intensidade / c.total : 0;
      perDimPct[dim] = { evoluindo: Math.round(evolPct * 100), estavel: Math.round(estPct * 100), perdendo_intensidade: Math.round(perdPct * 100) };
      if (evolPct > bestPct) { bestPct = evolPct; bestDim = dim; }
      if (perdPct > attentionPct) { attentionPct = perdPct; attentionDim = dim; }
    });
    return {
      memberCount: withData.length,
      pctEvoluindo: totalPairs ? Math.round((totalEvoluindo / totalPairs) * 100) : 0,
      bestDim, bestPct: Math.round(bestPct * 100),
      attentionDim, attentionPct: Math.round(attentionPct * 100),
      perDimPct,
    };
  }, [orgOverview]);


  // Atividade agregada â soma bruta de contatos/interaÃ§Ãµes da equipe.
  // Usa o mesmo piso de 3 pessoas que o resto do agregado, mesmo essa
  // mÃ©trica nÃ£o depender do cron semanal (existe assim que hÃ¡ contato
  // cadastrado), pra manter uma Ãºnica rÃ©gua de anonimato em toda a tela.
  const orgActivityStats = useMemo(() => {
    const members = orgOverview || [];
    if (members.length < 3) return null;
    return {
      totalContacts: members.reduce((s, m) => s + (m.contacts_count || 0), 0),
      totalInteractions: members.reduce((s, m) => s + (m.interactions_count || 0), 0),
      totalLast30d: members.reduce((s, m) => s + (m.interactions_last_30d || 0), 0),
      totalCooling: members.reduce((s, m) => s + (m.contacts_cooling_count || 0), 0),
    };
  }, [orgOverview]);


  const renderTeamStatCard = (label, value, sub, accent) => (
    <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: "16px 18px", flex: "1 1 160px", minWidth: 160 }}>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'DM Sans'", fontSize: 26, fontWeight: 700, color: accent || C.txt, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginTop: 4 }}>{sub}</div>}
    </div>
  );


  // VisÃ£o Empresa. SÃ³ categÃ³rico, sÃ³ arquÃ©tipo.
  // Nunca lista contatos, interaÃ§Ãµes ou conteÃºdo de mensagens de ninguÃ©m.
  const renderEmpresa = () => {
    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>VisÃ£o Empresa</h2>
        {orgInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {orgNameEditing ? (
              <>
                <input
                  value={orgNameDraft}
                  onChange={(e) => setOrgNameDraft(e.target.value)}
                  style={{ background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "5px 10px", fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}
                />
                <Btn small onClick={saveOrgName} disabled={orgNameBusy || !orgNameDraft.trim()}>Salvar</Btn>
                <Btn small variant="ghost" onClick={() => { setOrgNameEditing(false); setOrgNameDraft(orgInfo.name || ""); }}>Cancelar</Btn>
              </>
            ) : (
              <>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>{orgInfo.name}</span>
                <button onClick={() => setOrgNameEditing(true)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 11, color: C.gold }}>Renomear</button>
              </>
            )}
          </div>
        )}
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px", maxWidth: 560 }}>
          Estado comportamental semanal e volume de atividade da sua equipe â categÃ³rico e quantitativo, nunca identidade ou conteÃºdo. Quem sÃ£o os contatos de cada pessoa e o que foi dito em qualquer conversa nunca aparecem aqui.
        </p>


        {orgInfo?.invite_code && (
          <div style={{ background: C.gD, border: `1px solid ${C.gL}`, borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>CÃ³digo de convite â {orgInfo.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 18, fontWeight: 700, color: C.txt, letterSpacing: ".08em" }}>{orgInfo.invite_code}</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginTop: 4 }}>Compartilhe com a equipe. Cada pessoa digita esse cÃ³digo em Perfil â "Tem um cÃ³digo de empresa?" e passa pelo consentimento antes de qualquer dado aparecer aqui.</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <Btn small variant="ghost" onClick={copyOrgCode}>{orgCodeCopied ? "Copiado!" : "Copiar"}</Btn>
              <Btn small variant="ghost" onClick={regenerateOrgCode} disabled={orgCodeBusy}>Gerar novo cÃ³digo</Btn>
            </div>
          </div>
        )}


        {orgOverviewLoading && (
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>Carregandoâ¦</div>
        )}


        {!orgOverviewLoading && orgOverviewError && (
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>
            {orgOverviewError}
          </div>
        )}


        {orgDeclineAlerts && orgDeclineAlerts.length > 0 && (
          <div style={{ background: `${C.cor}12`, border: `1px solid ${C.cor}50`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: C.cor, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>â  Queda consecutiva detectada</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {orgDeclineAlerts.map((a) => (
                <div key={a.dimension} style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>
                  <strong>{a.member_count}</strong> {a.member_count === 1 ? "pessoa" : "pessoas"} com <strong>{DIMENSION_LABELS[a.dimension] || a.dimension}</strong> perdendo intensidade hÃ¡ 2+ semanas seguidas
                </div>
              ))}
            </div>
          </div>
        )}


        {!orgOverviewLoading && !orgOverviewError && orgOverview && orgOverview.length === 0 && (
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 16, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>
            Nenhum membro vinculado a esta organizaÃ§Ã£o ainda.
          </div>
        )}


        {!orgOverviewLoading && !orgOverviewError && orgTeamStats && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            {renderTeamStatCard(
              "Evoluindo no geral",
              `${orgTeamStats.pctEvoluindo}%`,
              (() => {
                if (!orgTrend || orgTrend.length < 2) return `${orgTeamStats.memberCount} pessoas com dado`;
                const delta = orgTrend[orgTrend.length - 1].pct_evoluindo - orgTrend[orgTrend.length - 2].pct_evoluindo;
                const arrow = delta > 0 ? "â²" : delta < 0 ? "â¼" : "ï¼";
                return `${arrow} ${Math.abs(delta)} pts vs semana passada`;
              })(),
              C.grn
            )}
            {orgTeamStats.bestDim && renderTeamStatCard("Ponto forte da equipe", DIMENSION_LABELS[orgTeamStats.bestDim] || orgTeamStats.bestDim, `${orgTeamStats.bestPct}% evoluindo nessa dimensÃ£o`, C.gold)}
            {orgTeamStats.attentionDim && renderTeamStatCard("Merece atenÃ§Ã£o", DIMENSION_LABELS[orgTeamStats.attentionDim] || orgTeamStats.attentionDim, `${orgTeamStats.attentionPct}% perdendo intensidade`, C.cor)}
          </div>
        )}
        {!orgOverviewLoading && !orgOverviewError && orgActivityStats && (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
            {renderTeamStatCard("Carteira total da equipe", orgActivityStats.totalContacts, "contatos cadastrados")}
            {renderTeamStatCard("InteraÃ§Ãµes (30 dias)", orgActivityStats.totalLast30d, `${orgActivityStats.totalInteractions} no histÃ³rico total`)}
            {renderTeamStatCard("Contas esfriando", orgActivityStats.totalCooling, "60+ dias sem interaÃ§Ã£o", orgActivityStats.totalCooling > 0 ? C.cor : undefined)}
          </div>
        )}
        {!orgOverviewLoading && !orgOverviewError && orgOverview && orgOverview.length > 0 && !orgTeamStats && (
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, marginBottom: 20 }}>
            O resumo agregado da equipe aparece a partir de 3 pessoas com dado semanal computado â preserva o anonimato de quem jÃ¡ entrou.
          </div>
        )}


        {orgTrend && orgTrend.length >= 2 && (
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>TendÃªncia â % da equipe evoluindo por semana</div>
            <TeamTrendChart data={orgTrend} />
          </div>
        )}


        {orgTeamStats && (
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: orgAnalysisText || orgAnalysisLoading || orgAnalysisError ? 12 : 0 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".06em" }}>
                AnÃ¡lise da equipe (IA)
                {orgAnalysisGeneratedAt && !orgAnalysisLoading && (
                  <span style={{ textTransform: "none", fontWeight: 400, color: C.txL, marginLeft: 8 }}>Â· gerada automaticamente {new Date(orgAnalysisGeneratedAt).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
              <Btn small onClick={generateOrgAnalysis} disabled={orgAnalysisLoading}>{orgAnalysisLoading ? "Gerandoâ¦" : orgAnalysisText ? "Gerar de novo" : "Gerar anÃ¡lise"}</Btn>
            </div>
            {orgAnalysisError && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor }}>{orgAnalysisError}</div>}
            {orgAnalysisText && <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt, lineHeight: 1.65 }}>{orgAnalysisText}</div>}
          </div>
        )}


        {!orgOverviewLoading && !orgOverviewError && orgOverview && orgOverview.length > 0 && (
          <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, textTransform: "uppercase", letterSpacing: ".05em" }}>Legenda</span>
            {[["evoluindo", "Evoluindo"], ["estavel", "EstÃ¡vel"], ["perdendo_intensidade", "Perdendo intensidade"], ["sem_dados", "Sem dados suficientes"]].map(([k, label]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "'DM Sans'", fontSize: 11, color: C.txM }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: TEAM_STATE_COLOR[k] || C.txL, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
        )}


        {!orgOverviewLoading && !orgOverviewError && orgOverview && orgOverview.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {orgOverview.map((m) => (
              <div key={m.member_id} style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 18, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                {m.onboarding_completed && m.dimension_observation && (
                  <TeamDimensionRadar observation={m.dimension_observation} />
                )}
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 700, color: C.txt }}>{m.first_name || "â"}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{m.profile_name || "ArquÃ©tipo pendente"}</div>
                  </div>
                  {!m.onboarding_completed ? (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>Onboarding nÃ£o concluÃ­do</div>
                  ) : !m.dimension_observation ? (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL }}>Sem observaÃ§Ã£o semanal computada ainda</div>
                  ) : null}
                  {m.declining_dimensions && m.declining_dimensions.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {m.declining_dimensions.map((dim) => (
                        <span key={dim} style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.cor, background: `${C.cor}15`, padding: "2px 8px", borderRadius: 20 }}>
                          â  {DIMENSION_LABELS[dim] || dim} em queda hÃ¡ 2+ semanas
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}><strong style={{ color: C.txt }}>{m.contacts_count ?? 0}</strong> contatos</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}><strong style={{ color: C.txt }}>{m.interactions_count ?? 0}</strong> interaÃ§Ãµes <span style={{ color: C.txL }}>({m.interactions_last_30d ?? 0} nos Ãºltimos 30d)</span></span>
                    {(m.contacts_cooling_count ?? 0) > 0 && (
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor }}>{m.contacts_cooling_count} esfriando (60d+)</span>
                    )}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 4 }}>
                    {(m.interactions_count ?? 0) > 0 && (
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}><strong style={{ color: C.txt }}>{m.value_rate ?? 0}%</strong> das interaÃ§Ãµes geraram valor</span>
                    )}
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: (m.weeks_with_data ?? 0) <= 2 ? C.amb : C.txM }}>
                      dado hÃ¡ <strong style={{ color: (m.weeks_with_data ?? 0) <= 2 ? C.amb : C.txt }}>{m.weeks_with_data ?? 0}</strong> {(m.weeks_with_data ?? 0) === 1 ? "semana" : "semanas"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };


  const renderExport = () => {
    const exportCSV = () => {
      try {
        const header = "Nome,Empresa,Cargo,Categoria,Proximidade,FrequÃªncia,Health,Ãltimo Contato,Como Conheceu,Notas\n";
        const rows = cts.map(c => `"${c.name}","${c.company || ""}","${c.role || ""}","${c.category}",${c.proximity},${c.idealFreq},${c.health},"${fD(c.lastInteraction)}","${c.howMet || ""}","${(c.notes || "").replace(/"/g, "''")}"`).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${BRAND.exportFileBase}-contatos.csv`; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
    };


    const exportJSON = () => {
      try {
        const data = { profile, assessment, contacts: cts, interactions: its, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${BRAND.exportFileBase}-backup.json`; a.click();
        URL.revokeObjectURL(url);
      } catch (e) { console.error(e); }
    };


    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Exportar dados</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Apenas o admin pode exportar. Testadores nÃ£o veem esta tela.</p>


        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>ð</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 6 }}>Contatos CSV</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 12 }}>{cts.length} contatos</div>
            {isPro ? <Btn small onClick={exportCSV}>Baixar CSV</Btn> : <button onClick={openAccessKey} style={{ background:`${C.gold}10`, border:`1px solid ${C.gL}`, borderRadius:8, padding:"6px 12px", fontFamily:"'DM Sans'", fontSize:11, color:C.gold, cursor:"pointer" }}>ð CSV â PRO</button>}
          </div>
          <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>ð¾</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: C.txt, marginBottom: 6 }}>Backup completo</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 12 }}>Perfil + assessment + CRM</div>
            {isPro ? <Btn small onClick={exportJSON}>Baixar JSON</Btn> : null}
          </div>
        </div>


        {admin && (
        <div style={{ background: C.ambD, border: `1px solid ${C.amb}28`, borderRadius: 10, padding: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, marginBottom: 6 }}>Google Drive Â· Em breve</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.6 }}>No deploy com Supabase, este botÃ£o conectarÃ¡ ao Google Drive via OAuth exclusivo do admin. RelatÃ³rios, contatos e backups serÃ£o salvos automaticamente na pasta MILLÃO STRATEGIC HUB.</div>
        </div>
        )}
      </div>
    );
  };


  const renderMetrics = () => {
    const Card = ({ label, value, danger }) => (
      <div style={{ background: danger ? C.corD : C.card, border: `1px solid ${danger ? C.cor + "40" : C.brd}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 6 }}>{label}</div>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 26, fontWeight: 700, color: danger ? C.cor : C.txt }}>{value}</div>
      </div>
    );
    const sourceLabels = { access_key: "Convite (grÃ¡tis)", admin: "Concedido (admin)", stripe: "Stripe", stripe_test: "Teste Stripe", demo: "Demo", desconhecido: "Desconhecido" };


    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>MÃ©tricas do CONÃXIA</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>VisÃ£o administrativa do produto â contas de teste do admin excluÃ­das.</p>


        {metricsLoading && <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>Carregando mÃ©tricasâ¦</p>}
        {metricsErr && <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.cor }}>{metricsErr}</p>}


        {metrics && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
              <Card label="UsuÃ¡rios reais" value={metrics.totalReal} />
              <Card label="Onboarding completo" value={`${metrics.onboardingPct}%`} />
              <Card label="AvaliaÃ§Ã£o completa" value={`${metrics.assessmentPct}%`} />
              <Card label="Com 1Âª interaÃ§Ã£o" value={metrics.usersWithInteraction} />
              <Card label="Pro concedido" value={metrics.proConcedido} />
              <Card label="Pagantes externos reais" value={metrics.payingReal} danger={metrics.payingReal === 0} />
            </div>


            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Cadastros reais por semana</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, marginBottom: 24, padding: "0 2px" }}>
              {metrics.weeklySignups.map(({ week, count }) => {
                const max = Math.max(...metrics.weeklySignups.map(w => w.count), 1);
                return (
                  <div key={week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txM }}>{count}</div>
                    <div style={{ width: "100%", height: Math.max(4, (count / max) * 90), background: C.blu, borderRadius: 3 }} />
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 9, color: C.txL }}>{week.slice(5)}</div>
                  </div>
                );
              })}
            </div>


            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>Origem do acesso pro</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {Object.entries(metrics.proBySource).map(([src, qtd]) => (
                <div key={src} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 140, fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>{sourceLabels[src] || src}</div>
                  <div style={{ flex: 1, background: C.sf, borderRadius: 4, height: 18, position: "relative" }}>
                    <div style={{ width: `${Math.max(6, (qtd / metrics.proConcedido) * 100)}%`, height: "100%", background: C.vio, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 24, textAlign: "right", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{qtd}</div>
                </div>
              ))}
            </div>


            {metrics.payingReal === 0 && (
              <div style={{ background: C.corD, border: `1px solid ${C.cor}40`, borderRadius: 10, padding: 16 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.cor, marginBottom: 6 }}>Estado real do negÃ³cio</div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.6 }}>Nenhum cliente externo paga hoje. O acesso pro em uso vem de convites gratuitos. MonetizaÃ§Ã£o ainda nÃ£o foi validada no mercado.</div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };


    const renderPlan = () => {
    const week = Math.min(4, Math.max(1, Math.ceil(dSince(assessment?.createdAt) / 7) || 1));
    return (
      <div>
        <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Plano de AtivaÃ§Ã£o</h2>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, margin: "0 0 20px" }}>Seu guia de 4 semanas para transformar networking em hÃ¡bito.</p>
        <PlanInterativo userId={user?.id} week={week} isPro={isPro} openAccessKey={openAccessKey} pf={pf} />
      </div>
    );
  };


  const renderDash = () => {
    // A Home ("Hoje") deixou de acumular 4 mecanismos de prioridade
    // paralelos e contraditÃ³rios entre si (arco de saÃºde/score, "Movimento
    // da Semana", "Ritual Semanal", "AÃ§Ãµes PrioritÃ¡rias" e "Top 5
    // Movimentos" â todos usando fÃ³rmulas diferentes). Agora existe sÃ³ uma
    // fonte de verdade: <HomeToday>, que usa shared/priorityEngine.js â o
    // mesmo motor do WhatsApp. Isso tambÃ©m resolve a instruÃ§Ã£o explÃ­cita de
    // nÃ£o comeÃ§ar a Home com quantidade de contatos, saÃºde da rede, scores,
    // grÃ¡ficos ou banner de venda no topo.
    // CorreÃ§Ã£o de um bug real: usava `??` (nullish coalescing), que sÃ³ cai
    // para `assessment` quando profile.assessment_completed Ã© null/undefined.
    // Contas com assessment_completed=false por inconsistÃªncia de dado
    // antiga (mas com um assessment de verdade jÃ¡ carregado em `assessment`)
    // ficavam presas na tela de "diagnÃ³stico nÃ£o concluÃ­do" para sempre.
    const assessmentCompleted = !!(profile?.assessment_completed || assessment);


    if (isConexiaLab) {
      return (
        <div>
          <div style={{ display: "flex", justifyContent: canPickVoiceEngine ? "space-between" : "flex-end", alignItems: "center", gap: 8, marginBottom: 8 }}>
            {canPickVoiceEngine && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, letterSpacing: ".06em", textTransform: "uppercase" }}>Voz</span>
                {[["gemini", "Gemini"], ["openai", "OpenAI"]].map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setVoiceEngine(id)}
                    style={{ background: voiceEngine === id ? `${C.gold}22` : "none", border: `1px solid ${voiceEngine === id ? C.gL : C.brd}`, borderRadius: 8, padding: "5px 10px", fontFamily: "'DM Sans'", fontSize: 11, fontWeight: voiceEngine === id ? 700 : 400, color: voiceEngine === id ? C.gold : C.txM, cursor: "pointer" }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setDannaHome(false)}
              style={{ background: "none", border: `1px solid ${C.brd}`, borderRadius: 8, padding: "6px 12px", fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, cursor: "pointer" }}
            >
              â Voltar ao painel
            </button>
          </div>
        <ConexiaLabHome
          ref={dannaStartRef}
          userId={user?.id}
          firstName={profile?.first_name || profile?.name || ""}
          contacts={cts}
          interactions={its}
          onOpenContact={(cid) => {
            setSelId(cid);
            setRedeSubTab("pessoas");
            setView("contacts");
          }}
          onDataChanged={load}
          network={network}
          voiceEngine={voiceEngine}
          autoStart={true}
          key={`danna-${user?.id}-${voiceEngine}`}
        />
        </div>
      );
    }


    return (
      <div>
        {/* TransparÃªncia LGPD: o membro precisa saber que o
            estado categÃ³rico semanal (nunca contatos/interaÃ§Ãµes/conteÃºdo)
            fica visÃ­vel ao admin da organizaÃ§Ã£o. */}
        {profile?.organization_id && profile?.org_role === "membro" && (
          <div style={{ background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontFamily: "'DM Sans'", fontSize: 11, color: C.txM }}>
            Sua organizaÃ§Ã£o tem acesso a um resumo categÃ³rico da sua tendÃªncia comportamental semanal (ex.: "PresenÃ§a: Evoluindo") e Ã  quantidade de contatos e interaÃ§Ãµes que vocÃª registra. A identidade dos seus contatos e o conteÃºdo de conversas continuam privados.
          </div>
        )}


        {/* Danna (beta): convite opt-in para a conversa por voz (somente pagantes). */}
        {hasVoiceAccess ? (
        <div
          onClick={openDannaConversation}
          style={{ cursor: "pointer", background: `linear-gradient(135deg, ${C.gold}18, ${C.gold}06)`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}
        >
          <div style={{ width: 42, height: 42, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${C.gold}, ${C.gold}40)`, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 3 }}>
              Converse com a Danna <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: C.txM, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" }}>BETA</span>
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>
              Fale sobre uma pessoa, prepare uma reuniÃ£o ou registre uma conversa usando a voz. VocÃª pode voltar ao painel quando quiser.
            </div>
          </div>
          <span style={{ fontSize: 18, color: C.gold, flexShrink: 0 }}>â</span>
        </div>
        ) : (
        <a
          href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)}
          target="_blank"
          rel="noreferrer"
          style={{ textDecoration: "none", background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "14px 20px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}
        >
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: `radial-gradient(circle at 35% 35%, ${C.gold}80, ${C.gold}20)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>ð</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 700, color: C.txt, marginBottom: 3 }}>
              Converse com a Danna <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: C.txM, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "1px 6px", marginLeft: 6, verticalAlign: "middle" }}>BETA</span>
            </div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5 }}>
              A conversa por voz Ã© exclusiva para assinantes. Toque para assinar.
            </div>
          </div>
          <span style={{ fontSize: 16, color: C.txM, flexShrink: 0 }}>â</span>
        </a>
        )}


        {/* Removido: "{pf.emoji} {pf.name}" ocupava a posiÃ§Ã£o mais nobre da
            pÃ¡gina (antes atÃ© do card do WhatsApp) pra mostrar algo puramente
            decorativo, nÃ£o acionÃ¡vel. O arquÃ©tipo continua visÃ­vel em "Eu". */}


        {/* ââ Assistente por WhatsApp: em destaque, no topo â nÃ£o Ã© um
            detalhe de rodapÃ©, Ã© o jeito mais usado de falar com o CONÃXIA
            (na palma da mÃ£o, sem precisar abrir o app). Antes ficava depois
            de "Sua rede", exigindo rolar a tela inteira pra ver. ââ */}
        {hasWhatsappAccess && profile?.whatsapp ? (
          <div style={{ background: `linear-gradient(135deg, ${C.grn}14, ${C.grn}05)`, border: `1px solid ${C.grn}35`, borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.grn}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>ð¬</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.grn, marginBottom: 4 }}>
                  Seu assistente jÃ¡ estÃ¡ no WhatsApp{!isPro && diasDeTrialCrm !== null ? ` â teste grÃ¡tis, ${Math.max(0, Math.ceil(10 - diasDeTrialCrm))} dia(s) restante(s)` : ""}
                </div>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.55, marginBottom: 12 }}>
                  NÃ£o precisa abrir o {BRAND.name} pra usar. Manda uma mensagem de onde estiver: <em>"Liguei pro AndrÃ© hoje, foi positivo"</em> ou <em>"Minhas prÃ³ximas aÃ§Ãµes"</em> â e o assistente cuida do resto.
                </div>
                <a href="https://wa.me/5511988630785" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.grn, color: "#0D0D0D", borderRadius: 8, padding: "9px 16px", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Abrir conversa no WhatsApp â</a>
              </div>
            </div>
          </div>
        ) : hasWhatsappAccess ? (
          <div onClick={() => { setView("perfil"); setSelId(null); }} style={{ cursor: "pointer", background: `linear-gradient(135deg, ${C.gold}14, ${C.gold}05)`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.gold}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>ð±</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>Ative o assistente no WhatsApp</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.55 }}>Registre interaÃ§Ãµes e consulte sua rede direto do WhatsApp, sem precisar abrir o app. Toque aqui pra cadastrar seu nÃºmero.</div>
            </div>
            <span style={{ fontSize: 18, color: C.gold, flexShrink: 0, marginTop: 8 }}>â</span>
          </div>
        ) : profile?.whatsapp_trial_started_at ? (
          <div onClick={openAccessKey} style={{ cursor: "pointer", background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: C.w06, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>ð</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.txt, marginBottom: 4 }}>Seu teste grÃ¡tis do WhatsApp acabou</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.55 }}>VocÃª testou 10 dias grÃ¡tis. Toque aqui pra assinar o PRO e continuar usando pelo WhatsApp.</div>
            </div>
            <span style={{ fontSize: 18, color: C.gold, flexShrink: 0, marginTop: 8 }}>â</span>
          </div>
        ) : (
          <div onClick={() => { setView("perfil"); setSelId(null); }} style={{ cursor: "pointer", background: `linear-gradient(135deg, ${C.gold}14, ${C.gold}05)`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: "20px 22px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.gold}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>ð±</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 4 }}>Teste grÃ¡tis o assistente no WhatsApp â 10 dias</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.55 }}>Registre interaÃ§Ãµes e consulte sua rede direto do WhatsApp, na palma da mÃ£o. Toque aqui pra cadastrar seu nÃºmero e comeÃ§ar.</div>
            </div>
            <span style={{ fontSize: 18, color: C.gold, flexShrink: 0, marginTop: 8 }}>â</span>
          </div>
        )}


        <HomeToday
          userId={user?.id}
          contacts={cts}
          interactions={its}
          isPro={isPro}
          assessmentCompleted={assessmentCompleted}
          firstName={profile?.first_name || profile?.name || ""}
          onOpenContact={(cid) => { setSelId(cid); setRedeSubTab("pessoas"); setView("contacts"); }}
          onStartAssessment={() => { setView("perfil"); setSelId(null); }}
          onStartNetwork={() => setView("startNetwork")}
          onQuickLogInteraction={(cid) => { setSelId(cid); setIntCid(cid); setModal("addI"); }}
          openAccessKey={openAccessKey}
          stripeCheckoutUrl={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)}
        />


        {/* ââ Ãreas secundÃ¡rias: nunca competem com a orientaÃ§Ã£o principal acima ââ */}
        {!isPro && (
          <div style={{ background: `${C.gold}0d`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: "14px 18px", marginTop: 20, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>ð</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Sem limite de contatos. Plano completo de 90 dias. A IA te avisando toda semana quem chamar.</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, marginBottom: 10 }}>Isso Ã© o PRO â R$ 39,90/mÃªs ou R$ 399/ano.</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer" style={{ background: C.gold, color: C.bg, borderRadius: 8, padding: "7px 14px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Assinar PRO</a>
                <button onClick={openAccessKey} style={{ background: "none", border: `1px solid ${C.brd}`, borderRadius: 8, padding: "7px 14px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, cursor: "pointer" }}>JÃ¡ tenho uma chave</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  const renderContactsList = () => {
    if (sel) {
      const ci = CATS.find(c => c.value === sel.category);
      return (
        <div>
          <button onClick={() => {
            setSelId(null);
            if (openedFromCircle) setRedeSubTab("teia");
            setOpenedFromCircle(false);
          }} style={{ background: "none", border: "none", color: C.txM, cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 13, padding: "0 0 14px" }}>â Voltar</button>
          <ContactCircleAssignment network={network} contactId={sel.id} />
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.brd}`,
              borderRadius: 14,
              padding: isMobile ? 16 : 20,
              marginBottom: 14,
              display: "grid",
              gridTemplateColumns: isMobile ? "56px minmax(0,1fr)" : "50px minmax(0,1fr) auto",
              gap: isMobile ? 12 : 16,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: isMobile ? 44 : 50,
                height: isMobile ? 44 : 50,
                borderRadius: 12,
                background: `${ci?.color || C.gold}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cormorant Garamond',serif",
                fontSize: isMobile ? 20 : 22,
                fontWeight: 700,
                color: ci?.color,
              }}
            >
              {sel.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>{sel.name}</h3>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>{[sel.role, sel.company].filter(Boolean).join(" Â· ")}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}><Tag color={ci?.color}>{ci?.label}</Tag></div>
              {(() => {
                const rs = calculateRelevanceScore(sel);
                const priority = getContactPriorityStatus(sel.health, rs);
                const badgeColors = {"Talvez mereÃ§a atenÃ§Ã£o":"#E8A020","Presente e importante":"#4caf50","RelaÃ§Ã£o tranquila":"#ff9800","Sem prioridade agora":"#5a5650","Dados incompletos":"#9B59B6"};
                const bc = badgeColors[priority.status] || C.txL;
                return (
                  <div style={{ marginTop:10 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: isMobile ? 10 : 8,
                        marginBottom: isMobile ? 10 : 8,
                        width: "100%",
                      }}
                    >
                      <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>PresenÃ§a</div>
                        <div style={{ fontFamily:"'JetBrains Mono'", fontSize:20, fontWeight:700, color:sel.health>=70?C.grn:sel.health>=40?C.amb:C.cor, marginBottom:5 }}>{sel.health}%</div>
                        <HBar score={sel.health} />
                      </div>
                      <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:5 }}>RelevÃ¢ncia</div>
                        {rs !== null
                          ? (<><div style={{ fontFamily:"'JetBrains Mono'", fontSize:20, fontWeight:700, color:getRelevanceLabelColor(rs), marginBottom:5 }}>{rs}%</div>
                             <div style={{ height:6, borderRadius:3, background:C.w06 }}><div style={{ height:6, borderRadius:3, background:getRelevanceLabelColor(rs), width:`${rs}%` }}/></div></>)
                          : (<><div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, fontStyle:"italic", marginTop:4 }}>NÃ£o avaliado</div>
                             <button onClick={()=>openEditC(sel)} style={{ marginTop:6, background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:10, color:C.gold, cursor:"pointer", padding:0, textAlign:"left" }}>â Preencher esses dados</button></>)}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto",
                gap: 8,
                width: isMobile ? "100%" : "auto",
                gridColumn: isMobile ? "1 / -1" : "auto",
              }}
            >
              <Btn small full={isMobile} onClick={() => openEditC(sel)}>âï¸ Editar</Btn>
              <Btn variant="danger" small full={isMobile} onClick={() => { if (confirm("Remover contato?")) delC(sel.id); }}>Remover</Btn>
            </div>
          </div>
          {sel.notes && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 14, marginBottom: 10, fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.5 }}>{sel.notes}</div>}
          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            {sel.whatsapp && <a href={`https://wa.me/55${sel.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 2 }}>ð± WhatsApp</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{sel.whatsapp}</div></a>}
            {sel.contactEmail && <a href={`mailto:${sel.contactEmail}`} style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.blu, marginBottom: 2 }}>âï¸ Email</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel.contactEmail}</div></a>}
            {sel.linkedin && <a href={sel.linkedin.startsWith("http") ? sel.linkedin : `https://${sel.linkedin}`} target="_blank" rel="noreferrer" style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px", textDecoration: "none" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: "#0A66C2", marginBottom: 2 }}>ð LinkedIn</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ver perfil</div></a>}
            {sel.birthday && (() => { const days = birthdayDaysAway(sel.birthday); const bDate = new Date(sel.birthday); return <div style={{ background: days !== null && days <= 7 ? `${C.vio}12` : C.card, border: `1px solid ${days !== null && days <= 7 ? C.vio : C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.vio, marginBottom: 2 }}>ð AniversÃ¡rio</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{bDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}{days !== null && days <= 7 && <span style={{ color: C.vio, fontWeight: 600 }}> Â· em {days === 0 ? "hoje!" : `${days}d`}</span>}</div></div>; })()}
            {sel.mainCulture && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 2 }}>ð± Cultura</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{MAIN_CULTURES.find(m => m.value === sel.mainCulture)?.label || sel.mainCulture}</div></div>}
            {(sel.city || sel.stateCode) && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "10px 12px" }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.txL, marginBottom: 2 }}>ð LocalizaÃ§Ã£o</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{[sel.city, sel.stateCode].filter(Boolean).join(", ")}</div></div>}
          </div>
          {sel.hobbies && <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginBottom: 10 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.amb }}>ð¯ Hobbies: </span><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM }}>{sel.hobbies}</span></div>}
          {sel.nextAction && (
            <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.gold, marginBottom: 4 }}>ð PrÃ³xima aÃ§Ã£o{sel.nextActionDate ? ` Â· ${fD(sel.nextActionDate)}` : ""}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{sel.nextAction}</div>
                </div>
                {sel.nextActionDate && (
                  <button onClick={() => {
                    const ics = buildICS({ title: `ð ${sel.nextAction} Â· ${sel.name}`, description: "Agendado via CONÃXIA", start: `${sel.nextActionDate}T09:00:00`, durationMinutes: 30 });
                    downloadICS(ics, `conexia-${sel.name.replace(/\s+/g, "_").toLowerCase()}.ics`);
                  }} style={{ background: "none", border: `1px solid ${C.gL}`, borderRadius: 6, padding: "4px 8px", fontFamily: "'DM Sans'", fontSize: 10, color: C.gold, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>ð CalendÃ¡rio</button>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase" }}>Timeline ({cI.length})</span>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn small onClick={() => setSchedOpenId(schedOpenId === sel.id ? null : sel.id)}>ð Agendar</Btn>
              <Btn variant="success" small onClick={() => { setIntCid(sel.id); setModal("addI"); }}>+ InteraÃ§Ã£o</Btn>
            </div>
          </div>
          {schedOpenId === sel.id && (
            <div style={{ background: C.card, border: `1px solid ${C.gL}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, marginBottom: 10, textTransform: "uppercase" }}>Agendar com {sel.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <select value={schedForm.type} onChange={e => setSchedForm({ ...schedForm, type: e.target.value })}
                  style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>
                  {ITYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                </select>
                <select value={schedForm.duration} onChange={e => setSchedForm({ ...schedForm, duration: e.target.value })}
                  style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>
                  <option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option>
                  <option value="60">1 hora</option><option value="90">1h30</option>
                </select>
              </div>
              <textarea rows={3} placeholder="Tema (opcional): o que vai ser tratado nessa reuniÃ£o..." value={schedForm.topic}
                onChange={e => setSchedForm({ ...schedForm, topic: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, marginBottom: 8, resize: "vertical" }} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <input type="date" value={schedForm.date} onChange={e => setSchedForm({ ...schedForm, date: e.target.value })}
                  style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }} />
                <input type="time" value={schedForm.time} onChange={e => setSchedForm({ ...schedForm, time: e.target.value })}
                  style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }} />
              </div>
              <input type="text" placeholder="Local (opcional): escritÃ³rio, Google Meet, WhatsApp..." value={schedForm.location}
                onChange={e => setSchedForm({ ...schedForm, location: e.target.value })}
                style={{ width: "100%", boxSizing: "border-box", background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 6, padding: "8px", fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn variant="ghost" small onClick={() => { setSchedOpenId(null); setSchedForm({ type: "reuniao", date: "", time: "09:00", duration: "30", location: "", topic: "" }); }}>Cancelar</Btn>
                <Btn small onClick={() => saveSchedule(sel.id)} disabled={!schedForm.date || savingSchedule}>{savingSchedule ? "Agendando..." : "Salvar"}</Btn>
              </div>
            </div>
          )}
          {cI.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 28, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 13, color: C.txL }}>Registre a primeira interaÃ§Ã£o.</div>
          : cI.map((r, i) => { const tp = ITYPES.find(t => t.value === r.type); const se = SENTS.find(s => s.value === r.sentiment); return (
            <div key={i} style={{ display: "flex", gap: 12, marginBottom: 2 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 18 }}><div style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, background: se?.color || C.txL }} />{i < cI.length - 1 && <div style={{ width: 1, flex: 1, background: C.brd }} />}</div>
              <div style={{ flex: 1, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 8, padding: 12, marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: C.txt }}>{tp?.icon} {tp?.label}{r.valueGen ? " Â· ð" : ""}</span><span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{fD(r.createdAt)}</span></div>
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
        {/* ââ Matriz Health Ã Relevance ââ */}
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
                <div key={c.id} onClick={()=>setSelId(c.id)} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, cursor:"pointer", marginBottom:3, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Â· {c.name}</div>
              ))}
              {contacts.length > 3 && <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:`${color}80`, marginTop:2 }}>+{contacts.length-3} mais</div>}
              {contacts.length === 0 && <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, fontStyle:"italic" }}>Nenhum contato</div>}
            </div>
          );
          return (
            <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:12, padding:14, marginBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ fontFamily:"'DM Sans'", fontSize:11, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".08em" }}>Como sua rede estÃ¡ agora</div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:C.txL }}>PresenÃ§a Ã ImportÃ¢ncia</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom: q.incomplete.length ? 8 : 0 }}>
                <QCell label="Talvez mereÃ§a atenÃ§Ã£o" color="#E8A020" icon="â" contacts={q.reactivate} />
                <QCell label="Presente e importante" color="#4caf50" icon="â­" contacts={q.protect} />
                <QCell label="Sem prioridade agora" color="#5a5650" icon="â" contacts={q.low} />
                <QCell label="RelaÃ§Ã£o tranquila" color="#ff9800" icon="â" contacts={q.maintain} />
              </div>
              {q.incomplete.length > 0 && (
                <div style={{ background:`${"#9B59B6"}08`, border:`1px solid ${"#9B59B6"}20`, borderRadius:8, padding:"8px 12px", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:12 }}>â</span>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:"#9B59B6", textTransform:"uppercase", letterSpacing:".08em", flex:1 }}>Sem relevÃ¢ncia avaliada â {q.incomplete.length} contato{q.incomplete.length>1?"s":""}</div>
                  <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:"#9B59B6", cursor:"pointer" }} onClick={()=>q.incomplete[0]&&setSelId(q.incomplete[0].id)}>Avaliar â</div>
                </div>
              )}
            </div>
          );
        })()}


        {cts.length === 0 ? <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 40, textAlign: "center" }}><Btn small onClick={() => setModal("addC")}>+ Primeiro contato</Btn></div>
        : [...cts].sort((a, b) => {
            // Ordena por prioridade, nÃ£o por ordem de cadastro â usa o mesmo
            // status jÃ¡ calculado pra Teia/detalhe de contato, sem criar
            // uma segunda lÃ³gica. "Talvez mereÃ§a atenÃ§Ã£o" sempre primeiro;
            // dentro de cada grupo, quem tem menos presenÃ§a (health) vem
            // antes (mais urgente primeiro).
            const order = { "Talvez mereÃ§a atenÃ§Ã£o": 0, "Presente e importante": 1, "RelaÃ§Ã£o tranquila": 2, "Sem prioridade agora": 3, "Dados incompletos": 4 };
            const pa = getContactPriorityStatus(a.health, calculateRelevanceScore(a)).status;
            const pb = getContactPriorityStatus(b.health, calculateRelevanceScore(b)).status;
            const oa = order[pa] ?? 5, ob = order[pb] ?? 5;
            if (oa !== ob) return oa - ob;
            return (a.health ?? 100) - (b.health ?? 100);
          }).map(c => { const ci = CATS.find(x => x.value === c.category); return (
          <div key={c.id} onClick={() => setSelId(c.id)} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${C.brd}`, borderLeft: `3px solid ${{ "Talvez mereÃ§a atenÃ§Ã£o":"#E8A020","Presente e importante":"#4caf50","RelaÃ§Ã£o tranquila":"#ff9800" }[getContactPriorityStatus(c.health, calculateRelevanceScore(c)).status] || C.brd}`, borderRadius: 10, padding: "12px 14px", marginBottom: 6, cursor: "pointer" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: `${ci?.color || C.gold}14`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 700, color: ci?.color }}>{c.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500, color: C.txt, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, marginTop:2 }}>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{c.company || "â"}</span>
                {(() => { const rs = calculateRelevanceScore(c); const p = getContactPriorityStatus(c.health, rs);
                  const badgeColors = { "Talvez mereÃ§a atenÃ§Ã£o":"#E8A020","Presente e importante":"#4caf50","RelaÃ§Ã£o tranquila":"#ff9800","Sem prioridade agora":"#5a5650","Dados incompletos":"#9B59B6" };
                  const bc = badgeColors[p.status] || C.txL;
                  return p.status !== "Dados incompletos" ? (
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


  const renderTeia = () => (
    <ConexiaCircleNetwork
      userId={user.id}
      network={network}
      initialFocus={circleFocus}
      onFocusChange={setCircleFocus}
      contacts={cts}
      interactions={its}
      isPro={isPro}
      onOpenContact={(id) => {
        setOpenedFromCircle(true);
        setSelId(id);
        setRedeSubTab("pessoas");
        setView("contacts");
      }}
    />
  );


  const UpgradeModal = () => (
    <Modal title="" onClose={() => setShowUpgrade(false)}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.gold, marginBottom: 4 }}>{BRAND.name} PRO</div>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>Transforme diagnÃ³stico em execuÃ§Ã£o</div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <div style={{ background:C.sf, border:`1px solid ${C.brd}`, borderRadius:10, padding:14 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.txL, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>Free â R$ 0</div>
          {["1 diagnÃ³stico","AtÃ© 5 contatos","Health Score","Teia simples","Semana 1 do plano","1 insight por vez (IA)","WhatsApp â teste grÃ¡tis 10 dias"].map((f,i)=><div key={i} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:4 }}>â {f}</div>)}
        </div>
        <div style={{ background:`${C.gold}08`, border:`1.5px solid ${C.gold}`, borderRadius:10, padding:14 }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, color:C.gold, textTransform:"uppercase", letterSpacing:".08em", marginBottom:8 }}>PRO â R$ 39,90/mÃªs</div>
          {["Contatos ilimitados","Relevance Score","Top 5 movimentos","Insights ilimitados (IA)","Metas de 90 dias (IA)","Briefing prÃ©-contato (IA)","Assistente por WhatsApp sem limite","Plano de 4 semanas completo","Teia avanÃ§ada"].map((f,i)=><div key={i} style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, marginBottom:4 }}>â­ {f}</div>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 12, padding: 20, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.txL, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Mensal</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.txt, lineHeight: 1 }}>R$39,90</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 16 }}>/mÃªs</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 16, lineHeight: 1.5 }}>Cancele quando quiser</div>
          <button onClick={() => window.open(buildStripeCheckoutUrl(STRIPE.checkoutUrl, user), "_blank")} style={{ width: "100%", background: C.w06, border: `1px solid ${C.brd}`, color: C.txt, borderRadius: 8, padding: "10px 0", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Assinar mensal</button>
          <button onClick={() => { setShowUpgrade(false); openAccessKey(); }} style={{ width:"100%", background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", textDecoration:"underline", marginTop:4 }}>Tenho uma chave de acesso</button>
        </div>
        <div style={{ background: `${C.gold}10`, border: `1.5px solid ${C.gold}`, borderRadius: 12, padding: 20, textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: C.gold, color: "#0d0d0f", fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, textTransform: "uppercase", letterSpacing: ".08em", whiteSpace: "nowrap" }}>2 meses grÃ¡tis</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>Anual</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.gold, lineHeight: 1 }}>R$399</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, marginBottom: 4 }}>/ano Â· R$33,25/mÃªs</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginBottom: 16, lineHeight: 1.5 }}>Economia de R$79,80 vs mensal</div>
          <button onClick={() => window.open(buildStripeCheckoutUrl(STRIPE.checkoutUrl, user), "_blank")} style={{ width: "100%", background: C.gold, border: "none", color: "#0d0d0f", borderRadius: 8, padding: "10px 0", fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Assinar anual â¡</button>
        </div>
      </div>
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: 14 }}>
        <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txt, marginBottom: 8 }}>O que estÃ¡ incluÃ­do no PRO:</div>
        {["ð RelatÃ³rio PDF completo personalizado", "ðºï¸ Mapa mental da sua arquitetura relacional", "ð TermÃ´metro de evoluÃ§Ã£o 90 dias", "ð¯ Gatilhos relacionais do seu perfil", "â¡ Acesso a todas as futuras funcionalidades"].map((f,i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 5, fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>{f}</div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 12, fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>
        ApÃ³s o pagamento, seu acesso PRO Ã© liberado automaticamente. â
      </div>
    </Modal>
  );


  // ââ "Rede" (Ã¢ncora principal) = Pessoas + Teia num sÃ³ lugar ââ
  // Reaproveita renderContactsList() e renderTeia() sem tocar no que jÃ¡
  // funciona â sÃ³ adiciona um alternador simples por cima.
  const [redeSubTab, setRedeSubTab] = useState("teia"); // Teia como padrÃ£o â Ã© o elemento mais diferenciado do produto, nÃ£o devia ficar atrÃ¡s de um clique extra
  const renderContacts = () => (
    <div>
      {circleSaveNotice && <p role="alert" style={{ color: C.cor, fontSize: 12 }}>
        {circleSaveNotice}
        <button onClick={() => setCircleSaveNotice("")}>Fechar</button>
      </p>}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: isMobile ? 10 : 16,
        }}
      >
        <button onClick={() => { setRedeSubTab("pessoas"); setOpenedFromCircle(false); }} style={{ background: redeSubTab === "pessoas" ? C.gD : "transparent", border: `1px solid ${redeSubTab === "pessoas" ? C.gL : C.brd}`, borderRadius: 8, padding: "7px 14px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: redeSubTab === "pessoas" ? C.gold : C.txM, cursor: "pointer" }}>Pessoas</button>
        <button onClick={() => setRedeSubTab("teia")} style={{ background: redeSubTab === "teia" ? C.gD : "transparent", border: `1px solid ${redeSubTab === "teia" ? C.gL : C.brd}`, borderRadius: 8, padding: "7px 14px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: redeSubTab === "teia" ? C.gold : C.txM, cursor: "pointer" }}>Teia</button>
      </div>
      {redeSubTab === "pessoas" ? renderContactsList() : renderTeia()}
    </div>
  );


  const renderReport = () => {
    if (!assessment) return <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 40, textAlign: "center", fontFamily: "'DM Sans'", fontSize: 14, color: C.txL }}>RelatÃ³rio nÃ£o encontrado.</div>;
    const downloadReport = () => {
      const formatarNome = (raw) => {
        if (!raw) return '';
        // Se tem espaÃ§o, assumir que foi digitado pelo usuÃ¡rio â respeitar exatamente
        if (raw.includes(' ')) return raw.trim();
        // Sem espaÃ§o: tentar capitalizar corretamente (ex: "rafaelmilleo" â "Rafaelmilleo" como fallback legÃ­vel)
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      };
      const nomeRaw = profile?.name || profile?.first_name || '';
      const nomePessoa = nomeRaw.includes(' ')
        ? nomeRaw.trim()  // nome completo digitado pelo usuÃ¡rio â usar como estÃ¡
        : nomeRaw
          ? formatarNome(nomeRaw)  // nome sem espaÃ§o â capitalizar
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
      const getLvlLbl = (v) => v>=80?'Excelente':v>=65?'Forte':v>=50?'MÃ©dio':v>=35?'Relevante':'Gap CrÃ­tico';
      const getLvlClr = (v) => v>=75?'#2e7d32':v>=50?'#e65100':'#c62828';
      const percLabel = assessment.overall>=85?'TOP 10%':assessment.overall>=75?'TOP 20%':assessment.overall>=65?'TOP 30%':'EM DESENVOLVIMENTO';
      const overallTen = Math.round(assessment.overall/10);


      const dimInterp = {
        intencao_estrategica:{
          high:"Use sua clareza estratÃ©gica para escolher melhor onde investir energia. Nem toda conexÃ£o merece o mesmo esforÃ§o â seu ganho estÃ¡ em priorizar quem amplia confianÃ§a, reputaÃ§Ã£o e oportunidade.",
          mid:"VocÃª tem direÃ§Ã£o, mas nem sempre age com intenÃ§Ã£o deliberada. Defina os 10 contatos mais importantes para seus prÃ³ximos 90 dias e estabeleÃ§a o que quer construir com cada um.",
          low:"Antes de ampliar sua rede, defina quem realmente importa para os prÃ³ximos 90 dias. Sem clareza de propÃ³sito, networking vira ruÃ­do."
        },
        escuta_relacional:{
          high:"Sua escuta cria abertura. Use isso para aprofundar conversas e captar necessidades antes de propor qualquer movimento â quem escuta bem Ã© lembrado como parceiro, nÃ£o apenas como contato.",
          mid:"VocÃª escuta bem em momentos importantes, mas a agenda prÃ³pria Ã s vezes interfere. Antes de cada conversa relevante, defina 2 perguntas que vocÃª genuinamente nÃ£o sabe a resposta.",
          low:"VocÃª pode estar ouvindo pouco antes de conduzir a conversa. FaÃ§a mais perguntas, registre o contexto do outro e resista ao impulso de posicionar antes de entender."
        },
        presenca_mercado:{
          high:"Sua presenÃ§a mantÃ©m vocÃª lembrado. Use essa forÃ§a para ocupar espaÃ§os certos com constÃ¢ncia e intenÃ§Ã£o â aparecendo antes de precisar pedir.",
          mid:"Sua competÃªncia pode estar maior que sua visibilidade. Crie uma cadÃªncia mÃ­nima: 1 conteÃºdo, 1 evento, 1 conversa por semana â sem consistÃªncia, presenÃ§a vira episÃ³dio.",
          low:"O mercado nÃ£o reconhece o que nÃ£o vÃª com frequÃªncia. Sua competÃªncia estÃ¡ invisÃ­vel para quem deveria conhecÃª-la. Aparecer com regularidade Ã© o primeiro passo."
        },
        reciprocidade_ativa:{
          high:"VocÃª gera valor antes de pedir. Esse comportamento cria confianÃ§a e aumenta a chance de retorno espontÃ¢neo â continue antecipando, indicando e conectando.",
          mid:"VocÃª se importa em contribuir, mas nem sempre toma a iniciativa. Antecipe valor: antes de cada contato estratÃ©gico, defina o que pode oferecer sem pedir nada.",
          low:"VocÃª pode estar esperando ser acionado para ajudar. Inverta: indique, compartilhe, reconheÃ§a e facilite antes de receber qualquer demanda."
        },
        ritual_consistencia:{
          high:"Sua disciplina evita que relaÃ§Ãµes importantes esfriem. Use isso para transformar contato em continuidade â e continue aparecendo mesmo quando nÃ£o hÃ¡ agenda comercial.",
          mid:"Sem ritual, boas intenÃ§Ãµes somem da agenda. Crie uma cadÃªncia mÃ­nima semanal: 30 minutos, 3 contatos, toda segunda. O sistema faz o que a motivaÃ§Ã£o nÃ£o consegue.",
          low:"Sem ritual fixo, networking vira reativo. VocÃª sÃ³ age quando precisa â e quando precisa jÃ¡ Ã© tarde. Crie um sistema mÃ­nimo e coloque no calendÃ¡rio agora."
        },
        confianca_autentica:{
          high:"Sua coerÃªncia gera confianÃ§a. As pessoas confiam mais quando percebem alinhamento entre fala, intenÃ§Ã£o e atitude â continue sendo o mesmo em reuniÃµes formais e conversas informais.",
          mid:"Cuidado para parecer estratÃ©gico demais e humano de menos. RelaÃ§Ãµes fortes precisam de intenÃ§Ã£o, mas tambÃ©m de verdade â compartilhe mais do que estÃ¡ construindo e enfrentando.",
          low:"VocÃª pode estar mantendo um personagem profissional que impede conexÃµes genuÃ­nas. Seja vulnerÃ¡vel em pelo menos 2 conversas esta semana â isso transforma contato em aliado."
        },
      };


      const sintese = [
        {q:"O que mais te impressiona?", a: pct('intencao_estrategica')>=70?`A clareza sobre quem quer ter na rede e por quÃª â vÃª o networking como investimento, nÃ£o evento.`:`A intenÃ§Ã£o existe, mas a estratÃ©gia de rede ainda estÃ¡ em construÃ§Ã£o.`},
        {q:"Como gostaria de ser descrito?", a: pct('presenca_mercado')>=70?`Uma referÃªncia â domÃ­nio tÃ©cnico e visÃ£o que geram reconhecimento de mercado.`:`Um profissional sÃ³lido, construindo visibilidade consistente.`},
        {q:"Sua relaÃ§Ã£o com networking?", a: pct('intencao_estrategica')>=70?`Como investimento estratÃ©gico a ser gerenciado com propÃ³sito e disciplina.`:`Importante, mas ainda compete com a rotina na priorizaÃ§Ã£o.`},
        {q:"Como se comporta em eventos?", a: pct('presenca_mercado')>=70?`Circulando ativamente â objetivo Ã© conectar com pessoas relevantes com clareza de propÃ³sito.`:`Presente, mas sem sempre ter clareza do que quer gerar em cada conversa.`},
        {q:"AlguÃ©m pede ajuda. Sua reaÃ§Ã£o?", a: pct('reciprocidade_ativa')>=70?`Responde com generosidade â conecta, indica, compartilha. Reciprocidade Ã© valor genuÃ­no.`:`Ajuda quando solicitado, mas raramente oferece antes de ser chamado.`},
        {q:"Qual situaÃ§Ã£o te representa?", a: pct('ritual_consistencia')>=70?`Contatos que evoluem para aliados â porque cultiva com consistÃªncia, nÃ£o sÃ³ por necessidade.`:`Muitos contatos, mas poucos que chamaria de aliados reais.`},
        {q:"Maior bloqueio?", a: pct('ritual_consistencia')>=70?`A escala â manter qualidade quando o volume de relaÃ§Ãµes cresce.`:`O tempo â a intenÃ§Ã£o existe, mas a rotina engole a execuÃ§Ã£o.`},
        {q:"O que faz nas 48h apÃ³s conversa?", a: pct('reciprocidade_ativa')>=70?`Envia mensagem personalizada com algo de valor â artigo, indicaÃ§Ã£o, reconhecimento.`:`Depende da conversa â nas mais relevantes faz follow-up; nas demais, aguarda.`},
        {q:"Onde sua energia vai em conversas?", a: pct('escuta_relacional')>=70?`Para entender o outro genuinamente â o que estÃ¡ construindo, enfrentando, precisando.`:`Para se posicionar bem â como estÃ¡ sendo percebido e que impressÃ£o gera.`},
        {q:"Papel dos relacionamentos?", a: pct('confianca_autentica')>=70?`Ã o que define o legado â impacto gerado nas pessoas e no mercado.`:`Essencial para o crescimento, mas ainda nÃ£o gerenciado com atenÃ§Ã£o suficiente.`},
        {q:"Uma coisa que mudaria?", a: pct('ritual_consistencia')>=70?`Aprofundar as conexÃµes que jÃ¡ tem â transformar mais contatos em aliados reais.`:`Ser mais consistente no follow-up â manter o contato vivo entre os encontros.`},
        {q:"O que rede representa?", a: pct('confianca_autentica')>=70?`SeguranÃ§a â pessoas que estarÃ£o lÃ¡ quando precisar, porque cultivou com autenticidade.`:`Oportunidade â mas ainda nÃ£o operacionalizada com a consistÃªncia que o potencial merece.`},
      ];


      const tensao = top2.length>=2&&bot2.length>=2
        ? `${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1].label} ${s10(top2[1].key)}/10 â mas ${bot2[1].label} ${s10(bot2[1].key)}/10 e ${bot2[0].label} ${s10(bot2[0].key)}/10. Os pontos mais fortes coexistem com gaps que limitam a conversÃ£o do potencial em resultado relacional real.`
        : `Score geral ${overallTen}/10. ${pf?.desc?.split('.')[0]||''}.`;


      const termometro = DIMS.map(d => ({
        label: d.label, hoje: `${s10(d.key)}/10`, d90: `${Math.round(proj(pct(d.key))/10)}/10`,
        muda: dimInterp[d.key]?.high?.split('â')[1]?.trim() || dimInterp[d.key]?.high?.split('.')[0] || ''
      }));


      const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>DiagnÃ³stico Relacional â ${nomePessoa}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a1a;font-size:10pt;line-height:1.5}
@page{size:A4;margin:18mm 20mm 16mm 20mm}
@media print{.no-print{display:none!important}.pb{page-break-before:always}}
.print-btn{position:fixed;top:16px;right:16px;background:#c9a227;color:#000;border:none;border-radius:6px;padding:10px 18px;font-weight:700;cursor:pointer;font-size:12px;z-index:99}


/* ââ CABEÃALHO DE PÃGINA ââ */
.pg-hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;border-bottom:1px solid #ddd;margin-bottom:14px}
.pg-hdr-title{font-size:8pt;color:#888;letter-spacing:.05em}
.pg-hdr-right{font-size:8pt;color:#888}


/* ââ CAPA ââ */
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


/* ââ DIM TABLE ââ */
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


/* ââ SINTESE ââ */
.sq{display:flex;gap:8px;margin-bottom:9px;padding-bottom:9px;border-bottom:1px solid #f0ede8;break-inside:avoid}
.sq:last-child{border-bottom:none;margin-bottom:0}
.sq-num{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#c9a227;background:#c9a22712;border:1px solid #c9a22730;min-width:24px;height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.sq-q{font-weight:600;font-size:8.5pt;color:#1a1a1a;margin-bottom:2px}
.sq-a{font-size:8pt;color:#555;line-height:1.6;word-break:break-word;overflow-wrap:anywhere}


/* ââ SECTIONS ââ */
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


/* ââ GATILHOS ââ */
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gt-block{border-radius:6px;padding:11px 13px;margin-bottom:10px;break-inside:avoid}
.gt-at{background:#f0faf0;border-left:2.5px solid #2e7d32}
.gt-bl{background:#fff5f5;border-left:2.5px solid #c62828}
.gt-title{font-size:8.5pt;font-weight:700;margin-bottom:4px}
.gt-desc{font-size:8pt;color:#444;line-height:1.55;margin-bottom:4px}
.gt-action{font-size:7.5pt;font-style:italic;color:#c9a227}


/* ââ PLANO ââ */
.week-box{display:grid;grid-template-columns:56px 1fr;border:1px solid #e0ddd8;border-radius:6px;overflow:hidden;margin-bottom:12px;break-inside:avoid}
.week-num{background:#f9f7f3;border-right:1px solid #e0ddd8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;gap:3px;font-size:18pt}
.week-num-txt{font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#c9a227}
.week-body{padding:10px}
.week-sem{font-size:7pt;color:#888;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.week-title{font-size:11pt;font-weight:700;color:#1a1a1a;margin-bottom:2px}
.week-goal{font-size:8pt;color:#666;font-style:italic;margin-bottom:6px}
.week-task{font-size:8pt;color:#333;margin-bottom:2px;display:flex;gap:6px}
.week-meta{margin-top:6px;background:#fdf9ec;border:1px solid #c9a22720;border-radius:2px;padding:4px 8px;font-family:'Courier New',monospace;font-size:7.5pt;color:#c9a227}


/* ââ TERMÃMETRO ââ */
.thermo{width:100%;border-collapse:collapse}
.thermo th{background:#f3f0ea;font-size:7.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:6px 8px;border:1px solid #ddd;color:#666}
.thermo td{padding:6px 8px;border:1px solid #ddd;font-size:8.5pt;vertical-align:middle}
.thermo tr:nth-child(even) td{background:#faf8f4}


/* ââ VANTAGEM ââ */
.vant-box{background:#fdf9ec;border-left:3px solid #c9a227;border-radius:0 3px 3px 0;padding:12px;margin-bottom:10px}
.frase-box{text-align:center;padding:20px;background:#f9f7f3;border:1px solid #e0ddd8;border-radius:3px}
.frase-big{font-size:14pt;color:#c9a227;font-weight:700;margin-bottom:8px;line-height:1.4}
.frase-sub{font-size:8.5pt;color:#666;font-style:italic}
</style></head><body>


<button class="print-btn no-print" onclick="window.print()">â¬ Salvar como PDF</button>


<!-- ââââ CAPA ââââââââââââââââââââââââââââââââââââââââââââââââââââââ -->
<div class="cover">
  <div>
    <div class="lbl">DiagnÃ³stico Relacional Profissional Â· ${BRAND.name}</div>
    <div class="name-big">${nomePessoa}</div>
    <div class="profile-tag">
      <span class="profile-tag-name">${pf?.name||""}</span>
    </div>
    <div class="profile-tagline">${pf?.tagline||""}</div>
    <div class="ctx-tags" style="margin-top:8px">
      ${[profile?.role,profile?.segment,profile?.state].filter(Boolean).join("  Â·  ")}
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
      <div class="tensao-lbl">TensÃ£o Central</div>
      <div class="tensao-txt">${tensao}</div>
    </div>


    <div class="quote">"${pf?.tagline||""}"</div>
  </div>


  <div class="footer-bar">
    <div class="footer-bar-l">${BRAND.name}</div>
    <div class="footer-bar-r">"Networking, alÃ©m do cafezinho" Â· Rafael MillÃ©o<br>${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
</div>


<!-- ââââ P2: MAPA DIMENSIONAL + SÃNTESE âââââââââââââââââââââââââââââ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
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
          ${isCrit?`<span class="dim-badge" style="color:#c62828;background:#fff0f0;border:1px solid #ffcccc">â  GAP CRÃTICO</span>`:isStr?`<span class="dim-badge" style="color:#2e7d32;background:#f0faf0;border:1px solid #c8e6c9">â  Excelente</span>`:''}
          <div class="dim-note">${dimInterp[d.key]?.[getLvl(v)]?.split('.')[0]||''}</div>
        </td>
        <td class="dim-bar-cell"><div class="dim-bar-bg"><div class="dim-bar-fg" style="width:${v}%;background:${d.color}"></div></div></td>
        <td class="dim-score" style="color:${clr}">${s10(d.key)}/10</td>
      </tr>`;}).join('')}
    </table>
  </div>
  <div>
    <div class="lbl">SÃ­ntese das Respostas</div>
    ${sintese.map((item,i)=>`<div class="sq">
      <div class="sq-num">${String(i+1).padStart(2,'0')}</div>
      <div><div class="sq-q">${item.q}</div><div class="sq-a">${item.a}</div></div>
    </div>`).join('')}
  </div>
</div>


<!-- ââââ P3: ANÃLISE PROFUNDA ââââââââââââââââââââââââââââââââââââââââ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
</div>


<div class="lbl">AnÃ¡lise Profunda do Perfil</div>
<div class="h1">O que suas respostas revelam sobre vocÃª</div>


<p class="body-p">${pf?.desc||""} ${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1]?.label} ${s10(top2[1]?.key)}/10 criam a percepÃ§Ã£o de profissional com propÃ³sito e coerÃªncia. ${bot2[0]?`O desafio central Ã© ${bot2[0].label} ${s10(bot2[0].key)}/10 â ${dimInterp[bot2[0].key]?.[getLvl(pct(bot2[0].key))]?.split('.')[0]||''}.`:''}`:''}.</p>


<div class="h3">Sua arquitetura relacional â como vocÃª estÃ¡ sendo percebido</div>
<p class="body-p">${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 ${top2[1]?`combinado com ${top2[1].label} ${s10(top2[1].key)}/10`:''} cria a impressÃ£o de alguÃ©m que sabe o que estÃ¡ fazendo e para onde vai. Isso Ã© um ativo real â as pessoas confiam em quem demonstra clareza de propÃ³sito. O problema Ã© que essa percepÃ§Ã£o ainda nÃ£o Ã© suficientemente nutrida ${bot2[0]?`pela ausÃªncia de ${bot2[0].label.toLowerCase()} ativa`:''}.`:''}</p>


<div class="box box-warn" style="margin-top:12px">
  <div class="box-lbl" style="color:#c62828">A sombra do seu perfil â o ponto cego que mais te custa</div>
  <p style="font-size:8.5pt;color:#444;line-height:1.65;margin:0">${bot2[0]?`A sombra mais profunda Ã© o gap entre a intenÃ§Ã£o declarada e a execuÃ§Ã£o. ${bot2[0].label} ${s10(bot2[0].key)}/10 Ã© o padrÃ£o que mais custa â nÃ£o pela ausÃªncia de vontade, mas pela ausÃªncia de sistema. ${dimInterp[bot2[0].key]?.[getLvl(pct(bot2[0].key))]||''}`:pf?.risks?.[0]||''}</p>
</div>


<div class="box box-gold">
  <div class="box-lbl" style="color:#c9a227">â NÃ£o ignore isso</div>
  <p style="font-size:8.5pt;color:#444;line-height:1.65;margin:0">${bot2[0]?`${(['presenca_mercado','escuta_relacional','reciprocidade_ativa','confianca_autentica'].includes(bot2[0].key)?bot2[0].label+' baixa':bot2[0].label+' baixo')} Ã© o padrÃ£o clÃ¡ssico do profissional que confunde intenÃ§Ã£o com execuÃ§Ã£o. A diferenÃ§a entre quem constrÃ³i capital relacional real e quem acumula contatos estÃ¡ exatamente nessa dimensÃ£o.`:pf?.risks?.[1]||''}</p>
</div>


<div style="margin-top:14px">
  <div class="lbl">ForÃ§as e Riscos</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="box box-grey">
      <div class="box-lbl" style="color:#2e7d32">â Suas ForÃ§as</div>
      ${(pf?.strengths||[]).map(s=>`<div style="display:flex;gap:6px;margin-bottom:5px;font-size:8.5pt"><span style="color:#2e7d32;flex-shrink:0">â</span><span style="color:#333">${s}</span></div>`).join('')}
    </div>
    <div class="box box-grey">
      <div class="box-lbl" style="color:#c62828">â  Pontos de AtenÃ§Ã£o</div>
      ${(pf?.risks||[]).map(r=>`<div style="display:flex;gap:6px;margin-bottom:5px;font-size:8.5pt"><span style="color:#c62828;flex-shrink:0">!</span><span style="color:#333">${r}</span></div>`).join('')}
    </div>
  </div>
</div>


<div class="box box-gold" style="margin-top:10px">
  <div class="box-lbl" style="color:#c9a227">Suas 3 AÃ§Ãµes PrioritÃ¡rias</div>
  ${(pf?.actions||[]).map((a,i)=>`<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<(pf?.actions?.length-1)?'1px solid #e5d89a':'none'}"><span style="font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#c9a227;flex-shrink:0">${i+1}</span><span style="font-size:8.5pt;color:#333;line-height:1.5">${a}</span></div>`).join('')}
</div>


<!-- ââââ PLANO DE AÃÃO IMEDIATO âââââââââââââââââââââââââââââââââââââââ -->
${(() => {
  const plan = generateImmediateActionPlan(sc);
  if (!plan) return '';
  return `<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
</div>
<div class="lbl">Plano de AÃ§Ã£o Imediato</div>
<h2 style="margin-bottom:6px">De diagnÃ³stico para execuÃ§Ã£o</h2>
<p style="font-size:8.5pt;color:#666;margin-bottom:16px">AÃ§Ãµes concretas baseadas nos seus menores scores. Sem teoria â sÃ³ o prÃ³ximo passo.</p>
<div style="display:grid;grid-template-columns:1fr;gap:12px">
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #e8d89a;border-radius:8px;overflow:hidden">
    <div style="background:#fdf6d8;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #e8d89a">
      <div style="font-size:18px">â¡</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#a07814;text-align:center;line-height:1.2">48h</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#a07814;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px">PrÃ³ximas 48 horas</div>
      <p style="font-size:9pt;color:#333;line-height:1.65;margin:0">${plan.h48}</p>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:#f9f7f3;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #ddd">
      <div style="font-size:18px">ð</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#888;text-align:center;line-height:1.2">7d</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">PrÃ³ximos 7 dias</div>
      ${plan.d7.map((a,i) => `<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<plan.d7.length-1?'1px solid #f0ede4':'none'}">
        <div style="width:20px;height:20px;border-radius:5px;background:#f0ede4;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#888;flex-shrink:0">${i+1}</div>
        <span style="font-size:8.5pt;color:#333;line-height:1.55">${a}</span>
      </div>`).join('')}
    </div>
  </div>
  <div style="display:grid;grid-template-columns:56px 1fr;border:1px solid #ddd;border-radius:8px;overflow:hidden">
    <div style="background:#f9f7f3;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;gap:4px;border-right:1px solid #ddd">
      <div style="font-size:18px">ð</div>
      <div style="font-family:'Courier New',monospace;font-size:8pt;font-weight:700;color:#888;text-align:center;line-height:1.2">30d</div>
    </div>
    <div style="padding:12px 14px">
      <div style="font-size:8pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">PrÃ³ximos 30 dias</div>
      ${plan.d30.map((a,i) => `<div style="display:flex;gap:10px;margin-bottom:7px;padding-bottom:7px;border-bottom:${i<plan.d30.length-1?'1px solid #f0ede4':'none'}">
        <div style="width:20px;height:20px;border-radius:5px;background:#f0ede4;display:flex;align-items:center;justify-content:center;font-family:'Courier New',monospace;font-size:9pt;font-weight:700;color:#888;flex-shrink:0">${i+1}</div>
        <span style="font-size:8.5pt;color:#333;line-height:1.55">${a}</span>
      </div>`).join('')}
    </div>
  </div>
</div>`;
})()}


<!-- ââââ P4: GATILHOS ââââââââââââââââââââââââââââââââââââââââââââââ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
</div>


<div class="lbl">Gatilhos Relacionais</div>
<div class="h1" style="margin-bottom:6px">Os padrÃµes automÃ¡ticos que ativam e travam o comportamento relacional</div>
<p style="font-size:8.5pt;color:#666;margin-bottom:14px">O que faz vocÃª aparecer com energia total â e o que te impede de avanÃ§ar.</p>


<div class="g2" style="margin-bottom:18px">
  <div>
    <div style="font-size:8pt;font-weight:700;color:#2e7d32;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">â¡ Gatilhos de AtivaÃ§Ã£o</div>
    ${(()=>{
      const acoes = {
        intencao_estrategica: "Escolha melhor onde colocar energia. Seu ganho estÃ¡ em priorizar relaÃ§Ãµes que ampliam reputaÃ§Ã£o, oportunidade e confianÃ§a.",
        escuta_relacional: "Use sua escuta para entender o momento do outro antes de propor qualquer prÃ³ximo passo.",
        presenca_mercado: "Use sua visibilidade para ocupar os ambientes certos com constÃ¢ncia e intenÃ§Ã£o.",
        reciprocidade_ativa: "Continue gerando valor antes de pedir. IndicaÃ§Ãµes, reconhecimento e ajuda prÃ¡tica fortalecem retorno espontÃ¢neo.",
        ritual_consistencia: "Mantenha cadÃªncia. RelaÃ§Ãµes importantes nÃ£o esfriam quando existe ritual.",
        confianca_autentica: "Sua coerÃªncia gera confianÃ§a. Preserve o mesmo tom em conversas formais e informais."
      };
      return DIMS.filter(d=>pct(d.key)>=65).slice(0,3).map(d=>`<div class="gt-block gt-at">
        <div class="gt-title" style="color:#2e7d32">${d.label} ${s10(d.key)}/10</div>
        <div class="gt-desc">${dimInterp[d.key]?.high?.split('.')[0]||''}</div>
        <div class="gt-action">â ${acoes[d.key]||'Use este ponto como vantagem relacional.'}</div>
      </div>`).join('');
    })()}
  </div>
  <div>
    <div style="font-size:8pt;font-weight:700;color:#c62828;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">ð´ Gatilhos de Bloqueio</div>
    ${(()=>{
      const antidotos = {
        intencao_estrategica: "Defina seus 10 contatos prioritÃ¡rios e o motivo de cada um importar nos prÃ³ximos 90 dias.",
        escuta_relacional: "Entre em conversas importantes com uma pergunta aberta e a intenÃ§Ã£o real de entender.",
        presenca_mercado: "Crie uma cadÃªncia mÃ­nima: 1 conteÃºdo, 1 conversa e 1 apariÃ§Ã£o relevante por semana.",
        reciprocidade_ativa: "Antecipe valor: faÃ§a uma indicaÃ§Ã£o, compartilhe algo Ãºtil ou reconheÃ§a alguÃ©m antes de precisar pedir.",
        ritual_consistencia: "Coloque um ritual fixo de 30 minutos por semana para revisar contatos e prÃ³ximos passos.",
        confianca_autentica: "Reduza interaÃ§Ãµes transacionais. FaÃ§a uma conversa sem vender, pedir ou apresentar nada."
      };
      return DIMS.filter(d=>pct(d.key)<70).slice(-3).map(d=>`<div class="gt-block gt-bl">
        <div class="gt-title" style="color:#c62828">${d.label} ${s10(d.key)}/10</div>
        <div class="gt-desc">${dimInterp[d.key]?.[getLvl(pct(d.key))]?.split('.')[0]||''}</div>
        <div class="gt-action">AntÃ­doto: ${antidotos[d.key]||'Crie um sistema mÃ­nimo para esta dimensÃ£o.'}</div>
      </div>`).join('');
    })()}
  </div>
</div>


<!-- ââââ P5: PLANO âââââââââââââââââââââââââââââââââââââââââââââââââ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
</div>


<div class="lbl">Plano de AtivaÃ§Ã£o â 4 Semanas</div>
<div class="h1" style="margin-bottom:6px">Quatro semanas para transformar o gap mais custoso em hÃ¡bito</div>
<p style="font-size:8.5pt;color:#666;margin-bottom:14px">Cada semana tem um foco, um comportamento concreto e uma meta mensurÃ¡vel.</p>
${PLAN.map((w,i)=>`<div class="week-box">
  <div class="week-num"><span>${w.icon}</span><span class="week-num-txt">${w.week}</span></div>
  <div class="week-body">
    <div class="week-sem">Semana ${w.week}</div>
    <div class="week-title">${w.title}</div>
    <div class="week-goal">${w.goal}</div>
    ${w.tasks.map(t=>`<div class="week-task"><span style="color:#c9a22760">â</span>${t}</div>`).join('')}
    <div class="week-meta">Meta: ${w.metric}</div>
  </div>
</div>`).join('')}


<!-- ââââ P5: TERMÃMETRO + VANTAGEM ââââââââââââââââââââââââââââââââââ -->
<div class="pg-hdr pb">
  <div class="pg-hdr-title">DIAGNÃSTICO RELACIONAL PROFISSIONAL</div>
  <div class="pg-hdr-right">${nomePessoa} Â· ${BRAND.name}</div>
</div>


<div class="lbl">TermÃ´metro Relacional â 90 Dias</div>
<div class="h1" style="margin-bottom:10px">O que Ã© possÃ­vel construir com consistÃªncia de aplicaÃ§Ã£o</div>


<table class="thermo" style="margin-bottom:16px">
  <tr><th>DimensÃ£o</th><th>Hoje</th><th>90 dias</th><th>O que muda</th></tr>
  ${termometro.map(t=>`<tr><td style="font-weight:600">${t.label}</td><td style="font-family:'Courier New',monospace;font-weight:700;text-align:center">${t.hoje}</td><td style="font-family:'Courier New',monospace;font-weight:700;color:#2e7d32;text-align:center">${t.d90}</td><td style="font-size:8pt;color:#555">${t.muda}</td></tr>`).join('')}
</table>


<div class="lbl">A Vantagem Ãnica do Seu Perfil</div>
<div class="vant-box">
  <p style="font-size:9pt;color:#333;line-height:1.75;margin:0">${pf?.desc?.split('.').slice(0,2).join('.')||''}. ${top2[0]?`${top2[0].label} ${s10(top2[0].key)}/10 e ${top2[1]?.label} ${s10(top2[1]?.key)}/10 Ã© uma combinaÃ§Ã£o que jÃ¡ posiciona como referÃªncia. O prÃ³ximo nÃ­vel nÃ£o exige mudar o que vocÃª faz â exige ampliar como o mercado enxerga o que vocÃª entrega.`:''}</p>
</div>


<p style="text-align:center;font-style:italic;color:#666;font-size:9pt;margin-bottom:20px">"Toda semana: em quantas conversas vocÃª genuinamente aprendeu algo sobre o outro que nÃ£o sabia antes â e o que isso diz sobre a qualidade da sua presenÃ§a?"</p>


<div class="frase-box">
  <div class="frase-big">${nomePessoa.split(" ")[0]||"VocÃª"}, vocÃª jÃ¡ sabe chegar.<br>O prÃ³ximo nÃ­vel Ã© fazer as pessoas quererem que vocÃª fique.</div>
  <div class="frase-sub">"Relacionamento nÃ£o Ã© sobre ter muitos contatos. Ã sobre ser indispensÃ¡vel para os que importam."</div>
</div>


${MENTORIA_LINK || true ? `
<div class="pb" style="background:#f9f7f3;border-top:1px solid #e0ddd8;padding:28px 40px;text-align:center">
  <div style="font-size:8pt;font-weight:700;color:#a07814;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Mentoria Individual</div>
  <div style="font-size:14pt;font-weight:700;color:#1a1a1a;margin-bottom:8px">Quer desenvolver esse plano com mais profundidade?</div>
  <p style="font-size:9pt;color:#555;line-height:1.7;margin:0 auto 14px;max-width:500px">Se fizer sentido para vocÃª, posso te ajudar em uma mentoria individual para transformar esse diagnÃ³stico em um plano prÃ¡tico de relacionamento, posicionamento e geraÃ§Ã£o de oportunidades.</p>
  ${MENTORIA_LINK ? `<a href="${MENTORIA_LINK}" target="_blank" style="display:inline-block;background:#c9a227;color:#0d0d0f;border-radius:6px;padding:10px 24px;font-size:10pt;font-weight:700;text-decoration:none">Quero desenvolver meu plano</a>` : `<div style="font-size:9pt;color:#888;font-style:italic">Em breve vocÃª poderÃ¡ solicitar sua mentoria por aqui.</div>`}
</div>` : ''}


<div class="footer-bar" style="margin-top:20px">
  <div class="footer-bar-l">${BRAND.name}</div>
  <div class="footer-bar-r">"Networking, alÃ©m do cafezinho" Â· Rafael MillÃ©o<br>DiagnÃ³stico Relacional Profissional Â· ${new Date().toLocaleDateString('pt-BR')}</div>
</div>


</body></html>`;


      const win=window.open("","_blank");
      if(!win){alert("Permita pop-ups para abrir o relatÃ³rio.");return;}
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
          {/* Download do relatÃ³rio/PDF Ã© gratuito para todos os usuÃ¡rios (Free e PRO) â decisÃ£o de produto: nÃ£o cobrar pelo assessment em si */}
          <Btn small onClick={downloadReport}>â¬ Baixar relatÃ³rio</Btn>
          {false && (
            <button onClick={() => setShowUpgrade(true)} style={{ background: `${C.gold}15`, border: `1px solid ${C.gold}50`, borderRadius: 10, padding: "10px 16px", cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, color: C.gold, marginBottom: 2 }}>ð PRO</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>Fazer upgrade</div>
            </button>
          )}
          {showUpgrade && <UpgradeModal />}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 16, display: "flex", justifyContent: "center" }}>{isPro && <RadarChart scores={sc} />}</div>
        {!isPro && (
          <ProLock
            title="Sua TrajetÃ³ria completa Ã© PRO"
            desc="Veja suas 6 dimensÃµes com comportamento observado (nÃ£o sÃ³ o que vocÃª declarou), forÃ§as, riscos, anÃ¡lise profunda e suas 3 aÃ§Ãµes prioritÃ¡rias."
            onKey={openAccessKey}
            user={user}
          />
        )}
        {isPro && (<>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Suas 6 dimensÃµes</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 12 }}>Toque numa dimensÃ£o pra ver o porquÃª e uma sugestÃ£o concreta.</div>
          {DIMS.map((d, i) => { const v = sc[d.key] || 0;
            const obs = dimObservation?.[d.key];
            const OBS_COLOR = { evoluindo: C.grn, estavel: C.amb, perdendo_intensidade: C.cor };
            const OBS_LABEL = { evoluindo: 'Evoluindo', estavel: 'EstÃ¡vel', perdendo_intensidade: 'Perdendo intensidade' };
            const isOpen = expandedDim === d.key;
            const insight = isOpen ? buildDimensionInsight(d.key, obs) : null;
            return (
            <div key={i} style={{ marginBottom: 12 }}>
              <div onClick={() => setExpandedDim(isOpen ? null : d.key)} style={{ cursor: 'pointer' }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txt }}>{d.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {obs && obs.state !== 'sem_dados' && (
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 700, color: OBS_COLOR[obs.state], border: `1px solid ${OBS_COLOR[obs.state]}40`, borderRadius: 20, padding: "2px 8px" }}>
                        Comportamento: {OBS_LABEL[obs.state]}
                      </span>
                    )}
                    <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: d.color }}>{v}%</span>
                  </div>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: C.w06 }}><div style={{ height: 7, borderRadius: 4, background: d.color, width: `${v}%` }} /></div>
              </div>
              {isOpen && insight && (
                <div style={{ marginTop: 8, background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.5, marginBottom: insight.action ? 8 : 0 }}>{insight.diagnosis}</div>
                  {insight.action && (
                    <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 6, padding: '7px 10px' }}>
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: 'uppercase', letterSpacing: '.06em' }}>â AÃ§Ã£o: </span>
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{insight.action}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ); })}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {(pf?.strengths || []).map((s, i) => <div key={i} style={{ background: C.grnD, border: `1px solid ${C.grn}28`, borderRadius: 10, padding: 12 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.grn, marginBottom: 4 }}>â ForÃ§a</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{s}</div></div>)}
          {(pf?.risks || []).map((r, i) => <div key={i} style={{ background: C.corD, border: `1px solid ${C.cor}28`, borderRadius: 10, padding: 12 }}><div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 600, color: C.cor, marginBottom: 4 }}>â  Risco</div><div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>{r}</div></div>)}
        </div>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>AnÃ¡lise profunda</div>
          <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, lineHeight: 1.65, margin: 0 }}>{pf?.desc}</p>
        </div>
        <div style={{ background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 14, padding: 24 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.gold, textTransform: "uppercase", marginBottom: 4 }}>VocÃª Ã© {pf?.name}.</div>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 20, fontWeight: 700, color: C.txt, marginBottom: 14 }}>Suas 3 aÃ§Ãµes prioritÃ¡rias:</div>
          <ArchetypeActionsChecklist userId={user?.id} pf={pf} hideHeader />
        </div>
        {cts.length > 0 && (() => {
          // DistribuiÃ§Ã£o por categoria
          const catCount = {};
          cts.forEach(c => { catCount[c.category] = (catCount[c.category] || 0) + 1; });
          const catEntries = Object.entries(catCount).sort((a, b) => b[1] - a[1]);
          const dominantCat = catEntries[0];
          const dominantPct = Math.round((dominantCat?.[1] || 0) / cts.length * 100);
          const catLabel = (v) => CATS.find(c => c.value === v)?.label || v;
          const catColor = (v) => CATS.find(c => c.value === v)?.color || C.gold;


          // DistribuiÃ§Ã£o por empresa
          const empCount = {};
          cts.forEach(c => { if (c.company) { empCount[c.company] = (empCount[c.company] || 0) + 1; } });
          const empEntries = Object.entries(empCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
          const topEmp = empEntries[0];
          const topEmpPct = topEmp ? Math.round(topEmp[1] / cts.length * 100) : 0;


          // Contatos sem prÃ³xima aÃ§Ã£o
          const semAcao = cts.filter(c => !c.nextAction && c.status === 'active').length;
          const semInteracao = cts.filter(c => !c.lastInteraction).length;


          // InteraÃ§Ãµes recentes
          const recentIts = its.slice(0, 8);
          const sentPos = its.filter(i => i.sentiment === 'positivo').length;
          const sentNeg = its.filter(i => i.sentiment === 'negativo').length;
          const sentPct = its.length > 0 ? Math.round(sentPos / its.length * 100) : 0;


          return (
            <>
              {/* Painel: Sua Rede em NÃºmeros */}
              <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>ð Sua rede em nÃºmeros</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[{ l: 'Total de contatos', v: cts.length, c: C.gold }, { l: 'Sem prÃ³xima aÃ§Ã£o', v: semAcao, c: semAcao > 0 ? C.amb : C.grn }, { l: 'Sem interaÃ§Ã£o registrada', v: semInteracao, c: semInteracao > 0 ? C.cor : C.grn }, { l: 'InteraÃ§Ãµes positivas', v: `${sentPct}%`, c: sentPct >= 70 ? C.grn : C.amb }].map((m, i) => (
                    <div key={i} style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, marginBottom: 4 }}>{m.l}</div>
                      <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
                    </div>
                  ))}
                </div>


                {/* DistribuiÃ§Ã£o por categoria */}
                <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>DistribuiÃ§Ã£o por categoria</div>
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
                        <div style={{ height: 6, borderRadius: 3, background: cc, width: `${pct}%`, transition: `width ${MOTION.slow}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>


              {/* Alerta de concentraÃ§Ã£o */}
              {(dominantPct > 60 || topEmpPct > 60) && (
                <div style={{ background: `${C.amb}08`, border: `1px solid ${C.amb}30`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.amb, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>â  Alerta de concentraÃ§Ã£o</div>
                  {dominantPct > 60 && (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, marginBottom: 6 }}>
                      <strong style={{ color: C.txt }}>{dominantPct}% dos seus contatos sÃ£o "{catLabel(dominantCat[0])}".</strong> Redes diversas geram mais oportunidades. Busque contatos nas categorias menos representadas.
                    </div>
                  )}
                  {topEmpPct > 60 && (
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6 }}>
                      <strong style={{ color: C.txt }}>{topEmpPct}% dos seus contatos sÃ£o da {topEmp[0]}.</strong> Diversifique para reduzir dependÃªncia e ampliar oportunidades externas.
                    </div>
                  )}
                  <div style={{ background: `${C.gold}0A`, border: `1px solid ${C.gL}`, borderRadius: 6, padding: '8px 12px', marginTop: 10 }}>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 9, fontWeight: 600, color: C.gold, textTransform: 'uppercase' }}>â AÃ§Ã£o: </span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt }}>Cadastre 2 contatos de empresas ou categorias diferentes nos prÃ³ximos 7 dias.</span>
                  </div>
                </div>
              )}


              {/* DistribuiÃ§Ã£o por empresa */}
              {empEntries.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 12 }}>ð¢ Empresas na sua rede</div>
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


              {/* InteraÃ§Ãµes recentes */}
              {recentIts.length > 0 && (
                <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: 'uppercase', letterSpacing: '.08em' }}>ð¬ InteraÃ§Ãµes recentes</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.grn, background: `${C.grn}12`, border: `1px solid ${C.grn}30`, borderRadius: 4, padding: '2px 8px' }}>â {sentPos} positivas</span>
                      {sentNeg > 0 && <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.cor, background: `${C.cor}12`, border: `1px solid ${C.cor}30`, borderRadius: 4, padding: '2px 8px' }}>â {sentNeg} negativas</span>}
                    </div>
                  </div>
                  {recentIts.map((it, i) => {
                    const contact = cts.find(c => c.id === it.contactId);
                    const typeLabel = { ligacao: 'LiganÃ§a', mensagem: 'Mensagem', reuniao: 'ReuniÃ£o', email: 'E-mail', outro: 'Outro' }[it.type] || it.type;
                    const sentColor = it.sentiment === 'positivo' ? C.grn : it.sentiment === 'negativo' ? C.cor : C.txL;
                    const sentIcon = it.sentiment === 'positivo' ? 'â' : it.sentiment === 'negativo' ? 'â' : 'â';
                    const daysAgo = Math.floor((Date.now() - new Date(it.createdAt).getTime()) / 86400000);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, marginBottom: 8, borderBottom: i < recentIts.length - 1 ? `1px solid ${C.brd}` : 'none' }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: `${sentColor}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>{sentIcon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txt, fontWeight: 500 }}>{contact?.name || 'Contato'}</div>
                          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>{typeLabel} Â· {daysAgo === 0 ? 'hoje' : `${daysAgo}d atrÃ¡s`}</div>
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
        </>)}
      </div>
    );
  };


  // ââ Aba Perfil ââââââââââââââââââââââââââââââââââââââââââââ
  const renderPerfilForm = () => (
    <div>
      <PerfilForm
        profile={profile}
        userId={user?.id}
        onSaved={(updated) => onProfileUpdate?.(updated)}
        isPro={isPro}
        openAccessKey={openAccessKey}
        archetype={pf}
      />
      {profile?.organization_id && profile?.org_role === "membro" && profile?.org_consent_status === "accepted" && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>OrganizaÃ§Ã£o</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 14, lineHeight: 1.55 }}>
            Seu admin vÃª um resumo categÃ³rico da sua tendÃªncia semanal por dimensÃ£o e a quantidade de contatos e interaÃ§Ãµes que vocÃª registra. A identidade dos seus contatos e o conteÃºdo de qualquer conversa continuam privados. VocÃª pode sair a qualquer momento â isso nÃ£o afeta seus dados individuais.
          </div>
          <Btn variant="ghost" small onClick={leaveOrganization} disabled={orgConsentBusy}>Sair da organizaÃ§Ã£o</Btn>
        </div>
      )}
      {!profile?.organization_id && (
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 20, marginTop: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 600, color: C.txL, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Tem um cÃ³digo de empresa?</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, marginBottom: 14, lineHeight: 1.55 }}>
            Se sua empresa usa o {BRAND.name}, digite o cÃ³digo que ela te passou. Antes de qualquer coisa aparecer pro admin, vocÃª ainda vai confirmar o que fica visÃ­vel.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={joinOrgCode}
              onChange={(e) => setJoinOrgCode(e.target.value.toUpperCase())}
              placeholder="Ex: A1B2C3D4"
              maxLength={8}
              style={{ flex: "1 1 160px", background: C.w06, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "9px 12px", fontFamily: "'JetBrains Mono'", fontSize: 13, color: C.txt, letterSpacing: ".05em" }}
            />
            <Btn small onClick={joinOrganization} disabled={joinOrgBusy || !joinOrgCode.trim()}>Entrar</Btn>
          </div>
          {joinOrgMsg && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor, marginTop: 8 }}>{joinOrgMsg}</div>}
        </div>
      )}
    </div>
  );


  // ââ "Insights" (Ã¢ncora principal, coluna lateral) = IA + Plano + RelatÃ³rio ââ
  // Cadastro/atualizaÃ§Ã£o de perfil NÃO fica aqui â sÃ³ no botÃ£o "Perfil" do
  // rodapÃ© da barra lateral (view="perfil", renderPerfilForm acima). SÃ£o 2
  // destinos diferentes agora, cada um com um conteÃºdo diferente:
  //   - "Insights" (coluna lateral): chamariz pra IA, com Plano/RelatÃ³rio juntos
  //   - "Perfil" (rodapÃ©, Ã¡rea da conta): sÃ³ cadastro/dados pessoais
  const [insightsSubTab, setInsightsSubTab] = useState("ia");
  const INSIGHTS_TABS = [
    { id: "ia", label: "Insights" },
    { id: "plano", label: "Plano" },
    { id: "report", label: "TrajetÃ³ria" },
  ];
  const renderInsightsHub = () => (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {INSIGHTS_TABS.map(t => (
          <button key={t.id} onClick={() => setInsightsSubTab(t.id)} style={{ background: insightsSubTab === t.id ? C.gD : "transparent", border: `1px solid ${insightsSubTab === t.id ? C.gL : C.brd}`, borderRadius: 8, padding: "7px 14px", fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, color: insightsSubTab === t.id ? C.gold : C.txM, cursor: "pointer" }}>{t.label}</button>
        ))}
      </div>
      {insightsSubTab === "ia" && <AbaIA userId={user?.id} contacts={cts} interactions={its} assessment={assessment} profile={profile} pf={pf} isPro={isPro} openAccessKey={openAccessKey} />}
      {insightsSubTab === "plano" && renderPlan()}
      {insightsSubTab === "report" && renderReport()}
    </div>
  );


  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);


  // ââ Tour de uso (primeira vez) âââââââââââââââââââââââââââââ
  // Mostra automaticamente sÃ³ na primeira visita (profile.tour_completed
  // ainda nÃ£o true). Depois disso sÃ³ reabre pela lÃ¢mpada de dicas, e nunca
  // mais de forma automÃ¡tica â fechar em qualquer ponto jÃ¡ marca como visto.
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (profile && profile.tour_completed !== true) setShowTour(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const closeTour = async () => {
    setShowTour(false);
    if (profile?.tour_completed || !user?.id) return;
    try {
      const { error } = await supabase.from("profiles").update({ tour_completed: true }).eq("id", user.id);
      if (error) console.error("[Tour] falha ao salvar tour_completed:", error);
    } catch (e) { console.error("[Tour] excecao ao salvar tour_completed:", e); }
    onProfileUpdate?.({ tour_completed: true });
  };


  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
      {/* Ajuda: automÃ¡tica na 1Âª vez (boas-vindas), depois sempre contextual
          ao que a pessoa estÃ¡ vendo â nÃ£o Ã© mais um tour fixo do app inteiro. */}
      {showTour && <TourModal onClose={closeTour} onFinish={closeTour} steps={getHelpSteps(["dash", "contacts", "perfil", "insights", "startNetwork"].includes(view) ? view : "dash")} />}
      {/* Guardrail de consentimento â vÃ­nculo a organizaÃ§Ã£o nunca Ã©
          silencioso. Sem X, sem clique-fora: sÃ³ decide clicando num dos
          dois botÃµes. Enquanto pending, o admin nÃ£o vÃª nada desta pessoa
          (get_org_team_overview exige org_consent_status='accepted'). */}
      {profile?.organization_id && profile?.org_consent_status === "pending" && profile?.org_role !== "admin" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.card, border: `1px solid ${C.brdH}`, borderRadius: 16, width: "100%", maxWidth: 440, padding: 28 }}>
            <h3 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.txt, margin: "0 0 14px" }}>Sua organizaÃ§Ã£o convidou vocÃª</h3>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, margin: "0 0 10px" }}>
              Se vocÃª aceitar, o admin da sua organizaÃ§Ã£o passa a ver um resumo <strong>categÃ³rico</strong> da sua tendÃªncia comportamental semanal por dimensÃ£o (ex.: "PresenÃ§a: Evoluindo") e a <strong>quantidade</strong> de contatos e interaÃ§Ãµes que vocÃª registra â nunca nÃºmeros de desempenho, nunca quem sÃ£o seus contatos, nunca o conteÃºdo de nada.
            </p>
            <p style={{ fontFamily: "'DM Sans'", fontSize: 13, color: C.txM, lineHeight: 1.6, margin: "0 0 20px" }}>
              A identidade dos seus contatos e o que foi dito em qualquer conversa continuam 100% privados em qualquer um dos dois casos. VocÃª pode sair da organizaÃ§Ã£o quando quiser, sem perder nada do seu {BRAND.name}.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn small onClick={() => respondOrgInvite(true)} disabled={orgConsentBusy}>Aceitar</Btn>
              <Btn variant="ghost" small onClick={() => respondOrgInvite(false)} disabled={orgConsentBusy}>Recusar</Btn>
            </div>
          </div>
        </div>
      )}
      <HelpButton onClick={() => setShowTour(true)} bottom={isMobile ? 78 : 20} />
      {/* PRO Activation Toast */}
      {proToast && <div style={{ position:"fixed", top:16, left:"50%", transform:"translateX(-50%)", background:C.gold, color:C.bg, borderRadius:10, padding:"12px 24px", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, zIndex:9999, boxShadow:"0 4px 20px #c9a22740", whiteSpace:"nowrap" }}>â¨ PRO ativado com sucesso!</div>}
      {!isMobile && (
        <nav style={{ width: 190, flexShrink: 0, background: C.sf, borderRight: `1px solid ${C.brd}`, padding: "20px 12px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 18px", borderBottom: `1px solid ${C.brd}`, marginBottom: 14 }}>
            <ConexiaIcon size={30} dark={true} />
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: C.txt }}>{BRAND.name}</div>
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
            <div style={{ marginTop:4, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
              <span style={{ fontFamily:"'DM Sans'", fontSize:9, fontWeight:700, textTransform:"uppercase", letterSpacing:".08em", padding:"2px 7px", borderRadius:3, background: isPro?`${C.gold}20`:C.w06, color: isPro?C.gold:C.txL, border:`1px solid ${isPro?C.gL:C.brd}` }}>{planLabel}</span>
              {!isPro && <button onClick={openAccessKey} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:9, color:C.txL, cursor:"pointer", padding:0 }}>Chave</button>}
              {!isPro && (
                <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"baseline", gap:3, textDecoration:"none", cursor:"pointer" }}>
                  <span style={{ fontFamily:"'DM Sans'", fontSize:9, color:C.txL }}>seja</span>
                  <span style={{ fontFamily:"'DM Sans'", fontSize:13, fontWeight:800, color:C.gold, letterSpacing:".02em" }}>PRO</span>
                </a>
              )}
            </div>
            {admin && <Tag color={C.vio} small>Admin</Tag>}
          </div>
          <button onClick={() => setView("perfil")} style={{ width:"100%", display:"flex", alignItems:"center", gap:10, background: view==="perfil" ? C.gD : "transparent", border: view==="perfil" ? `1px solid ${C.gL}` : "1px solid transparent", borderRadius:7, padding:"9px 12px", cursor:"pointer", marginBottom:3 }}>
            <span style={{ fontSize:12, color: view==="perfil" ? C.gold : C.txL }}>ð¤</span>
            <span style={{ fontFamily:"'DM Sans'", fontSize:13, fontWeight:500, color: view==="perfil" ? C.gold : C.txM }}>Perfil</span>
          </button>
          <Btn variant="ghost" small onClick={onReset}>Sair</Btn>
        </nav>
      )}


      {isMobile && (
        <div style={{ background: C.sf, borderBottom: `1px solid ${C.brd}`, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ConexiaIcon size={26} dark={true} />
            <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 700, color: C.txt }}>{BRAND.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!isPro && (
              <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, background: C.gold, color: C.bg, borderRadius: 20, padding: "5px 12px", fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                seja PRO
              </a>
            )}
            <button onClick={() => { setView("perfil"); setSelId(null); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", borderRadius: 6 }}>
              <span style={{ fontSize: 14 }}>ð¤</span>
              <span style={{ fontFamily: "'DM Sans'", fontSize: 11, color: view === "perfil" ? C.gold : C.txL, fontWeight: view === "perfil" ? 700 : 400, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile?.name || "Perfil"}</span>
            </button>
            <button
              onClick={() => { if (window.confirm(`Sair do ${BRAND.name}?`)) onReset(); }}
              aria-label="Sair"
              style={{ background: "none", border: `1px solid ${C.brd}`, borderRadius: 6, padding: "4px 9px", fontFamily: "'DM Sans'", fontSize: 11, color: C.txM, cursor: "pointer" }}
            >
              Sair
            </button>
          </div>
        </div>
      )}


      <main
        style={{
          flex: 1,
          minHeight: 0,
          padding: isMobile ? "14px 14px 0" : "24px 28px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          maxHeight: "none",
          paddingBottom: isMobile
            ? "calc(104px + env(safe-area-inset-bottom))"
            : 24,
        }}
      >
        {view === "dash" && renderDash()}
        {view === "startNetwork" && (
          <GuidedNetworkStart
            userId={user?.id}
            onFinish={() => { load(); setView("dash"); }}
            onExit={() => { load(); setView("dash"); }}
          />
        )}
        {view === "contacts" && renderContacts()}
        {view === "teia" && renderTeia()}
        {view === "plano" && renderPlan()}
        {view === "ia" && <AbaIA userId={user?.id} contacts={cts} interactions={its} assessment={assessment} profile={profile} pf={pf} isPro={isPro} openAccessKey={openAccessKey} />}
        {view === "empresa" && profile?.organization_id && profile?.org_role === "admin" && renderEmpresa()}
        {view === "report" && renderReport()}
        {view === "mentor" && admin && renderMentor()}
        {view === "export" && admin && renderExport()}
        {view === "metrics" && isMetricsAdmin && renderMetrics()}
        {view === "insights" && renderInsightsHub()}
        {view === "perfil" && renderPerfilForm()}
      </main>


      {isMobile && (
        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "rgba(18,18,18,.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderTop: `1px solid ${C.brd}`,
            display: "flex",
            justifyContent: "space-around",
            padding: "8px 0 calc(8px + env(safe-area-inset-bottom))",
            zIndex: 50,
          }}
        >
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
        <ContactCircleField network={network} value={contactCircleDraft} onChange={setContactCircleDraft} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Empresa" value={cf.company} onChange={v => setCf({ ...cf, company: v })} placeholder="Empresa" />
          <Inp label="Cargo" value={cf.role} onChange={v => setCf({ ...cf, role: v })} placeholder="Cargo" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð± WhatsApp" value={cf.whatsapp} onChange={v => setCf({ ...cf, whatsapp: v })} placeholder="(00) 00000-0000" />
          <Inp label="âï¸ Email" value={cf.contactEmail} onChange={v => setCf({ ...cf, contactEmail: v })} placeholder="email@empresa.com" type="email" />
        </div>
        <Inp label="ð LinkedIn" value={cf.linkedin} onChange={v => setCf({ ...cf, linkedin: v })} placeholder="linkedin.com/in/nome" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð AniversÃ¡rio" value={cf.birthday} onChange={v => setCf({ ...cf, birthday: v })} type="date" />
          <Sel label="ð± Cultura principal" value={cf.mainCulture} onChange={v => setCf({ ...cf, mainCulture: v })} options={MAIN_CULTURES} placeholder="Selecione..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð Cidade" value={cf.city} onChange={v => setCf({ ...cf, city: v })} placeholder="Cidade" />
          <Sel label="Estado" value={cf.stateCode} onChange={v => setCf({ ...cf, stateCode: v })} options={UFS} placeholder="UF" />
        </div>
        <Inp label="ð¯ Hobbies / Interesses" value={cf.hobbies} onChange={v => setCf({ ...cf, hobbies: v })} placeholder="Pesca, futebol, leitura..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Sel label="Categoria" value={cf.category} onChange={v => setCf({ ...cf, category: v })} options={CATS.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))} />
          <Sel label="Proximidade" value={cf.proximity} onChange={v => setCf({ ...cf, proximity: v })} options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${n}/5` }))} />
          <Inp label="Freq. (dias)" value={cf.idealFreq} onChange={v => setCf({ ...cf, idealFreq: v })} type="number" />
        </div>
        <Inp label="Como conheceu?" value={cf.howMet} onChange={v => setCf({ ...cf, howMet: v })} placeholder="Evento, indicaÃ§Ã£o, campo..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð PrÃ³xima aÃ§Ã£o" value={cf.nextAction} onChange={v => setCf({ ...cf, nextAction: v })} placeholder="Ligar, enviar artigo..." />
          <Inp label="ð Data da aÃ§Ã£o" value={cf.nextActionDate} onChange={v => setCf({ ...cf, nextActionDate: v })} type="date" />
        </div>
        <Inp label="ð Notas" value={cf.notes} onChange={v => setCf({ ...cf, notes: v })} placeholder="O que importa saber sobre essa pessoa..." textarea />
        {isPro ? (
          <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 16, paddingTop: 16 }}>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>RelevÃ¢ncia estratÃ©gica</div>
            <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 14 }}>Avalie de 0 a 10. Preencha os 4 para calcular a relevÃ¢ncia.</div>
            {[
              { field: "influenciaPessoas", label: "Influencia outras pessoas?", micro: "Essa pessoa movimenta opiniÃ£o, decisÃµes ou conexÃµes ao redor dela?" },
              { field: "geraOportunidade",  label: "Pode gerar oportunidade?",  micro: "Existe chance real de parceria, negÃ³cio, projeto, indicaÃ§Ã£o ou aprendizado?" },
              { field: "abrePortas",        label: "Pode abrir portas?",        micro: "Essa pessoa pode conectar vocÃª a pessoas, ambientes ou conversas importantes?" },
              { field: "momentoAtual",      label: "Faz sentido para meu momento atual?", micro: "Essa relaÃ§Ã£o tem conexÃ£o com seus objetivos dos prÃ³ximos meses?" },
            ].map(({ field, label, micro }) => (
              <div key={field} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM }}>{label}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{micro}</div>
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: C.gold, minWidth: 28, textAlign: "right" }}>{cf[field] !== "" ? cf[field] : "â"}</div>
                </div>
                <input type="range" min="0" max="10" step="1" value={cf[field] !== "" ? cf[field] : 5} onChange={e => setCf({ ...cf, [field]: e.target.value })} style={{ width: "100%", accentColor: C.gold, height: 4, cursor: "pointer" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'DM Sans'", fontSize: 9, color: C.txL, marginTop: 2 }}><span>0</span><span>5</span><span>10</span></div>
              </div>
            ))}
            {(() => { const rs = calculateRelevanceScore({ influenciaPessoas: cf.influenciaPessoas !== "" ? parseInt(cf.influenciaPessoas) : null, geraOportunidade: cf.geraOportunidade !== "" ? parseInt(cf.geraOportunidade) : null, abrePortas: cf.abrePortas !== "" ? parseInt(cf.abrePortas) : null, momentoAtual: cf.momentoAtual !== "" ? parseInt(cf.momentoAtual) : null }); return rs !== null ? (<div style={{ background:`${C.gold}10`, border:`1px solid ${C.gL}`, borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM }}>RelevÃ¢ncia</span><span style={{ fontFamily:"'JetBrains Mono'", fontSize:14, fontWeight:700, color:getRelevanceLabelColor(rs) }}>{rs}% â {getRelevanceLabel(rs)}</span></div>) : (<div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, fontStyle:"italic" }}>Preencha os 4 campos para calcular.</div>); })()}
          </div>
        ) : (
          <div style={{ borderTop:`1px solid ${C.brd}`, marginTop:16, paddingTop:16, background:`${C.gold}06`, borderRadius:8, padding:14 }}>
            <div style={{ fontFamily:"'DM Sans'", fontSize:12, fontWeight:600, color:C.gold, marginBottom:4 }}>ð RelevÃ¢ncia estratÃ©gica â PRO</div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, marginBottom:8 }}>Quer saber quem realmente importa na sua rede? A leitura de relevÃ¢ncia estÃ¡ disponÃ­vel no PRO.</div>
            <button onClick={openAccessKey} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:10, color:C.txL, cursor:"pointer", textDecoration:"underline" }}>Tenho uma chave de acesso</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => setModal(null)}>Cancelar</Btn><Btn small onClick={addC} disabled={!cf.name.trim() || savingContact}>{savingContact ? "Salvando..." : "Salvar"}</Btn></div>
      </Modal>}
      {modal === "editC" && <Modal title="Editar contato" onClose={() => { setModal(null); setEditId(null); }}>
        <Inp label="Nome *" value={cf.name} onChange={v => setCf({ ...cf, name: v })} placeholder="Nome completo" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="Empresa" value={cf.company} onChange={v => setCf({ ...cf, company: v })} placeholder="Empresa" />
          <Inp label="Cargo" value={cf.role} onChange={v => setCf({ ...cf, role: v })} placeholder="Cargo" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð± WhatsApp" value={cf.whatsapp} onChange={v => setCf({ ...cf, whatsapp: v })} placeholder="(00) 00000-0000" />
          <Inp label="âï¸ Email" value={cf.contactEmail} onChange={v => setCf({ ...cf, contactEmail: v })} placeholder="email@empresa.com" type="email" />
        </div>
        <Inp label="ð LinkedIn" value={cf.linkedin} onChange={v => setCf({ ...cf, linkedin: v })} placeholder="linkedin.com/in/nome" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð AniversÃ¡rio" value={cf.birthday} onChange={v => setCf({ ...cf, birthday: v })} type="date" />
          <Sel label="ð± Cultura principal" value={cf.mainCulture} onChange={v => setCf({ ...cf, mainCulture: v })} options={MAIN_CULTURES} placeholder="Selecione..." />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð Cidade" value={cf.city} onChange={v => setCf({ ...cf, city: v })} placeholder="Cidade" />
          <Sel label="Estado" value={cf.stateCode} onChange={v => setCf({ ...cf, stateCode: v })} options={UFS} placeholder="UF" />
        </div>
        <Inp label="ð¯ Hobbies / Interesses" value={cf.hobbies} onChange={v => setCf({ ...cf, hobbies: v })} placeholder="Pesca, futebol, leitura..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <Sel label="Categoria" value={cf.category} onChange={v => setCf({ ...cf, category: v })} options={CATS.map(c => ({ value: c.value, label: `${c.icon} ${c.label}` }))} />
          <Sel label="Proximidade" value={cf.proximity} onChange={v => setCf({ ...cf, proximity: v })} options={[1,2,3,4,5].map(n => ({ value: String(n), label: `${n}/5` }))} />
          <Inp label="Freq. (dias)" value={cf.idealFreq} onChange={v => setCf({ ...cf, idealFreq: v })} type="number" />
        </div>
        <Inp label="Como conheceu?" value={cf.howMet} onChange={v => setCf({ ...cf, howMet: v })} placeholder="Evento, indicaÃ§Ã£o, campo..." />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Inp label="ð PrÃ³xima aÃ§Ã£o" value={cf.nextAction} onChange={v => setCf({ ...cf, nextAction: v })} placeholder="Ligar, enviar artigo..." />
          <Inp label="ð Data da aÃ§Ã£o" value={cf.nextActionDate} onChange={v => setCf({ ...cf, nextActionDate: v })} type="date" />
        </div>
        <Inp label="ð Notas" value={cf.notes} onChange={v => setCf({ ...cf, notes: v })} placeholder="O que importa saber sobre essa pessoa..." textarea />
        <div style={{ borderTop: `1px solid ${C.brd}`, marginTop: 16, paddingTop: 16 }}>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>RelevÃ¢ncia estratÃ©gica</div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginBottom: 14 }}>Avalie de 0 a 10. Preencha os 4 para calcular a relevÃ¢ncia.</div>
          {[
            { field: "influenciaPessoas", label: "Influencia outras pessoas?", micro: "Essa pessoa movimenta opiniÃ£o, decisÃµes ou conexÃµes ao redor dela?" },
            { field: "geraOportunidade",  label: "Pode gerar oportunidade?",  micro: "Existe chance real de parceria, negÃ³cio, projeto, indicaÃ§Ã£o ou aprendizado?" },
            { field: "abrePortas",        label: "Pode abrir portas?",        micro: "Essa pessoa pode conectar vocÃª a pessoas, ambientes ou conversas importantes?" },
            { field: "momentoAtual",      label: "Faz sentido para meu momento atual?", micro: "Essa relaÃ§Ã£o tem conexÃ£o com seus objetivos dos prÃ³ximos meses?" },
          ].map(({ field, label, micro }) => (
            <div key={field} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM }}>{label}</div>
                  <div style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>{micro}</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: C.gold, minWidth: 28, textAlign: "right" }}>
                  {cf[field] !== "" ? cf[field] : "â"}
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
                <span style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txM }}>RelevÃ¢ncia</span>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 700, color: getRelevanceLabelColor(rs) }}>{rs}% â {getRelevanceLabel(rs)}</span>
              </div>
            ) : (
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, fontStyle: "italic" }}>Preencha os 4 campos para calcular.</div>
            );
          })()}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => { setModal(null); setEditId(null); }}>Cancelar</Btn><Btn small onClick={saveEditC} disabled={!cf.name.trim()}>Salvar alteraÃ§Ãµes</Btn></div>
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
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginBottom:18 }}>
          <Btn variant="ghost" small onClick={() => setShowAccessKey(false)}>Cancelar</Btn>
          <Btn small onClick={redeemKey} disabled={akBusy || !akCode.trim()}>{akBusy ? "Ativando..." : "Ativar PRO"}</Btn>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0 16px" }}>
          <div style={{ flex:1, height:1, background:C.brd }} />
          <span style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL }}>ou</span>
          <div style={{ flex:1, height:1, background:C.brd }} />
        </div>
        <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer" onClick={() => setShowAccessKey(false)}
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:C.gold, color:C.bg, borderRadius:8, padding:"11px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, textDecoration:"none", textAlign:"center" }}>
          ð³ Assinar PRO â R$ 39,90/mÃªs
        </a>
      </Modal>}


      {/* Limite interaÃ§Ãµes por contato Free */}
      {modal === "limiteIt" && <Modal title="Limite do plano gratuito" onClose={() => setModal(null)}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>ð</div>
          <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, lineHeight:1.7 }}>
            No plano Free vocÃª pode registrar atÃ© <strong style={{ color:C.txt }}>3 interaÃ§Ãµes por contato</strong>. Assine o PRO para interaÃ§Ãµes ilimitadas, Relevance Score e aÃ§Ãµes inteligentes.
          </p>
        </div>
        <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer" onClick={() => setModal(null)}
          style={{ display:"block", background:C.gold, color:C.bg, borderRadius:8, padding:"11px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, textDecoration:"none", textAlign:"center", marginBottom:10 }}>
          Assinar PRO â R$ 39,90/mÃªs
        </a>
        <button onClick={() => { setModal(null); openAccessKey(); }}
          style={{ display:"block", width:"100%", background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", textDecoration:"underline" }}>
          Tenho uma chave de acesso
        </button>
      </Modal>}


      {/* Limite contatos Free */}
      {modal === "limiteCt" && <Modal title="Limite do plano gratuito" onClose={() => setModal(null)}>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:32, marginBottom:10 }}>ð</div>
          <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, lineHeight:1.7 }}>
            No plano Free vocÃª pode gerenciar atÃ© <strong style={{ color:C.txt }}>5 contatos</strong>. Assine o PRO para contatos ilimitados, Relevance Score e aÃ§Ãµes inteligentes.
          </p>
        </div>
        <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer" onClick={() => setModal(null)}
          style={{ display:"block", background:C.gold, color:C.bg, borderRadius:8, padding:"11px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, textDecoration:"none", textAlign:"center", marginBottom:10 }}>
          Assinar PRO â R$ 39,90/mÃªs
        </a>
        <button onClick={() => { setModal(null); openAccessKey(); }}
          style={{ display:"block", width:"100%", background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", textDecoration:"underline" }}>
          Tenho uma chave de acesso
        </button>
      </Modal>}


      {modal === "addI" && <Modal title="Registrar interaÃ§Ã£o" onClose={() => setModal(null)}>
        <div style={{ marginBottom: 16 }}><label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>Tipo</label><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{ITYPES.map(t => <button key={t.value} onClick={() => setInf({ ...inf, type: t.value })} style={{ background: inf.type === t.value ? C.gD : C.sf, border: `1px solid ${inf.type === t.value ? C.gL : C.brd}`, borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 12, color: inf.type === t.value ? C.gold : C.txM }}>{t.icon} {t.label}</button>)}</div></div>
        <Inp label="O que aconteceu? *" value={inf.desc} onChange={v => setInf({ ...inf, desc: v })} placeholder="Descreva a interaÃ§Ã£o..." textarea />
        <div style={{ marginBottom: 16 }}><label style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 500, color: C.txM, display: "block", marginBottom: 6 }}>Sentimento</label><div style={{ display: "flex", gap: 8 }}>{SENTS.map(s => <button key={s.value} onClick={() => setInf({ ...inf, sentiment: s.value })} style={{ flex: 1, background: inf.sentiment === s.value ? `${s.color}14` : C.sf, border: `1px solid ${inf.sentiment === s.value ? `${s.color}40` : C.brd}`, borderRadius: 6, padding: "10px 0", cursor: "pointer", textAlign: "center", fontFamily: "'DM Sans'", fontSize: 12, color: inf.sentiment === s.value ? s.color : C.txL }}>{s.icon} {s.label}</button>)}</div></div>
        <div style={{ marginBottom: 16 }}><button onClick={() => setInf({ ...inf, valueGen: !inf.valueGen })} style={{ display: "flex", alignItems: "center", gap: 10, background: inf.valueGen ? C.grnD : C.sf, border: `1px solid ${inf.valueGen ? `${C.grn}40` : C.brd}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", width: "100%" }}><span style={{ fontSize: 16 }}>{inf.valueGen ? "ð" : "â"}</span><span style={{ fontFamily: "'DM Sans'", fontSize: 13, color: inf.valueGen ? C.grn : C.txM }}>Gerei valor nesta interaÃ§Ã£o</span></button></div>
        <Inp label="Tags (vÃ­rgula)" value={inf.tags} onChange={v => setInf({ ...inf, tags: v })} placeholder="cafÃ©, projeto, follow-up..." />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}><Btn variant="ghost" small onClick={() => setModal(null)}>Cancelar</Btn><Btn variant="success" small onClick={addI} disabled={!inf.desc.trim() || savingInteraction}>{savingInteraction ? "Registrando..." : "Registrar"}</Btn></div>
      </Modal>}
    </div>
  );
}


/* âââ SPLASH SCREEN ââââââââââââââââââââââââââââââââââââââââ */
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
          "Para ser intencional<br/>precisa ser estratÃ©gico."
        </p>
        <div style={{ width: 40, height: 1, background: C.gD, margin: '0 auto 20px' }} />
        <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.txL, letterSpacing: '.12em', textTransform: 'uppercase' }}>{BRAND.name}</div>
      </div>
      <div style={{ position: 'absolute', bottom: 32, fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, opacity: 0.35, letterSpacing: '.06em' }}>toque para continuar</div>
    </div>
  );
}


/* âââ ROOT ââââââââââââââââââââââââââââââââââââââââââââââââ */
/* âââ PUBLIC LANDING âââââââââââââââââââââââââââââââââââââââ */
/* âââ IlustraÃ§Ã£o original: rede/constelaÃ§Ã£o de nÃ³s, com um gerador
   pseudo-aleatÃ³rio determinÃ­stico (mesma seed = mesmo desenho sempre,
   sem depender de imagem externa, sem custo de carregamento). âââ */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildConstellation(seed = 7, n = 26) {
  const rnd = mulberry32(seed);
  const nodes = Array.from({ length: n }, (_, i) => ({
    id: i,
    x: 4 + rnd() * 92,
    y: 4 + rnd() * 172,
    r: 0.5 + rnd() * 0.9,
    hub: rnd() > 0.85,
  }));
  const edges = [];
  nodes.forEach((a, i) => {
    const dists = nodes
      .map((b, j) => ({ j, d: i === j ? Infinity : (a.x - b.x) ** 2 + (a.y - b.y) ** 2 }))
      .sort((p, q) => p.d - q.d)
      .slice(0, a.hub ? 3 : 1);
    dists.forEach(({ j }) => {
      const key = [i, j].sort().join("-");
      if (!edges.find(e => e.key === key)) edges.push({ key, a: i, b: j });
    });
  });
  return { nodes, edges };
}
function ConstellationArt({ seed = 7, n = 34 }) {
  const { nodes, edges } = useMemo(() => buildConstellation(seed, n), [seed, n]);
  return (
    <svg viewBox="0 0 100 180" preserveAspectRatio="xMidYMid slice" style={{ width: "100%", height: "100%", display: "block" }}>
      {edges.map(e => {
        const a = nodes[e.a], b = nodes[e.b];
        const lit = a.hub || b.hub;
        return <line key={e.key} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={lit ? C.gold : C.brd} strokeWidth={lit ? 0.12 : 0.08} opacity={lit ? 0.4 : 0.3} />;
      })}
      {nodes.map(node => (
        <circle key={node.id} cx={node.x} cy={node.y} r={node.hub ? node.r * 1.6 : node.r}
          fill={node.hub ? C.gold : C.txL} opacity={node.hub ? 0.85 : 0.35}
          style={node.hub ? { animation: `nodePulse ${3 + (node.id % 4)}s ease-in-out ${node.id * 0.2}s infinite` } : undefined} />
      ))}
    </svg>
  );
}


/* Converte 6 valores (0â100) em pontos de polÃ­gono SVG, eixo a eixo,
   comeÃ§ando no topo e girando em sentido horÃ¡rio â mesma orientaÃ§Ã£o usada
   no radar do resultado do assessment, pra manter familiaridade visual. */
function radarPoints(values, cx = 150, cy = 150, maxR = 110) {
  return values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / values.length - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, v)) / 100) * maxR;
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}
function radarAxisPoint(cx, cy, maxR, i, total, fraction = 1) {
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  return [cx + maxR * fraction * Math.cos(angle), cy + maxR * fraction * Math.sin(angle)];
}
function HeroRadar({ values, size = 280 }) {
  const cx = 150, cy = 150, maxR = 110;
  const rings = [0.25, 0.5, 0.75, 1];
  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: size, display: "block", margin: "0 auto" }}>
      {rings.map(f => (
        <polygon key={f}
          points={DIMS.map((_, i) => radarAxisPoint(cx, cy, maxR, i, DIMS.length, f).join(",")).join(" ")}
          fill="none" stroke={C.brd} strokeWidth={1} />
      ))}
      {DIMS.map((d, i) => {
        const [x, y] = radarAxisPoint(cx, cy, maxR, i, DIMS.length, 1);
        return <line key={d.key} x1={cx} y1={cy} x2={x} y2={y} stroke={C.brd} strokeWidth={1} />;
      })}
      <polygon points={radarPoints(values, cx, cy, maxR)}
        fill={`${C.gold}22`} stroke={C.gold} strokeWidth={2}
        style={{ transformOrigin: "150px 150px", animation: "radarDrawIn 1.1s cubic-bezier(0.16,1,0.3,1) both" }} />
      {DIMS.map((d, i) => {
        const v = values[i];
        const [x, y] = radarAxisPoint(cx, cy, maxR, i, DIMS.length, (v / 100));
        return <circle key={d.key} cx={x} cy={y} r={3.5} fill={C.gold} />;
      })}
      {DIMS.map((d, i) => {
        const [x, y] = radarAxisPoint(cx, cy, maxR, i, DIMS.length, 1.24);
        return (
          <text key={d.key} x={x} y={y} fill={C.txL} fontSize={10} fontFamily="DM Sans"
            textAnchor="middle" dominantBaseline="middle">{d.short}</text>
        );
      })}
    </svg>
  );
}


/* Moldura de celular genÃ©rica (nÃ£o reproduz hardware/UI de nenhuma marca
   especÃ­fica) com uma conversa estilo app de mensagens, demonstrando o
   assistente de WhatsApp do CONÃXIA. ReutilizÃ¡vel â cada cena passa suas
   prÃ³prias bolhas como children. ConteÃºdo ilustrativo â nome e nÃºmeros
   fictÃ­cios, deixado explÃ­cito na legenda logo abaixo de cada cena na pÃ¡gina. */
function ChatBubble({ from, children }) {
  return (
    <div style={{ display:"flex", justifyContent: from === "bot" ? "flex-start" : "flex-end", marginBottom:10 }}>
      <div style={{
        maxWidth:"82%", padding:"9px 13px", borderRadius: from === "bot" ? "4px 14px 14px 14px" : "14px 4px 14px 14px",
        background: from === "bot" ? C.card : `linear-gradient(135deg,${C.gold},${C.gB})`,
        border: from === "bot" ? `1px solid ${C.brd}` : "none",
        color: from === "bot" ? C.txt : C.bg,
        fontFamily:"'DM Sans'", fontSize:12.5, lineHeight:1.5,
      }}>
        {children}
      </div>
    </div>
  );
}
function PhoneMockup({ subtitle = "assistente relacional", height = 560, children }) {
  return (
    <div style={{ width:252, margin:"0 auto", borderRadius:44, background:"linear-gradient(160deg,#2a2a2a,#0a0a0a)", padding:10, boxShadow:`0 30px 60px -20px ${C.gold}22` }}>
      <div style={{ position:"relative", background:C.bg, borderRadius:34, overflow:"hidden", height }}>
        <div style={{ position:"absolute", top:8, left:"50%", transform:"translateX(-50%)", width:64, height:18, background:"#000", borderRadius:20, zIndex:2 }} />
        <div style={{ paddingTop:34, display:"flex", flexDirection:"column", height:"100%" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 16px 12px", borderBottom:`1px solid ${C.brd}` }}>
            <div style={{ width:26, height:26, borderRadius:"50%", background:`${C.gold}22`, border:`1px solid ${C.gL}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12 }}>â</div>
            <div>
              <div style={{ fontFamily:"'DM Sans'", fontSize:12, fontWeight:700, color:C.txt }}>CONÃXIA</div>
              <div style={{ fontFamily:"'DM Sans'", fontSize:9, color:C.txL }}>{subtitle}</div>
            </div>
          </div>
          <div style={{ flex:1, padding:"14px 12px", overflow:"hidden" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


/* Ãcones das 6 dimensÃµes dispostos em roda, ecoando o radar â peÃ§a visual
   pura; a leitura (label + descriÃ§Ã£o) vem na lista logo abaixo. */
/* PrÃ©via grande da Teia â mesma lÃ³gica visual da tela real do app (anÃ©is
   concÃªntricos = % de saÃºde do relacionamento, distÃ¢ncia do centro = saÃºde,
   cor do nÃ³ = status de prioridade), com contatos de exemplo. Contatos e
   nomes fictÃ­cios, deixado explÃ­cito na legenda logo abaixo na pÃ¡gina. */
const TEIA_PRIO_COLORS = { alta: "#4caf50", media: "#E8A020", baixa: "#ff9800" };
const TEIA_EXAMPLE = [
  { name: "Marina Costa", health: 88, prio: "alta", interaÃ§Ãµes: 5 },
  { name: "JoÃ£o Kaminski", health: 74, prio: "alta", interaÃ§Ãµes: 4 },
  { name: "PatrÃ­cia Nunes", health: 60, prio: "media", interaÃ§Ãµes: 3 },
  { name: "Eduardo Reis", health: 45, prio: "media", interaÃ§Ãµes: 2 },
  { name: "Camila Torres", health: 30, prio: "baixa", interaÃ§Ãµes: 1 },
  { name: "Rafael Sanches", health: 68, prio: "media", interaÃ§Ãµes: 3 },
  { name: "Beatriz Lima", health: 82, prio: "alta", interaÃ§Ãµes: 5 },
  { name: "Diego Farah", health: 22, prio: "baixa", interaÃ§Ãµes: 1 },
];
function TeiaPreview({ size = 340 }) {
  const cx = 200, cy = 200, R = 168;
  const TEIA_EXAMPLE = [
  { name: "Marina Costa", health: 88, prio: "alta", interacoes: 5 },
  { name: "Joao Kaminski", health: 74, prio: "alta", interacoes: 4 },
  { name: "Patricia Nunes", health: 60, prio: "media", interacoes: 3 },
  { name: "Eduardo Reis", health: 45, prio: "media", interacoes: 2 },
  { name: "Camila Torres", health: 30, prio: "baixa", interacoes: 1 },
  { name: "Rafael Sanches", health: 68, prio: "media", interacoes: 3 },
  { name: "Beatriz Lima", health: 82, prio: "alta", interacoes: 5 },
  { name: "Diego Farah", health: 22, prio: "baixa", interacoes: 1 },
];

function TeiaPreview({ size = 340 }) {
  const cx = 200, cy = 200, R = 168;
  const step = (2 * Math.PI) / TEIA_EXAMPLE.length;

  const nodes = TEIA_EXAMPLE.map((c, i) => {
    const a = -Math.PI / 2 + i * step;
    const d = R * Math.max(0.15, c.health / 100);

    return {
      ...c,
      x: cx + d * Math.cos(a),
      y: cy + d * Math.sin(a),
      col: TEIA_PRIO_COLORS[c.prio],
      r: 6 + c.interacoes * 2,
    };
  });
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.col} opacity={0.88}
            style={{ animation: `nodePulse ${3 + (i % 4)}s ease-in-out ${i * 0.15}s infinite` }} />
        </g>
      ))}
    </svg>
  );
}


function DimensionWheel({ size = 260 }) {
  const cx = 130, cy = 130, r = 96;
  return (
    <svg viewBox="0 0 260 260" style={{ width: "100%", maxWidth: size, display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.brd} strokeWidth={1} />
      <circle cx={cx} cy={cy} r={2} fill={C.brd} />
      {DIMS.map((d, i) => {
        const [x, y] = radarAxisPoint(cx, cy, r, i, DIMS.length, 1);
        return (
          <g key={d.key}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={C.brd} strokeWidth={1} />
            <circle cx={x} cy={y} r={19} fill={C.card} stroke={d.color} strokeWidth={1.5} />
            <text x={x} y={y + 6} textAnchor="middle" fontSize={16}>{d.icon}</text>
          </g>
        );
      })}
    </svg>
  );
}


/* Revela um "momento" (seÃ§Ã£o de tela cheia) suavemente quando entra na
   viewport â um Ãºnico disparo por seÃ§Ã£o, nÃ£o animaÃ§Ã£o repetida por scroll.
   Respeita "reduzir movimento" via a regra global jÃ¡ existente no index.html. */
function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}
function Moment({ children, minH = true, style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className="cx-moment" style={{
      minHeight: minH ? "min(100vh, 780px)" : undefined,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      width: "100%", padding: "60px 0",
      opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)",
      transition: `opacity ${MOTION.slow}, transform ${MOTION.slow}`,
      ...style,
    }}>
      {children}
    </div>
  );
}


// MÃ©dia real das 6 dimensÃµes nas redes jÃ¡ mapeadas na base â checado
// manualmente via Supabase em 10/09/2026 (RLS de `profiles` bloqueia leitura
// anÃ´nima, entÃ£o isto nÃ£o Ã© uma consulta ao vivo â atualizar Ã  mÃ£o quando
// fizer sentido revisitar). SÃ³ os agregados aparecem na pÃ¡gina; a contagem
// de amostra nÃ£o Ã© exposta publicamente por escolha do fundador.
const REDE_STATS_VALUES = [73.1, 62.5, 60.4, 61.3, 74.8, 82.6]; // mesma ordem de DIMS


function PublicLanding({ onSignup, onLogin, urlKey = "" }) {
  const [openProfile, setOpenProfile] = useState(null);
  const radarValues = REDE_STATS_VALUES;
  const dimsRanked = DIMS.map((d, i) => ({ ...d, val: radarValues[i] })).sort((a, b) => b.val - a.val);
  const strongest = dimsRanked[0];
  const weakest = dimsRanked[dimsRanked.length - 1];


  // Toque em qualquer ponto "neutro" da pÃ¡gina avanÃ§a pra prÃ³xima seÃ§Ã£o â
  // como em Stories. Elementos com sua prÃ³pria aÃ§Ã£o (botÃµes, perfis
  // clicÃ¡veis) marcam data-noadvance pra nÃ£o disparar os dois ao mesmo tempo.
  // Em celular, um simples onClick falha com frequÃªncia: o navegador trata
  // qualquer toque com leve deslocamento como rolagem, nÃ£o clique. Por isso
  // medimos o toque na mÃ£o (touchstart/touchend) e sÃ³ avanÃ§amos se foi um
  // toque de verdade (pouco movimento, rÃ¡pido) â onClick fica sÃ³ de reforÃ§o
  // pra quem usa mouse.
  const touchRef = useRef(null);
  const isAdvanceTarget = (target) => !target.closest("button, a, [data-noadvance]");
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const handleTouchEnd = (e) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - start.x), dy = Math.abs(t.clientY - start.y);
    const dt = Date.now() - start.time;
    if (dx < 12 && dy < 12 && dt < 500 && isAdvanceTarget(e.target)) {
      e.preventDefault(); // evita o clique-fantasma duplicado logo em seguida
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    }
  };
  const handleAdvanceClick = (e) => {
    if (!isAdvanceTarget(e.target)) return;
    window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
  };


  return (
    <div
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onClick={handleAdvanceClick}
      style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", overflowX:"hidden", cursor:"pointer" }}>


      {/* âââ 1. HERO â ilustraÃ§Ã£o + assinatura âââ */}
      <div style={{ minHeight:"100vh", width:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", padding:"24px 20px" }}>
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:"min(640px, 92vw)", aspectRatio:"3 / 4", maxHeight:"88vh" }}>
          <ConstellationArt seed={7} n={34} />
          <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 55% 30% at 50% 50%, ${C.bg}, transparent)` }} />
        </div>
        <div style={{ position:"relative", zIndex:1, textAlign:"center" }}>
          <ConexiaLogo height={76} style={{ margin: "0 auto 12px", display: "block" }} />
          <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, letterSpacing:".12em", textTransform:"uppercase", marginBottom:60 }}>{BRAND.platformTag}</div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10, opacity:0.7 }}>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, letterSpacing:".05em" }}>Role pra conhecer</div>
            <div style={{ fontSize:18, color:C.gold, animation:"bounce 1.8s infinite" }}>â</div>
          </div>
        </div>
      </div>


      {/* âââ 2. AFIRMAÃÃO CENTRAL âââ */}
      <Moment style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`radial-gradient(circle at 50% 35%, #8a6b24 0%, #3a2f18 32%, #17140e 68%, #0d0c09 100%)`, backgroundSize:"cover", backgroundPosition:"center" }} />
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(180deg, ${C.bg}CC, ${C.bg}66 40%, ${C.bg}CC)` }} />
        <div style={{ position:"relative", zIndex:1 }}>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:38, fontWeight:700, color:C.txt, lineHeight:1.25, textAlign:"center", maxWidth:380, margin:"0 20px" }}>
            Sua rede nÃ£o Ã© uma lista de contatos.
          </h1>
          <h1 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:38, fontWeight:700, color:C.gold, lineHeight:1.25, textAlign:"center", maxWidth:380, margin:"6px 20px 0" }}>
            Ã um mapa.
          </h1>
        </div>
      </Moment>


      {/* âââ 3. O PROBLEMA âââ */}
      <Moment style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(135deg, #101510 0%, #243128 48%, #0d0f0d 100%)`, backgroundSize:"cover", backgroundPosition:"center 30%" }} />
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(180deg, ${C.bg}E6 0%, ${C.bg}99 45%, ${C.bg}F2 100%)` }} />
        <div style={{ position:"relative", maxWidth:400, textAlign:"center", padding:"0 24px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txL, letterSpacing:".08em", marginBottom:18 }}>O QUE NORMALMENTE ACONTECE</div>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, color:C.txt, lineHeight:1.45, margin:0 }}>
            VocÃª nÃ£o falha em relacionamentos profissionais por falta de esforÃ§o. Falha por falta de clareza.
          </p>
        </div>
      </Moment>


      <Moment style={{ position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(135deg, #11130d 0%, #2d3024 48%, #0d0e0a 100%)`, backgroundSize:"cover", backgroundPosition:"center 35%" }} />
        <div style={{ position:"absolute", inset:0, background:`linear-gradient(180deg, ${C.bg}E6 0%, ${C.bg}80 45%, ${C.bg}F2 100%)` }} />
        <div style={{ position:"relative", maxWidth:400, textAlign:"center", padding:"0 24px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.gold, letterSpacing:".08em", marginBottom:18 }}>O QUE O CONÃXIA MUDA</div>
          <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:24, fontWeight:600, color:C.txt, lineHeight:1.45, margin:0 }}>
            Um diagnÃ³stico que mostra onde sua rede Ã© forte, onde ela racha, e o que fazer amanhÃ£ de manhÃ£.
          </p>
        </div>
      </Moment>


      {/* âââ 4. O RADAR â prova por dado, sem depoimento âââ */}
      <Moment>
        <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txL, letterSpacing:".08em", textAlign:"center", marginBottom:8 }}>
          O QUE AS REDES JÃ MAPEADAS REVELAM
        </div>
        <HeroRadar values={radarValues} size={320} />
        <div style={{ display:"flex", justifyContent:"center", gap:32, margin:"20px 0 16px" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:700, color:C.gold }}>{strongest.val}</div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, marginTop:2 }}>{strongest.label}</div>
          </div>
          <div style={{ width:1, background:C.brd }} />
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:34, fontWeight:700, color:C.txM }}>{weakest.val}</div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txM, marginTop:2 }}>{weakest.label}</div>
          </div>
        </div>
        <p style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:18, fontStyle:"italic", color:C.txt, lineHeight:1.5, textAlign:"center", maxWidth:340, margin:0 }}>
          Em mÃ©dia, as pessoas confiam mais nelas mesmas do que aparecem.
        </p>
      </Moment>


      {/* âââ 5-7. COMO FUNCIONA â um passo por tela âââ */}
      {[
        { n:"01", t:"DiagnÃ³stico gratuito", d:"18 perguntas cobrindo as 6 dimensÃµes que sustentam uma rede relacional saudÃ¡vel â menos de 10 minutos." },
        { n:"02", t:"Seu perfil relacional", d:"Entre 8 perfis mapeados, descubra qual descreve como vocÃª constrÃ³i e mantÃ©m relaÃ§Ãµes hoje." },
        { n:"03", t:"Sua rede, de verdade", d:"Cadastre suas conexÃµes e veja o mapa da sua rede â a Teia â priorizado por quem precisa de atenÃ§Ã£o agora, com assistente de WhatsApp." },
      ].map(s => (
        <Moment key={s.n}>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:64, fontWeight:700, color:C.gL, lineHeight:1, marginBottom:8 }}>{s.n}</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:C.txt, textAlign:"center", margin:"0 0 14px", maxWidth:340 }}>{s.t}</h2>
          <p style={{ fontFamily:"'DM Sans'", fontSize:15, color:C.txM, lineHeight:1.7, textAlign:"center", maxWidth:340, margin:0 }}>{s.d}</p>
        </Moment>
      ))}


      {/* âââ 7.4 â A TEIA, EM GRANDE âââ */}
      <Moment>
        <div style={{ textAlign:"center", marginBottom:16, padding:"0 24px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txL, letterSpacing:".08em", marginBottom:10 }}>A TEIA DA SUA REDE</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:700, color:C.txt, lineHeight:1.35, maxWidth:360, margin:"0 auto" }}>
            Quanto mais longe do centro, mais forte o relacionamento.
          </h2>
        </div>
        <TeiaPreview size={360} />
        <div style={{ display:"flex", gap:18, justifyContent:"center", marginTop:16, flexWrap:"wrap" }}>
          {[{c:"#4caf50",l:"Presente e importante"},{c:"#E8A020",l:"Talvez mereÃ§a atenÃ§Ã£o"},{c:"#ff9800",l:"RelaÃ§Ã£o tranquila"}].map(x => (
            <div key={x.l} style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:x.c }} />
              <div style={{ fontFamily:"'DM Sans'", fontSize:10.5, color:C.txL }}>{x.l}</div>
            </div>
          ))}
        </div>
        <p style={{ fontFamily:"'DM Sans'", fontSize:12.5, color:C.txL, lineHeight:1.6, textAlign:"center", maxWidth:320, margin:"20px 24px 0" }}>
          Exemplo ilustrativo â sua Teia real mostra seus prÃ³prios contatos, com cor e distÃ¢ncia calculadas pelo histÃ³rico de cada relaÃ§Ã£o.
        </p>
      </Moment>


      {/* âââ 7.5 â O ASSISTENTE DE WHATSAPP EM AÃÃO âââ */}
      <Moment>
        <div style={{ textAlign:"center", marginBottom:28, padding:"0 24px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txL, letterSpacing:".08em", marginBottom:10 }}>ENQUANTO VOCÃ TRABALHA</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:700, color:C.txt, lineHeight:1.35, maxWidth:340, margin:"0 auto" }}>
            O CONÃXIA avisa antes de vocÃª esquecer â direto no WhatsApp.
          </h2>
        </div>
        <PhoneMockup>
          <ChatBubble from="bot">Bom dia! VocÃª nÃ£o fala com a <b>Marina Costa</b> hÃ¡ 42 dias â ela foi peÃ§a-chave na sua Ãºltima negociaÃ§Ã£o. Bora reativar?</ChatBubble>
          <ChatBubble from="user">Boa, manda uma ideia</ChatBubble>
          <ChatBubble from="bot">"Marina, lembrei de vocÃª â como estÃ¡ a expansÃ£o do projeto que comentou? Bora marcar um cafÃ©?" âï¸</ChatBubble>
          <ChatBubble from="bot">ð Sua Carta de EvoluÃ§Ã£o da semana: Health Score 74 <span style={{color:"#6FCF97"}}>(+3)</span>. ConsistÃªncia subiu 8 pontos.</ChatBubble>
        </PhoneMockup>
        <p style={{ fontFamily:"'DM Sans'", fontSize:12.5, color:C.txL, lineHeight:1.6, textAlign:"center", maxWidth:300, margin:"24px 24px 0" }}>
          Exemplo ilustrativo do assistente â os alertas reais usam os contatos e o histÃ³rico da sua prÃ³pria rede.
        </p>
      </Moment>


      {/* âââ 7.6 â BRIEFING ANTES DE UMA REUNIÃO âââ */}
      <Moment>
        <div style={{ textAlign:"center", marginBottom:28, padding:"0 24px" }}>
          <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txL, letterSpacing:".08em", marginBottom:10 }}>ANTES DE UMA REUNIÃO IMPORTANTE</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:26, fontWeight:700, color:C.txt, lineHeight:1.35, maxWidth:340, margin:"0 auto" }}>
            "Vou falar com o JoÃ£o. O que eu preciso saber?"
          </h2>
        </div>
        <PhoneMockup subtitle="briefing de contato" height={600}>
          <ChatBubble from="user">Vou almoÃ§ar com o JoÃ£o Kaminski daqui a pouco, me dÃ¡ um briefing</ChatBubble>
          <ChatBubble from="bot">
            <div style={{ fontWeight:700, marginBottom:4 }}>ð JoÃ£o Kaminski</div>
            <div style={{ marginBottom:6 }}><b>Estado:</b> relaÃ§Ã£o sÃ³lida, mas 51 dias sem contato direto desde a reuniÃ£o sobre expansÃ£o da fazenda.</div>
            <div style={{ marginBottom:6 }}><b>AtenÃ§Ã£o:</b> ele mencionou decisÃ£o de compra "atÃ© o fim do trimestre" â prazo vence essa semana.</div>
            <div style={{ marginBottom:6 }}><b>Gancho:</b> pergunte como ficou a decisÃ£o sobre a Ã¡rea nova antes de qualquer coisa.</div>
            <div><b>PrÃ³ximo passo:</b> propor visita tÃ©cnica em atÃ© 7 dias.</div>
          </ChatBubble>
        </PhoneMockup>
        <p style={{ fontFamily:"'DM Sans'", fontSize:12.5, color:C.txL, lineHeight:1.6, textAlign:"center", maxWidth:300, margin:"24px 24px 0" }}>
          Exemplo ilustrativo â o briefing real Ã© gerado pela IA a partir do histÃ³rico de cada contato, com perguntas sugeridas e objetivo estratÃ©gico.
        </p>
      </Moment>


      {/* âââ 8. AS 6 DIMENSÃES âââ */}
      <Moment minH={false} style={{ padding:"80px 0" }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:C.txt, textAlign:"center", margin:"0 0 6px", padding:"0 20px" }}>
          As 6 dimensÃµes que medimos
        </h2>
        <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, textAlign:"center", margin:"0 0 40px", padding:"0 20px" }}>
          Nenhuma rede Ã© forte ou fraca de um jeito sÃ³.
        </p>
        <div style={{ width:"100%" }}>
          {DIMS.map((d, i) => (
            <div key={d.key} style={{
              display:"flex", alignItems:"center", gap:18, padding:"22px max(20px, calc(50% - 210px))",
              background: i % 2 === 0 ? `${d.color}0f` : "transparent",
              borderTop: i > 0 ? `1px solid ${C.brd}` : "none",
            }}>
              <div style={{ fontSize:26, color:d.color, flexShrink:0, width:32, textAlign:"center" }}>{d.icon}</div>
              <div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:15, fontWeight:700, color:C.txt, marginBottom:3 }}>{d.label}</div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txM, lineHeight:1.6 }}>{d.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Moment>


      {/* âââ 9. 8 PERFIS â lista tipogrÃ¡fica, sem cartÃ£o âââ */}
      <Moment minH={false} style={{ padding:"80px 20px" }}>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:28, fontWeight:700, color:C.txt, textAlign:"center", margin:"0 0 6px" }}>
          Qual Ã© o seu perfil relacional?
        </h2>
        <p style={{ fontFamily:"'DM Sans'", fontSize:13, color:C.txL, textAlign:"center", margin:"0 0 32px" }}>
          Toque em cada um pra ver o que ele revela.
        </p>
        <div style={{ maxWidth:420, width:"100%" }}>
          {Object.entries(PROFILES).map(([key, p], i) => {
            const isOpen = openProfile === key;
            return (
              <div key={key} onClick={(e) => { e.stopPropagation(); setOpenProfile(isOpen ? null : key); }}
                style={{ padding:"20px 4px", borderTop: i > 0 ? `1px solid ${C.brd}` : "none", cursor:"pointer" }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ fontSize:24 }}>{p.emoji}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'DM Sans'", fontSize:15, fontWeight:700, color:C.txt }}>{p.name}</div>
                    <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:14, fontStyle:"italic", color:C.gold }}>{p.tagline}</div>
                  </div>
                  <div style={{ fontSize:13, color:C.txL, transform: isOpen ? "rotate(180deg)" : "none", transition:`transform ${MOTION.fast}` }}>â¾</div>
                </div>
                {isOpen && (
                  <div style={{ fontFamily:"'DM Sans'", fontSize:13.5, color:C.txM, lineHeight:1.7, marginTop:14, paddingLeft:38 }}>
                    {p.desc}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Moment>


      {/* âââ 10. CTA FINAL âââ */}
      <Moment>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, color:C.txt, textAlign:"center", lineHeight:1.3, maxWidth:360, margin:"0 0 8px" }}>
          Para ser intencional
        </h2>
        <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:32, fontWeight:700, color:C.gold, textAlign:"center", lineHeight:1.3, maxWidth:360, margin:"0 0 40px" }}>
          precisa ser estratÃ©gico.
        </h2>
        <div style={{ display:"flex", flexDirection:"column", gap:12, width:"100%", maxWidth:340, padding:"0 24px" }}>
          <button onClick={onSignup}
            style={{ background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:12, padding:"16px 0", fontFamily:"'DM Sans'", fontSize:14, fontWeight:700, color:C.bg, cursor:"pointer", width:"100%" }}>
            Fazer diagnÃ³stico gratuito
          </button>
          <button onClick={onLogin}
            style={{ background:"transparent", border:`1.5px solid ${C.brd}`, borderRadius:12, padding:"14px 0", fontFamily:"'DM Sans'", fontSize:14, fontWeight:500, color:C.txM, cursor:"pointer", width:"100%" }}>
            JÃ¡ tenho conta â Entrar
          </button>
        </div>


        {urlKey && (
          <div style={{ marginTop:20, background:`${C.gold}12`, border:`1px solid ${C.gL}`, borderRadius:10, padding:"10px 20px", textAlign:"center", maxWidth:340 }}>
            <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.gold, fontWeight:600 }}>ð Chave de acesso detectada: <span style={{ fontFamily:"'JetBrains Mono'", letterSpacing:".06em" }}>{urlKey}</span></div>
            <div style={{ fontFamily:"'DM Sans'", fontSize:10, color:C.txL, marginTop:3 }}>Crie sua conta para ativar o acesso PRO automaticamente</div>
          </div>
        )}
        <div style={{ marginTop:24, fontFamily:"'DM Sans'", fontSize:11, color:C.txL, textAlign:"center" }}>
          Criado por Rafael MillÃ©o
        </div>
        <div style={{ marginTop:12, fontFamily:"'DM Sans'", fontSize:10, color:C.txL, opacity:0.7, textAlign:"center", lineHeight:1.5, paddingBottom:20 }}>
          {BRAND.legalName} Â· CNPJ {BRAND.legalCnpj}<br/>{BRAND.legalAddress}
        </div>
      </Moment>
    </div>
  );
}




/* âââ Traduz mensagens de erro do Supabase Auth pra portuguÃªs simples âââ */
function friendlyAuthError(e, fallback = "Erro de conexÃ£o.") {
  const raw = e?.message || "";
  const m = raw.toLowerCase();
  if (m.includes("password") && (m.includes("character") || m.includes("weak") || m.includes("should contain") || m.includes("at least"))) {
    return "A senha deve conter pelo menos 1 letra maiÃºscula, 1 nÃºmero e 1 caractere especial.";
  }
  if (m.includes("password") && m.includes("6 characters")) {
    return "A senha precisa ter no mÃ­nimo 6 caracteres.";
  }
  if (m.includes("invalid login credentials")) {
    return "Email ou senha incorretos.";
  }
  if (m.includes("user already registered") || (m.includes("already") && m.includes("registered"))) {
    return "JÃ¡ existe uma conta com esse email. Tenta entrar em vez de criar uma nova.";
  }
  if (m.includes("email") && m.includes("invalid")) {
    return "Digite um email vÃ¡lido.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Muitas tentativas seguidas. Espera um minuto e tenta de novo.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Erro de conexÃ£o. Confere sua internet e tenta de novo.";
  }
  return raw || fallback;
}


/* âââ AUTH âââââââââââââââââââââââââââââââââââââââââââââââââ */
function Auth({ onAuth, initialMode = "signup" }) {
  const [mode, setMode] = useState(initialMode || "signup");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [lgpd, setLgpd] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");


  const sendResetEmail = async () => {
    if (!forgotEmail) { setForgotMsg("Informe seu email."); return; }
    setForgotBusy(true); setForgotMsg("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setForgotMsg(`â Se esse email tiver uma conta no ${BRAND.name}, enviamos um link pra redefinir a senha. Confere sua caixa de entrada (e o spam) â o link Ã© vÃ¡lido por 1 hora.`);
    } catch (e) {
      console.error("[ForgotPassword]", e);
      setForgotMsg("NÃ£o consegui enviar agora. Tenta de novo em instantes.");
    }
    setForgotBusy(false);
  };


  const submit = async () => {
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setErr("Informe seu nome."); setBusy(false); return; }
        if (!lgpd) { setErr("VocÃª precisa aceitar a PolÃ­tica de Privacidade para continuar."); setBusy(false); return; }
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
        if (data?.user) {
          supabase.from("page_events").insert({ user_id: data.user.id, event_type: "signup_completed", tab_name: "auth" }).then(() => {}, () => {});
        }
        // O aceite LGPD Ã© gravado no servidor pelo gatilho handle_new_user,
        // de forma confiÃ¡vel independente de haver sessÃ£o ativa neste momento
        // (necessÃ¡rio pois signUp pode nÃ£o retornar sessÃ£o se a confirmaÃ§Ã£o
        // de e-mail estiver habilitada no projeto).
        if (data?.session) { onAuth(data.session, data.user); return; }
        if (data?.user) { setErr("Conta criada! FaÃ§a login."); setMode("login"); }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        if (data?.session) { onAuth(data.session, data.user); return; }
      }
    } catch (e) { setErr(friendlyAuthError(e)); }
    setBusy(false);
  };


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg,${C.gold},${C.gB})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.bg }}>C</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 32, fontWeight: 700, color: C.txt, margin: "0 0 6px" }}>{BRAND.name}</h1>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, margin: "0 0 28px" }}>Seu sistema pessoal de inteligÃªncia relacional.</p>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 28, textAlign: "left" }}>
          <div style={{ display: "flex", marginBottom: 22 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); }} style={{ flex: 1, background: "none", border: "none", borderBottom: mode === m ? `2px solid ${C.gold}` : `2px solid ${C.brd}`, padding: "10px 0", cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 600, color: mode === m ? C.gold : C.txL }}>{m === "login" ? "Entrar" : "Criar conta"}</button>
            ))}
          </div>
          {err && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor, background: C.corD, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>{err}</div>}
          {mode === "signup" && <Inp label="Seu nome" value={name} onChange={setName} placeholder="Como podemos te chamar?" />}
          <Inp label="Email" value={email} onChange={setEmail} placeholder="seu@email.com" type="email" />
          <Inp label="Senha" value={pass} onChange={setPass} placeholder="MÃ­nimo 6 caracteres" type="password" />
          {mode === "signup" && (
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:16, marginTop:4 }}>
              <div
                onClick={() => setLgpd(!lgpd)}
                style={{ width:18, height:18, minWidth:18, borderRadius:4, border:`2px solid ${lgpd ? C.gold : C.brd}`, background: lgpd ? C.gold : "transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", marginTop:1 }}
              >
                {lgpd && <span style={{ color:C.bg, fontSize:11, fontWeight:700, lineHeight:1 }}>â</span>}
              </div>
              <span style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, lineHeight:1.5 }}>
                Li e aceito a{" "}
                <span
                  onClick={() => setShowPrivacy(true)}
                  style={{ color:C.gold, cursor:"pointer", textDecoration:"underline" }}
                >
                  PolÃ­tica de Privacidade
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
                  <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:0 }}>PolÃ­tica de Privacidade e Termos de Uso</h2>
                  <button onClick={() => setShowPrivacy(false)} style={{ background:"none", border:"none", color:C.txL, fontSize:20, cursor:"pointer", lineHeight:1 }}>Ã</button>
                </div>
                <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, lineHeight:1.7 }}>
                  <p><strong style={{color:C.txt}}>1. ResponsÃ¡vel pelo tratamento</strong><br/>{BRAND.name}, plataforma de inteligÃªncia relacional para profissionais do agronegÃ³cio, operada por {BRAND.legalName}, CNPJ {BRAND.legalCnpj}, com sede em {BRAND.legalAddress}.</p>
                  <p><strong style={{color:C.txt}}>2. Dados coletados</strong><br/>Coletamos nome, e-mail, empresa, cargo, WhatsApp, LinkedIn, Instagram, cidade, estado, objetivos profissionais e histÃ³rico de interaÃ§Ãµes com contatos.</p>
                  <p><strong style={{color:C.txt}}>3. Finalidade</strong><br/>Os dados sÃ£o utilizados exclusivamente para personalizar os insights de inteligÃªncia relacional, gerar diagnÃ³sticos e recomendaÃ§Ãµes dentro da plataforma.</p>
                  <p><strong style={{color:C.txt}}>4. Base legal (LGPD â Lei 13.709/2018)</strong><br/>O tratamento Ã© realizado com base no consentimento do titular (Art. 7Âº, I) e para execuÃ§Ã£o do contrato de uso da plataforma (Art. 7Âº, V).</p>
                  <p><strong style={{color:C.txt}}>5. Compartilhamento</strong><br/>Seus dados nÃ£o sÃ£o vendidos ou compartilhados com terceiros. Utilizamos provedores de infraestrutura (Supabase, Vercel, Google Gemini) sob acordos de confidencialidade.</p>
                  <p><strong style={{color:C.txt}}>6. Seus direitos</strong><br/>VocÃª pode solicitar acesso, correÃ§Ã£o, exclusÃ£o ou portabilidade dos seus dados a qualquer momento pelo e-mail: <strong>{BRAND.supportEmail}</strong>.</p>
                  <p><strong style={{color:C.txt}}>7. RetenÃ§Ã£o</strong><br/>Os dados sÃ£o mantidos enquanto a conta estiver ativa. ApÃ³s exclusÃ£o, os dados sÃ£o removidos em atÃ© 30 dias.</p>
                  <p><strong style={{color:C.txt}}>8. Termos de Uso</strong><br/>O uso da plataforma Ã© pessoal e intransferÃ­vel. Ã vedado o uso para fins ilÃ­citos, spam ou coleta de dados de terceiros sem consentimento.</p>
                </div>
                <button onClick={() => { setLgpd(true); setShowPrivacy(false); }} style={{ width:"100%", marginTop:16, background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer" }}>Li e aceito os termos</button>
              </div>
            </div>
          )}
          {!forgotOpen && <Btn onClick={submit} disabled={busy || !email || pass.length < 6 || (mode === "signup" && !lgpd)} full>{busy ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</Btn>}
          {mode === "login" && !forgotOpen && (
            <button onClick={() => { setForgotOpen(true); setForgotEmail(email); setForgotMsg(""); }} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", marginTop:14, display:"block", width:"100%", textAlign:"center", textDecoration:"underline" }}>Esqueci minha senha</button>
          )}
          {mode === "login" && forgotOpen && (
            <div style={{ marginTop:4 }}>
              <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:12 }}>Digite seu email pra receber o link de redefiniÃ§Ã£o de senha:</div>
              <Inp label="Email" value={forgotEmail} onChange={setForgotEmail} placeholder="seu@email.com" type="email" />
              {forgotMsg && <div style={{ fontFamily:"'DM Sans'", fontSize:12, color: forgotMsg.startsWith("â") ? C.grn : C.cor, background: forgotMsg.startsWith("â") ? C.grnD : C.corD, borderRadius:8, padding:"10px 14px", marginBottom:14, lineHeight:1.5 }}>{forgotMsg}</div>}
              <Btn onClick={sendResetEmail} disabled={forgotBusy || !forgotEmail} full>{forgotBusy ? "Enviando..." : "Enviar link de redefiniÃ§Ã£o"}</Btn>
              <button onClick={() => setForgotOpen(false)} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", marginTop:14, display:"block", width:"100%", textAlign:"center" }}>â Voltar pro login</button>
            </div>
          )}
        </div>
        <button onClick={() => window.history.back()} style={{ background:"none", border:"none", fontFamily:"'DM Sans'", fontSize:11, color:C.txL, cursor:"pointer", marginTop:14, display:"block", width:"100%", textAlign:"center" }}>â Voltar para a pÃ¡gina inicial</button>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 8 }}>"Networking, alÃ©m do cafezinho" Â· Rafael MillÃ©o</p>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL, opacity: 0.7, marginTop: 10, lineHeight: 1.5 }}>{BRAND.legalName} Â· CNPJ {BRAND.legalCnpj}<br/>{BRAND.legalAddress}</p>
      </div>
    </div>
  );
}


/* âââ RESET DE SENHA ââââââââââââââââââââââââââââââââââââââ */
function ResetPassword({ onDone }) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);


  const submit = async () => {
    setErr("");
    if (pass.length < 6) { setErr("A senha precisa ter no mÃ­nimo 6 caracteres."); return; }
    if (pass !== pass2) { setErr("As senhas nÃ£o conferem."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      onDone();
    } catch (e) {
      console.error("[ResetPassword]", e);
      setErr(friendlyAuthError(e, "NÃ£o consegui atualizar a senha. Tenta gerar um novo link."));
    }
    setBusy(false);
  };


  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: C.bg }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: `linear-gradient(135deg,${C.gold},${C.gB})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.bg }}>C</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, fontWeight: 700, color: C.txt, margin: "0 0 6px" }}>Nova senha</h1>
        <p style={{ fontFamily: "'DM Sans'", fontSize: 14, color: C.txM, margin: "0 0 24px" }}>Defina sua nova senha de acesso ao {BRAND.name}.</p>
        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 28, textAlign: "left" }}>
          {err && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: C.cor, background: C.corD, borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>{err}</div>}
          <Inp label="Nova senha" value={pass} onChange={setPass} placeholder="MÃ­nimo 6 caracteres" type="password" />
          <Inp label="Confirme a nova senha" value={pass2} onChange={setPass2} placeholder="Repita a senha" type="password" />
          <Btn onClick={submit} disabled={busy || pass.length < 6} full>{busy ? "Salvando..." : "Salvar nova senha"}</Btn>
        </div>
      </div>
    </div>
  );
}


/* âââ ROOT ââââââââââââââââââââââââââââââââââââââââââââââââ */
function ProLock({ title = "Recurso disponÃ­vel no PRO", desc = `Desbloqueie o ${BRAND.name} completo para transformar diagnÃ³stico em aÃ§Ã£o prÃ¡tica.`, cta = "Assinar PRO â R$ 39,90/mÃªs", onKey, user }) {
  return (
    <div style={{ background:"#161618", border:"1px solid #2a2825", borderRadius:12, padding:24, textAlign:"center", margin:"8px 0" }}>
      <div style={{ fontSize:28, marginBottom:10 }}>ð</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, color:"#e8e4da", marginBottom:6 }}>{title}</div>
      <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:"#6a6460", lineHeight:1.6, marginBottom:16, maxWidth:340, margin:"0 auto 16px" }}>{desc}</div>
      <a href={buildStripeCheckoutUrl(STRIPE.checkoutUrl, user)} target="_blank" rel="noreferrer"
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
  const [state, setState]       = useState("loading"); // loading | landing | auth_signup | auth_login | onboard | assess | app | reset_password
  const [splashDone, setSplashDone] = useState(false);
  const [splashShown, setSplashShown] = useState(false); // splash jÃ¡ foi exibida nesta sessÃ£o
  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [assessment, setAssessment] = useState(null);
  const urlKey = new URLSearchParams(window.location.search).get("key") || "";
  const [pendingKey, setPendingKey] = useState(urlKey ? urlKey.toUpperCase() : "");
  const [needsConsent, setNeedsConsent] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  // Contas afetadas pelo bug de 24/07 (objectives salvo como string em vez de
  // array, rejeitado pelo Postgres). onboarding ficou marcado como concluÃ­do
  // mas o campo nunca foi persistido. Pede pra corrigir sÃ³ esse campo no login.
  const [needsObjectivesFix, setNeedsObjectivesFix] = useState(false);
  const [objectivesFixSel, setObjectivesFixSel] = useState([]);
  const [objectivesFixBusy, setObjectivesFixBusy] = useState(false);
  const activationTrackedRef = useRef(new Set());


  const trackActivationEvent = useCallback(async (eventType, tabName, metadata = null) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase.from("page_events").insert({
        user_id: user.id,
        event_type: eventType,
        tab_name: tabName,
        metadata,
      });
      if (error) console.warn("[Activation Analytics]", error);
    } catch (error) {
      console.warn("[Activation Analytics]", error);
    }
  }, [user?.id]);


  useEffect(() => {
    if (!user?.id || !["onboard", "assess"].includes(state)) return;
    const eventKey = `${user.id}:${state}`;
    if (activationTrackedRef.current.has(eventKey)) return;
    activationTrackedRef.current.add(eventKey);
    void trackActivationEvent(
      state === "onboard" ? "onboarding_view" : "assessment_view",
      state
    );
    // assessment_started / assessment_resumed agora sÃ£o disparados dentro do
    // prÃ³prio componente Assess, que sabe se havia um rascunho (profile.
    // assessment_draft) â aqui nÃ£o dÃ¡ pra distinguir os dois casos.
  }, [state, user?.id, trackActivationEvent]);


  useEffect(() => {
    // Verificar sessÃ£o atual ao iniciar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadUserData(session.user.id);
      } else {
        setState("landing");   // Sem sessÃ£o â landing pÃºblica
      }
    });


    // Escutar mudanÃ§as de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setUser(session?.user || null);
        setState("reset_password");
        return;
      }
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
    const lsKey = BRAND.storagePrefix + "_done_" + userId;
    // Dispara sem esperar (fire-and-forget) â se falhar, nÃ£o deve travar o
    // carregamento do perfil. Usado pelo cron de check-in de inatividade
    // (api/relationship-inactivity-cron.js) para saber quem estÃ¡ ausente.
    supabase.from("profiles").update({ last_access_at: new Date().toISOString() }).eq("id", userId).then(() => {}, () => {});
    try {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (p) p.name = p.name || p.first_name || "";
      setProfile(p);
      if (p?.onboarding_completed && (!p.objectives || p.objectives.length === 0)) {
        setNeedsObjectivesFix(true);
      }


      // Contas criadas antes da correÃ§Ã£o do registro de consentimento LGPD
      // nÃ£o tÃªm esse aceite gravado. Verifica e pede pra confirmar agora.
      try {
        // Nunca usar .maybeSingle() aqui: se existir mais de uma linha de
        // consentimento pro mesmo usuÃ¡rio (aceite antigo + reaceite), o
        // Postgrest lanÃ§a erro de "multiple rows", cai no catch abaixo e
        // reabre o modal â isso Ã© o que fazia o aviso de LGPD voltar a
        // cada troca de aba/navegaÃ§Ã£o, mesmo jÃ¡ tendo sido aceito.
        const { data: consent } = await supabase.from("consent_logs").select("id").eq("user_id", userId).order("created_at", { ascending: false }).limit(1);
        if (!consent || consent.length === 0) setNeedsConsent(true);
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
      // Sem assessment no DB â verifica fallbacks
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
      const { error } = await supabase.from("profiles").upsert({
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
        objectives: form.objectives, onboarding_completed: true, onboarding_completed_at: new Date().toISOString(),
      });
      if (error) {
        // Antes este erro era silenciosamente ignorado â a tela seguia pro
        // quiz como se tivesse salvo, mas nada persistia no banco. Agora
        // avisa e nÃ£o deixa perder os dados do onboarding sem o usuÃ¡rio saber.
        console.error("[handleOnboard] falha ao salvar perfil:", error);
        alert("NÃ£o consegui salvar seus dados de perfil (" + (error.message || "erro desconhecido") + "). Tenta de novo em instantes â se persistir, avisa o suporte.");
        return;
      }
      setProfile({ ...profile, ...form, first_name: form.name, onboarding_completed: true });
    } catch (e) {
      console.error("[handleOnboard] erro inesperado:", e);
      alert("NÃ£o consegui salvar seus dados de perfil. Tenta de novo em instantes â se persistir, avisa o suporte.");
      return;
    }
    void trackActivationEvent("onboarding_completed", "onboard");
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
        objetivos: p.objectives || "",
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
    const scores = result.scores;
    const fullScores = { ...scores, profileKey: result.profileKey, profileName: result.profileName, overall: result.overall };


    // IdempotÃªncia: se uma tentativa anterior jÃ¡ inseriu o assessment mas
    // falhou no update do perfil logo depois, uma nova tentativa (mesmo
    // `result`, mesma sessÃ£o) nÃ£o deve criar um segundo registro. Verifica
    // se jÃ¡ existe um assessment igual (mesmo overall + profileKey) nos
    // Ãºltimos 10 minutos para este usuÃ¡rio antes de inserir.
    const tenMinAgoISO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: existingAttempt } = await supabase.from("assessments")
      .select("id")
      .eq("user_id", user.id)
      .eq("overall", result.overall)
      .eq("profile_key", result.profileKey)
      .gte("created_at", tenMinAgoISO)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();


    if (!existingAttempt) {
      const { error: insertError } = await supabase.from("assessments").insert({
        user_id: user.id,
        scores: fullScores,
        overall: result.overall,
      });
      if (insertError) {
        console.error("[Assess] insert em assessments falhou:", insertError);
        throw insertError; // crÃ­tico: sem isso nÃ£o hÃ¡ diagnÃ³stico salvo â o usuÃ¡rio precisa poder tentar de novo
      }
    }


    const profileUpdate = {
      assessment_completed: true,
      onboarding_completed: true,
      last_assessment_at: new Date().toISOString(),
      overall_score: result.overall,
      profile_key: result.profileKey,
      profile_name: result.profileName,
      assessment_scores: fullScores,
      // Limpa o rascunho â o assessment foi concluÃ­do, nÃ£o faz sentido
      // restaurar respostas antigas numa prÃ³xima visita a esta tela.
      assessment_draft: null,
      assessment_draft_step: null,
    };
    let { error: updateError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
    if (updateError) {
      console.error("[Assess] update em profiles falhou, tentando novamente:", updateError);
      const retry = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
      updateError = retry.error;
      if (updateError) console.error("[Assess] retry do update em profiles falhou:", updateError);
    }
    if (updateError) throw updateError; // crÃ­tico: sem isso o app nunca sai da tela de assessment (assessment_completed continuaria false)


    // Daqui pra baixo Ã© best-effort â nÃ£o deve impedir a navegaÃ§Ã£o nem
    // acionar o retry do usuÃ¡rio se falhar (nada aqui Ã© indispensÃ¡vel para
    // ele seguir em frente).
    try {
      // Ativa o plano mensurÃ¡vel: cria user_plans se ainda nÃ£o existir para este usuÃ¡rio.
      // Isso liga o trigger update_plan_progress (interactions -> plan_progress) que jÃ¡ existe no banco.
      const { data: existingPlan } = await supabase.from("user_plans").select("id").eq("user_id", user.id).maybeSingle();
      if (!existingPlan) {
        const dimEntries = DIMS.map(d => ({ label: d.label, score: scores?.[d.key] ?? 0 }));
        const weakest = dimEntries.reduce((min, d) => (d.score < min.score ? d : min), dimEntries[0]);
        const { error: planError } = await supabase.from("user_plans").insert({
          user_id: user.id,
          target_dimension: weakest.label,
          target_dimension_score: Math.min(100, (weakest.score || 0) + 20),
          phase: 1,
          week: 1,
        });
        if (planError) console.error("[Assess] falha ao criar user_plans:", planError);
      }
    } catch (e) { console.error("[Assess] excecao (nÃ£o-crÃ­tica):", e); }


    sendToMake(result);
    void trackActivationEvent("assessment_completed", "assess", {
      overall: result.overall,
      profile_key: result.profileKey,
    });
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




  const handlePasswordUpdated = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) { setUser(session.user); await loadUserData(session.user.id); }
    else setState("landing");
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null); setProfile(null); setAssessment(null);
    // onAuthStateChange dispararÃ¡ SIGNED_OUT e irÃ¡ para landing
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


  const saveObjectivesFix = async () => {
    if (!user || objectivesFixSel.length === 0) return;
    setObjectivesFixBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ objectives: objectivesFixSel }).eq("id", user.id);
      if (error) {
        console.error("[ObjectivesFix]", error);
        setObjectivesFixBusy(false);
        return;
      }
      setProfile(prev => ({ ...(prev || {}), objectives: objectivesFixSel }));
      setNeedsObjectivesFix(false);
    } catch (e) {
      console.error("[ObjectivesFix]", e);
    }
    setObjectivesFixBusy(false);
  };


  // Splash aparece imediatamente na primeira abertura, independente do estado de auth
  if (!splashShown) return <SplashScreen onDone={() => setSplashShown(true)} />;


  if (state === "loading") return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:44, height:44, borderRadius:11, background:`linear-gradient(135deg,${C.gold},${C.gB})`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.bg }}>C</div>
      <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, color:C.gold, letterSpacing:".06em" }}>{BRAND.name}</div>
      <div style={{ width:32, height:2, borderRadius:1, background:C.gD, animation:"none", marginTop:4 }}/>
      <div style={{ fontFamily:"'DM Sans'", fontSize:11, color:C.txL, letterSpacing:".08em" }}>Verificando acesso...</div>
    </div>
  );


  return (
    <>
      {needsConsent && user && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:99999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"85vh", overflowY:"auto" }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:"0 0 6px" }}>Atualizamos nossa PolÃ­tica de Privacidade</h2>
            <p style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:16, lineHeight:1.6 }}>Pra continuar usando o {BRAND.name}, precisamos que vocÃª confirme sua ciÃªncia sobre o tratamento dos seus dados, conforme a LGPD.</p>
            <div style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, lineHeight:1.7, marginBottom:16 }}>
              <p><strong style={{color:C.txt}}>1. ResponsÃ¡vel pelo tratamento</strong><br/>{BRAND.name}, plataforma de inteligÃªncia relacional para profissionais do agronegÃ³cio.</p>
              <p><strong style={{color:C.txt}}>2. Dados coletados</strong><br/>Nome, e-mail, empresa, cargo, WhatsApp, LinkedIn, Instagram, cidade, estado, objetivos profissionais e histÃ³rico de interaÃ§Ãµes com contatos.</p>
              <p><strong style={{color:C.txt}}>3. Finalidade</strong><br/>Personalizar os insights de inteligÃªncia relacional, gerar diagnÃ³sticos e recomendaÃ§Ãµes dentro da plataforma.</p>
              <p><strong style={{color:C.txt}}>4. Base legal (LGPD â Lei 13.709/2018)</strong><br/>Consentimento do titular (Art. 7Âº, I) e execuÃ§Ã£o do contrato de uso da plataforma (Art. 7Âº, V).</p>
              <p><strong style={{color:C.txt}}>5. Compartilhamento</strong><br/>Seus dados nÃ£o sÃ£o vendidos ou compartilhados com terceiros. Utilizamos provedores de infraestrutura (Supabase, Vercel, Google Gemini) sob acordos de confidencialidade.</p>
              <p><strong style={{color:C.txt}}>6. Seus direitos</strong><br/>Acesso, correÃ§Ã£o, exclusÃ£o ou portabilidade dos seus dados a qualquer momento: <strong>{BRAND.supportEmail}</strong>.</p>
            </div>
            <button onClick={acceptConsentNow} disabled={consentBusy} style={{ width:"100%", background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer" }}>{consentBusy ? "Aguarde..." : "Li e aceito"}</button>
          </div>
        </div>
      )}
      {needsObjectivesFix && user && !needsConsent && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.9)", zIndex:99998, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:C.card, border:`1px solid ${C.brd}`, borderRadius:14, padding:24, maxWidth:480, width:"100%", maxHeight:"85vh", overflowY:"auto" }}>
            <h2 style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700, color:C.txt, margin:"0 0 6px" }}>SÃ³ falta um detalhe</h2>
            <p style={{ fontFamily:"'DM Sans'", fontSize:12, color:C.txM, marginBottom:16, lineHeight:1.6 }}>Seus objetivos de networking nÃ£o foram salvos por uma falha tÃ©cnica. Selecione de novo pra deixar seu diagnÃ³stico completo.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
              {OBJECTIVES.map(o => {
                const sel = objectivesFixSel.includes(o.value);
                return (
                  <button key={o.value} onClick={() => setObjectivesFixSel(p => p.includes(o.value) ? p.filter(x => x !== o.value) : [...p, o.value])} style={{ background: sel ? C.gD : C.sf, border: `1px solid ${sel ? C.gL : C.brd}`, borderRadius: 10, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{o.icon}</span>
                    <span style={{ fontFamily: "'DM Sans'", fontSize: 13, fontWeight: sel ? 600 : 400, color: sel ? C.gold : C.txM }}>{o.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={saveObjectivesFix} disabled={objectivesFixBusy || objectivesFixSel.length === 0} style={{ width:"100%", background:`linear-gradient(135deg,${C.gold},${C.gB})`, border:"none", borderRadius:10, padding:"12px 0", fontFamily:"'DM Sans'", fontSize:13, fontWeight:700, color:C.bg, cursor:"pointer", opacity: objectivesFixSel.length === 0 ? 0.6 : 1 }}>{objectivesFixBusy ? "Salvando..." : "Salvar e continuar"}</button>
          </div>
        </div>
      )}
      {state === "reset_password" && <ResetPassword onDone={handlePasswordUpdated} />}
      {state === "landing"      && <PublicLanding onSignup={() => setState("auth_signup")} onLogin={() => setState("auth_login")} urlKey={urlKey} />}
      {state === "auth_signup"  && <Auth onAuth={handleAuth} initialMode="signup" />}
      {state === "auth_login"   && <Auth onAuth={handleAuth} initialMode="login" />}
      {state === "onboard"      && user && (
        <Onboard
          onDone={handleOnboard}
          initialKey={pendingKey}
          authEmail={user?.email || ""}
          authName={
            user?.user_metadata?.name ||
            profile?.first_name ||
            profile?.name ||
            ""
          }
        />
      )}
      {state === "assess"       && user && <Assess profile={profile} onDone={handleAssess} />}
      {state === "app"          && user && <CRM profile={profile} assessment={assessment} onReset={handleLogout} user={user} onProfileUpdate={(updated) => setProfile(prev => ({ ...(prev || {}), ...updated }))} />}
    </>
  );
}


export default App;
