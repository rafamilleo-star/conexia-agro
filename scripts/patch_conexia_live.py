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
      id: c.id,
      name: c.name,
      company: c.company || null,
      role: c.role || null,
      category: c.category || null,
      city: c.city || null,
      state: c.state_code || null,
      birthday: c.birthday || null,
      hobbies: c.hobbies || null,
      culture: c.main_culture || null,
      notes: (c.personal_notes || c.notes || "").slice(0, 800) || null,
      nextAction: c.next_action || null,
      nextActionDate: c.next_action_date || null,
      lastInteractionAt: c.last_interaction_at || null,
      idealFrequencyDays: c.ideal_frequency_days || null,
      status: c.status || null,
    }));

    const interactionsForAI = (interactionsRes.data || []).map(i => ({
      id: i.id,
      contactId: i.contact_id,
      person: contactName(i.contact_id) || "desconhecido",
      date: i.created_at,
      type: i.type || null,
      description: String(i.description || "").slice(0, 1000),
      sentiment: i.sentiment || null,
      tags: Array.isArray(i.tags) ? i.tags.slice(0, 8) : [],
      valueGenerated: Boolean(i.value_generated),
    }));

    const memoriesForAI = (memoryRes.data || [])
      .filter(m => !m.valid_until || new Date(m.valid_until).getTime() >= now.getTime())
      .map(m => ({
        id: m.id,
        contactId: m.contact_id,
        person: contactName(m.contact_id),
        type: m.memory_type,
        content: m.content,
        summary: m.summary || null,
        source: m.source_type,
        confidence: Number(m.confidence ?? 1),
        occurredAt: m.occurred_at || null,
        validFrom: m.valid_from || null,
        validUntil: m.valid_until || null,
        createdAt: m.created_at,
      }));

    const alertsForAI = (alertsRes.data || []).map(a => ({
      person: contactName(a.contact_id),
      title: a.title,
      description: a.description,
      status: a.status,
      createdAt: a.created_at,
    }));

    const eventsForAI = (eventsRes.data || []).map(e => ({
      person: contactName(e.contact_id),
      contactId: e.contact_id,
      type: e.type,
      scheduledAt: e.scheduled_at,
      durationMinutes: e.duration_minutes,
      location: e.location || null,
      notes: e.notes || null,
      status: e.status,
      source: e.source,
    }));

    const signalsForAI = (signalsRes.data || []).map(sig => ({
      person: contactName(sig.contact_id),
      source: sig.source,
      type: sig.type,
      title: sig.title,
      summary: sig.summary,
      confidence: sig.identity_confidence,
      detectedAt: sig.detected_at,
      expiresAt: sig.expires_at,
      status: sig.status,
    }));

    const pendingActions = contactsForAI
      .filter(c => c.nextAction)
      .sort((a, b) => String(a.nextActionDate || "9999").localeCompare(String(b.nextActionDate || "9999")));

    return {
      generatedAt: nowIso,
      today,
      timezone: profileRes.data?.timezone || timeZone || "America/Sao_Paulo",
      profile: profileRes.data || null,
      contacts: contactsForAI,
      interactions: interactionsForAI,
      memories: memoriesForAI,
      scheduledEvents: eventsForAI,
      pendingActions,
      alerts: alertsForAI,
      signals: signalsForAI,
    };
  };

