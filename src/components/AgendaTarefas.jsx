import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../utils/supabase";
import { C } from "../utils/theme";
import { ativarLembretes, lembretesAtivos, pushSuportado } from "../utils/push";

// Agenda pessoal de tarefas. Cada usuário vê apenas as próprias linhas
// (RLS na tabela public.tasks_agenda, política "ta_own").

const STATUS = {
  pendente: { label: "Pendente", color: C.txM },
  em_andamento: { label: "Em andamento", color: C.blu },
  feita: { label: "Feita", color: C.grn },
};
const NEXT_STATUS = { pendente: "em_andamento", em_andamento: "feita", feita: "pendente" };

const todayISO = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD no fuso local

const formatPrazo = (iso) => {
  if (!iso) return "Sem prazo";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const FONT = "'DM Sans', sans-serif";

export default function AgendaTarefas({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState("abertas"); // abertas | feitas | todas
  const [editingId, setEditingId] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const cancelarEdicao = useRef(false);
  const [lembretes, setLembretes] = useState("verificando"); // verificando | ativos | inativos | indisponivel

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    const { data, error: err } = await supabase
      .from("tasks_agenda")
      .select("*")
      .eq("user_id", userId)
      .order("prazo", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (err) setError("Não foi possível carregar sua agenda. Tente novamente.");
    else setTasks(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pushSuportado()) { setLembretes("indisponivel"); return; }
    lembretesAtivos().then((ok) => setLembretes(ok ? "ativos" : "inativos")).catch(() => setLembretes("inativos"));
  }, []);

  const ativar = async () => {
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Entre novamente no Conexia.");
      await ativarLembretes(session.access_token);
      setLembretes("ativos");
    } catch (e) {
      setError(e.message);
    }
  };

  const addTask = async (e) => {
    e.preventDefault();
    const t = titulo.trim();
    if (!t || saving) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("tasks_agenda")
      .insert({ user_id: userId, titulo: t, prazo: prazo || null, status: "pendente", origem: "app" })
      .select()
      .single();
    if (err) setError("Não foi possível salvar a tarefa. Tente novamente.");
    else {
      setTasks((prev) => [...prev, data].sort((a, b) => (a.prazo || "9999").localeCompare(b.prazo || "9999")));
      setTitulo("");
      setPrazo("");
    }
    setSaving(false);
  };

  const cycleStatus = async (task) => {
    const novo = NEXT_STATUS[task.status] || "pendente";
    setError("");
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: novo } : t)));
    const { error: err } = await supabase
      .from("tasks_agenda")
      .update({ status: novo, updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", userId);
    if (err) {
      setError("Não foi possível atualizar a tarefa.");
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t)));
    }
  };

  const removeTask = async (task) => {
    setError("");
    const anterior = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const { error: err } = await supabase
      .from("tasks_agenda")
      .delete()
      .eq("id", task.id)
      .eq("user_id", userId);
    if (err) {
      setError("Não foi possível excluir a tarefa.");
      setTasks(anterior);
    }
  };

  const saveEdit = async (task) => {
    if (cancelarEdicao.current) { cancelarEdicao.current = false; setEditingId(null); return; }
    const t = editTitulo.trim();
    setEditingId(null);
    if (!t || t === task.titulo) return;
    setError("");
    const anterior = tasks;
    setTasks((prev) => prev.map((x) => (x.id === task.id ? { ...x, titulo: t } : x)));
    const { error: err } = await supabase
      .from("tasks_agenda")
      .update({ titulo: t, updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("user_id", userId);
    if (err) {
      setError("Não foi possível salvar a edição.");
      setTasks(anterior);
    }
  };

  const visiveis = useMemo(() => {
    if (filtro === "abertas") return tasks.filter((t) => t.status !== "feita");
    if (filtro === "feitas") return tasks.filter((t) => t.status === "feita");
    return tasks;
  }, [tasks, filtro]);

  const hoje = todayISO();
  const atrasadas = (t) => t.status !== "feita" && t.prazo && t.prazo < hoje;

  const btnBase = {
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 8,
    padding: "7px 12px",
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "8px 4px", fontFamily: FONT, color: C.txt }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 700, margin: "0 0 4px" }}>Agenda</h2>
      <p style={{ fontSize: 13, color: C.txM, margin: "0 0 18px", lineHeight: 1.5 }}>
        Suas tarefas pessoais. Só você vê esta lista.
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.card, border: `1px solid ${C.brd}`, borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.txM, lineHeight: 1.4 }}>
          {lembretes === "ativos" ? "🔔 Lembretes diários ativos (08:00)." : lembretes === "indisponivel" ? "Lembretes indisponíveis neste navegador." : "Receba um lembrete diário das tarefas de hoje."}
        </div>
        {(lembretes === "inativos") && (
          <button onClick={ativar} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, borderRadius: 8, padding: "7px 12px", cursor: "pointer", background: C.gold, color: C.bg, border: "none", whiteSpace: "nowrap" }}>
            Ativar lembretes
          </button>
        )}
      </div>

      <form onSubmit={addTask} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Nova tarefa"
          maxLength={200}
          style={{ flex: "2 1 220px", background: C.sf, color: C.txt, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "9px 12px", fontFamily: FONT, fontSize: 14 }}
        />
        <input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          style={{ flex: "1 1 150px", background: C.sf, color: C.txt, border: `1px solid ${C.brd}`, borderRadius: 8, padding: "9px 12px", fontFamily: FONT, fontSize: 14, colorScheme: "dark" }}
        />
        <button
          type="submit"
          disabled={!titulo.trim() || saving}
          style={{ ...btnBase, background: C.gold, color: C.bg, border: "none", padding: "9px 16px", fontSize: 13, opacity: !titulo.trim() || saving ? 0.5 : 1 }}
        >
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </form>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["abertas", "Abertas"], ["feitas", "Feitas"], ["todas", "Todas"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            style={{ ...btnBase, background: filtro === id ? C.gD : "transparent", border: `1px solid ${filtro === id ? C.gL : C.brd}`, color: filtro === id ? C.gold : C.txM }}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: C.corD, border: `1px solid ${C.cor}`, color: C.cor, borderRadius: 8, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: C.txM }}>Carregando sua agenda...</p>}

      {!loading && visiveis.length === 0 && (
        <p style={{ fontSize: 13, color: C.txM }}>
          {filtro === "feitas" ? "Nenhuma tarefa concluída ainda." : "Nenhuma tarefa aberta. Adicione a primeira acima."}
        </p>
      )}

      {!loading && visiveis.map((t) => {
        const st = STATUS[t.status] || STATUS.pendente;
        const late = atrasadas(t);
        return (
          <div
            key={t.id}
            style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${late ? C.amb : C.brd}`, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}
          >
            <button
              onClick={() => cycleStatus(t)}
              title="Mudar status"
              style={{ ...btnBase, background: "transparent", border: `1px solid ${st.color}`, color: st.color, minWidth: 104, padding: "6px 8px", fontSize: 11 }}
            >
              {st.label}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === t.id ? (
                <input
                  autoFocus
                  value={editTitulo}
                  maxLength={200}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  onBlur={() => saveEdit(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { cancelarEdicao.current = true; e.currentTarget.blur(); }
                  }}
                  style={{ width: "100%", background: C.sf, color: C.txt, border: `1px solid ${C.gL}`, borderRadius: 6, padding: "6px 8px", fontFamily: FONT, fontSize: 14, boxSizing: "border-box" }}
                />
              ) : (
                <div
                  onClick={() => { setEditingId(t.id); setEditTitulo(t.titulo); }}
                  title="Tocar para editar"
                  style={{ fontSize: 14, cursor: "text", color: t.status === "feita" ? C.txL : C.txt, textDecoration: t.status === "feita" ? "line-through" : "none", overflowWrap: "anywhere" }}
                >
                  {t.titulo}
                </div>
              )}
              <div style={{ fontSize: 11, color: late ? C.amb : C.txL, marginTop: 3 }}>
                {late ? "Atrasada · " : ""}{formatPrazo(t.prazo)}{t.origem === "whatsapp" ? " · via WhatsApp" : ""}
              </div>
            </div>
            <button
              onClick={() => removeTask(t)}
              title="Excluir"
              style={{ ...btnBase, background: "transparent", border: "none", color: C.txL, padding: "4px 6px", fontSize: 16 }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
