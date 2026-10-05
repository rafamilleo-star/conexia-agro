import React, { useEffect, useMemo, useState } from "react";
import { C } from "../utils/theme";
import { UNASSIGNED, circlePath, descendantIds } from "../../shared/networkCircles.js";
import ContactCircleField from "./ContactCircleField";
import icon from "../assets/brand/conexia_icone_transparente.svg";

const PAGE_SIZE = 6;
const POSITIONS = [
  [145, 145], [455, 145], [145, 495],
  [455, 495], [115, 325], [485, 325],
];
const normalize = value => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase();
const short = (text, length = 21) =>
  text.length > length ? text.slice(0, length - 1) + "…" : text;

export default function ConexiaCircleNetwork({
  contacts = [], network, onOpenContact,
  initialFocus = null, onFocusChange,
}) {
  const [focus, setFocus] = useState(initialFocus);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [renameName, setRenameName] = useState("");
  const [personId, setPersonId] = useState("");
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { circles, assignments } = network;
  const current = circles.find(c => c.id === focus);

  useEffect(() => {
    setPage(0);
    setRenameName(current?.name || "");
  }, [focus, current?.name]);

  useEffect(() => {
    if (focus && focus !== UNASSIGNED && !current && !network.loading) {
      setFocus(null);
      onFocusChange?.(null);
    }
  }, [focus, current, network.loading, onFocusChange]);

  const unassigned = contacts.filter(c => !assignments[c.id]);
  const direct = focus === UNASSIGNED
    ? unassigned
    : contacts.filter(c => assignments[c.id] === focus);
  const childCircles = circles.filter(c => (c.parent_id || null) === focus);
  const countFor = id => {
    const ids = descendantIds(circles, id);
    return contacts.filter(c => ids.has(assignments[c.id])).length;
  };
  const items = focus === UNASSIGNED
    ? direct.map(c => ({ ...c, type: "contact" }))
    : [
      ...childCircles.map(c => ({ ...c, type: "circle", count: countFor(c.id) })),
      ...(!focus && unassigned.length
        ? [{ type: "circle", id: UNASSIGNED, name: "A organizar", count: unassigned.length }]
        : []),
      ...(focus ? direct.map(c => ({ ...c, type: "contact" })) : []),
    ];
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const activePage = Math.min(page, pages - 1);
  const visible = items.slice(activePage * PAGE_SIZE, (activePage + 1) * PAGE_SIZE);
  const matches = useMemo(() => contacts.filter(c =>
    normalize(`${c.name} ${c.company || ""} ${circlePath(circles, assignments[c.id])}`)
      .includes(normalize(search))
  ), [contacts, circles, assignments, search]);
  const title = focus === UNASSIGNED ? "A organizar" : current?.name || "CONÉXIA";

  const action = async fn => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const button = {
    border: `1px solid ${C.brd}`, borderRadius: 9, padding: "10px 14px",
    minHeight: 44, background: C.sf, color: C.gold, cursor: "pointer",
    fontFamily: "'DM Sans'", fontSize: 13,
  };
  const input = { ...button, boxSizing: "border-box", width: "100%", color: C.txt };
  const go = id => {
    setFocus(id); onFocusChange?.(id);
    setSearch(""); setError(""); setNotice("");
  };

  return <div style={{ fontFamily: "'DM Sans'", color: C.txt }}>
    <h2 style={{ margin: "0 0 6px", fontSize: 25 }}>Minha rede</h2>
    <p style={{ fontSize: 12, color: C.txL }}>
      Seus círculos, do seu jeito. Toque para expandir.
    </p>
    <input
      aria-label="Buscar contato na rede"
      placeholder="Buscar contato"
      value={search}
      onChange={e => setSearch(e.target.value)}
      style={input}
    />
    <nav aria-label="Caminho dos círculos" style={{
      display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0",
    }}>
      <button style={button} onClick={() => go(null)}>Minha rede</button>
      {focus && <>
        <button style={button} onClick={() => go(current?.parent_id || null)}>
          ← Voltar
        </button>
        <span style={{ fontSize: 12, alignSelf: "center" }}>
          {focus === UNASSIGNED ? title : circlePath(circles, focus)}
        </span>
      </>}
    </nav>
    {network.loading
      ? <p role="status">Carregando círculos…</p>
      : network.error
        ? <p role="alert">
          {network.error} <button style={button} onClick={network.load}>Tentar novamente</button>
        </p>
        : search.trim()
          ? <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {matches.length ? matches.map(c =>
              <button
                key={c.id}
                onClick={() => onOpenContact?.(c.id)}
                style={{
                  ...button, display: "block", width: "100%",
                  textAlign: "left", marginBottom: 8,
                }}
              >
                {c.name}
                <span style={{ display: "block", color: C.txL, fontSize: 11 }}>
                  {circlePath(circles, assignments[c.id]) || "A organizar"}
                </span>
              </button>
            ) : <p>Nenhum contato encontrado.</p>}
          </div>
          : <>
            <div style={{
              background: "radial-gradient(circle at center, #20202a, #0D0D0F)",
              border: `1px solid ${C.brd}`, borderRadius: 18, overflow: "hidden",
            }}>
              <svg
                viewBox="0 0 600 650"
                style={{ width: "100%", display: "block", maxHeight: "72vh" }}
                aria-label={`Rede: ${title}`}
              >
                {visible.map((item, index) => {
                  const [x, y] = POSITIONS[index];
                  return <line
                    key={item.id}
                    x1={300} y1={325} x2={x} y2={y}
                    stroke={C.gold} strokeWidth={1.5} opacity={0.55}
                  />;
                })}
                <circle
                  cx={300} cy={325} r={85}
                  fill="#151516" stroke={C.gold} strokeWidth={2}
                />
                {!focus && <image
                  href={icon} x={279} y={276} width={42} height={42}
                />}
                <foreignObject
                  x={221} y={focus ? 287 : 315} width={158} height={80}
                >
                  <button
                    aria-label={focus ? `Recolher ${title}` : "Visão inicial CONÉXIA"}
                    onClick={() => go(current?.parent_id || null)}
                    style={{
                      border: 0, background: "transparent", color: C.gold,
                      width: "100%", height: "100%", fontSize: 19,
                      cursor: "pointer", fontFamily: "'DM Sans'",
                      overflowWrap: "anywhere",
                    }}
                  >{short(title, 35)}</button>
                </foreignObject>
                {visible.map((item, index) => {
                  const [x, y] = POSITIONS[index];
                  const isGroup = item.type === "circle";
                  return <g key={item.id}>
                    <circle
                      cx={x} cy={y} r={isGroup ? 78 : 63}
                      fill="#151516" stroke={C.gold}
                      strokeWidth={isGroup ? 1.6 : 1}
                    />
                    {isGroup && Array.from({ length: 5 }, (_, i) => {
                      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
                      return <circle
                        key={i}
                        cx={x + Math.cos(a) * 72}
                        cy={y + Math.sin(a) * 72}
                        r={4} fill={C.gold}
                      />;
                    })}
                    <foreignObject
                      x={x - 67} y={y - 55} width={134} height={110}
                    >
                      <button
                        aria-label={`${isGroup ? "Expandir" : "Abrir contato"} ${item.name}`}
                        onClick={() => isGroup ? go(item.id) : onOpenContact?.(item.id)}
                        style={{
                          width: "100%", height: "100%", border: 0,
                          background: "transparent", color: C.txt,
                          cursor: "pointer", fontFamily: "'DM Sans'",
                          fontSize: 18, lineHeight: 1.3, overflowWrap: "anywhere",
                        }}
                      >
                        {short(item.name, 32)}
                        <span style={{
                          display: "block", color: C.gold, fontSize: 14, marginTop: 7,
                        }}>
                          {isGroup
                            ? `${item.count} pessoa${item.count === 1 ? "" : "s"}`
                            : "Abrir ficha"}
                        </span>
                      </button>
                    </foreignObject>
                  </g>;
                })}
              </svg>
            </div>
            {!items.length && <p style={{ fontSize: 13, color: C.txL }}>
              {focus
                ? "Este círculo está vazio. Crie um subgrupo ou coloque uma pessoa nele."
                : "Crie seu primeiro círculo. Você escolhe os nomes e a quantidade."}
            </p>}
            {pages > 1 && <div style={{
              display: "flex", justifyContent: "center", alignItems: "center",
              gap: 10, marginTop: 10,
            }}>
              <button
                style={button} disabled={!activePage}
                onClick={() => setPage(activePage - 1)}
              >Anterior</button>
              <span style={{ fontSize: 12 }}>{activePage + 1} / {pages}</span>
              <button
                style={button} disabled={activePage + 1 >= pages}
                onClick={() => setPage(activePage + 1)}
              >Próxima</button>
            </div>}
          </>}
    <div style={{
      marginTop: 16, padding: 15, background: C.card,
      border: `1px solid ${C.brd}`, borderRadius: 12,
    }}>
      {focus !== UNASSIGNED && <form onSubmit={e => {
        e.preventDefault();
        void action(async () => {
          await network.create(newName, focus);
          setNewName(""); setNotice("Círculo criado.");
        });
      }}>
        <label style={{ fontSize: 12 }}>
          {focus ? "Novo subgrupo neste círculo" : "Novo círculo"}
          <input
            aria-label="Nome do círculo"
            placeholder={focus ? "Ex.: Café" : "Ex.: Profissional"}
            maxLength={60} value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ ...input, margin: "6px 0 8px" }}
          />
        </label>
        <button
          style={button}
          disabled={busy || network.loading || Boolean(network.error) || !newName.trim()}
        >{busy ? "Salvando…" : "Criar"}</button>
      </form>}
      {current && <form
        onSubmit={e => {
          e.preventDefault();
          void action(async () => {
            await network.rename(current.id, renameName);
            setNotice("Nome atualizado.");
          });
        }}
        style={{ marginTop: 15 }}
      >
        <label style={{ fontSize: 12 }}>
          Nome deste círculo
          <input
            aria-label="Renomear círculo" value={renameName} maxLength={60}
            onChange={e => setRenameName(e.target.value)}
            style={{ ...input, margin: "6px 0 8px" }}
          />
        </label>
        <button style={button} disabled={busy || !renameName.trim()}>
          Renomear
        </button>{" "}
        {!childCircles.length && !direct.length && <button
          type="button" style={button} disabled={busy}
          onClick={() => void action(async () => {
            await network.remove(current.id);
            go(current.parent_id || null);
          })}
        >Excluir círculo vazio</button>}
      </form>}
      {!!contacts.length && <div style={{ marginTop: 16 }}>
        <label style={{ fontSize: 12 }}>
          Organizar uma pessoa
          <select
            aria-label="Pessoa para organizar" value={personId}
            onChange={e => {
              setPersonId(e.target.value);
              setDestination(assignments[e.target.value] || "");
            }}
            style={{ ...input, marginTop: 6 }}
          >
            <option value="">Escolha um contato</option>
            {[...contacts]
              .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
              .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        {personId && <>
          <ContactCircleField
            network={network} value={destination} onChange={setDestination}
          />
          <button
            style={button}
            disabled={busy || network.loading || Boolean(network.error)}
            onClick={() => void action(async () => {
              await network.assign(personId, destination || null);
              setNotice("Organização salva.");
            })}
          >Salvar organização</button>
        </>}
      </div>}
      {(error || notice) && <p
        role={error ? "alert" : "status"}
        style={{ fontSize: 12, color: error ? C.cor : C.gold }}
      >{error || notice}</p>}
    </div>
  </div>;
}
