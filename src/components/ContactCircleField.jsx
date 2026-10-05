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
