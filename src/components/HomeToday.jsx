import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Brain,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MessageCircle,
  RefreshCw,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import useRelationshipIntelligence from "../lib/useRelationshipIntelligence.js";

const UI = {
  bg: "#0B0C0B",
  card: "#121411",
  cardStrong: "#171914",
  border: "rgba(214, 179, 76, 0.18)",
  borderSoft: "rgba(255,255,255,0.08)",
  gold: "#D6B34C",
  goldSoft: "rgba(214,179,76,0.12)",
  goldBorder: "rgba(214,179,76,0.32)",
  text: "#F3EFE7",
  textMuted: "#AAA398",
  textSoft: "#77736C",
  green: "#55BE82",
  greenSoft: "rgba(85,190,130,0.12)",
  greenBorder: "rgba(85,190,130,0.26)",
  amber: "#E7B95D",
  amberSoft: "rgba(231,185,93,0.10)",
};

function firstName(name = "") {
  return String(name).trim().split(/\s+/)[0] || "";
}

function scoreLabel(score = 0) {
  if (score >= 110) return "atenção imediata";
  if (score >= 95) return "alta prioridade";
  if (score >= 80) return "vale olhar hoje";
  return "oportunidade";
}

function actionIcon(type) {
  if (type === "birthday") return CalendarDays;

  if (
    type === "overdue_next_action" ||
    type === "upcoming_next_action" ||
    type === "tracked_commitment"
  ) {
    return Clock3;
  }

  if (type === "event_preparation" || type === "event_followup") {
    return CalendarDays;
  }

  if (
    type === "frequency_exceeded" ||
    type === "strategic_relationship_cooling"
  ) {
    return Users;
  }

  return Target;
}

