import { AbaIA } from './components/AbaIA';
import HomeToday from './components/HomeToday';
import ConexiaLabHome from './components/ConexiaLabHome';
import ConexiaTeiaEvolutiva from "./components/ConexiaTeiaEvolutiva";
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


/* ─── Logo Components ─────────────────────────────────── */
// Ícone isolado (para splash, headers, favicons)
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
    alt={`${BRAND.name} — Diagnóstico Relacional`}
    style={{ height, objectFit: 'contain', ...style }}
  />
);


/* ─── Profiles ────────────────────────────────────────── */
const PROFILES = {
  estrategista: { name: "O Estrategista", emoji: "🎯", tagline: "Você joga xadrez relacional.", desc: "Você não faz networking por acaso. Sabe exatamente quem precisa na sua rede, por quê, e cultiva com disciplina. Sua força está na clareza de intenção combinada com consistência.", strengths: ["Visão estratégica de longo prazo", "Disciplina no follow-up", "Capacidade de priorizar relações"], risks: ["Pode parecer transacional", "Subestima conexões sem utilidade imediata"], actions: ["Liste 3 pessoas que mantém contato por obrigação — existe algo genuíno ali?", "Tenha 1 conversa sem agenda nas próximas 2 semanas.", "Envie reconhecimento para alguém que te ajudou, sem pedir nada."] },
  influenciador: { name: "O Influenciador", emoji: "🌟", tagline: "Onde você está, as coisas acontecem.", desc: "Presença de mercado e generosidade natural. As pessoas te procuram porque sabem que você conecta, indica e gera valor. Rede viva e diversa.", strengths: ["Alta visibilidade", "Generosidade natural", "Confiança rápida"], risks: ["Pode se sobrecarregar", "Rede ampla mas nem sempre profunda"], actions: ["Transforme 2 contatos superficiais em relações profundas.", "Crie critério claro para dizer não sem culpa.", "Documente os 10 contatos que mais geram valor mútuo."] },
  conector: { name: "O Conector", emoji: "🔗", tagline: "Você tece redes vivas.", desc: "Escuta de verdade e conecta A com B criando valor para ambos. Confiança natural porque se importa genuinamente.", strengths: ["Escuta ativa genuína", "Conecta pessoas certas", "Alta reciprocidade"], risks: ["Falta de direcionamento estratégico", "Pode dar mais do que recebe"], actions: ["Liste 10 conexões valiosas que fez para outros — peça algo para 3.", "Defina 3 objetivos para sua rede nos próximos 90 dias.", "Para cada conexão: isso me aproxima de qual objetivo?"] },
  tecnico_invisivel: { name: "O Técnico Invisível", emoji: "🔬", tagline: "Competente demais para ser ignorado — mas é o que acontece.", desc: "Competência inquestionável. Mas sua rede não sabe porque você não aparece. Confiança alta, presença baixa.", strengths: ["Competência reconhecida por quem convive", "Autenticidade", "Relações profundas"], risks: ["Invisibilidade profissional", "Perde oportunidades"], actions: ["Participe de 1 evento do setor nos próximos 30 dias.", "Publique 1 conteúdo técnico no LinkedIn esta semana.", "Peça a 3 pessoas: me indica para uma conversa importante."] },
  relacional_intuitivo: { name: "O Relacional Intuitivo", emoji: "💫", tagline: "Você sente as pessoas. Falta transformar em sistema.", desc: "Dom natural para relações, opera por intuição. Quando a vida aperta, networking cai primeiro — porque não tem estrutura.", strengths: ["Inteligência emocional alta", "Relações autênticas", "Confiança rápida"], risks: ["Networking inconsistente", "Reativo — só cultiva quando precisa"], actions: [`Configure o ${BRAND.name} com 10 contatos mais importantes.`, "Ritual semanal: toda segunda, escolha 2 pessoas para contatar.", "Escreva o que cada contato precisa. Envie algo relevante sem pedir nada."] },
  ativador_intermitente: { name: "O Ativador Intermitente", emoji: "⚡", tagline: "Quando ativa, é poderoso. O problema é que nem sempre ativa.", desc: "Visão e presença. Mas a inconsistência faz sua rede nunca saber se pode contar com você.", strengths: ["Alta capacidade quando engajado", "Boa visão estratégica", "Presença forte"], risks: ["Inconsistência crônica", "Perde credibilidade pela oscilação"], actions: ["Ative alertas para contatos com mais de 15 dias sem interação.", "Comprometa-se com 3 interações por semana.", "Agende networking como reunião fixa no calendário."] },
  construtor_confianca: { name: "O Construtor de Confiança", emoji: "🏛️", tagline: "Você constrói devagar, mas o que constrói não cai.", desc: "Rede sólida. Cultiva com consistência e autenticidade. O que falta é expandir.", strengths: ["Alta confiabilidade", "Consistência no cultivo", "Autenticidade reconhecida"], risks: ["Rede pode ser pequena demais", "Dificuldade em expandir zona de conforto"], actions: ["Identifique 3 pessoas FORA do seu círculo que seriam estratégicas.", "Peça a um aliado para te apresentar a alguém novo.", "Participe de 1 evento onde não conhece ninguém."] },
  explorador_rede: { name: "O Explorador de Rede", emoji: "🧭", tagline: "Você está no começo. E isso é vantagem.", desc: `Sem padrão dominante — pode construir do zero, com método, sem vícios. O ${BRAND.name} será sua fundação.`, strengths: ["Mente aberta", "Sem vícios de networking", "Alto potencial"], risks: ["Pode se sentir perdido", "Risco de desistir cedo"], actions: [`Liste 15 pessoas que importam — classifique cada uma no ${BRAND.name}.`, "Escolha 3 e envie mensagem genuína esta semana.", "Leia o capítulo 1 do livro e aplique 1 conceito."] },
};


const PLAN = [
  { week: 1, title: "Mapear contatos", icon: "🗺️", goal: "Construir a fundação da sua rede.", tasks: ["Cadastre 10 contatos estratégicos", "Classifique cada um", "Defina frequência ideal", "Escreva notas sobre cada pessoa"], metric: "10 contatos cadastrados" },
  { week: 2, title: "Reativar relações", icon: "🔄", goal: "Reconectar com quem esfriou.", tasks: ["Identifique 3 contatos com menor health", "Envie mensagem genuína para cada um", `Registre cada interação no ${BRAND.name}`], metric: "3 relações reativadas" },
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
// Gera um arquivo .ics padrão (RFC 5545) — funciona igual em Outlook, Google Calendar
// e Apple Calendar, sem precisar de OAuth nem integração com nenhuma API externa.
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
