#!/usr/bin/env python3
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "shared/networkCircles.js": r'''
export const UNASSIGNED = "__unassigned__";

export function circlePath(circles, id) {
  const names = [];
  const seen = new Set();
  let circle = circles.find(c => c.id === id);
  while (circle && !seen.has(circle.id)) {
    seen.add(circle.id);
    names.unshift(circle.name);
    circle = circles.find(c => c.id === circle.parent_id);
  }
  return names.join(" → ");
}

export function descendantIds(circles, id) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const circle of circles) {
      if (ids.has(circle.parent_id) && !ids.has(circle.id)) {
        ids.add(circle.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function resolveCircle(circles, text) {
  const normalize = value => String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/\s*(?:→|>|\/)\s*/g, " > ");
  const query = normalize(text).replace(/^(?:(?:coloque|coloca|colocar|inserir|insere|em|no|na|circulo|grupo)\s+)+/, "");
  const matches = circles.filter(c => normalize(c.name) === query || normalize(circlePath(circles, c.id)) === query);
  return matches.length === 1 ? matches[0] : null;
}
''',
    "src/lib/useNetworkCircles.js": r'''
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../utils/supabase";

export default function useNetworkCircles(userId) {
  const [state, setState] = useState({ userId: null, circles: [], assignments: {}, loading: true, error: "" });
  const activeUser = useRef(userId);
  activeUser.current = userId;

  const load = useCallback(async () => {
    if (!userId) return;
    setState(s => ({ ...s, loading: true, error: "" }));
    const [groups, memberships] = await Promise.all([
      supabase.from("network_circles").select("id,name,parent_id").eq("user_id", userId).order("created_at"),
      supabase.from("contact_circle_memberships").select("contact_id,circle_id").eq("user_id", userId),
    ]);
    if (activeUser.current !== userId) return;
    const failure = groups.error || memberships.error;
    setState({
      userId,
      loading: false,
      circles: groups.data || [],
      assignments: Object.fromEntries((memberships.data || []).map(m => [m.contact_id, m.circle_id])),
      error: failure ? "Não consegui carregar os círculos. Tente novamente." : "",
    });
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const create = async (name, parentId = null) => {
    const clean = String(name || "").trim();
    if (!clean || clean.length > 60) throw new Error("Use um nome de 1 a 60 caracteres.");
    const { data, error } = await supabase.from("network_circles")
      .insert({ user_id: userId, name: clean, parent_id: parentId })
      .select("id,name,parent_id").single();
    if (error) throw new Error(error.code === "23505"
      ? "Já existe um círculo com esse nome neste nível."
      : "Não consegui criar o círculo.");
    if (activeUser.current === userId) {
      setState(s => ({ ...s, circles: [...s.circles, data] }));
    }
    return data;
  };

  const rename = async (id, name) => {
    const clean = String(name || "").trim();
    if (!clean || clean.length > 60) throw new Error("Use um nome de 1 a 60 caracteres.");
    const { data, error } = await supabase.from("network_circles")
      .update({ name: clean }).eq("id", id).eq("user_id", userId)
      .select("id").single();
    if (error || !data) throw new Error("Não consegui renomear. Confira se o nome já existe neste nível.");
    if (activeUser.current === userId) {
      setState(s => ({
        ...s,
        circles: s.circles.map(c => c.id === id ? { ...c, name: clean } : c),
      }));
    }
  };

  const remove = async id => {
    const { data, error } = await supabase.from("network_circles")
      .delete().eq("id", id).eq("user_id", userId).select("id").single();
    if (error || !data) throw new Error("Mova os contatos e remova os subgrupos antes de excluir este círculo.");
    if (activeUser.current === userId) {
      setState(s => ({ ...s, circles: s.circles.filter(c => c.id !== id) }));
    }
  };

  const assign = async (contactId, circleId) => {
    if (circleId) {
      const { data, error } = await supabase.from("contact_circle_memberships")
        .upsert(
          { user_id: userId, contact_id: contactId, circle_id: circleId },
          { onConflict: "contact_id" }
        ).select("contact_id").single();
      if (error || !data) throw new Error("Não consegui mover o contato. Ele continua salvo.");
    } else {
      const { error } = await supabase.from("contact_circle_memberships")
        .delete().eq("contact_id", contactId).eq("user_id", userId);
      if (error) throw new Error("Não consegui alterar a organização. O contato continua salvo.");
    }
    if (activeUser.current === userId) {
      setState(s => {
        const assignments = { ...s.assignments };
        if (circleId) assignments[contactId] = circleId;
        else delete assignments[contactId];
        return { ...s, assignments };
      });
    }
  };

  const current = state.userId === userId ? state : {
    circles: [], assignments: {}, loading: Boolean(userId), error: "",
  };
  return { ...current, load, create, rename, remove, assign };
}
''',
    "src/components/ContactCircleField.jsx": r'''
import React, { useState } from "react";
import { circlePath } from "../../shared/networkCircles.js";
import { C } from "../utils/theme";

export default function ContactCircleField({
  network, value = "", onChange, label = "Círculo / grupo",
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [parent, setParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const style = {
    width: "100%", boxSizing: "border-box", background: C.sf,
    border: `1px solid ${C.brd}`, borderRadius: 8, color: C.txt,
    padding: 12, fontFamily: "'DM Sans'", fontSize: 13, minHeight: 44,
  };
  const options = [...network.circles].sort((a, b) =>
    circlePath(network.circles, a.id).localeCompare(
      circlePath(network.circles, b.id), "pt-BR"
    )
  );

  return <div style={{ margin: "12px 0", fontFamily: "'DM Sans'", textAlign: "left" }}>
    <label style={{ display: "block", color: C.txM, fontSize: 12 }}>
      {label}
      <select
        aria-label={label}
        value={value || ""}
        disabled={network.loading || Boolean(network.error) || busy}
        onChange={e => onChange(e.target.value)}
        style={{ ...style, marginTop: 6 }}
      >
        <option value="">A organizar — decidir depois</option>
        {options.map(c =>
          <option key={c.id} value={c.id}>
            {circlePath(network.circles, c.id)}
          </option>
        )}
      </select>
    </label>
    {network.error && <div role="alert" style={{ color: C.cor, fontSize: 12 }}>
      {network.error} <button type="button" onClick={network.load}>Tentar novamente</button>
    </div>}
    <button
      type="button"
      disabled={network.loading || Boolean(network.error) || busy}
      onClick={() => { setCreating(!creating); setParent(value || ""); }}
      style={{
        background: "none", border: "none", color: C.gold,
        cursor: "pointer", minHeight: 44,
      }}
    >+ Criar círculo ou subgrupo</button>
    {creating && <div style={{ display: "grid", gap: 8 }}>
      <input
        aria-label="Nome do novo círculo"
        placeholder="Nome do novo círculo"
        maxLength={60}
        value={name}
        onChange={e => setName(e.target.value)}
        style={style}
      />
      <select
        aria-label="Dentro de qual círculo"
        value={parent}
        onChange={e => setParent(e.target.value)}
        style={style}
      >
        <option value="">Na visão inicial</option>
        {options.map(c =>
          <option key={c.id} value={c.id}>
            {circlePath(network.circles, c.id)}
          </option>
        )}
      </select>
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true); setError("");
          try {
            const created = await network.create(name, parent || null);
            onChange(created.id);
            setName("");
            setCreating(false);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
        style={{ ...style, cursor: "pointer", color: C.gold }}
      >{busy ? "Criando…" : "Criar e selecionar"}</button>
    </div>}
    {error && <div role="alert" style={{ color: C.cor, fontSize: 12 }}>{error}</div>}
  </div>;
}
''',
    "src/components/ContactCircleAssignment.jsx": r'''
import React, { useEffect, useState } from "react";
import ContactCircleField from "./ContactCircleField";
import { C } from "../utils/theme";

export default function ContactCircleAssignment({ network, contactId }) {
  const saved = network.assignments[contactId] || "";
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => { setValue(saved); setMessage(""); }, [saved, contactId]);

  return <div style={{
    marginBottom: 14, padding: 14, background: C.card,
    border: `1px solid ${C.brd}`, borderRadius: 12,
  }}>
    <ContactCircleField network={network} value={value} onChange={setValue} />
    <button
      disabled={busy || network.loading || Boolean(network.error)}
      onClick={async () => {
        setBusy(true); setMessage("");
        try {
          await network.assign(contactId, value || null);
          setMessage("Organização salva.");
        } catch (e) {
          setMessage(e.message);
        } finally {
          setBusy(false);
        }
      }}
      style={{
        background: C.sf, border: `1px solid ${C.brd}`, color: C.gold,
        borderRadius: 8, padding: 12, minHeight: 44, cursor: "pointer",
      }}
    >{busy ? "Salvando…" : "Salvar organização"}</button>
    {message && <p role="status" style={{ fontSize: 12, color: C.txM }}>{message}</p>}
  </div>;
}
''',
    "src/components/ConexiaCircleNetwork.jsx": r'''
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
''',
    "src/lib/dannaFishLive.js": r'''
import DannaGeminiLive from "./dannaGeminiLive.js";

// Gemini escuta e chama o cérebro. Fish fala o texto do CONÉXIA.
export default class DannaFishLive extends DannaGeminiLive {
  constructor(options = {}) {
    super(options);
    this.engine = "fish";
    this.localBargeIn = false;
    this.audioEpoch = 0;
    this.synthesisAbort = null;
    this.captureHeld = false;
    this.releaseTimer = null;
    this.savedTrackStates = new Map();
    this.manualMuted = false;

    const transcript = this.onUserTranscript;
    const speechStart = this.onUserSpeechStart;
    this.onUserTranscript = text => {
      if (!this.captureHeld) transcript(text);
    };
    this.onUserSpeechStart = () => {
      if (!this.captureHeld) speechStart();
    };
  }

  async beforeConnect() {
    const token = await this.getAccessToken();
    const res = await fetch("/api/fish-tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token || ""}`,
      },
      body: JSON.stringify({ check: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Fish Audio indisponível.");
    }
  }

  handleServerMessage(msg) {
    if (msg.serverContent?.interrupted && !this.captureHeld) {
      this.interrupt();
      this.onUserSpeechStart();
    }
    const sc = msg.serverContent;
    super.handleServerMessage(sc ? {
      ...msg,
      serverContent: {
        ...sc,
        modelTurn: undefined,
        outputTranscription: undefined,
        interrupted: false,
      },
    } : msg);
  }

  handleToolCall(calls) {
    if (this.captureHeld) {
      for (const call of calls) this.sendToolResponse(call, "");
      return;
    }
    const call = calls.find(c => c?.name === "conexia_responder");
    for (const c of calls) this.sendToolResponse(c, "");
    const text = String(call?.args?.fala || "").trim();
    if (!text) return;
    this.markActivity();
    this.userTurns += 1;
    this.setStatus("thinking");
    this.onUserTranscript(text);
  }

  // A voz Gemini é descartada; Fish usa super.playChunk diretamente.
  playChunk() {}

  speak(text) {
    const clean = String(text || "").trim();
    if (!clean || !this.connected) return false;

    this.interrupt();
    this.outputSuppressed = false;
    this.holdCapture();

    const epoch = this.audioEpoch;
    const abort = new AbortController();
    this.synthesisAbort = abort;
    this.markActivity();
    this.setStatus("thinking");
    void this.streamSpeech(clean, epoch, abort);
    return true;
  }

  async streamSpeech(text, epoch, abort) {
    let reader;
    const current = () =>
      !abort.signal.aborted && this.connected && epoch === this.audioEpoch;

    try {
      const token = await this.getAccessToken();
      if (!current()) return;

      const res = await fetch("/api/fish-tts", {
        method: "POST",
        signal: abort.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ text }),
      });

      if (!current()) {
        await res.body?.cancel();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Fish Audio: HTTP ${res.status}`);
      }
      if (!res.body) throw new Error("Fish não devolveu áudio.");

      reader = res.body.getReader();
      let carry = new Uint8Array(0);

      while (current()) {
        const { value, done } = await reader.read();
        if (!current() || done) break;

        const bytes = new Uint8Array(carry.length + value.length);
        bytes.set(carry);
        bytes.set(value, carry.length);
        const evenLength = bytes.length - bytes.length % 2;
        carry = bytes.slice(evenLength);

        for (
          let offset = 0;
          offset < evenLength && current();
          offset += 4800
        ) {
          while (
            current() && this.outCtx &&
            this.nextPlayTime - this.outCtx.currentTime > 0.5
          ) {
            await new Promise(resolve => setTimeout(resolve, 25));
          }
          if (!current()) break;

          const chunk = bytes.subarray(
            offset, Math.min(offset + 4800, evenLength)
          );
          let binary = "";
          for (const byte of chunk) binary += String.fromCharCode(byte);
          super.playChunk(btoa(binary));
        }
      }
    } catch (error) {
      if (current() && error.name !== "AbortError") {
        this.stopPlayback();
        this.setStatus("error");
        this.onError(error);
      }
    } finally {
      try { await reader?.cancel(); } catch {}
      if (this.synthesisAbort === abort) this.synthesisAbort = null;
      if (current()) this.releaseCaptureWhenDone();
    }
  }

  holdCapture() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    this.captureHeld = true;
    for (const track of this.micStream?.getAudioTracks() || []) {
      if (!this.savedTrackStates.has(track)) {
        this.savedTrackStates.set(track, track.enabled);
      }
      track.enabled = false;
    }
    this.micSpeechMs = 0;
    this.micSilenceMs = 0;
    this.micSpeechActive = false;
  }

  releaseCaptureWhenDone() {
    if (!this.captureHeld || this.synthesisAbort || this.playing.size) return;
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      this.releaseTimer = null;
      if (this.synthesisAbort || this.playing.size || !this.connected) return;
      this.releaseCapture();
      this.setStatus("listening");
    }, 450);
  }

  releaseCapture() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    for (const [track, enabled] of this.savedTrackStates) {
      if (track.readyState !== "ended") {
        track.enabled = enabled && !this.manualMuted;
      }
    }
    this.savedTrackStates.clear();
    this.captureHeld = false;
    this.micSpeechMs = 0;
    this.micSilenceMs = 0;
    this.micSpeechActive = false;
  }

  setSpeaking(value) {
    super.setSpeaking(value);
    if (!value && this.captureHeld) this.releaseCaptureWhenDone();
  }

  checkMicActivity(buffer) {
    if (!this.captureHeld) super.checkMicActivity(buffer);
  }

  mute() {
    this.manualMuted = true;
    super.mute();
  }

  unmute() {
    this.manualMuted = false;
    if (this.captureHeld) {
      for (const track of this.savedTrackStates.keys()) {
        this.savedTrackStates.set(track, true);
      }
    } else {
      super.unmute();
    }
  }

  disconnect(reason = "manual") {
    super.disconnect(reason);
    this.releaseCapture();
  }

  stopPlayback() {
    this.audioEpoch += 1;
    this.synthesisAbort?.abort();
    this.synthesisAbort = null;
    super.stopPlayback();
    this.releaseCaptureWhenDone();
  }
}
''',
    "tests/networkCircles.test.js": r'''
import test from "node:test";
import assert from "node:assert/strict";
import { circlePath, descendantIds, resolveCircle } from "../shared/networkCircles.js";

const circles = [
  { id: "work", name: "Profissional", parent_id: null },
  { id: "coffee", name: "Café", parent_id: "work" },
  { id: "coop", name: "Cooperativas", parent_id: "coffee" },
  { id: "personal", name: "Pessoal", parent_id: null },
  { id: "otherCoffee", name: "Café", parent_id: "personal" },
];

test("Inclui subgrupos sem duplicar contatos", () => {
  assert.deepEqual([...descendantIds(circles, "work")], ["work", "coffee", "coop"]);
  assert.equal(circlePath(circles, "coop"), "Profissional → Café → Cooperativas");
});

test("Desambigua nomes iguais pelo caminho", () => {
  assert.equal(resolveCircle(circles, "cafe"), null);
  assert.equal(resolveCircle(circles, "profissional > cafe").id, "coffee");
  assert.equal(resolveCircle(circles, "Pessoal / Café").id, "otherCoffee");
  assert.equal(resolveCircle(circles, "no Profissional").id, "work");
  assert.equal(resolveCircle(circles, "coloca no círculo Profissional").id, "work");
  assert.equal(resolveCircle(circles, "coloca em Profissional → Café").id, "coffee");
  assert.equal(resolveCircle(circles, "grupo inexistente"), null);
});

test("Protege contra hierarquia circular", () => {
  const malformed = [
    { id: "a", name: "A", parent_id: "b" },
    { id: "b", name: "B", parent_id: "a" },
  ];
  assert.equal(circlePath(malformed, "a"), "B → A");
  assert.equal(descendantIds(malformed, "a").size, 2);
  assert.equal(circlePath(circles, "missing"), "");
});
''',
}

