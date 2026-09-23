import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../utils/theme";
import { computePriorities, relationshipMomentum } from "../../shared/priorityEngine.js";
import { detectPatterns, PATTERN_NOTES } from "../../shared/relationshipPatternDetector.js";
import iconeDark from "../assets/brand/conexia_icone_fundo-escuro.svg";

const TAU = Math.PI * 2;

function relevance(contact) {
  const values = [
    contact?.influenciaPessoas ?? contact?.influencia_pessoas,
    contact?.geraOportunidade ?? contact?.gera_oportunidade,
    contact?.abrePortas ?? contact?.abre_portas,
    contact?.momentoAtual ?? contact?.momento_atual,
  ].map(Number).filter(Number.isFinite);

  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(0, Math.min(100, avg > 10 ? avg : avg * 10));
}

function statusFor(contact) {
  const r = relevance(contact);
  const h = Number(contact?.health);

  if (!Number.isFinite(r)) return { label: "Dados incompletos", color: "#5B9BD5" };
  if (h >= 65 && r >= 65) return { label: "Presente e importante", color: "#4caf50" };
  if (h < 45 && r >= 55) return { label: "Talvez mereça atenção", color: "#E8A020" };
  if (h >= 45 && r < 65) return { label: "Relação tranquila", color: "#ff9800" };
  return { label: "Sem prioridade agora", color: "#6a6460" };
}