'''
s = s.replace(marker, helper + marker, 1)

start = s.index(marker)
end = s.index('  const classifyIntent = async (text) => {', start)
new_ask = r'''  const askNetwork = async (text) => {
    // Consulta fresca a cada pergunta: Danna não responde com um snapshot velho da Home.
    const knowledge = await loadDannaKnowledge();

    const ctx = {
      ...sessionContextRef.current,
      lastSavedInteraction: lastSavedContextRef.current,
    };

    const prompt = `
Você é DANNA, a inteligência relacional central do CONÉXIA.

O usuário abriu a Danna diretamente. Ele NÃO precisa escolher contato, tela ou módulo antes de perguntar.
Sua função é responder usando os DADOS REAIS DO CONÉXIA fornecidos abaixo.

O usuário pode perguntar livremente, por exemplo:
- "quando falei com João?"
- "o que sei sobre Maria?"
- "quem está esfriando?"
- "o que tenho esta semana?"
- "quais reuniões tenho?"
- "o que ficou pendente?"
- "quem preciso procurar hoje?"
- "quem conheço na empresa X?"
- "o que combinamos com Carlos?"
- "me prepare para a reunião com Ana"
- "quem pode me conectar com determinada pessoa/tema?"

FONTES E HIERARQUIA:
1. CONTACTS = cadastro atual das pessoas.
2. INTERACTIONS = fatos registrados sobre conversas/encontros.
3. RELATIONAL_MEMORY = memória de longo prazo CONFIRMADA. Use apenas como contexto factual conforme tipo/confiança.
4. SCHEDULED_EVENTS = agenda/eventos relacionais conhecidos pelo CONÉXIA.
5. PENDING_ACTIONS = próximos movimentos cadastrados nos contatos.
6. ALERTS = alertas do sistema.
7. SIGNALS = sinais externos/internos; trate como sinal, não como fato absoluto.

REGRAS DE VERDADE:
- Nunca invente pessoa, reunião, compromisso, memória, empresa, data ou evento.
- Diferencie fato registrado de inferência/padrão.
- memory.type=pattern não vira fato sobre intenção de alguém.
- signal com baixa confiança deve ser explicitamente tratado como sinal incerto.
- se a informação não estiver nas fontes, diga "não encontrei isso registrado no CONÉXIA" e diga qual dado existe de mais próximo.
- quando houver conflito, prefira registro mais recente e mencione a divergência se ela importar.
- não diga "eu lembro" só para demonstrar memória.

TEMPO E SEMANA:
- GENERATED_AT é a referência de agora.
- Para "hoje", "amanhã", "esta semana", "próxima semana", calcule usando scheduledEvents + pendingActions.
- Inclua data exata quando o usuário pedir "quando", "qual dia/data/horário" ou quando for necessária para agir.
- Não confunda nextActionDate com evento confirmado: é próximo movimento planejado.

COMPORTAMENTO:
- Responda primeiro à pergunta. Sem introdução genérica.
- Seja natural e concisa; detalhe quando a pergunta exigir.
- Se houver várias pessoas com nome parecido, NÃO escolha silenciosamente: mostre as opções e peça desambiguação.
- Preserve referências da conversa (ele/ela/essa reunião/isso) usando CONTEXTO ATIVO e ÚLTIMOS TURNOS.
- Não force pergunta de continuidade.
- Não transforme tudo em tarefa ou CRM.
- Se a pergunta for ampla ("o que merece minha atenção?"), priorize 1 a 3 itens por urgência + relevância relacional + evidência.

CONTEXTO ATIVO DA CONVERSA:
${JSON.stringify(ctx)}

ÚLTIMOS TURNOS:
${JSON.stringify(recentTurnsRef.current)}

PERGUNTA ATUAL:
${text}

SNAPSHOT FRESCO DO CONÉXIA:
${JSON.stringify(knowledge)}

Responda SOMENTE JSON válido:
{
  "answer":"resposta natural, factual e útil",
  "view":"answer|connection|person|insight",
  "people":["nomes exatos de até 3 pessoas relevantes"],
  "topics":["até 5 temas"],
  "activePerson":"nome principal ou null",
  "relationalMode":"person_memory|meeting_prep|relationship_risk|connection_discovery|network_pattern|next_best_action|pending_commitment|week_overview|calendar_query|network_search|general_relational",
  "confidence":"high|medium|low"
}
`.trim();

    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        maxTokens: 1800,
        temperature: 0.2,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || data?.error || `HTTP ${res.status}`);
    }

    const parsed = firstJson(data.content?.[0]?.text || "");
    if (!parsed) throw new Error("Não consegui estruturar a resposta.");

    const resolvedPeople = (parsed.people || [])
      .map(name => findContactByName(name))
      .filter(Boolean)
      .slice(0, 2);

    const finalAnswer = parsed.answer || "Não encontrei evidência suficiente no CONÉXIA.";
    setAnswer(finalAnswer);

    sessionContextRef.current.lastQuestion = text;
    sessionContextRef.current.activePeople = resolvedPeople.map(p => p.name);
    sessionContextRef.current.activeTopics = parsed.topics || [];
    sessionContextRef.current.lastView = parsed.view || "answer";
    if (parsed.activePerson) sessionContextRef.current.activePerson = parsed.activePerson;

    if (parsed.view === "connection" && resolvedPeople.length >= 2) {
      setConnectionData({
        people: resolvedPeople,
        topics: parsed.topics || [],
        answer: finalAnswer,
      });
      setCurrentView("connection");
    } else {
      setCurrentView("answer");
    }

    speak(finalAnswer, true);
  };

