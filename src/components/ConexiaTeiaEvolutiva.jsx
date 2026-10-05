import React, { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../utils/theme";
import {
  computePriorities,
  relationshipMomentum,
} from "../../shared/priorityEngine.js";
import {
  detectPatterns,
  PATTERN_NOTES,
} from "../../shared/relationshipPatternDetector.js";
import iconeDark from "../assets/brand/conexia_icone_fundo-escuro.svg";

const TAU = Math.PI * 2;

function relevance(contact) {
  const values = [
    contact?.influenciaPessoas ?? contact?.influencia_pessoas,
    contact?.geraOportunidade ?? contact?.gera_oportunidade,
    contact?.abrePortas ?? contact?.abre_portas,
    contact?.momentoAtual ?? contact?.momento_atual,
  ]
    .map(Number)
    .filter(Number.isFinite);

  if (!values.length) return null;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return Math.max(
    0,
    Math.min(100, avg > 10 ? avg : avg * 10)
  );
}

function statusFor(contact) {
  const r = relevance(contact);
  const h = Number(contact?.health);

  if (!Number.isFinite(r)) {
    return {
      label: "Dados incompletos",
      color: "#5B9BD5",
    };
  }

  if (h >= 65 && r >= 65) {
    return {
      label: "Presente e importante",
      color: "#4caf50",
    };
  }

  if (h < 45 && r >= 55) {
    return {
      label: "Talvez mereça atenção",
      color: "#E8A020",
    };
  }

  if (h >= 45 && r < 65) {
    return {
      label: "Relação tranquila",
      color: "#ff9800",
    };
  }

  return {
    label: "Sem prioridade agora",
    color: "#6a6460",
  };
}

function safeText(value, max = 17) {
  const text = String(value || "");

  return text.length > max
    ? `${text.slice(0, max - 1)}…`
    : text;
}

function formatDate(value) {
  if (!value) return "—";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function firstValue(...values) {
  return values.find(
    value =>
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
  );
}

function contactInteractions(contactId, interactions) {
  return interactions
    .filter(
      interaction =>
        (interaction.contactId ??
          interaction.contact_id) === contactId
    )
    .sort(
      (a, b) =>
        new Date(
          b.createdAt ??
            b.created_at ??
            0
        ) -
        new Date(
          a.createdAt ??
            a.created_at ??
            0
        )
    );
}

function InfoRow({ label, value }) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "92px minmax(0,1fr)",
        gap: 8,
        padding: "7px 0",
        borderBottom: `1px solid ${C.brd}`,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Sans'",
          fontSize: 9,
          color: C.txL,
          textTransform: "uppercase",
          letterSpacing: ".05em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily: "'DM Sans'",
          fontSize: 11.5,
          color: C.txt,
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
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
    const contactsSignature = contacts
      .map(contact =>
        [
          contact.id,
          contact.health,
          contact.lastInteraction,
          contact.last_interaction_at,
          contact.nextAction,
          contact.next_action,
        ].join(":")
      )
      .join("|");

    const interactionsSignature = interactions
      .slice(0, 80)
      .map(interaction =>
        [
          interaction.id,
          interaction.contactId,
          interaction.contact_id,
          interaction.createdAt,
          interaction.created_at,
        ].join(":")
      )
      .join("|");

    return `${contactsSignature}::${interactionsSignature}`;
  }, [contacts, interactions]);

  useEffect(() => {
    if (
      lastSignature.current &&
      lastSignature.current !== signature
    ) {
      setPhase(value => value + Math.PI / 8);
    }

    lastSignature.current = signature;
  }, [signature]);

  /*
   * MOVIMENTO DA TEIA
   */
  useEffect(() => {
    if (!motion) return undefined;

    let animationFrame;
    let last = performance.now();

    const tick = now => {
      const delta = Math.min(40, now - last);

      last = now;

      setPhase(
        value =>
          value +
          delta * 0.000055
      );

      animationFrame =
        requestAnimationFrame(tick);
    };

    animationFrame =
      requestAnimationFrame(tick);

    return () =>
      cancelAnimationFrame(
        animationFrame
      );
  }, [motion]);

  const priorities = useMemo(
    () =>
      computePriorities(
        contacts,
        {},
        new Date(),
        interactions
      ),
    [contacts, interactions]
  );

  const priorityIds = useMemo(
    () =>
      new Set(
        [
          priorities?.main,
          ...(priorities?.secondary || []),
        ]
          .filter(Boolean)
          .map(
            item =>
              item.relationshipId
          )
      ),
    [priorities]
  );

  const insight = useMemo(
    () =>
      detectPatterns(
        contacts,
        interactions,
        new Date()
      )[0] || null,
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
      contacts.filter(contact => {
        const status =
          statusFor(contact).label;

        if (filter === "todos") {
          return true;
        }

        if (
          filter === "prioridade"
        ) {
          return (
            priorityIds.has(
              contact.id
            ) ||
            status ===
              "Talvez mereça atenção"
          );
        }

        if (filter === "fortes") {
          return (
            status ===
            "Presente e importante"
          );
        }

        if (
          filter === "sem_acao"
        ) {
          return !(
            contact.nextAction ??
            contact.next_action
          );
        }

        return true;
      }),
    [
      contacts,
      filter,
      priorityIds,
    ]
  );

  /*
   * TAMANHO DO MAPA
   */
  const WIDTH = 760;
  const HEIGHT = 650;

  const CX = WIDTH / 2;
  const CY = HEIGHT / 2;

  const MAX_RADIUS = 270;

  /*
   * POSICIONAMENTO EM ESPIRAL
   */
  const nodes = useMemo(() => {
    const total = Math.max(
      1,
      filtered.length
    );

    return filtered.map(
      (contact, index) => {
        const its =
          contactInteractions(
            contact.id,
            interactions
          );

        const count = its.length;

        const health = Math.max(
          0,
          Math.min(
            100,
            Number(
              contact.health
            ) ||
              Math.min(
                100,
                35 +
                  count * 4
              )
          )
        );

        const rel =
          relevance(contact);

        const st =
          statusFor(contact);

        const momentum =
          relationshipMomentum(
            contact,
            interactions,
            new Date()
          );

        const progress =
          total <= 1
            ? 0
            : index /
              (total - 1);

        const baseRadius =
          70 +
          Math.sqrt(
            progress
          ) *
            (MAX_RADIUS -
              70);

        const healthPull =
          (health / 100) *
          24;

        const radius =
          Math.max(
            60,
            baseRadius -
              healthPull
          );

        /*
         * Golden angle:
         * espalha os contatos sem
         * empilhá-los.
         */
        const goldenAngle =
          Math.PI *
          (3 -
            Math.sqrt(5));

        /*
         * Metade gira em um sentido,
         * metade no outro.
         *
         * Isso cria a sensação de
         * Teia viva / espiral.
         */
        const direction =
          index % 2 === 0
            ? 1
            : -1;

        const orbitSpeed =
          0.72 +
          (index % 7) *
            0.025;

        const angle =
          -Math.PI / 2 +
          index *
            goldenAngle +
          phase *
            orbitSpeed *
            direction;

        const x =
          CX +
          radius *
            Math.cos(angle);

        const y =
          CY +
          radius *
            Math.sin(angle);

        const labelRadius =
          radius + 23;

        const lx =
          CX +
          labelRadius *
            Math.cos(angle);

        const ly =
          CY +
          labelRadius *
            Math.sin(angle);

        const size =
          Math.max(
            7,
            Math.min(
              19,
              7 +
                Math.sqrt(
                  Math.max(
                    1,
                    count
                  )
                ) *
                  2
            )
          );

        return {
          c: contact,
          interactions: its,
          count,
          health,
          rel,
          st,
          momentum,
          angle,
          radius,
          x,
          y,
          lx,
          ly,
          size,
        };
      }
    );
  }, [
    filtered,
    interactions,
    phase,
  ]);

  const selected =
    nodes.find(
      node =>
        node.c.id ===
        selectedId
    ) || null;

  useEffect(() => {
    if (
      selectedId &&
      !filtered.some(
        contact =>
          contact.id ===
          selectedId
      )
    ) {
      setSelectedId(null);
    }
  }, [
    filtered,
    selectedId,
  ]);

  const avg =
    filtered.length
      ? Math.round(
          filtered.reduce(
            (
              sum,
              contact
            ) =>
              sum +
              (Number(
                contact.health
              ) ||
                0),
            0
          ) /
            filtered.length
        )
      : 0;

  const momentumLabel = {
    strengthening:
      "Fortalecendo",
    stable: "Estável",
    cooling: "Esfriando",
    reactivated:
      "Reativada",
    new: "Nova",
    insufficient_data:
      "Sem leitura ainda",
  };

  /*
   * LINHAS DA TEIA ENTRE PESSOAS
   */
  const webLinks =
    useMemo(() => {
      if (
        nodes.length < 2
      ) {
        return [];
      }

      const links = [];

      nodes.forEach(
        (node, index) => {
          const next =
            nodes[
              (index + 1) %
                nodes.length
            ];

          if (next) {
            links.push({
              key: `a-${node.c.id}-${next.c.id}`,
              a: node,
              b: next,
              opacity: 0.11,
            });
          }

          if (
            nodes.length > 6
          ) {
            const second =
              nodes[
                (index + 4) %
                  nodes.length
              ];

            if (second) {
              links.push({
                key: `b-${node.c.id}-${second.c.id}`,
                a: node,
                b: second,
                opacity:
                  0.055,
              });
            }
          }
        }
      );

      return links;
    }, [nodes]);

  if (
    contacts.length < 2
  ) {
    return (
      <div
        style={{
          background:
            C.card,
          border: `1px solid ${C.brd}`,
          borderRadius: 14,
          padding: 36,
          textAlign:
            "center",
        }}
      >
        <div
          style={{
            fontSize: 30,
            marginBottom: 10,
          }}
        >
          ⊛
        </div>

        <div
          style={{
            fontFamily:
              "'DM Sans'",
            color: C.txt,
            fontWeight: 700,
          }}
        >
          Cadastre mais pessoas para formar sua Teia
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* CABEÇALHO */}

      <div
        style={{
          display: "flex",
          alignItems:
            "flex-start",
          justifyContent:
            "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontFamily:
                "'DM Sans'",
              fontSize: 10,
              fontWeight: 800,
              color: C.gold,
              letterSpacing:
                ".12em",
              textTransform:
                "uppercase",
            }}
          >
            TEIA VIVA
          </div>

          <h2
            style={{
              fontFamily:
                "'Cormorant Garamond',serif",
              fontSize: 26,
              fontWeight: 700,
              color: C.txt,
              margin:
                "3px 0 3px",
            }}
          >
            Sua rede está em movimento
          </h2>

          <div
            style={{
              fontFamily:
                "'DM Sans'",
              fontSize: 11,
              color: C.txL,
            }}
          >
            Pessoas, presença, contexto e movimento em uma única rede.
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setMotion(
              value => !value
            )
          }
          style={{
            background:
              motion
                ? C.gD
                : C.sf,
            border: `1px solid ${
              motion
                ? C.gL
                : C.brd
            }`,
            color:
              motion
                ? C.gold
                : C.txM,
            borderRadius: 999,
            padding:
              "7px 11px",
            fontFamily:
              "'DM Sans'",
            fontSize: 10,
            cursor: "pointer",
            whiteSpace:
              "nowrap",
          }}
        >
          {motion
            ? "● Teia viva"
            : "○ Teia pausada"}
        </button>
      </div>

      {/* INSIGHT */}

      {insight &&
        PATTERN_NOTES[
          insight.type
        ] && (
          <div
            style={{
              background: `${C.gold}0d`,
              border: `1px solid ${C.gL}`,
              borderRadius: 12,
              padding:
                "11px 14px",
              marginBottom: 12,
              fontFamily:
                "'DM Sans'",
              fontSize: 12,
              color: C.txM,
              lineHeight: 1.55,
            }}
          >
            <span
              style={{
                color: C.gold,
                fontWeight: 800,
              }}
            >
              O que percebi:{" "}
            </span>

            {
              PATTERN_NOTES[
                insight.type
              ]
            }
          </div>
        )}

      {/* FILTROS */}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {filters.map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() =>
                setFilter(key)
              }
              style={{
                background:
                  filter === key
                    ? C.gold
                    : C.sf,

                border: `1px solid ${
                  filter ===
                  key
                    ? C.gold
                    : C.brd
                }`,

                color:
                  filter === key
                    ? C.bg
                    : C.txM,

                borderRadius:
                  999,

                padding:
                  "6px 11px",

                fontFamily:
                  "'DM Sans'",

                fontSize:
                  10.5,

                fontWeight:
                  filter === key
                    ? 800
                    : 500,

                cursor:
                  "pointer",
              }}
            >
              {label}
            </button>
          )
        )}
      </div>

      {/* TEIA + PAINEL LATERAL */}

      <div className="conexia-teia-layout">

        {/* TEIA */}

        <div
          style={{
            position:
              "relative",

            background:
              "radial-gradient(circle at 50% 50%, rgba(201,168,76,.10), transparent 35%), #151516",

            border: `1px solid ${C.brd}`,

            borderRadius: 18,

            padding: 5,

            overflow:
              "hidden",

            minHeight: 570,
          }}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 570,
              display: "block",
            }}
          >
            <defs>
              <filter id="teiaGlow">
                <feGaussianBlur
                  stdDeviation="3"
                  result="blur"
                />

                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <radialGradient id="coreGradient">
                <stop
                  offset="0%"
                  stopColor={
                    C.gold
                  }
                  stopOpacity=".24"
                />

                <stop
                  offset="100%"
                  stopColor={
                    C.gold
                  }
                  stopOpacity="0"
                />
              </radialGradient>
            </defs>

            {/* ANÉIS */}

            {[
              0.25,
              0.5,
              0.75,
              1,
            ].map(
              (
                ratio,
                index
              ) => (
                <circle
                  key={
                    ratio
                  }
                  cx={CX}
                  cy={CY}
                  r={
                    MAX_RADIUS *
                    ratio
                  }
                  fill="none"
                  stroke={
                    C.brd
                  }
                  strokeWidth=".7"
                  strokeDasharray={
                    index < 3
                      ? "2 9"
                      : "none"
                  }
                  opacity=".32"
                />
              )
            )}

            {/* ESPIRAL */}

            {nodes.length >
              2 && (
              <path
                d={nodes
                  .map(
                    (
                      node,
                      index
                    ) =>
                      `${
                        index
                          ? "L"
                          : "M"
                      } ${node.x.toFixed(
                        1
                      )} ${node.y.toFixed(
                        1
                      )}`
                  )
                  .join(" ")}
                fill="none"
                stroke={
                  C.gold
                }
                strokeWidth="1"
                strokeOpacity=".13"
              />
            )}

            {/* MALHA ENTRE PESSOAS */}

            {webLinks.map(
              link => (
                <line
                  key={
                    link.key
                  }
                  x1={
                    link.a.x
                  }
                  y1={
                    link.a.y
                  }
                  x2={
                    link.b.x
                  }
                  y2={
                    link.b.y
                  }
                  stroke={
                    C.gold
                  }
                  strokeWidth=".7"
                  opacity={
                    link.opacity
                  }
                />
              )
            )}

            {/* CONEXÕES AO CONÉXIA */}

            {nodes.map(
              node => (
                <line
                  key={`core-${node.c.id}`}
                  x1={CX}
                  y1={CY}
                  x2={
                    node.x
                  }
                  y2={
                    node.y
                  }
                  stroke={
                    node.st
                      .color
                  }
                  strokeWidth={Math.max(
                    0.5,
                    Math.min(
                      2.7,
                      node.count *
                        0.09 +
                        0.5
                    )
                  )}
                  opacity={
                    priorityIds.has(
                      node.c.id
                    )
                      ? 0.28
                      : 0.09
                  }
                />
              )
            )}

            {/* NÚCLEO */}

            <circle
              cx={CX}
              cy={CY}
              r="70"
              fill="url(#coreGradient)"
            />

            <circle
              cx={CX}
              cy={CY}
              r="43"
              fill={`${C.gold}08`}
              stroke={`${C.gold}30`}
              strokeWidth="1"
            />

            <circle
              cx={CX}
              cy={CY}
              r="33"
              fill={C.bg}
              stroke={C.gold}
              strokeWidth="1.4"
              filter="url(#teiaGlow)"
            />

            <image
              href={
                iconeDark
              }
              x={CX - 23}
              y={CY - 23}
              width="46"
              height="46"
              preserveAspectRatio="xMidYMid meet"
            />

            {/* CONTATOS */}

            {nodes.map(
              node => {
                const selectedNow =
                  selectedId ===
                  node.c.id;

                const priority =
                  priorityIds.has(
                    node.c.id
                  );

                return (
                  <g
                    key={
                      node.c.id
                    }
                    onClick={() =>
                      setSelectedId(
                        selectedNow
                          ? null
                          : node.c.id
                      )
                    }
                    style={{
                      cursor:
                        "pointer",
                    }}
                  >
                    {priority && (
                      <circle
                        cx={
                          node.x
                        }
                        cy={
                          node.y
                        }
                        r={
                          node.size +
                          7
                        }
                        fill="none"
                        stroke={
                          C.gold
                        }
                        strokeWidth="1"
                        strokeDasharray="2 4"
                        opacity=".85"
                      />
                    )}

                    {selectedNow && (
                      <circle
                        cx={
                          node.x
                        }
                        cy={
                          node.y
                        }
                        r={
                          node.size +
                          13
                        }
                        fill={
                          node.st
                            .color
                        }
                        opacity=".15"
                        filter="url(#teiaGlow)"
                      />
                    )}

                    <circle
                      cx={
                        node.x
                      }
                      cy={
                        node.y
                      }
                      r={
                        node.size
                      }
                      fill={`${node.st.color}22`}
                      stroke={
                        node.st
                          .color
                      }
                      strokeWidth={
                        selectedNow
                          ? 2.8
                          : 1.3
                      }
                    />

                    <circle
                      cx={
                        node.x
                      }
                      cy={
                        node.y
                      }
                      r="2.8"
                      fill={
                        node.st
                          .color
                      }
                    />

                    <text
                      x={
                        node.lx
                      }
                      y={
                        node.ly
                      }
                      textAnchor={
                        Math.cos(
                          node.angle
                        ) < 0
                          ? "end"
                          : "start"
                      }
                      dominantBaseline="middle"
                      fill={
                        selectedNow
                          ? node.st
                              .color
                          : C.txM
                      }
                      fontSize={
                        selectedNow
                          ? 11
                          : 9.5
                      }
                      fontWeight={
                        selectedNow
                          ? 800
                          : 500
                      }
                      fontFamily="'DM Sans'"
                    >
                      {safeText(
                        node.c
                          .name,
                        18
                      )}
                    </text>
                  </g>
                );
              }
            )}
          </svg>
        </div>

        {/* PAINEL LATERAL */}

        <div
          style={{
            background:
              C.card,

            border: `1px solid ${C.brd}`,

            borderRadius:
              16,

            padding: 16,

            minWidth: 0,

            overflow:
              "hidden",
          }}
        >
          {selected ? (
            <>
              <div
                style={{
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 9,
                  fontWeight:
                    800,
                  color:
                    C.gold,
                  letterSpacing:
                    ".1em",
                  textTransform:
                    "uppercase",
                  marginBottom:
                    5,
                }}
              >
                PESSOA NA SUA REDE
              </div>

              <div
                style={{
                  fontFamily:
                    "'Cormorant Garamond',serif",
                  fontSize: 25,
                  lineHeight:
                    1.05,
                  fontWeight:
                    700,
                  color: C.txt,
                }}
              >
                {
                  selected.c
                    .name
                }
              </div>

              <div
                style={{
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 11,
                  color:
                    C.txL,
                  marginTop: 5,
                  lineHeight:
                    1.45,
                }}
              >
                {[
                  selected.c
                    .role,
                  selected.c
                    .company,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " · "
                  )}
              </div>

              {/* STATUS */}

              <div
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap: 6,
                  marginTop: 10,
                  padding:
                    "5px 8px",
                  borderRadius:
                    999,
                  background: `${selected.st.color}12`,
                  border: `1px solid ${selected.st.color}40`,
                  color:
                    selected.st
                      .color,
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 9.5,
                  fontWeight:
                    700,
                }}
              >
                <span>●</span>

                {
                  selected.st
                    .label
                }
              </div>

              {/* MÉTRICAS */}

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(3,minmax(0,1fr))",
                  gap: 7,
                  marginTop: 14,
                }}
              >
                {[
                  [
                    "Presença",
                    `${selected.health}%`,
                  ],
                  [
                    "Interações",
                    selected.count,
                  ],
                  [
                    "Movimento",
                    momentumLabel[
                      selected
                        .momentum
                    ] || "—",
                  ],
                ].map(
                  ([
                    label,
                    value,
                  ]) => (
                    <div
                      key={
                        label
                      }
                      style={{
                        background:
                          C.sf,
                        border: `1px solid ${C.brd}`,
                        borderRadius:
                          9,
                        padding:
                          "9px 7px",
                        minWidth:
                          0,
                      }}
                    >
                      <div
                        style={{
                          fontFamily:
                            "'DM Sans'",
                          fontSize:
                            7.5,
                          color:
                            C.txL,
                          textTransform:
                            "uppercase",
                        }}
                      >
                        {
                          label
                        }
                      </div>

                      <div
                        style={{
                          fontFamily:
                            "'DM Sans'",
                          fontSize:
                            11,
                          fontWeight:
                            700,
                          color:
                            C.txt,
                          marginTop:
                            4,
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                        }}
                      >
                        {
                          value
                        }
                      </div>
                    </div>
                  )
                )}
              </div>

              {/* CONTEXTO */}

              <div
                style={{
                  marginTop: 15,
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 9,
                  fontWeight:
                    800,
                  color: C.txL,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                CONTEXTO
              </div>

              <div
                style={{
                  marginTop: 5,
                }}
              >
                <InfoRow
                  label="Empresa"
                  value={
                    selected.c
                      .company
                  }
                />

                <InfoRow
                  label="Cargo"
                  value={
                    selected.c
                      .role
                  }
                />

                <InfoRow
                  label="Categoria"
                  value={
                    selected.c
                      .category
                  }
                />

                <InfoRow
                  label="Cidade"
                  value={[
                    selected.c
                      .city,
                    selected.c
                      .state_code,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      " · "
                    )}
                />

                <InfoRow
                  label="Cultura"
                  value={
                    selected.c
                      .main_culture
                  }
                />

                <InfoRow
                  label="WhatsApp"
                  value={firstValue(
                    selected.c
                      .whatsapp,
                    selected.c
                      .phone,
                    selected.c
                      .telephone
                  )}
                />

                <InfoRow
                  label="E-mail"
                  value={firstValue(
                    selected.c
                      .contact_email,
                    selected.c
                      .email
                  )}
                />

                <InfoRow
                  label="LinkedIn"
                  value={
                    selected.c
                      .linkedin
                  }
                />
              </div>

              {/* RELACIONAMENTO */}

              <div
                style={{
                  marginTop: 15,
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 9,
                  fontWeight:
                    800,
                  color: C.txL,
                  letterSpacing:
                    ".08em",
                  textTransform:
                    "uppercase",
                }}
              >
                RELACIONAMENTO
              </div>

              <div
                style={{
                  marginTop: 5,
                }}
              >
                <InfoRow
                  label="Última"
                  value={formatDate(
                    firstValue(
                      selected.c
                        .last_interaction_at,

                      selected.c
                        .lastInteraction,

                      selected
                        .interactions?.[
                        0
                      ]
                        ?.created_at,

                      selected
                        .interactions?.[
                        0
                      ]
                        ?.createdAt
                    )
                  )}
                />

                <InfoRow
                  label="Próxima ação"
                  value={firstValue(
                    selected.c
                      .next_action,

                    selected.c
                      .nextAction,

                    "Nenhuma definida"
                  )}
                />

                <InfoRow
                  label="Quando"
                  value={
                    selected.c
                      .next_action_date
                      ? formatDate(
                          selected
                            .c
                            .next_action_date
                        )
                      : null
                  }
                />

                <InfoRow
                  label="Notas"
                  value={firstValue(
                    selected.c
                      .personal_notes,

                    selected.c
                      .notes
                  )}
                />
              </div>

              {/* ÚLTIMAS INTERAÇÕES */}

              {selected
                .interactions
                ?.length >
                0 && (
                <>
                  <div
                    style={{
                      marginTop:
                        15,
                      fontFamily:
                        "'DM Sans'",
                      fontSize:
                        9,
                      fontWeight:
                        800,
                      color:
                        C.txL,
                      letterSpacing:
                        ".08em",
                      textTransform:
                        "uppercase",
                    }}
                  >
                    ÚLTIMAS INTERAÇÕES
                  </div>

                  <div
                    style={{
                      marginTop:
                        7,
                      display:
                        "grid",
                      gap: 6,
                    }}
                  >
                    {selected.interactions
                      .slice(
                        0,
                        3
                      )
                      .map(
                        interaction => (
                          <div
                            key={
                              interaction.id
                            }
                            style={{
                              background:
                                C.sf,

                              border: `1px solid ${C.brd}`,

                              borderRadius:
                                9,

                              padding:
                                9,
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",

                                justifyContent:
                                  "space-between",

                                gap: 8,
                              }}
                            >
                              <span
                                style={{
                                  fontFamily:
                                    "'DM Sans'",

                                  fontSize:
                                    9,

                                  fontWeight:
                                    700,

                                  color:
                                    C.gold,
                                }}
                              >
                                {interaction.type ||
                                  "Interação"}
                              </span>

                              <span
                                style={{
                                  fontFamily:
                                    "'DM Sans'",

                                  fontSize:
                                    8,

                                  color:
                                    C.txL,

                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {formatDate(
                                  interaction.created_at ??
                                    interaction.createdAt
                                )}
                              </span>
                            </div>

                            {interaction.description && (
                              <div
                                style={{
                                  fontFamily:
                                    "'DM Sans'",

                                  fontSize:
                                    10,

                                  color:
                                    C.txM,

                                  lineHeight:
                                    1.4,

                                  marginTop:
                                    5,
                                }}
                              >
                                {
                                  interaction.description
                                }
                              </div>
                            )}
                          </div>
                        )
                      )}
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() =>
                  onOpenContact?.(
                    selected.c
                      .id
                  )
                }
                style={{
                  marginTop: 15,
                  width: "100%",
                  background:
                    C.gold,
                  border: "none",
                  color: C.bg,
                  borderRadius:
                    10,
                  padding:
                    "11px 12px",
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 12,
                  fontWeight:
                    800,
                  cursor:
                    "pointer",
                }}
              >
                Abrir relação completa →
              </button>

              {!isPro && (
                <div
                  style={{
                    marginTop: 9,
                    fontFamily:
                      "'DM Sans'",
                    fontSize: 10,
                    color: C.txL,
                  }}
                >
                  A Teia completa faz parte do PRO.
                </div>
              )}
            </>
          ) : (
            <>
              {/* PAINEL SEM PESSOA SELECIONADA */}

              <div
                style={{
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 9,
                  fontWeight:
                    800,
                  color: C.gold,
                  letterSpacing:
                    ".1em",
                  textTransform:
                    "uppercase",
                }}
              >
                LEITURA DA REDE
              </div>

              <div
                style={{
                  fontFamily:
                    "'Cormorant Garamond',serif",
                  fontSize: 23,
                  fontWeight:
                    700,
                  color: C.txt,
                  marginTop: 4,
                }}
              >
                {
                  filtered.length
                }{" "}
                pessoas conectadas
              </div>

              <div
                style={{
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 11,
                  color: C.txL,
                  marginTop: 3,
                  lineHeight: 1.5,
                }}
              >
                A posição muda conforme a relação evolui. Clique em qualquer pessoa da Teia para abrir o contexto ao lado.
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "baseline",
                  gap: 6,
                  marginTop: 18,
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "'JetBrains Mono'",
                    fontSize: 31,
                    fontWeight:
                      700,
                    color:
                      avg >= 70
                        ? C.grn
                        : avg >=
                          40
                        ? C.amb
                        : C.cor,
                  }}
                >
                  {avg}%
                </span>

                <span
                  style={{
                    fontFamily:
                      "'DM Sans'",
                    fontSize: 10,
                    color: C.txL,
                  }}
                >
                  presença média
                </span>
              </div>

              {priorities?.main && (
                <div
                  style={{
                    marginTop: 14,
                    padding:
                      "11px 12px",
                    background: `${C.gold}08`,
                    border: `1px solid ${C.gL}`,
                    borderRadius:
                      10,
                    fontFamily:
                      "'DM Sans'",
                    fontSize:
                      11.5,
                    color: C.txM,
                    lineHeight:
                      1.5,
                  }}
                >
                  <span
                    style={{
                      color:
                        C.gold,
                      fontWeight:
                        800,
                    }}
                  >
                    Agora:{" "}
                  </span>

                  {
                    priorities
                      .main
                      .title
                  }
                </div>
              )}

              <div
                style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: `1px solid ${C.brd}`,
                  fontFamily:
                    "'DM Sans'",
                  fontSize: 10.5,
                  color: C.txL,
                  lineHeight: 1.6,
                }}
              >
                <strong
                  style={{
                    color: C.txt,
                  }}
                >
                  Como ler a Teia
                </strong>

                <div
                  style={{
                    marginTop: 7,
                  }}
                >
                  • O CONÉXIA permanece no centro.
                </div>

                <div>
                  • As relações orbitam continuamente.
                </div>

                <div>
                  • Mais interações aumentam a presença visual.
                </div>

                <div>
                  • As linhas formam a malha da sua rede.
                </div>

                <div>
                  • Profissional, Pessoal e Legendário organizam a rede sem substituir a Teia.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* RESPONSIVIDADE JÁ INCLUÍDA */}

      <style>{`
        .conexia-teia-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.75fr) minmax(280px, .75fr);
          gap: 12px;
          align-items: stretch;
        }

        @media (max-width: 900px) {
          .conexia-teia-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 600px) {
          .conexia-teia-layout svg {
            min-height: 440px !important;
          }
        }
      `}</style>
    </div>
  );
}