function DecisionCard({
  item,
  principal = false,
  onOpenContact,
  onTalkToDanna,
}) {
  if (!item) return null;

  const Icon = actionIcon(item.actionType);

  return (
    <article
      style={{
        borderRadius: 18,
        border: `1px solid ${
          principal ? UI.goldBorder : UI.borderSoft
        }`,
        background: principal ? UI.goldSoft : UI.card,
        padding: 18,
        boxSizing: "border-box",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            minWidth: 42,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: principal
              ? "rgba(214,179,76,0.16)"
              : "rgba(255,255,255,0.055)",
            color: principal ? UI.gold : UI.textMuted,
          }}
        >
          <Icon size={20} />
        </div>

        <div
          style={{
            minWidth: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 7,
              marginBottom: 9,
            }}
          >
            {principal && (
              <span
                style={{
                  borderRadius: 999,
                  background: "rgba(214,179,76,0.16)",
                  color: UI.gold,
                  padding: "4px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.10em",
                }}
              >
                Primeiro olhar
              </span>
            )}

            <span
              style={{
                fontSize: 11,
                color: UI.textSoft,
              }}
            >
              {scoreLabel(item.score)}
            </span>

            {item.confidence >= 0.9 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: UI.green,
                  fontSize: 11,
                }}
              >
                <CheckCircle2 size={12} />
                evidência forte
              </span>
            )}
          </div>

          <h3
            style={{
              margin: 0,
              color: UI.text,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 16,
              lineHeight: 1.35,
              fontWeight: 700,
            }}
          >
            {item.title}
          </h3>

          <p
            style={{
              margin: "8px 0 0",
              color: UI.textMuted,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              lineHeight: 1.65,
            }}
          >
            {item.reason}
          </p>

          {item.nextMove && (
            <div
              style={{
                marginTop: 14,
                padding: "12px 13px",
                borderRadius: 13,
                border: `1px solid ${UI.borderSoft}`,
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                  color: UI.gold,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.09em",
                }}
              >
                <ArrowRight size={13} />
                Próximo movimento
              </div>

              <p
                style={{
                  margin: 0,
                  color: UI.text,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  lineHeight: 1.55,
                }}
              >
                {item.nextMove}
              </p>
            </div>
          )}

          {(typeof onOpenContact === "function" ||
            typeof onTalkToDanna === "function") && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 14,
              }}
            >
              {typeof onOpenContact === "function" && (
                <button
                  type="button"
                  onClick={() => onOpenContact(item.contactId)}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${UI.border}`,
                    background: "rgba(255,255,255,0.035)",
                    color: UI.text,
                    padding: "9px 12px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Abrir {firstName(item.contactName)}
                </button>
              )}

              {typeof onTalkToDanna === "function" && (
                <button
                  type="button"
                  onClick={() => onTalkToDanna(item)}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${UI.goldBorder}`,
                    background: UI.gold,
                    color: "#11120F",
                    padding: "9px 12px",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <MessageCircle size={14} />
                  Falar com Danna
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export default function HomeToday({
  user,
  contacts = [],
  interactions = [],
  alerts = [],
  onOpenContact,
  onTalkToDanna,
}) {
  const userId = user?.id || user?.user_id || null;

  const intelligence = useRelationshipIntelligence(
    userId,
    contacts,
    interactions,
    alerts
  );

  const [refreshing, setRefreshing] = useState(false);

  function refresh() {
    setRefreshing(true);

    window.dispatchEvent(
      new Event("conexia:relationship-changed")
    );

    window.setTimeout(() => {
      setRefreshing(false);
    }, 700);
  }

  const main = intelligence.main;
  const secondary = intelligence.secondary || [];
  const total = intelligence.decisions?.length || 0;

  return (
    <section
      style={{
        width: "100%",
        boxSizing: "border-box",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 6,
              color: UI.gold,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            <Brain size={17} />
            Inteligência relacional
          </div>

          <h2
            style={{
              margin: 0,
              color: UI.text,
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 25,
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            Quem merece sua atenção agora?
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              maxWidth: 620,
              color: UI.textMuted,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            O CONÉXIA cruza sua rede, histórico, compromissos e agenda
            para sugerir o próximo movimento com contexto.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          aria-label="Atualizar inteligência relacional"
          style={{
            width: 40,
            height: 40,
            minWidth: 40,
            borderRadius: 12,
            border: `1px solid ${UI.border}`,
            background: UI.card,
            color: UI.gold,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <RefreshCw
            size={17}
            style={{
              animation: refreshing
                ? "conexiaSpin .7s linear infinite"
                : "none",
            }}
          />
        </button>
      </div>

      {!intelligence.complete && userId && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            marginBottom: 13,
            padding: "11px 13px",
            borderRadius: 13,
            border: `1px solid ${UI.borderSoft}`,
            background: UI.card,
            color: UI.textMuted,
            fontSize: 12,
          }}
        >
          <RefreshCw
            size={15}
            style={{
              animation: "conexiaSpin .8s linear infinite",
            }}
          />
          Lendo sua rede completa…
        </div>
      )}

      {intelligence.error && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: 13,
            padding: "12px 13px",
            borderRadius: 13,
            border: "1px solid rgba(231,185,93,0.22)",
            background: UI.amberSoft,
          }}
        >
          <AlertTriangle
            size={17}
            style={{
              color: UI.amber,
              flexShrink: 0,
              marginTop: 2,
            }}
          />

          <div>
            <p
              style={{
                margin: 0,
                color: UI.text,
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Não consegui atualizar toda a inteligência da rede.
            </p>

            <p
              style={{
                margin: "5px 0 0",
                color: UI.textMuted,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {intelligence.error}
            </p>
          </div>
        </div>
      )}

      {main ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 11,
          }}
        >
          <DecisionCard
            item={main}
            principal
            onOpenContact={onOpenContact}
            onTalkToDanna={onTalkToDanna}
          />

          {secondary.map((item) => (
            <DecisionCard
              key={item.recommendationId}
              item={item}
              onOpenContact={onOpenContact}
              onTalkToDanna={onTalkToDanna}
            />
          ))}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 18,
            border: `1px solid ${UI.borderSoft}`,
            background: UI.card,
            padding: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 13,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                minWidth: 42,
                borderRadius: 13,
                background: UI.greenSoft,
                color: UI.green,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={20} />
            </div>

            <div>
              <h3
                style={{
                  margin: 0,
                  color: UI.text,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                Nenhuma ação forte apareceu agora.
              </h3>

              <p
                style={{
                  margin: "7px 0 0",
                  color: UI.textMuted,
                  fontSize: 12,
                  lineHeight: 1.6,
                }}
              >
                Isso não significa que sua rede está resolvida.
                Significa apenas que, com os dados disponíveis, o
                CONÉXIA não encontrou evidência suficiente para
                recomendar uma abordagem específica hoje.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "5px 12px",
          marginTop: 13,
          color: UI.textSoft,
          fontSize: 10,
          lineHeight: 1.5,
        }}
      >
        <span>
          {intelligence.coverage?.contacts || 0} contatos analisados
        </span>

        <span>•</span>

        <span>
          {intelligence.coverage?.interactions || 0} interações
        </span>

        <span>•</span>

        <span>
          {intelligence.coverage?.memories || 0} memórias relacionais
        </span>

        <span>•</span>

        <span>
          {intelligence.coverage?.events || 0} eventos
        </span>

        {total > 0 && (
          <>
            <span>•</span>
            <span style={{ color: UI.gold }}>
              {total} {total === 1 ? "prioridade" : "prioridades"} agora
            </span>
          </>
        )}
      </div>

      <style>{`
        @keyframes conexiaSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}