'''
s = s[:start] + new_ask + s[end:]

# O roteador antigo excluía perguntas de agenda genérica. A Danna central deve entender
# semana/agenda/pendências do próprio CONÉXIA como consultas válidas.
s = s.replace(
'''out_of_scope
= assunto sem relação com pessoas, relações, interações, contexto profissional/pessoal relacional, preparação de conversas, networking ou inteligência relacional.''',
'''out_of_scope
= assunto que não pode ser respondido com dados do CONÉXIA e não tem relação com pessoas, relações, interações, agenda relacional, semana, pendências, memória, contexto profissional/pessoal, preparação de conversas, networking ou inteligência relacional.'''
)
s = s.replace(
'''- "o que eu preciso saber?", "como me preparo?", "e ele?", "por quê?", "e agora?", "qual o risco?", "quem poderia ajudar?" = relational;''',
'''- "o que eu preciso saber?", "como me preparo?", "e ele?", "por quê?", "e agora?", "qual o risco?", "quem poderia ajudar?" = relational;
- "o que tenho hoje?", "o que tenho esta semana?", "qual minha agenda?", "quais reuniões?", "o que ficou pendente?" = relational;'''
)

# Ao abrir a sessão, entregue um brief central mínimo com dados frescos. Falha aqui não impede a conversa.
old = '''    live.addContext(
      "Conversa de inteligência relacional no CONÉXIA. " +
      "Escute e aguarde o aplicativo enviar o conteúdo falado. " +
      "Nunca use a expressão 'o usuário'."
    );'''
new = '''    try {
      const k = await loadDannaKnowledge();
      const nextEvents = (k.scheduledEvents || []).filter(e => new Date(e.scheduledAt).getTime() >= Date.now()).slice(0, 8);
      const nextActions = (k.pendingActions || []).slice(0, 8);
      const recentMemories = (k.memories || []).slice(0, 8);
      live.addContext([
        "DANNA CENTRAL DO CONÉXIA.",
        `Agora: ${k.generatedAt}.`,
        `Próximos eventos: ${JSON.stringify(nextEvents)}.`,
        `Próximos movimentos: ${JSON.stringify(nextActions)}.`,
        `Memórias confirmadas recentes: ${JSON.stringify(recentMemories)}.`,
        "Este contexto é silencioso. Não recite. Aguarde a pergunta e consulte o cérebro completo quando necessário."
      ].join("\\n"));
    } catch (contextError) {
      console.warn("[Danna Brain] brief inicial indisponível", contextError);
      live.addContext(
        "Danna central do CONÉXIA. Aguarde a pergunta. O aplicativo consultará os dados relacionais sob demanda."
      );
    }'''
if old not in s:
    raise RuntimeError('Nao encontrei o bloco live.addContext esperado')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('OK: ConexiaLabHome.jsx atualizado com Danna Central Brain')
