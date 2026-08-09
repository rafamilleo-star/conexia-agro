// src/components/HomeToday.jsx

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../utils/supabase";
import { MOTION, TYPE } from "../utils/theme";
import { computePriorities } from "../../shared/priorityEngine.js";
import {
  detectPatterns,
  PATTERN_NOTES,
  evidenceLabel,
} from "../../shared/relationshipPatternDetector.js";
import {
  addDays,
  buildFeedbackMap,
  nextDismissSuppressionDays,
} from "../../shared/alertsFeedback.js";

const C = {
  card: "#141414",
  surface: "#1A1A1A",
  surfaceSoft: "#171717",
  border: "#2A2A2A",
  text: "#F0EDE8",
  muted: "#A09890",
  light: "#8B837A", // corrigido: #6F6861 dava só 3,17–3,36:1 sobre card/surface (reprovava pra texto pequeno). Agora 4,66–4,93:1.
  gold: "#C9A84C",
  error: "#E05050",
  success: "#5FA66F",
};

const fontSans = "'DM Sans', sans-serif";
const fontSerif = "'Cormorant Garamond', serif";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function getFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function getInteractionDate(interaction) {
  return (
    interaction?.created_at ||
    interaction?.createdAt ||
    interaction?.date ||
    interaction?.interaction_date ||
    null
  );
}

function getContactId(interaction) {
  return interaction?.contact_id || interaction?.contactId || null;
}

function getContactName(contact) {
  return contact?.name || contact?.full_name || "Alguém da sua rede";
}

function getInteractionType(interaction) {
  const raw = String(
    interaction?.type ||
      interaction?.interaction_type ||
      interaction?.channel ||
      ""
  ).toLowerCase();

  const labels = {
    ligacao: "uma ligação",
    ligação: "uma ligação",
    call: "uma ligação",
    telefone: "uma ligação",
    mensagem: "uma mensagem",
    whatsapp: "uma conversa pelo WhatsApp",
    email: "um e-mail",
    "e-mail": "um e-mail",
    reuniao: "uma reunião",
    reunião: "uma reunião",
    encontro: "um encontro",
    evento: "um encontro",
    cafe: "uma conversa",
    café: "uma conversa",
  };

  return labels[raw] || "uma interação";
}

function relativeDate(dateValue) {
  if (!dateValue) return "";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000);

  if (diff <= 0) return "Hoje";
  if (diff === 1) return "Ontem";
  if (diff < 7) return `Há ${diff} dias`;
  if (diff < 14) return "Há 1 semana";

  const weeks = Math.floor(diff / 7);
  return `Há ${weeks} semanas`;
}

function isWithinCurrentWeek(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const day = now.getDay();
  const distanceFromMonday = day === 0 ? 6 : day - 1;

  const start = new Date(now);
  start.setDate(now.getDate() - distanceFromMonday);
  start.setHours(0, 0, 0, 0);

  return date >= start;
}

const chipStyle = {
  background: "transparent",
  border: `1px solid ${C.border}`,
  color: C.muted,
  borderRadius: 9,
  padding: "7px 12px",
  minHeight: 44, // alvo de toque mínimo (WCAG 2.5.5 / iOS HIG) — as 4 respostas de feedback usam este estilo
  display: "inline-flex",
  alignItems: "center",
  fontFamily: fontSans,
  fontSize: TYPE.caption,
  cursor: "pointer",
};

function Button({ children, onClick, primary = false, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: primary ? C.gold : "transparent",
        border: `1px solid ${primary ? C.gold : C.border}`,
        color: primary ? "#0D0D0D" : C.gold,
        borderRadius: 10,
        padding: "10px 16px",
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontSans,
        fontWeight: 700,
        fontSize: TYPE.caption,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      {children}
    </button>
  );
}


function Section({ title, action, children, variant = "info" }) {
  const isAction = variant === "action";
  return (
    <section
      style={{
        background: isAction ? C.card : "transparent",
        border: `1px solid ${isAction ? C.border : C.border + "80"}`,
        borderRadius: 14,
        padding: isAction ? 18 : 15,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: isAction ? 14 : 10,
        }}
      >
        <h2
          style={{
            margin: 0,
            color: isAction ? C.text : C.muted,
            fontFamily: isAction ? fontSerif : fontSans,
            fontSize: isAction ? TYPE.title : TYPE.micro,
            fontWeight: isAction ? 700 : 700,
            textTransform: isAction ? "none" : "uppercase",
            letterSpacing: isAction ? "normal" : "0.06em",
          }}
        >
          {title}
        </h2>

        {action}
      </div>

      {children}
    </section>
  );
}