GROUP_HANDLERS = r'''
  const askContactCircle = (contactId, contactName) => {
    const network = networkRef.current;
    if (!network || network.assignments[contactId]) return "";
    const pending = { contactId, contactName };
    pendingGroupingRef.current = pending;
    setPendingGrouping(pending);
    setGroupChoice("");
    const examples = network.circles
      .filter(c => !c.parent_id).slice(0, 5).map(c => c.name);
    return ` Em qual círculo você quer colocar ${contactName}? ${examples.length ? `Você tem ${examples.join(", ")}. ` : "Você pode criar seu primeiro círculo. "}Se preferir, pode organizar depois.`;
  };

  const finishCircleChoice = async circleId => {
    const network = networkRef.current;
    const pending = pendingGroupingRef.current;
    if (!pending || captureBusyRef.current) return;
    if (!circleId) {
      pendingGroupingRef.current = null;
      setPendingGrouping(null);
      const message = `Tudo bem. ${pending.contactName} continua salvo. Você pode organizar depois na Minha rede.`;
      setAnswer(message);
      speak(message, true);
      return;
    }
    if (!network || network.loading || network.error) {
      speak("Ainda não consegui carregar seus círculos. Tente novamente ou escolha organizar depois na tela.", true);
      return;
    }
    captureBusyRef.current = true;
    try {
      await network.assign(pending.contactId, circleId);
      const message = `Pronto. ${pending.contactName} está em ${circlePath(network.circles, circleId)}.`;
      pendingGroupingRef.current = null;
      setPendingGrouping(null);
      setAnswer(message);
      speak(message, true);
    } catch (e) {
      setError(e.message);
      setVoiceState("listening");
    } finally {
      captureBusyRef.current = false;
    }
  };

  const handleCircleChoice = async line => {
    const network = networkRef.current;
    const n = normalize(line).replace(/[.!?]+$/, "");
    if (/^(depois|organizo depois|organizar depois|mais tarde|agora nao|nao|cancelar|cancela)$/.test(n)) {
      await finishCircleChoice(null);
      return;
    }
    if (!network || network.loading || network.error) {
      speak("Escolha organizar depois ou tente novamente quando seus círculos carregarem.", true);
      return;
    }
    const resolved = resolveCircle(network.circles, line.replace(/[.!?]+$/, ""));
    if (resolved) {
      await finishCircleChoice(resolved.id);
      return;
    }
    const createMatch = /^(?:criar|crie|cria)\s+(?:um\s+)?(?:circulo|círculo|grupo|subgrupo)\s+(.+?)(?:\s+(?:em|dentro de)\s+(.+))?$/i.exec(line.replace(/[.!?]+$/, ""));
    if (createMatch && !captureBusyRef.current) {
      const parent = createMatch[2]
        ? resolveCircle(network.circles, createMatch[2])
        : null;
      if (createMatch[2] && !parent) {
        speak("Não consegui identificar o círculo principal. Diga o caminho completo ou escolha na tela.", true);
        return;
      }
      captureBusyRef.current = true;
      try {
        const created = await network.create(createMatch[1], parent?.id || null);
        setGroupChoice(created.id);
        const personName = pendingGroupingRef.current?.contactName || "a pessoa";
        setAnswer(`Criei ${created.name}. Selecione Salvar grupo para colocar ${personName} nele.`);
        speak(`Criei ${created.name}. Diga ${created.name} para colocar a pessoa nele, ou confirme na tela.`, true);
      } catch (e) {
        setError(e.message);
        setVoiceState("listening");
      } finally {
        captureBusyRef.current = false;
      }
      return;
    }
    speak("Escolha o nome de um círculo, diga criar círculo seguido do nome, ou diga organizar depois. Para subgrupos com nomes iguais, diga o caminho completo ou escolha na tela.", true);
  };

'''

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{label}: esperado um trecho, encontrados {count}. "
            "A versão mudou; nenhum arquivo será alterado."
        )
    return text.replace(old, new, 1)

