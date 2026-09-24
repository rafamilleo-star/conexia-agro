import { createClient } from "@supabase/supabase-js";

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase server credentials não configuradas."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getBearer(req) {
  const auth =
    req.headers.authorization || "";

  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice(7);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const token = getBearer(req);

  if (!token) {
    return res.status(401).json({
      error: "Não autenticado",
    });
  }

  try {
    const supabase =
      getSupabaseAdmin();

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        error: "Sessão inválida",
      });
    }

    const {
      contactId,
      contactName,
    } = req.body || {};

    if (!contactId && !contactName) {
      return res.status(400).json({
        error:
          "Informe contactId ou contactName",
      });
    }

    let query =
      supabase
        .from("contacts")
        .select(`
          id,
          name,
          company,
          role,
          category,
          proximity,
          influence,
          trust,
          ideal_frequency_days,
          how_met,
          personal_notes,
          professional_notes,
          interests,
          challenges,
          next_action,
          next_action_date,
          last_interaction_at,
          health_score,
          status
        `)
        .eq("user_id", user.id);

    if (contactId) {
      query =
        query.eq("id", contactId);
    } else {
      query =
        query.ilike(
          "name",
          `%${contactName}%`
        );
    }

    const {
      data: contacts,
      error: contactError,
    } = await query.limit(5);

    if (contactError) {
      throw contactError;
    }

    if (!contacts?.length) {
      return res.status(404).json({
        error:
          "Pessoa não encontrada no CONÉXIA",
      });
    }

    /*
     * Não deixa Danna adivinhar qual João,
     * Maria etc.
     */
    if (
      !contactId &&
      contacts.length > 1
    ) {
      return res.status(409).json({
        error:
          "Mais de uma pessoa encontrada",

        needsDisambiguation: true,

        contacts:
          contacts.map((contact) => ({
            id: contact.id,
            name: contact.name,
            company: contact.company,
            role: contact.role,
          })),
      });
    }

    const contact =
      contacts[0];

    const {
      data: interactions,
      error: interactionError,
    } =
      await supabase
        .from("interactions")
        .select(`
          id,
          type,
          description,
          sentiment,
          tags,
          value_generated,
          asked_for_something,
          next_action,
          next_action_date,
          created_at
        `)
        .eq("user_id", user.id)
        .eq("contact_id", contact.id)
        .order(
          "created_at",
          { ascending: false }
        )
        .limit(10);

    if (interactionError) {
      throw interactionError;
    }

    const context = {
      person: {
        id: contact.id,
        name: contact.name,
        company: contact.company,
        role: contact.role,
        category: contact.category,
      },

      relationship: {
        proximity:
          contact.proximity,

        influence:
          contact.influence,

        trust:
          contact.trust,

        healthScore:
          contact.health_score,

        idealFrequencyDays:
          contact.ideal_frequency_days,

        lastInteractionAt:
          contact.last_interaction_at,

        status:
          contact.status,

        howMet:
          contact.how_met,
      },

      knownContext: {
        interests:
          contact.interests,

        challenges:
          contact.challenges,

        personalNotes:
          contact.personal_notes,

        professionalNotes:
          contact.professional_notes,
      },

      openLoop: {
        nextAction:
          contact.next_action,

        nextActionDate:
          contact.next_action_date,
      },

      recentInteractions:
        (interactions || []).map(
          (item) => ({
            id: item.id,

            date:
              item.created_at,

            type:
              item.type,

            description:
              item.description,

            sentiment:
              item.sentiment,

            tags:
              item.tags || [],

            valueGenerated:
              item.value_generated,

            askedForSomething:
              item.asked_for_something,

            nextAction:
              item.next_action,

            nextActionDate:
              item.next_action_date,
          })
        ),
    };

    const dannaContext = `
CONTEXTO RELACIONAL REAL DO CONÉXIA:

${JSON.stringify(context, null, 2)}

INSTRUÇÕES:

Considere somente as informações acima
como fatos registrados.

Não invente informações.

Notas podem representar um momento antigo.

Diferencie:
- histórico;
- situação atual;
- assunto em aberto;
- inferência.

Quando houver mudança clara entre
interações, destaque essa mudança.

Não transforme automaticamente
a relação em oportunidade comercial.

Se sugerir uma ação, trate-a como
um possível próximo movimento,
não como obrigação.

Se o usuário corrigir alguma informação,
considere a correção mais recente.
    `.trim();

    return res.status(200).json({
      contactId: contact.id,
      context,
      dannaContext,
    });
  } catch (error) {
    console.error(
      "[Relationship Context]",
      error
    );

    return res.status(500).json({
      error:
        "Erro ao montar contexto relacional",

      details:
        error?.message ||
        String(error),
    });
  }
}