function DateChoicePopover({ mode, onPick, onCancel, busy }) {
  const [customDate, setCustomDate] = useState("");
  const [note, setNote] = useState("");

  const options =
    mode === "snooze"
      ? [
          {
            label: "Amanhã",
            dateISO: addDays(todayISO(), 1).toISOString().slice(0, 10),
          },
          {
            label: "Próxima semana",
            dateISO: addDays(todayISO(), 7).toISOString().slice(0, 10),
          },
        ]
      : [
          { label: "Hoje", dateISO: todayISO() },
          {
            label: "Ontem",
            dateISO: addDays(todayISO(), -1).toISOString().slice(0, 10),
          },
          {
            label: "Esta semana",
            dateISO: addDays(todayISO(), -3).toISOString().slice(0, 10),
          },
        ];

  return (
    <div
      style={{
        background: C.surfaceSoft,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 12,
        marginTop: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 7,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        {options.map((option) => (
          <button
            type="button"
            key={option.label}
            disabled={busy}
            onClick={() => onPick(option.dateISO, note)}
            style={chipStyle}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode !== "snooze" && (
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="O que aconteceu, rapidinho? (opcional, mas ajuda o CONÉXIA a te conhecer melhor)"
          rows={2}
          style={{
            width: "100%",
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.text,
            borderRadius: 8,
            padding: "8px 10px",
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            marginBottom: 10,
            resize: "vertical",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          flexWrap: "wrap",
        }}
      >
        <input
          type="date"
          value={customDate}
          onChange={(event) => setCustomDate(event.target.value)}
          style={{
            background: "transparent",
            border: `1px solid ${C.border}`,
            color: C.text,
            borderRadius: 8,
            padding: "7px 9px",
            fontFamily: fontSans,
          }}
        />

        <button
          type="button"
          disabled={busy || !customDate}
          onClick={() => onPick(customDate, note)}
          style={chipStyle}
        >
          Confirmar
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          style={{
            ...chipStyle,
            border: "none",
            color: C.light,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function NetworkInsightCard({ pattern, busy, onFeedback }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(null);

  const note = PATTERN_NOTES[pattern.type];
  if (!note) return null;

  const respond = async (answer, confirmMessage) => {
    setPending(answer);
    await onFeedback(pattern, answer);
    setPending(null);
    setConfirmed(confirmMessage);
  };

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 17,
        marginBottom: 14,
      }}
    >
      <div
        style={{
          color: C.muted,
          fontFamily: fontSans,
          fontSize: TYPE.micro,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        O que percebi
      </div>

      <div
        style={{
          color: C.text,
          fontFamily: fontSans,
          fontSize: TYPE.body,
          lineHeight: 1.6,
        }}
      >
        {note}
      </div>

      {confirmed ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: C.success,
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            fontWeight: 600,
            marginTop: 12,
            animation: `conexiaFadeIn ${MOTION.base}`,
          }}
        >
          <span>✓</span> {confirmed}
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 13,
            }}
          >
            <button
              type="button"
              disabled={busy}
              onClick={() => respond("makes_sense", "Obrigado — isso ajuda a refinar o que te mostro.")}
              style={{
                ...chipStyle,
                opacity: pending === "makes_sense" ? 0.6 : 1,
              }}
            >
              {pending === "makes_sense" ? "Um instante…" : "Faz sentido"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => respond("not_relevant", "Entendido — vou levar isso em conta.")}
              style={{
                ...chipStyle,
                opacity: pending === "not_relevant" ? 0.6 : 1,
              }}
            >
              {pending === "not_relevant" ? "Um instante…" : "Não faz sentido"}
            </button>

            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              style={{ ...chipStyle, border: "none", color: C.light }}
            >
              {showEvidence ? "Ocultar evidência" : "Ver evidência"}
            </button>
          </div>

          {showEvidence && (
            <div
              style={{
                color: C.light,
                fontFamily: fontSans,
                fontSize: TYPE.micro,
                marginTop: 9,
                lineHeight: 1.5,
              }}
            >
              {evidenceLabel(pattern)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HomeProLock({ openAccessKey, stripeCheckoutUrl }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "34px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 10 }}>🔒</div>
      <div
        style={{
          fontFamily: fontSerif,
          fontSize: 18,
          fontWeight: 700,
          color: C.text,
          marginBottom: 8,
        }}
      >
        Sua Home relacional é PRO
      </div>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: 13,
          color: C.muted,
          lineHeight: 1.6,
          maxWidth: 360,
          margin: "0 auto 18px",
        }}
      >
        Recomendação do melhor movimento do dia, o que percebemos sobre sua
        rede, e o resumo da sua semana — tudo isso é PRO.
      </p>
      {stripeCheckoutUrl && (
        <a
          href={stripeCheckoutUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            background: C.gold,
            color: "#0D0D0D",
            borderRadius: 8,
            padding: "11px 22px",
            fontFamily: fontSans,
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            marginBottom: 10,
          }}
        >
          Assinar PRO — R$ 39,90/mês
        </a>
      )}
      {openAccessKey && (
        <button
          type="button"
          onClick={openAccessKey}
          style={{
            display: "block",
            margin: "0 auto",
            background: "none",
            border: "none",
            fontFamily: fontSans,
            fontSize: 11,
            color: C.light,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Tenho uma chave de acesso
        </button>
      )}
    </div>
  );
}

function PriorityCard({
  action,
  busy,
  historyLabel,
  onAccept,
  onDismiss,
  onLogRecent,
  onSnooze,
}) {
  const [open, setOpen] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(null); // qual botão está em voo
  const [confirmed, setConfirmed] = useState(null); // mensagem de confirmação transitória

  const run = async (callback, pendingKey, confirmMessage) => {
    setError("");
    setPending(pendingKey);

    const response = await callback();

    setPending(null);

    if (response?.error) {
      setError("Não consegui salvar agora. Tente novamente.");
      return;
    }

    setOpen(null);
    setConfirmed(confirmMessage);
    setTimeout(() => setConfirmed(null), 2200);
  };

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.gold}50`,
        borderRadius: 12,
        padding: 17,
      }}
    >
      <style>{"@keyframes conexiaFadeIn{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}"}</style>
      <div
        style={{
          color: C.gold,
          fontFamily: fontSans,
          fontSize: TYPE.micro,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        Pode valer sua atenção
      </div>

      <div
        style={{
          color: C.text,
          fontFamily: fontSerif,
          fontSize: TYPE.title,
          fontWeight: 700,
          lineHeight: 1.15,
        }}
      >
        {action.title}
      </div>

      <div
        style={{
          color: C.muted,
          fontFamily: fontSans,
          fontSize: TYPE.body,
          lineHeight: 1.6,
          marginTop: 7,
        }}
      >
        {action.reason}
      </div>

      {historyLabel && (
        <div
          style={{
            color: C.light,
            fontFamily: fontSans,
            fontSize: TYPE.micro,
            marginTop: 6,
          }}
        >
          {historyLabel}
        </div>
      )}

      {error && (
        <div
          style={{
            color: C.error,
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            marginTop: 9,
          }}
        >
          {error}
        </div>
      )}

      {/* Confirmação transitória — fecha o loop "a IA me ouviu" sem esperar
          o cartão sumir/atualizar pra saber que a resposta foi registrada. */}
      {confirmed && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: C.success,
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            fontWeight: 600,
            marginTop: 9,
            animation: `conexiaFadeIn ${MOTION.base}`,
          }}
        >
          <span>✓</span> {confirmed}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginTop: 14,
        }}
      >
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onAccept(action), "accept", "Combinado.")}
          style={{
            ...chipStyle,
            borderColor: C.gold,
            color: C.gold,
            fontWeight: 700,
            opacity: pending === "accept" ? 0.6 : 1,
          }}
        >
          {pending === "accept" ? "Abrindo…" : "Ver pessoa"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => onDismiss(action), "dismiss", "Anotado — não trago essa de novo tão cedo.")}
          style={{ ...chipStyle, opacity: pending === "dismiss" ? 0.6 : 1 }}
        >
          {pending === "dismiss" ? "Um instante…" : "Está tudo bem assim"}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(open === "log" ? null : "log")}
          style={chipStyle}
        >
          Conversamos recentemente
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(open === "snooze" ? null : "snooze")}
          style={chipStyle}
        >
          Lembrar depois
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: `grid-template-rows ${MOTION.base}`,
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {open === "log" && (
            <DateChoicePopover
              mode="log"
              busy={busy}
              onPick={(dateISO, note) => run(() => onLogRecent(action, dateISO, note), "log", "Registrado.")}
              onCancel={() => setOpen(null)}
            />
          )}

          {open === "snooze" && (
            <DateChoicePopover
              mode="snooze"
              busy={busy}
              onPick={(dateISO) => run(() => onSnooze(action, dateISO), "snooze", "Vou lembrar você.")}
              onCancel={() => setOpen(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkMovement({ contacts, interactions, onQuickLogInteraction }) {
  const contactMap = useMemo(() => {
    return new Map((contacts || []).map((contact) => [contact.id, contact]));
  }, [contacts]);

  const recent = useMemo(() => {
    return [...(interactions || [])]
      .filter((interaction) => getInteractionDate(interaction))
      .sort(
        (a, b) =>
          new Date(getInteractionDate(b)).getTime() -
          new Date(getInteractionDate(a)).getTime()
      )
      .slice(0, 5);
  }, [interactions]);

  return (
    <Section title="Sua rede está em movimento">
      {recent.length === 0 ? (
        <div>
          <p
            style={{
              margin: "0 0 13px",
              color: C.muted,
              fontFamily: fontSans,
              fontSize: TYPE.body,
              lineHeight: 1.6,
            }}
          >
            Quando você registrar suas conversas, sua rede começa a ganhar
            movimento por aqui.
          </p>

          <Button
            onClick={() => {
              const firstContact = contacts?.[0];

              if (firstContact) {
                onQuickLogInteraction?.(firstContact.id);
              }
            }}
          >
            Registrar interação
          </Button>
        </div>
      ) : (
        <div>
          {recent.map((interaction, index) => {
            const contact = contactMap.get(getContactId(interaction));
            const name = getContactName(contact);
            const type = getInteractionType(interaction);
            const sentiment = String(
              interaction?.sentiment || interaction?.feeling || ""
            ).toLowerCase();

            let sentence = `Você registrou ${type} com ${name}.`;

            if (
              interaction?.value_generated === true ||
              interaction?.valueGenerated === true
            ) {
              sentence = `Você gerou valor em uma conversa com ${name}.`;
            } else if (sentiment === "positivo") {
              sentence = `A conversa com ${name} foi positiva.`;
            }

            return (
              <div
                key={interaction.id || `${getInteractionDate(interaction)}-${index}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "12px minmax(0, 1fr)",
                  gap: 12,
                  position: "relative",
                  paddingBottom: index === recent.length - 1 ? 0 : 17,
                }}
              >
                <div
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: index === 0 ? C.gold : C.light,
                    marginTop: 5,
                    boxShadow:
                      index === 0 ? `0 0 0 5px ${C.gold}18` : "none",
                  }}
                />

                <div>
                  <div
                    style={{
                      color: C.light,
                      fontFamily: fontSans,
                      fontSize: TYPE.micro,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.7,
                      marginBottom: 3,
                    }}
                  >
                    {relativeDate(getInteractionDate(interaction))}
                  </div>

                  <div
                    style={{
                      color: C.text,
                      fontFamily: fontSans,
                      fontSize: TYPE.body,
                      lineHeight: 1.5,
                    }}
                  >
                    {sentence}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function WeeklySummary({ contacts, interactions }) {
  const summary = useMemo(() => {
    const weeklyInteractions = (interactions || []).filter((interaction) =>
      isWithinCurrentWeek(getInteractionDate(interaction))
    );

    const uniquePeople = new Set(
      weeklyInteractions.map(getContactId).filter(Boolean)
    );

    const valueGenerated = weeklyInteractions.filter(
      (interaction) =>
        interaction?.value_generated === true ||
        interaction?.valueGenerated === true
    ).length;

    const pendingActions = (contacts || []).filter((contact) => {
      const action = contact?.next_action || contact?.nextAction;
      const date = contact?.next_action_date || contact?.nextActionDate;

      if (!action && !date) return false;
      if (!date) return true;

      const actionDate = new Date(date);
      actionDate.setHours(23, 59, 59, 999);

      return actionDate <= new Date();
    }).length;

    return {
      interactions: weeklyInteractions.length,
      people: uniquePeople.size,
      valueGenerated,
      pendingActions,
    };
  }, [contacts, interactions]);

  const items = [
    {
      value: summary.interactions,
      label: summary.interactions === 1 ? "interação" : "interações",
    },
    {
      value: summary.people,
      label: summary.people === 1 ? "pessoa cuidada" : "pessoas cuidadas",
    },
    {
      value: summary.valueGenerated,
      label: summary.valueGenerated === 1 ? "gesto de valor" : "gestos de valor",
    },
    {
      value: summary.pendingActions,
      label:
        summary.pendingActions === 1
          ? "próximo passo"
          : "próximos passos",
    },
  ];

  return (
    <Section title="Esta semana">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))",
          gap: 9,
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 11,
              padding: 13,
            }}
          >
            <div
              style={{
                color: C.gold,
                fontFamily: fontSerif,
                fontSize: 25,
                fontWeight: 700,
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                color: C.muted,
                fontFamily: fontSans,
                fontSize: TYPE.caption,
                marginTop: 2,
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function CompactAssessmentCard({
  assessmentCompleted,
  hasAssessmentEvidence,
  onStartAssessment,
}) {
  if (assessmentCompleted || hasAssessmentEvidence) {
    return null;
  }

  return (
    <div
      style={{
        background: C.surfaceSoft,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "13px 15px",
        marginBottom: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            color: C.text,
            fontFamily: fontSans,
            fontWeight: 700,
            fontSize: TYPE.caption,
          }}
        >
          Seu diagnóstico ajuda a personalizar as orientações.
        </div>

        <div
          style={{
            color: C.muted,
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            marginTop: 3,
          }}
        >
          Leva poucos minutos e você pode continuar de onde parou.
        </div>
      </div>

      <Button onClick={onStartAssessment}>Continuar diagnóstico</Button>
    </div>
  );
}

function EmptyNetwork({ firstName, onStartNetwork }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        padding: "48px 32px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 18, opacity: 0.9 }}>✦</div>

      <div
        style={{
          color: C.gold,
          fontFamily: fontSerif,
          fontSize: TYPE.display,
          fontWeight: 700,
          marginBottom: 12,
          lineHeight: 1.2,
        }}
      >
        Sua rede começa aqui{firstName ? `, ${firstName}` : ""}.
      </div>

      <p
        style={{
          margin: "0 auto 26px",
          maxWidth: 340,
          color: C.muted,
          fontFamily: fontSans,
          fontSize: TYPE.body,
          lineHeight: 1.6,
        }}
      >
        Cadastre as primeiras pessoas importantes para começar a receber
        orientações baseadas na sua realidade.
      </p>

      <Button primary onClick={onStartNetwork}>
        Começar minha rede
      </Button>
    </div>
  );
}

const HomeToday = ({
  userId,
  contacts = [],
  interactions = [],
  isPro = false,
  assessmentCompleted,
  firstName,
  onOpenContact,
  onStartAssessment,
  onStartNetwork,
  onQuickLogInteraction,
  openAccessKey,
  stripeCheckoutUrl,
}) => {
  const [alertRows, setAlertRows] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const trackedRef = useRef({});

  const name = getFirstName(firstName);

  /*
   * Evita o falso estado de diagnóstico incompleto para usuários que
   * já possuem dados reais no produto.
   *
   * Assim que o App.jsx passar corretamente assessmentCompleted=true,
   * essa proteção continua funcionando sem alterar o comportamento.
   */
  const hasAssessmentEvidence =
    contacts.length > 0 || interactions.length > 0;

  const effectiveAssessmentCompleted =
    assessmentCompleted === true || hasAssessmentEvidence;

  const loadAlerts = useCallback(async () => {
    if (!userId) {
      setLoadingAlerts(false);
      return;
    }

    setLoadingAlerts(true);
    setLoadError(false);

    const { data, error } = await supabase
      .from("alerts")
      .select("contact_id,status,created_at,metadata")
      .eq("user_id", userId);

    if (error) {
      setLoadError(true);
      setLoadingAlerts(false);
      return;
    }

    setAlertRows(data || []);
    setLoadingAlerts(false);
  }, [userId]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const trackOnce = useCallback(
    (eventType, metadata) => {
      if (!userId || trackedRef.current[eventType]) return;

      trackedRef.current[eventType] = true;

      supabase
        .from("page_events")
        .insert({
          user_id: userId,
          event_type: eventType,
          tab_name: "dash",
          metadata: metadata || null,
        })
        .then(
          () => {},
          () => {}
        );
    },
    [userId]
  );

  const feedbackMap = useMemo(() => {
    if (loadingAlerts || loadError) return {};
    return buildFeedbackMap(alertRows);
  }, [alertRows, loadingAlerts, loadError]);

  const priorities = useMemo(() => {
    return computePriorities(contacts, feedbackMap, todayISO(), interactions);
  }, [contacts, feedbackMap, interactions]);

  // Padrões de rede (Fase 5) — nunca decidem prioridade, só alimentam o
  // card "O que percebi" abaixo. Recalculado só quando contatos/interações
  // mudam, mesma disciplina do computePriorities acima.
  const networkPatterns = useMemo(() => {
    return detectPatterns(contacts, interactions, new Date());
  }, [contacts, interactions]);

  // Não repete um padrão que o usuário já respondeu ("faz sentido" ou "não
  // faz sentido") nos últimos 14 dias — mesmo espírito de supressão do
  // priorityEngine, só que mais simples porque aqui não há escalonamento
  // por repetição (padrão de rede é bem mais raro que recomendação de
  // contato). alerts.contact_id fica null pra esse tipo de linha — não é
  // sobre uma pessoa específica.
  const topPattern = useMemo(() => {
    const suppressedTypes = new Set(
      alertRows
        .filter((row) => {
          if (row.contact_id !== null) return false;
          const type = row.metadata?.patternType;
          if (!type) return false;
          const ageDays = (Date.now() - new Date(row.created_at).getTime()) / 86400000;
          return ageDays <= 14;
        })
        .map((row) => row.metadata.patternType)
    );
    return networkPatterns.find((p) => !suppressedTypes.has(p.type)) || null;
  }, [networkPatterns, alertRows]);

  const mainRecommendation = priorities?.main || null;
  // Até 3 cartões, nunca um número fixo — só os que realmente existem hoje.
  // Antes só o `main` aparecia; "às vezes vamos ter mais de 1 por dia".
  const priorityCards = [priorities?.main, ...(priorities?.secondary || [])].filter(Boolean);

  // "Onde fica a inteligência dos dados depois, baseado nas interações?" —
  // cada cartão agora mostra um resumo real do histórico com essa pessoa,
  // não só a recomendação isolada.
  const historyLabelFor = useCallback((contactId) => {
    const withThisContact = (interactions || []).filter(i => getContactId(i) === contactId);
    if (withThisContact.length === 0) return "Nenhuma interação registrada ainda.";
    const last = withThisContact
      .map(i => getInteractionDate(i))
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0];
    const count = withThisContact.length;
    const countLabel = count === 1 ? "1 interação registrada" : `${count} interações registradas`;
    return last ? `${countLabel} · a última foi ${relativeDate(last).toLowerCase()}` : countLabel;
  }, [interactions]);

  useEffect(() => {
    if (loadingAlerts) return;

    if (mainRecommendation) {
      trackOnce("first_recommendation_viewed", {
        actionType: mainRecommendation.actionType,
      });
    }

    if (
      effectiveAssessmentCompleted &&
      contacts.length > 0 &&
      interactions.length > 0
    ) {
      trackOnce("activation_completed");
    }
  }, [
    contacts.length,
    effectiveAssessmentCompleted,
    interactions.length,
    loadingAlerts,
    mainRecommendation,
    trackOnce,
  ]);

  const withGuard = (action, callback) => async () => {
    if (busyId) return { error: null };

    setBusyId(action.recommendationId);

    try {
      const result = (await callback()) || {};
      // A confirmação (✓ dentro do PriorityCard) já aparece na hora — é a
      // escrita real que acabou de resolver. O que atrasamos aqui é só o
      // *recarregamento* dos dados reais, porque ele recalcula
      // mainRecommendation e faria o cartão sumir no meio da confirmação
      // (antes da pessoa conseguir ler "Anotado"). 1.6s dá tempo do toast
      // aparecer. O guard (busyId) continua travado até lá, pra não deixar
      // clicar de novo numa recomendação que já foi resolvida.
      if (!result.error) {
        setTimeout(() => { setBusyId(null); loadAlerts(); }, 1600);
      } else {
        setBusyId(null);
        await loadAlerts();
      }
      return result;
    } catch (e) {
      setBusyId(null);
      throw e;
    }
  };

  const insertAlert = async (action, status, metadata) => {
    const { error } = await supabase.from("alerts").insert({
      user_id: userId,
      contact_id: action.relationshipId,
      title: action.title,
      description: action.reason,
      status,
      metadata: metadata || {},
    });

    supabase
      .from("page_events")
      .insert({
        user_id: userId,
        event_type: `suggestion_${status}`,
        tab_name: "dash",
        metadata: {
          actionType: action.actionType,
        },
      })
      .then(
        () => {},
        () => {}
      );

    return { error };
  };

  const handlePatternFeedback = async (pattern, answer) => {
    const status = answer === "makes_sense" ? "accepted" : "dismissed";

    await supabase.from("alerts").insert({
      user_id: userId,
      contact_id: null,
      title: PATTERN_NOTES[pattern.type],
      description: evidenceLabel(pattern),
      status,
      metadata: { patternType: pattern.type, origin: "network_insight" },
    });

    supabase
      .from("page_events")
      .insert({
        user_id: userId,
        event_type: `network_insight_${status}`,
        tab_name: "dash",
        metadata: { patternType: pattern.type },
      })
      .then(
        () => {},
        () => {}
      );

    await loadAlerts();
  };

  const handleAccept = (action) =>
    withGuard(action, async () => {
      const result = await insertAlert(action, "accepted", {
        recommendationId: action.recommendationId,
        actionType: action.actionType,
        origin: "home",
      });

      if (!result.error) {
        onOpenContact?.(action.relationshipId);
      }

      return result;
    })();

  const handleDismiss = (action) =>
    withGuard(action, async () => {
      const previousDismissals = alertRows.filter(
        (row) =>
          row.contact_id === action.relationshipId &&
          row.status === "dismissed"
      ).length;

      const days = nextDismissSuppressionDays(previousDismissals);
      const suppressUntil = addDays(new Date(), days).toISOString();

      return insertAlert(action, "dismissed", {
        recommendationId: action.recommendationId,
        actionType: action.actionType,
        origin: "home",
        suppressUntil,
      });
    })();

  const handleLogRecent = (action, dateISO, note) =>
    withGuard(action, async () => {
      const selectedDate = new Date(`${dateISO}T12:00:00`).toISOString();
      const trimmedNote = (note || "").trim();

      const { error: interactionError } = await supabase
        .from("interactions")
        .insert({
          user_id: userId,
          contact_id: action.relationshipId,
          type: "mensagem",
          // Antes disso era sempre um texto genérico fixo, mesmo quando a
          // pessoa contava o que realmente aconteceu — a nota digitada
          // agora vira o registro de verdade, não só uma data confirmada.
          description: trimmedNote || 'Conversa recente confirmada a partir de uma recomendação em "Hoje".',
          sentiment: "positivo",
          tags: [],
          value_generated: false,
          created_at: selectedDate,
        });

      if (interactionError) {
        return { error: interactionError };
      }

      const { error: contactError } = await supabase
        .from("contacts")
        .update({
          last_interaction_at: selectedDate,
          next_action: null,
          next_action_date: null,
        })
        .eq("id", action.relationshipId)
        .eq("user_id", userId);

      if (contactError) {
        return { error: contactError };
      }

      return insertAlert(action, "logged", {
        recommendationId: action.recommendationId,
        actionType: action.actionType,
        origin: "home",
        chosenDate: dateISO,
      });
    })();

  const handleSnooze = (action, dateISO) =>
    withGuard(action, async () => {
      const suppressUntil = new Date(`${dateISO}T00:00:00`).toISOString();

      return insertAlert(action, "snoozed", {
        recommendationId: action.recommendationId,
        actionType: action.actionType,
        origin: "home",
        suppressUntil,
      });
    })();

  if (!effectiveAssessmentCompleted && contacts.length === 0) {
    return (
      <div>
        <header style={{ marginBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              color: C.text,
              fontFamily: fontSerif,
              fontSize: TYPE.display,
              fontWeight: 700,
            }}
          >
            Bom ver você{name ? `, ${name}` : ""}.
          </h1>
        </header>

        <CompactAssessmentCard
          assessmentCompleted={assessmentCompleted}
          hasAssessmentEvidence={hasAssessmentEvidence}
          onStartAssessment={onStartAssessment}
        />

        <EmptyNetwork
          firstName={name}
          onStartNetwork={onStartNetwork}
        />
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div>
        <header style={{ marginBottom: 18 }}>
          <h1
            style={{
              margin: 0,
              color: C.text,
              fontFamily: fontSerif,
              fontSize: TYPE.display,
              fontWeight: 700,
            }}
          >
            Bom ver você{name ? `, ${name}` : ""}.
          </h1>
        </header>

        <EmptyNetwork
          firstName={name}
          onStartNetwork={onStartNetwork}
        />
      </div>
    );
  }

  return (
    <div>
      <style>{"@keyframes conexiaPulse{0%,100%{opacity:.55}50%{opacity:1}}"}</style>
      <header
        style={{
          marginBottom: 19,
        }}
      >
        <h1
          style={{
            margin: 0,
            color: C.text,
            fontFamily: fontSerif,
            fontSize: TYPE.display,
            fontWeight: 700,
          }}
        >
          Bom ver você{name ? `, ${name}` : ""}.
        </h1>

        <div
          style={{
            color: C.muted,
            fontFamily: fontSans,
            fontSize: TYPE.caption,
            marginTop: 4,
          }}
        >
          Vamos olhar com calma para o que está acontecendo na sua rede.
        </div>
      </header>

      <CompactAssessmentCard
        assessmentCompleted={assessmentCompleted}
        hasAssessmentEvidence={hasAssessmentEvidence}
        onStartAssessment={onStartAssessment}
      />

      {!isPro ? (
        <HomeProLock openAccessKey={openAccessKey} stripeCheckoutUrl={stripeCheckoutUrl} />
      ) : (
      <>
      {!loadingAlerts && topPattern && (
        <NetworkInsightCard
          pattern={topPattern}
          busy={!!busyId}
          onFeedback={handlePatternFeedback}
        />
      )}

      <Section title="Para hoje" variant="action">
        {loadError && (
          <div
            style={{
              color: C.error,
              fontFamily: fontSans,
              fontSize: TYPE.caption,
              marginBottom: 10,
            }}
          >
            Não consegui carregar suas respostas anteriores agora.
          </div>
        )}

        {loadingAlerts ? (
          <div
            style={{
              height: 90,
              borderRadius: 10,
              background: C.surface,
              animation: "conexiaPulse 1.4s ease-in-out infinite",  // pulsação contínua, fora da escala fast/base/slow (não é reação a evento)
            }}
          />
        ) : priorityCards.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {priorityCards.map((card) => (
              <PriorityCard
                key={card.recommendationId}
                action={card}
                busy={busyId === card.recommendationId}
                historyLabel={historyLabelFor(card.relationshipId)}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                onLogRecent={handleLogRecent}
                onSnooze={handleSnooze}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "34px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 10, opacity: 0.85 }}>☾</div>

            <div
              style={{
                color: C.text,
                fontFamily: fontSerif,
                fontSize: TYPE.title,
                fontWeight: 700,
              }}
            >
              Hoje sua rede parece tranquila.
            </div>

            <div
              style={{
                color: C.muted,
                fontFamily: fontSans,
                fontSize: TYPE.body,
                marginTop: 7,
              }}
            >
              Nada precisa virar uma obrigação agora.
            </div>
          </div>
        )}
      </Section>

      <NetworkMovement
        contacts={contacts}
        interactions={interactions}
        onQuickLogInteraction={onQuickLogInteraction}
      />

      <WeeklySummary
        contacts={contacts}
        interactions={interactions}
      />

      <Section title="Sua rede">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 15,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                color: C.gold,
                fontFamily: fontSerif,
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {contacts.length}
            </div>

            <div
              style={{
                color: C.muted,
                fontFamily: fontSans,
                fontSize: TYPE.caption,
              }}
            >
              {contacts.length === 1
                ? "pessoa sendo cuidada"
                : "pessoas sendo cuidadas"}
            </div>
          </div>

          <Button onClick={onStartNetwork}>Adicionar pessoa</Button>
        </div>
      </Section>
      </>
      )}
    </div>
  );
};

export default HomeToday;