function safeText(value, max = 14) {
  const s = String(value || "");
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export default function ConexiaTeiaEvolutiva({
  contacts = [],
  interactions = [],
  isPro = true,
  onOpenContact,
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("todos");
  const [phase, setPhase] = useState(0);
  const [motion, setMotion] = useState(true);
  const lastSignature = useRef("");

  const signature = useMemo(() => {
    const a = contacts
      .map(c => [c.id, c.health, c.lastInteraction, c.last_interaction_at, c.nextAction, c.next_action].join(":"))
      .join("|");
    const b = interactions
      .slice(0, 40)
      .map(i => [i.id, i.contactId, i.contact_id, i.createdAt, i.created_at].join(":"))
      .join("|");
    return a + "::" + b;
  }, [contacts, interactions]);

  useEffect(() => {
    if (lastSignature.current && lastSignature.current !== signature) {
      setPhase(p => p + Math.PI / 9);
    }
    lastSignature.current = signature;
  }, [signature]);

  useEffect(() => {
    if (!motion) return;
    let raf;
    let last = performance.now();

    const tick = now => {
      const dt = Math.min(50, now - last);
      last = now;
      setPhase(p => p + dt * 0.000018);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [motion]);

  const priorities = useMemo(
    () => computePriorities(contacts, {}, new Date(), interactions),
    [contacts, interactions]
  );

  const priorityIds = useMemo(
    () =>
      new Set(
        [priorities?.main, ...(priorities?.secondary || [])]
          .filter(Boolean)
          .map(x => x.relationshipId)
      ),
    [priorities]
  );

  const insight = useMemo(
    () => detectPatterns(contacts, interactions, new Date())[0] || null,
    [contacts, interactions]
  );

  const filters = [
    ["todos", "Todos"],
    ["prioridade", "Merecem atenção"],
    ["fortes", "Presentes"],
    ["sem_acao", "Sem próxima ação"],
  ];

  const filtered = useMemo(
    () =>
      contacts.filter(c => {
        const s = statusFor(c).label;
        if (filter === "todos") return true;
        if (filter === "prioridade") return priorityIds.has(c.id) || s === "Talvez mereça atenção";
        if (filter === "fortes") return s === "Presente e importante";
        if (filter === "sem_acao") return !(c.nextAction || c.next_action);
        return true;
      }),
    [contacts, filter, priorityIds]
  );

  const CX = 280;
  const CY = 255;
  const BASE = 190;

  const nodes = useMemo(() => {
    const n = Math.max(1, filtered.length);

    return filtered.map((c, i) => {
      const count = interactions.filter(x => (x.contactId ?? x.contact_id) === c.id).length;
      const health = Math.max(0, Math.min(100, Number(c.health) || 0));
      const rel = relevance(c);
      const st = statusFor(c);
      const momentum = relationshipMomentum(c, interactions, new Date());

      const ringBias = rel == null ? 0.88 : 0.72 + (rel / 100) * 0.28;
      const radius = BASE * (0.28 + (health / 100) * 0.72) * ringBias;
      const angle =
        -Math.PI / 2 +
        (TAU * i) / n +
        phase * (0.72 + (i % 5) * 0.045);

      const x = CX + radius * Math.cos(angle);
      const y = CY + radius * Math.sin(angle);
      const labelR = Math.min(BASE + 45, radius + 35);
      const lx = CX + labelR * Math.cos(angle);
      const ly = CY + labelR * Math.sin(angle);
      const size = Math.max(9, Math.min(23, 9 + Math.sqrt(count) * 4));

      return { c, count, health, rel, st, momentum, angle, x, y, lx, ly, size };
    });
  }, [filtered, interactions, phase]);

  const selected = nodes.find(n => n.c.id === selectedId) || null;
  const avg = filtered.length
    ? Math.round(filtered.reduce((sum, c) => sum + (Number(c.health) || 0), 0) / filtered.length)
    : 0;

  const momentumLabel = {
    strengthening: "fortalecendo",
    stable: "estável",
    cooling: "esfriando",
    reactivated: "reativada",
    new: "nova",
    insufficient_data: "sem leitura ainda",
  };

  if (contacts.length < 2) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 36, textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>⊛</div>
        <div style={{ fontFamily: "'DM Sans'", color: C.txt, fontWeight: 700 }}>Cadastre mais pessoas para formar sua Teia</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 10, fontWeight: 800, color: C.gold, letterSpacing: ".12em", textTransform: "uppercase" }}>TEIA VIVA</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, fontWeight: 700, color: C.txt, margin: "3px 0 3px" }}>Sua rede se reorganiza com você</h2>
          <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL }}>Núcleo fixo. Relações mudam conforme presença, relevância e interações.</div>
        </div>

        <button
          onClick={() => setMotion(v => !v)}
          style={{
            background: motion ? C.gD : C.sf,
            border: `1px solid ${motion ? C.gL : C.brd}`,
            color: motion ? C.gold : C.txM,
            borderRadius: 999,
            padding: "7px 10px",
            fontFamily: "'DM Sans'",
            fontSize: 10,
            cursor: "pointer",
          }}
        >
          {motion ? "● viva" : "○ pausada"}
        </button>
      </div>

      {insight && PATTERN_NOTES[insight.type] && (
        <div style={{ background: `${C.gold}0d`, border: `1px solid ${C.gL}`, borderRadius: 12, padding: "11px 14px", marginBottom: 12, fontFamily: "'DM Sans'", fontSize: 12, color: C.txM, lineHeight: 1.55 }}>
          <span style={{ color: C.gold, fontWeight: 800 }}>O que percebi: </span>
          {PATTERN_NOTES[insight.type]}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {filters.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              background: filter === key ? C.gold : C.sf,
              border: `1px solid ${filter === key ? C.gold : C.brd}`,
              color: filter === key ? C.bg : C.txM,
              borderRadius: 999,
              padding: "6px 11px",
              fontFamily: "'DM Sans'",
              fontSize: 10.5,
              fontWeight: filter === key ? 800 : 500,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 12 }}>
        <div style={{ position: "relative", background: "radial-gradient(circle at 50% 50%, rgba(201,168,76,.07), transparent 42%), #151516", border: `1px solid ${C.brd}`, borderRadius: 18, padding: 8, overflow: "hidden" }}>
          <svg viewBox="0 0 560 510" style={{ width: "100%", height: "auto", display: "block", maxHeight: "70vh" }}>
            <defs>
              <filter id="teiaGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {[0.25, 0.5, 0.75, 1].map((r, i) => (
              <circle
                key={i}
                cx={CX}
                cy={CY}
                r={BASE * r}
                fill="none"
                stroke={C.brd}
                strokeWidth=".7"
                strokeDasharray={i < 3 ? "2 8" : "none"}
                opacity=".38"
              />
            ))}

            {nodes.map(n => (
              <line
                key={"l" + n.c.id}
                x1={CX}
                y1={CY}
                x2={n.x}
                y2={n.y}
                stroke={n.st.color}
                strokeWidth={Math.max(0.6, Math.min(3, n.count * 0.22 + 0.6))}
                opacity={priorityIds.has(n.c.id) ? 0.33 : 0.14}
              />
            ))}

            {nodes.length > 2 && (
              <path
                d={
                  nodes
                    .map((n, i) => `${i ? "L" : "M"} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`)
                    .join(" ") + " Z"
                }
                fill={`${C.gold}05`}
                stroke={`${C.gold}18`}
                strokeWidth="1"
              />
            )}

            <circle cx={CX} cy={CY} r="37" fill={`${C.gold}08`} stroke={`${C.gold}30`} strokeWidth="1" />
            <circle cx={CX} cy={CY} r="29" fill={C.bg} stroke={C.gold} strokeWidth="1.2" filter="url(#teiaGlow)" />
            <image href={iconeDark} x={CX - 20} y={CY - 20} width="40" height="40" preserveAspectRatio="xMidYMid meet" />

            {nodes.map(n => {
              const sel = selectedId === n.c.id;
              const prio = priorityIds.has(n.c.id);

              return (
                <g key={n.c.id} onClick={() => setSelectedId(sel ? null : n.c.id)} style={{ cursor: "pointer" }}>
                  {prio && (
                    <circle cx={n.x} cy={n.y} r={n.size + 7} fill="none" stroke={C.gold} strokeWidth="1" strokeDasharray="2 4" opacity=".8" />
                  )}

                  {sel && (
                    <circle cx={n.x} cy={n.y} r={n.size + 11} fill={n.st.color} opacity=".12" filter="url(#teiaGlow)" />
                  )}

                  <circle cx={n.x} cy={n.y} r={n.size} fill={`${n.st.color}20`} stroke={n.st.color} strokeWidth={sel ? 2.6 : 1.4} />
                  <circle cx={n.x} cy={n.y} r="3" fill={n.st.color} />

                  <text
                    x={n.lx}
                    y={n.ly}
                    textAnchor={Math.cos(n.angle) < 0 ? "end" : "start"}
                    dominantBaseline="middle"
                    fill={sel ? n.st.color : C.txM}
                    fontSize={sel ? 11 : 10}
                    fontWeight={sel ? 700 : 500}
                    fontFamily="'DM Sans'"
                  >
                    {safeText(n.c.name, 15)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.brd}`, borderRadius: 14, padding: 15 }}>
          {selected ? (
            <>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 700, color: C.txt }}>{selected.c.name}</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 2 }}>
                {[selected.c.company, selected.c.role].filter(Boolean).join(" · ") || "sua rede"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 14 }}>
                {[
                  ["Presença", selected.health + "%"],
                  ["Interações", selected.count],
                  ["Movimento", momentumLabel[selected.momentum] || "—"],
                ].map(([a, b]) => (
                  <div key={a} style={{ background: C.sf, border: `1px solid ${C.brd}`, borderRadius: 9, padding: 9 }}>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 8, color: C.txL, textTransform: "uppercase" }}>{a}</div>
                    <div style={{ fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 700, color: C.txt, marginTop: 3 }}>{b}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 12, fontFamily: "'DM Sans'", fontSize: 12, color: selected.st.color, fontWeight: 700 }}>
                {selected.st.label}
              </div>

              <button
                onClick={() => onOpenContact?.(selected.c.id)}
                style={{
                  marginTop: 12,
                  width: "100%",
                  background: C.gold,
                  border: "none",
                  color: C.bg,
                  borderRadius: 9,
                  padding: "10px 12px",
                  fontFamily: "'DM Sans'",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Abrir relação
              </button>

              {!isPro && (
                <div style={{ marginTop: 9, fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>
                  A Teia completa faz parte do PRO.
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 21, fontWeight: 700, color: C.txt }}>Leitura da rede</div>
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: C.txL, marginTop: 2 }}>{filtered.length} pessoas neste recorte</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 28, fontWeight: 700, color: avg >= 70 ? C.grn : avg >= 40 ? C.amb : C.cor }}>{avg}%</span>
                <span style={{ fontFamily: "'DM Sans'", fontSize: 10, color: C.txL }}>presença média</span>
              </div>

              {priorities?.main && (
                <div style={{ marginTop: 12, padding: "10px 11px", background: `${C.gold}08`, border: `1px solid ${C.gL}`, borderRadius: 9, fontFamily: "'DM Sans'", fontSize: 11.5, color: C.txM, lineHeight: 1.5 }}>
                  <span style={{ color: C.gold, fontWeight: 800 }}>Agora: </span>
                  {priorities.main.title}
                </div>
              )}

              <div style={{ fontFamily: "'DM Sans'", fontSize: 10.5, color: C.txL, lineHeight: 1.5, marginTop: 11 }}>
                Toque em uma pessoa para a Teia parar de ser um mapa e virar contexto.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
