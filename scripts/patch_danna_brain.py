from pathlib import Path
import re

p = Path('src/components/ConexiaLabHome.jsx')
s = p.read_text(encoding='utf-8')

marker = '  const askNetwork = async (text) => {'
if marker not in s:
    raise RuntimeError('Nao encontrei askNetwork no ConexiaLabHome.jsx')

helper = r'''  // Danna Central Brain: consulta o CONÉXIA inteiro sob demanda.
  // A Home continua leve; os dados completos só são buscados quando Rafael pergunta algo.
  const loadDannaKnowledge = async () => {
    if (!userId) throw new Error("Sessão não autenticada.");

    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const horizon = new Date(now.getTime() + 45 * 86400000).toISOString();

    const [
      contactsRes,
      interactionsRes,
      memoryRes,
      alertsRes,
      eventsRes,
      signalsRes,
      profileRes,
    ] = await Promise.all([
      supabase
        .from("contacts")
        .select("id,name,company,role,category,city,state_code,birthday,hobbies,main_culture,personal_notes,notes,next_action,next_action_date,last_interaction_at,status,ideal_frequency_days")
        .eq("user_id", userId)
        .order("last_interaction_at", { ascending: false, nullsFirst: false }),

      supabase
        .from("interactions")
        .select("id,contact_id,type,description,sentiment,tags,value_generated,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),

      supabase
        .from("relational_memory")
        .select("id,contact_id,memory_type,content,summary,source_type,source_excerpt,confidence,occurred_at,valid_from,valid_until,created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200),

      supabase
        .from("alerts")
        .select("id,contact_id,title,description,status,created_at,metadata")
        .eq("user_id", userId)
        .neq("status", "dismissed")
        .order("created_at", { ascending: false })
        .limit(100),

      supabase
        .from("scheduled_events")
        .select("id,contact_id,type,scheduled_at,duration_minutes,location,notes,status,source,created_at")
        .eq("user_id", userId)
        .gte("scheduled_at", new Date(now.getTime() - 7 * 86400000).toISOString())
        .lte("scheduled_at", horizon)
        .order("scheduled_at", { ascending: true })
        .limit(150),

      supabase
        .from("signals")
        .select("id,contact_id,source,type,title,summary,identity_confidence,detected_at,expires_at,status")
        .eq("user_id", userId)
        .in("status", ["new", "active", "pending"])
        .order("detected_at", { ascending: false })
        .limit(100),

      supabase
        .from("profiles")
        .select("id,name,first_name,company,role,city,segment,timezone,last_discussed_contact_id,last_discussed_contact_at,calendar_ics_url")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const critical = [contactsRes, interactionsRes, memoryRes, eventsRes];
    const criticalError = critical.find(x => x?.error)?.error;
    if (criticalError) throw criticalError;

    // Alerts/signals são enriquecimento. Se uma dessas fontes falhar, a Danna continua.
    if (alertsRes.error) console.warn("[Danna Brain] alerts indisponível", alertsRes.error);
    if (signalsRes.error) console.warn("[Danna Brain] signals indisponível", signalsRes.error);
    if (profileRes.error) console.warn("[Danna Brain] profile indisponível", profileRes.error);

    const people = contactsRes.data || [];
    const contactById = new Map(people.map(c => [c.id, c]));
    const contactName = id => contactById.get(id)?.name || null;

    const contactsForAI = people.map(c => ({
