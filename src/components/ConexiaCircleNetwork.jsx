import React, { useMemo, useState } from "react";
import { C } from "../utils/theme";
import ConexiaTeiaEvolutiva from "./ConexiaTeiaEvolutiva";
import {
  UNASSIGNED,
  circlePath,
  descendantIds,
} from "../../shared/networkCircles.js";

/*
 * CONÉXIA — REDE HÍBRIDA
 *
 * PRINCÍPIO:
 * 1. A Teia é a visualização principal.
 * 2. Na visão inicial TODOS os contatos aparecem juntos.
 * 3. Círculos NÃO substituem a Teia.
 * 4. Profissional / Pessoal / outros círculos funcionam
 *    como filtros expansíveis.
 * 5. Ao entrar em um círculo, a própria Teia mostra
 *    apenas aquele universo.
 * 6. Subcírculos podem ser abertos sucessivamente.
 * 7. Não existe paginação.
 * 8. Não existe limite de 6 pessoas.
 * 9. "A organizar" não vira um círculo visual principal.
 */

const normalize = value =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function shortName(value, max = 28) {
  const text = String(value || "");
  return text.length > max
    ? `${text.slice(0, max - 1)}…`
    : text;
}

export default function ConexiaCircleNetwork({
  contacts = [],
  interactions = [],
  network,
  onOpenContact,
  initialFocus = null,
  onFocusChange,
  isPro = true,
}) {
  const [focus, setFocus] = useState(initialFocus || null);
  const [search, setSearch] = useState("");

  const circles = network?.circles || [];
  const assignments = network?.assignments || {};

  /*
   * Círculo atualmente aberto.
   */
  const currentCircle = useMemo(
    () => circles.find(circle => circle.id === focus) || null,
    [circles, focus]
  );

  /*
   * Círculos de primeiro nível.
   *
   * Ex.:
   * Profissional
   * Pessoal
   * Amigos
   * Família
   *
   * Cada usuário decide quantos existirão.
   */
  const rootCircles = useMemo(
    () =>
      circles
        .filter(circle => !circle.parent_id)
        .sort((a, b) =>
          String(a.name || "").localeCompare(
            String(b.name || ""),
            "pt-BR"
          )
        ),
    [circles]
  );

  /*
   * Subcírculos do universo atualmente aberto.
   *
   * Ex.:
   * Profissional
   *   ├─ BASF
   *   ├─ Clientes
   *   ├─ Consultores
   *   └─ Mercado
   */
  const childCircles = useMemo(() => {
    if (!focus) return rootCircles;

    return circles
      .filter(circle => circle.parent_id === focus)
      .sort((a, b) =>
        String(a.name || "").localeCompare(
          String(b.name || ""),
          "pt-BR"
        )
      );
  }, [circles, focus, rootCircles]);

  /*
   * Todos os IDs pertencentes ao círculo aberto,
   * incluindo os subcírculos.
   */
  const focusedCircleIds = useMemo(() => {
    if (!focus) return null;

    if (focus === UNASSIGNED) {
      return new Set();
    }

    return descendantIds(circles, focus);
  }, [circles, focus]);

  /*
   * REGRA MAIS IMPORTANTE:
   *
   * SEM FOCO:
   * TODOS os contatos aparecem.
   *
   * COM FOCO:
   * aparecem apenas as pessoas daquele círculo
   * e dos seus descendentes.
   *
   * NÃO existe slice().
   * NÃO existe PAGE_SIZE.
   * NÃO existe paginação.
   */
  const visibleContacts = useMemo(() => {
    if (!focus) {
      return contacts;
    }

    if (focus === UNASSIGNED) {
      return contacts.filter(contact => !assignments[contact.id]);
    }

    return contacts.filter(contact => {
      const assignedCircle = assignments[contact.id];

      if (!assignedCircle) return false;

      return focusedCircleIds?.has(assignedCircle);
    });
  }, [
    contacts,
    assignments,
    focus,
    focusedCircleIds,
  ]);

  /*
   * Interações somente das pessoas que estão
   * sendo visualizadas naquele momento.
   *
   * Isso mantém health, prioridade, momentum etc.
   * coerentes dentro da Teia.
   */
  const visibleContactIds = useMemo(
    () => new Set(visibleContacts.map(contact => contact.id)),
    [visibleContacts]
  );

  const visibleInteractions = useMemo(() => {
    if (!focus) return interactions;

    return interactions.filter(interaction =>
      visibleContactIds.has(
        interaction.contactId ?? interaction.contact_id
      )
    );
  }, [
    interactions,
    visibleContactIds,
    focus,
  ]);

  /*
   * Busca.
   *
   * A busca não destrói a Teia.
   * Apenas permite encontrar uma pessoa rapidamente.
   */
  const searchResults = useMemo(() => {
    const query = normalize(search);

    if (!query) return [];

    return contacts
      .filter(contact => {
        const path = circlePath(
          circles,
          assignments[contact.id]
        );

        const haystack = normalize(
          [
            contact.name,
            contact.company,
            contact.role,
            path,
          ]
            .filter(Boolean)
            .join(" ")
        );

        return haystack.includes(query);
      })
      .slice(0, 30);
  }, [
    search,
    contacts,
    circles,
    assignments,
  ]);

  /*
   * Quantas pessoas existem dentro de um círculo,
   * considerando também seus subcírculos.
   */
  const countForCircle = circleId => {
    const ids = descendantIds(circles, circleId);

    return contacts.filter(contact =>
      ids.has(assignments[contact.id])
    ).length;
  };

  /*
   * Navegação entre universos.
   */
  const goToCircle = circleId => {
    const next = circleId || null;

    setFocus(next);
    setSearch("");

    onFocusChange?.(next);
  };

  /*
   * Voltar um nível.
   */
  const goBack = () => {
    if (!focus) return;

    if (focus === UNASSIGNED) {
      goToCircle(null);
      return;
    }

    goToCircle(currentCircle?.parent_id || null);
  };

  /*
   * Breadcrumb completo.
   */
  const breadcrumb = useMemo(() => {
    if (!focus || focus === UNASSIGNED) return [];

    const result = [];
    let cursor = currentCircle;
    const visited = new Set();

    while (cursor && !visited.has(cursor.id)) {
      visited.add(cursor.id);

      result.unshift(cursor);

      cursor = circles.find(
        circle => circle.id === cursor.parent_id
      );
    }

    return result;
  }, [
    focus,
    currentCircle,
    circles,
  ]);

  /*
   * Quantidade ainda sem organização.
   *
   * Importante:
   * elas continuam aparecendo normalmente
   * na Teia principal.
   *
   * "Sem círculo" é somente informação,
   * não uma segunda rede.
   */
  const unassignedCount = useMemo(
    () =>
      contacts.filter(contact => !assignments[contact.id])
        .length,
    [contacts, assignments]
  );

  const styles = {
    container: {
      fontFamily: "'DM Sans', sans-serif",
      color: C.txt,
      width: "100%",
    },

    header: {
      marginBottom: 14,
    },

    title: {
      margin: 0,
      fontSize: 25,
      fontWeight: 700,
    },

    subtitle: {
      margin: "5px 0 0",
      fontSize: 12,
      color: C.txL,
    },

    search: {
      width: "100%",
      boxSizing: "border-box",
      minHeight: 44,
      borderRadius: 10,
      border: `1px solid ${C.brd}`,
      background: C.sf,
      color: C.txt,
      padding: "10px 13px",
      fontFamily: "'DM Sans'",
      fontSize: 13,
      outline: "none",
    },

    circleBar: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      margin: "12px 0 14px",
    },

    circleButton: {
      minHeight: 42,
      borderRadius: 999,
      border: `1px solid ${C.brd}`,
      background: C.sf,
      color: C.txt,
      padding: "8px 14px",
      cursor: "pointer",
      fontFamily: "'DM Sans'",
      fontSize: 12,
      transition: "all .18s ease",
    },

    activeCircleButton: {
      border: `1px solid ${C.gold}`,
      color: C.gold,
      background: `${C.gold}10`,
    },

    count: {
      marginLeft: 6,
      color: C.gold,
      fontSize: 10,
    },

    breadcrumb: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginBottom: 12,
      fontSize: 11,
      color: C.txL,
    },

    breadcrumbButton: {
      border: 0,
      background: "transparent",
      color: C.gold,
      padding: 0,
      cursor: "pointer",
      fontFamily: "'DM Sans'",
      fontSize: 11,
    },

    searchResults: {
      marginTop: 8,
      padding: 8,
      border: `1px solid ${C.brd}`,
      background: C.card,
      borderRadius: 12,
      maxHeight: 310,
      overflowY: "auto",
    },

    searchResult: {
      width: "100%",
      textAlign: "left",
      border: 0,
      borderBottom: `1px solid ${C.brd}`,
      background: "transparent",
      color: C.txt,
      padding: "10px 8px",
      cursor: "pointer",
      fontFamily: "'DM Sans'",
    },

    searchPath: {
      display: "block",
      marginTop: 3,
      color: C.txL,
      fontSize: 10,
    },

    info: {
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      margin: "4px 0 10px",
      fontSize: 11,
      color: C.txL,
    },

    empty: {
      padding: 20,
      textAlign: "center",
      color: C.txL,
      fontSize: 13,
    },
  };

  return (
    <div style={styles.container}>
      {/* CABEÇALHO */}
      <div style={styles.header}>
        <h2 style={styles.title}>
          {focus
            ? currentCircle?.name || "Minha rede"
            : "Minha rede"}
        </h2>

        <p style={styles.subtitle}>
          {focus
            ? `Você está vendo o universo ${
                currentCircle?.name || ""
              }. Toque em um subgrupo para aprofundar.`
            : "Toda a sua rede em uma única Teia. Os círculos organizam — não escondem pessoas."}
        </p>
      </div>

      {/* BUSCA */}
      <input
        aria-label="Buscar contato na rede"
        placeholder="Buscar pessoa, empresa ou círculo"
        value={search}
        onChange={event =>
          setSearch(event.target.value)
        }
        style={styles.search}
      />

      {/* RESULTADO DA BUSCA */}
      {!!search.trim() && (
        <div style={styles.searchResults}>
          {searchResults.length ? (
            searchResults.map(contact => {
              const path =
                circlePath(
                  circles,
                  assignments[contact.id]
                ) || "Sem círculo";

              return (
                <button
                  key={contact.id}
                  type="button"
                  style={styles.searchResult}
                  onClick={() =>
                    onOpenContact?.(contact.id)
                  }
                >
                  <strong>{contact.name}</strong>

                  {contact.company && (
                    <>
                      {" · "}
                      {contact.company}
                    </>
                  )}

                  <span style={styles.searchPath}>
                    {path}
                  </span>
                </button>
              );
            })
          ) : (
            <div style={styles.empty}>
              Nenhum contato encontrado.
            </div>
          )}
        </div>
      )}

      {/* CÍRCULOS */}
      {!search.trim() && (
        <>
          <div style={styles.circleBar}>
            {/* TODA A REDE */}
            <button
              type="button"
              style={{
                ...styles.circleButton,
                ...(!focus
                  ? styles.activeCircleButton
                  : {}),
              }}
              onClick={() => goToCircle(null)}
            >
              Toda a rede

              <span style={styles.count}>
                {contacts.length}
              </span>
            </button>

            {/* NA HOME: PROFISSIONAL / PESSOAL / ETC */}
            {!focus &&
              rootCircles.map(circle => (
                <button
                  key={circle.id}
                  type="button"
                  style={styles.circleButton}
                  onClick={() =>
                    goToCircle(circle.id)
                  }
                >
                  {shortName(circle.name)}

                  <span style={styles.count}>
                    {countForCircle(circle.id)}
                  </span>
                </button>
              ))}

            {/* DENTRO DE UM CÍRCULO: SUBGRUPOS */}
            {!!focus &&
              focus !== UNASSIGNED &&
              childCircles.map(circle => (
                <button
                  key={circle.id}
                  type="button"
                  style={styles.circleButton}
                  onClick={() =>
                    goToCircle(circle.id)
                  }
                >
                  {shortName(circle.name)}

                  <span style={styles.count}>
                    {countForCircle(circle.id)}
                  </span>
                </button>
              ))}
          </div>

          {/* BREADCRUMB */}
          {!!focus && (
            <div style={styles.breadcrumb}>
              <button
                type="button"
                style={styles.breadcrumbButton}
                onClick={() => goToCircle(null)}
              >
                Minha rede
              </button>

              {breadcrumb.map((circle, index) => (
                <React.Fragment key={circle.id}>
                  <span>›</span>

                  <button
                    type="button"
                    style={styles.breadcrumbButton}
                    onClick={() =>
                      goToCircle(circle.id)
                    }
                  >
                    {circle.name}
                  </button>
                </React.Fragment>
              ))}

              <span>·</span>

              <button
                type="button"
                style={styles.breadcrumbButton}
                onClick={goBack}
              >
                ← voltar
              </button>
            </div>
          )}

          {/* CONTADORES */}
          <div style={styles.info}>
            <span>
              {focus
                ? `${visibleContacts.length} pessoa${
                    visibleContacts.length === 1
                      ? ""
                      : "s"
                  } neste universo`
                : `${contacts.length} pessoa${
                    contacts.length === 1
                      ? ""
                      : "s"
                  } na sua rede`}
            </span>

            {!focus && unassignedCount > 0 && (
              <span>
                {unassignedCount} ainda sem círculo
              </span>
            )}
          </div>

          {/* ==========================================
              A TEIA ORIGINAL CONTINUA SENDO O MOTOR
              VISUAL.

              HOME:
              recebe TODOS os contatos.

              CÍRCULO ABERTO:
              recebe o subconjunto daquele universo.

              Nenhuma paginação.
              Nenhum limite de seis.
              ========================================== */}

          {visibleContacts.length ? (
            <ConexiaTeiaEvolutiva
              contacts={visibleContacts}
              interactions={visibleInteractions}
              isPro={isPro}
              onOpenContact={onOpenContact}
            />
          ) : (
            <div style={styles.empty}>
              Este círculo ainda não possui pessoas.
            </div>
          )}
        </>
      )}
    </div>
  );
}