def read(path):
    return (ROOT / path).read_text(encoding="utf-8")

def prepare_app():
    app = read("src/App.jsx")
    if 'import ConexiaCircleNetwork from' in app:
        if 'network={network}' not in app:
            raise RuntimeError("Integração dos círculos incompleta no App.jsx.")
        return app

    app = replace_once(
        app,
        'import ConexiaTeiaEvolutiva from "./components/ConexiaTeiaEvolutiva";',
        '''import ConexiaCircleNetwork from "./components/ConexiaCircleNetwork";
import ContactCircleField from "./components/ContactCircleField";
import ContactCircleAssignment from "./components/ContactCircleAssignment";
import useNetworkCircles from "./lib/useNetworkCircles";''',
        "Importações do App",
    )

    app = replace_once(
        app,
        'function CRM({ profile, assessment, onReset, user, onProfileUpdate }) {',
        '''function CRM({ profile, assessment, onReset, user, onProfileUpdate }) {
  const network = useNetworkCircles(user?.id);
  const [contactCircleDraft, setContactCircleDraft] = useState("");
  const [circleFocus, setCircleFocus] = useState(null);
  const [openedFromCircle, setOpenedFromCircle] = useState(false);
  const [circleSaveNotice, setCircleSaveNotice] = useState("");''',
        "Estado dos círculos",
    )

    app = replace_once(
        app,
        '  const [modal, setModal] = useState(null);',
        '''  const [modal, setModal] = useState(null);
  useEffect(() => { setContactCircleDraft(""); }, [modal]);''',
        "Modal de contato",
    )

    app = replace_once(
        app,
        '''    setDbgMsg("✅ Salvo: " + newContact?.name);
    if (newContact) {''',
        '''    setDbgMsg("✅ Salvo: " + newContact?.name);
    if (newContact) {
      if (contactCircleDraft) {
        try { await network.assign(newContact.id, contactCircleDraft); }
        catch (e) {
          setCircleSaveNotice("Contato salvo. " + e.message + " Organize pela Minha rede.");
        }
      }''',
        "Cadastro de contato",
    )

    app = replace_once(
        app,
        '''          onDataChanged={load}
          voiceEngine={voiceEngine}''',
        '''          onDataChanged={load}
          network={network}
          voiceEngine={voiceEngine}''',
        "Rede na Danna",
    )

    app = replace_once(
        app,
        '''<button onClick={() => setSelId(null)} style={{ background: "none", border: "none", color: C.txM, cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 13, padding: "0 0 14px" }}>← Voltar</button>''',
        '''<button onClick={() => {
            setSelId(null);
            if (openedFromCircle) setRedeSubTab("teia");
            setOpenedFromCircle(false);
          }} style={{ background: "none", border: "none", color: C.txM, cursor: "pointer", fontFamily: "'DM Sans'", fontSize: 13, padding: "0 0 14px" }}>← Voltar</button>
          <ContactCircleAssignment network={network} contactId={sel.id} />''',
        "Ficha do contato",
    )

    app = replace_once(
        app,
        '''  const renderTeia = () => (
    <ConexiaTeiaEvolutiva''',
        '''  const renderTeia = () => (
    <ConexiaCircleNetwork
      network={network}
      initialFocus={circleFocus}
      onFocusChange={setCircleFocus}''',
        "Visualização da rede",
    )

    start = app.index("  const renderTeia = () => (")
    end = app.index("  const renderContacts = () => (", start)
    section = app[start:end]
    section = replace_once(
        section,
        '''      onOpenContact={(id) => {
        setSelId(id);''',
        '''      onOpenContact={(id) => {
        setOpenedFromCircle(true);
        setSelId(id);''',
        "Abrir contato pelo círculo",
    )
    app = app[:start] + section + app[end:]

    app = replace_once(
        app,
        '''  const renderContacts = () => (
    <div>''',
        '''  const renderContacts = () => (
    <div>
      {circleSaveNotice && <p role="alert" style={{ color: C.cor, fontSize: 12 }}>
        {circleSaveNotice}
        <button onClick={() => setCircleSaveNotice("")}>Fechar</button>
      </p>}''',
        "Aviso de organização",
    )

    app = replace_once(
        app,
        '<button onClick={() => setRedeSubTab("pessoas")} style={{ background: redeSubTab',
        '<button onClick={() => { setRedeSubTab("pessoas"); setOpenedFromCircle(false); }} style={{ background: redeSubTab',
        "Aba Pessoas",
    )

    app = replace_once(
        app,
        '''      {modal === "addC" && <Modal title="Novo contato" onClose={() => setModal(null)}>
        <Inp label="Nome *" value={cf.name} onChange={v => setCf({ ...cf, name: v })} placeholder="Nome completo" />''',
        '''      {modal === "addC" && <Modal title="Novo contato" onClose={() => setModal(null)}>
        <Inp label="Nome *" value={cf.name} onChange={v => setCf({ ...cf, name: v })} placeholder="Nome completo" />
        <ContactCircleField network={network} value={contactCircleDraft} onChange={setContactCircleDraft} />''',
        "Escolha de círculo no cadastro",
    )
    return app

