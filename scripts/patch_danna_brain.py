"""Danna Central Brain — patch idempotente em src/components/ConexiaLabHome.jsx.

1. Injeta loadDannaKnowledge() antes de askNetwork: lê o CONÉXIA inteiro
   (contatos, interações, memória relacional, alertas, agenda, sinais, perfil)
   sob demanda, só quando Rafael pergunta algo.
2. Faz askNetwork usar esse snapshot fresco (com fallback para os dados da Home).
3. Injeta o bloco "SNAPSHOT FRESCO DO CONÉXIA" + week_overview no prompt.

Rodar de novo não duplica nada: cada etapa verifica se já foi aplicada.
"""
from pathlib import Path

p = Path('src/components/ConexiaLabHome.jsx')
s = p.read_text(encoding='utf-8')
original = s


def must_replace(src, old, new, label):
    count = src.count(old)
    if count != 1:
        raise RuntimeError(f'[{label}] esperava 1 ocorrência do trecho-âncora, encontrei {count}.')
    return src.replace(old, new, 1)


# ---------------------------------------------------------------------------
# 1) Helper loadDannaKnowledge
# ---------------------------------------------------------------------------
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
        .in("status", ["new", "evaluated", "relevant"])
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
      id: c.id,
      name: c.name,
      company: c.company || "",
      role: c.role || "",
      category: c.category || "",
      city: [c.city, c.state_code].filter(Boolean).join("/"),
      birthday: c.birthday || null,
      hobbies: c.hobbies || null,
      mainCulture: c.main_culture || null,
      notes: (c.personal_notes || c.notes || "").slice(0, 400),
      nextAction: c.next_action || null,
      nextActionDate: c.next_action_date || null,
      lastInteractionAt: c.last_interaction_at || null,
      idealFrequencyDays: c.ideal_frequency_days || null,
      status: c.status || null,
    }));

    // Interações: 500 lidas, 200 enviadas à IA (controle de tamanho do prompt).
    const interactionsForAI = (interactionsRes.data || []).slice(0, 200).map(i => ({
      person: contactName(i.contact_id) || "desconhecido",
      date: i.created_at,
      type: i.type || "",
      description: (i.description || "").slice(0, 400),
      tags: i.tags || [],
      sentiment: i.sentiment || "",
      valueGenerated: i.value_generated || null,
    }));

    const memoryForAI = (memoryRes.data || []).map(m => ({
      person: contactName(m.contact_id),
      type: m.memory_type,
      content: (m.summary || m.content || "").slice(0, 400),
      source: m.source_type,
      confidence: m.confidence,
      occurredAt: m.occurred_at,
      validUntil: m.valid_until,
    }));

    const alertsForAI = (alertsRes.data || []).map(a => ({
      person: contactName(a.contact_id),
      title: a.title,
      description: (a.description || "").slice(0, 300),
      status: a.status,
      createdAt: a.created_at,
    }));

    const signalsForAI = (signalsRes.data || []).map(sg => ({
      person: contactName(sg.contact_id),
      source: sg.source,
      type: sg.type,
      title: sg.title,
      summary: (sg.summary || "").slice(0, 300),
      identityConfidence: sg.identity_confidence,
      detectedAt: sg.detected_at,
      status: sg.status,
    }));

    const tz = profileRes.data?.timezone || timeZone || "America/Sao_Paulo";
    const dayKey = d => {
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
      } catch {
        return new Date(d).toISOString().slice(0, 10);
      }
    };
    const timeLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(d));
      } catch {
        return "";
      }
    };
    const weekdayLabel = d => {
      try {
        return new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(d));
      } catch {
        return dayKey(d);
      }
    };

    const events = (eventsRes.data || [])
      .filter(e => e.status !== "cancelado")
      .map(e => ({
        person: contactName(e.contact_id),
        type: e.type,
        at: e.scheduled_at,
        day: dayKey(e.scheduled_at),
        time: timeLabel(e.scheduled_at),
        durationMinutes: e.duration_minutes || null,
        location: e.location || null,
        notes: (e.notes || "").slice(0, 300),
        status: e.status,
        source: e.source,
      }));

    const upcomingEvents = events.filter(e => e.at >= nowIso);
    const recentPastEvents = events.filter(e => e.at < nowIso);

    // Visão da semana: hoje + 6 dias, dia a dia (inclusive dias livres).
    const week_overview = Array.from({ length: 7 }, (_, idx) => {
      const ref = new Date(now.getTime() + idx * 86400000);
      const key = dayKey(ref);
      const dayEvents = upcomingEvents.filter(e => e.day === key);
      return {
        date: key,
        label: idx === 0 ? `hoje (${weekdayLabel(ref)})` : idx === 1 ? `amanhã (${weekdayLabel(ref)})` : weekdayLabel(ref),
        eventCount: dayEvents.length,
        events: dayEvents.map(({ day, ...rest }) => rest),
      };
    });

    // Sinais de atenção calculados localmente (fatos, não inferência).
    const todayKey = dayKey(now);
    const overdueNextActions = people
      .filter(c => c.next_action && c.next_action_date && String(c.next_action_date).slice(0, 10) < todayKey)
      .map(c => ({ person: c.name, nextAction: c.next_action, dueDate: c.next_action_date }))
      .slice(0, 30);

    const upcomingBirthdays = people
      .map(c => {
        const m = String(c.birthday || "").match(/(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return null;
        const year = now.getFullYear();
        let next = new Date(`${year}-${m[2]}-${m[3]}T12:00:00`);
        if (next.getTime() < now.getTime() - 86400000) next = new Date(`${year + 1}-${m[2]}-${m[3]}T12:00:00`);
        const inDays = Math.round((next.getTime() - now.getTime()) / 86400000);
        return inDays >= 0 && inDays <= 30 ? { person: c.name, date: `${m[3]}/${m[2]}`, inDays } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.inDays - b.inDays);

    const coolingContacts = people
      .filter(c => c.ideal_frequency_days && c.last_interaction_at)
      .map(c => ({
        person: c.name,
        daysSinceLast: Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000),
        idealFrequencyDays: c.ideal_frequency_days,
      }))
      .filter(x => x.daysSinceLast > x.idealFrequencyDays)
      .sort((a, b) => (b.daysSinceLast - b.idealFrequencyDays) - (a.daysSinceLast - a.idealFrequencyDays))
      .slice(0, 20);

    const profile = profileRes.data || null;

    return {
      contacts: contactsForAI,
      interactions: interactionsForAI,
      overview: {
        generated_at: nowIso,
        today,
        timezone: tz,
        profile: profile
          ? {
              name: profile.first_name || profile.name || null,
              company: profile.company || null,
              role: profile.role || null,
              city: profile.city || null,
              segment: profile.segment || null,
              lastDiscussedPerson: contactName(profile.last_discussed_contact_id),
              lastDiscussedAt: profile.last_discussed_contact_at || null,
              calendarConnected: Boolean(profile.calendar_ics_url),
            }
          : null,
        counts: {
          contacts: people.length,
          interactionsLoaded: (interactionsRes.data || []).length,
          activeMemories: memoryForAI.length,
          openAlerts: alertsForAI.length,
          upcomingEvents: upcomingEvents.length,
          activeSignals: signalsForAI.length,
        },
        week_overview,
        upcoming_events: upcomingEvents.map(({ day, ...rest }) => rest),
        recent_past_events: recentPastEvents.map(({ day, ...rest }) => rest),
        relational_memory: memoryForAI,
        open_alerts: alertsForAI,
        signals: signalsForAI,
        attention: {
          overdueNextActions,
          upcomingBirthdays,
          coolingContacts,
        },
      },
    };
  };

'''

if 'const loadDannaKnowledge = async' not in s:
    s = must_replace(s, marker, helper + marker, 'helper')
    print('✓ loadDannaKnowledge inserido')
else:
    print('• loadDannaKnowledge já existia')

# ---------------------------------------------------------------------------
# 2) askNetwork passa a usar o snapshot fresco (fallback: dados da Home)
# ---------------------------------------------------------------------------
if 'brain = await loadDannaKnowledge()' not in s:
    s = must_replace(
        s,
        marker + '\n    const people = contacts.map(c => ({',
        marker + '''
    let brain = null;
    try {
      brain = await loadDannaKnowledge();
    } catch (e) {
      console.warn("[Danna Brain] snapshot indisponível; usando dados da Home.", e);
    }

    const people = brain?.contacts || contacts.map(c => ({''',
        'askNetwork-people',
    )
    s = must_replace(
        s,
        '    const recent = [...interactions]',
        '    const recent = brain?.interactions || [...interactions]',
        'askNetwork-recent',
    )
    print('✓ askNetwork conectado ao snapshot')
else:
    print('• askNetwork já usava o snapshot')

# ---------------------------------------------------------------------------
# 3) Prompt: bloco SNAPSHOT + regra de agenda
# ---------------------------------------------------------------------------
if 'SNAPSHOT FRESCO DO CONÉXIA' not in s:
    s = must_replace(
        s,
        'PESSOAS DA REDE:\n${JSON.stringify(people)}',
        '''SNAPSHOT FRESCO DO CONÉXIA (lido agora do banco; fonte de verdade para agenda, memória relacional, alertas, sinais e pontos de atenção):
${brain ? JSON.stringify(brain.overview) : "indisponível nesta consulta; use somente pessoas e interações abaixo e avise se a pergunta depender de agenda ou memória."}

PESSOAS DA REDE:
${JSON.stringify(people)}''',
        'prompt-snapshot',
    )
    s = must_replace(
        s,
        'REGRAS DE RESPOSTA:\n',
        '''REGRAS DE RESPOSTA:
- AGENDA: para "minha semana", "amanhã", "próximas reuniões" ou similares, use week_overview e upcoming_events do SNAPSHOT; nunca invente compromissos fora dele;
- MEMÓRIA: relational_memory são fatos/compromissos já consolidados; use-os como evidência forte, citando a pessoa;
- ATENÇÃO: attention traz ações vencidas, aniversários próximos e contatos esfriando; traga só o que for relevante para a pergunta;
''',
        'prompt-rules',
    )
    print('✓ Prompt enriquecido com SNAPSHOT e week_overview')
else:
    print('• Prompt já tinha o SNAPSHOT')

if s != original:
    p.write_text(s, encoding='utf-8')
    print('ConexiaLabHome.jsx atualizado.')
else:
    print('Nada a alterar.')
