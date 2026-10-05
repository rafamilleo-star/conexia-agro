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