def prepare_danna():
    text = read("src/components/ConexiaLabHome.jsx")
    if "const askContactCircle =" in text:
        if "pendingGroupingRef" not in text or "networkOrganization:" not in text:
            raise RuntimeError("Integração dos círculos incompleta na Danna.")
        return text

    text = '''import ContactCircleField from "./ContactCircleField";
import { circlePath, resolveCircle } from "../../shared/networkCircles.js";
''' + text

    text = replace_once(
        text,
        '''  onDataChanged,
  voiceEngine = "openai",''',
        '''  onDataChanged,
  network,
  voiceEngine = "openai",''',
        "Propriedade network",
    )

    text = replace_once(
        text,
        '''}, ref) {
  const [prefs, setPrefs] = useState(null);''',
        '''}, ref) {
  const networkRef = useRef(network);
  networkRef.current = network;
  const [prefs, setPrefs] = useState(null);''',
        "Referência da rede",
    )

    text = replace_once(
        text,
        '  const [pendingContact, setPendingContact] = useState(null);',
        '''  const [pendingContact, setPendingContact] = useState(null);
  const [pendingGrouping, setPendingGrouping] = useState(null);
  const pendingGroupingRef = useRef(null);
  const [groupChoice, setGroupChoice] = useState("");''',
        "Escolha pendente de grupo",
    )

    text = replace_once(
        text,
        '''    const networkScope = isNetworkQuestion(text);
    const ctx = networkScope''',
        '''    const networkScope = isNetworkQuestion(text);
    const conversationContext = networkScope''',
        "Contexto da conversa",
    )

    text = replace_once(
        text,
        '''      : brain?.overview;

    const prompt = `''',
        '''      : brain?.overview;
    const ctx = {
      ...conversationContext,
      networkOrganization: networkRef.current
        ? networkRef.current.circles.map(c => ({
            id: c.id,
            path: circlePath(networkRef.current.circles, c.id),
            contactIds: Object.keys(networkRef.current.assignments)
              .filter(id => networkRef.current.assignments[id] === c.id),
          }))
        : [],
    };

    const prompt = `''',
        "Organização no cérebro central",
    )

    text = replace_once(
        text,
        '''    if (pendingContactRef.current) {
      const nameState = pendingNameRef.current;''',
        '''    if (pendingGroupingRef.current) {
      await handleCircleChoice(line);
      return;
    }

    if (pendingContactRef.current) {
      const nameState = pendingNameRef.current;''',
        "Resposta da escolha de grupo",
    )

    text = replace_once(
        text,
        "  const declineCapturedContact = () => {",
        GROUP_HANDLERS + "  const declineCapturedContact = () => {",
        "Funções de organização",
    )

    text = replace_once(
        text,
        '''        `Pronto. ${linked.contactName} está na sua rede e vinculado ao relato que já salvei.`;''',
        '''        `Pronto. ${linked.contactName} está na sua rede e vinculado ao relato que já salvei.` + askContactCircle(linked.contactId, linked.contactName);''',
        "Pergunta após cadastrar",
    )

    text = replace_once(
        text,
        '''            {pendingContact && (
              <div style={{ marginTop: 16 }}>''',
        '''            {pendingGrouping && network && <div style={{ marginTop: 16 }}>
              <ContactCircleField
                network={network}
                value={groupChoice}
                onChange={setGroupChoice}
                label={`Onde colocar ${pendingGrouping.contactName}?`}
              />
              <button
                disabled={network.loading || Boolean(network.error)}
                onClick={() => finishCircleChoice(groupChoice || null)}
                style={secondaryButton}
              >Salvar grupo</button>{" "}
              <button
                onClick={() => finishCircleChoice(null)}
                style={secondaryButton}
              >Organizar depois</button>
            </div>}
            {pendingContact && (
              <div style={{ marginTop: 16 }}>''',
        "Escolha de grupo na tela",
    )
    return text

