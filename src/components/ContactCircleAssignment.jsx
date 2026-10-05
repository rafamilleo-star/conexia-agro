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