def main():
    # Prepara tudo antes de escrever. Se algum trecho mudou, interrompe.
    prepared = {
        path: content.lstrip("\n")
        for path, content in FILES.items()
    }
    prepared["src/App.jsx"] = prepare_app()
    prepared["src/components/ConexiaLabHome.jsx"] = prepare_danna()

    # Exige a classe Gemini já existente, usada pelo motor Fish.
    base = read("src/lib/dannaGeminiLive.js")
    for required in (
        "this.micStream",
        "this.playing",
        "setSpeaking(",
        "sendToolResponse(",
        "stopPlayback(",
    ):
        if required not in base:
            raise RuntimeError(
                "dannaGeminiLive.js incompatível. Nenhum arquivo foi alterado."
            )

    changed = []
    originals = {}
    try:
        for path, content in prepared.items():
            target = ROOT / path
            old = target.read_text(encoding="utf-8") if target.exists() else None
            if old == content:
                continue
            originals[path] = old
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            changed.append(path)
    except Exception:
        for path, old in originals.items():
            target = ROOT / path
            if old is None:
                target.unlink(missing_ok=True)
            else:
                target.write_text(old, encoding="utf-8")
        raise

    if changed:
        print("Correções aplicadas:")
        for path in changed:
            print(" -", path)
    else:
        print("As correções já estão aplicadas.")

    print("Usa as tabelas de círculos já existentes no Supabase.")
    print("A proteção de áudio se aplica ao motor Fish.")

if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERRO: {error}", file=sys.stderr)
        sys.exit(1)
