import { validDateOnly } from '../../shared/relationshipTriggers.js';

export function capturePerson(description) {
  return /^Pessoa mencionada: ([^\n]+)\n/.exec(
    String(description || "")
  )?.[1] || null;
}

export async function saveDannaCapture(db, userId, draft, contacts = []) {
  if (!userId) throw new Error("Entre novamente para salvar.");

  const name = String(draft.contactName || "").trim();
  const description = String(
    draft.description || draft.sourceText || ""
  ).trim();

  if (!description) {
    throw new Error("Não encontrei o relato para salvar.");
  }

  const contactId =
    contacts.find(c => c.id === draft.existingContactId)?.id || null;

  const payload = {
    user_id: userId,
    contact_id: contactId,
    type: draft.interactionType || "outro",
    description:
      !contactId && name
        ? `Pessoa mencionada: ${name}\n${description}`
        : description,
    sentiment: draft.sentiment || "neutro",
    tags: Array.isArray(draft.tags) ? draft.tags.slice(0, 5) : [],
  };

  const { data, error } = await db
    .from("interactions")
    .insert(payload)
    .select("id,created_at")
    .single();

  if (error) throw error;

  if (!data?.id) {
    throw new Error("Não consegui confirmar o registro.");
  }

  const saved = {
    ...draft,
    contactName:
      name || contacts.find(c => c.id === contactId)?.name || null,
    description,
    interactionId: data.id,
    contactId,
    savedAt: data.created_at,
    needsContact: !contactId,
  };

  try {
    await persistDannaCommitment(db, userId, saved);
  } catch (e) {
    saved.commitmentError = e.message;
  }

  return saved;
}

// Um id por interação: retries não criam múltiplos compromissos.
export async function persistDannaCommitment(db, userId, saved) {
  const nextAction = String(saved.nextAction || '').trim();

  if (!nextAction) return;

  const dueDate = validDateOnly(saved.nextActionDate);

  if (saved.nextActionDate && !dueDate) {
    throw new Error(
      'Data do próximo passo inválida; confirme a data.'
    );
  }

  const { error } = await db
    .from('relational_memory')
    .upsert(
      {
        id: saved.interactionId,
        user_id: userId,
        contact_id: saved.contactId || null,
        memory_type: 'commitment',
        content: nextAction,
        summary: nextAction,
        source_type: 'interaction',
        source_id: saved.interactionId,
        source_excerpt: saved.sourceText || saved.description,
        confidence: 1,
        status: 'active',
        occurred_at: saved.savedAt,
        metadata: {
          confirmed: true,
          due_date: dueDate,
          next_action: nextAction,
          person_name: saved.contactName,
          completed: false,
        },
      },
      {
        onConflict: 'id',
        ignoreDuplicates: true,
      }
    );

  if (error) throw error;
}

export async function linkDannaCapture(
  db,
  userId,
  saved,
  personName
) {
  const name = String(
    personName || saved.contactName || ""
  ).trim();

  if (!name) {
    throw new Error(
      "Informe o nome para adicionar a pessoa. O relato já está salvo."
    );
  }

  if (!userId || !saved.interactionId) {
    throw new Error("Não encontrei o registro salvo.");
  }

  const pattern = name.replace(
    /[\\%_]/g,
    char => `\\${char}`
  );

  const found = await db
    .from("contacts")
    .select("id,name")
    .eq("user_id", userId)
    .ilike("name", pattern)
    .limit(2);

  if (found.error) throw found.error;

  if (found.data?.length > 1) {
    throw new Error(
      "Há mais de uma pessoa com esse nome. Escolha o contato na sua rede."
    );
  }

  let contact = found.data?.[0];

  if (!contact) {
    const result = await db
      .from("contacts")
      .insert({
        user_id: userId,
        name,
        company: saved.company || null,
        role: saved.role || null,
        status: "active",
      })
      .select("id,name")
      .single();

    if (result.error) throw result.error;
    contact = result.data;
  }

  const linked = await db
    .from("interactions")
    .update({
      contact_id: contact.id,
      description: saved.description,
    })
    .eq("id", saved.interactionId)
    .eq("user_id", userId)
    .select("id")
    .single();

  if (linked.error) throw linked.error;

  return {
    ...saved,
    contactId: contact.id,
    contactName: contact.name,
    needsContact: false,
  };
}

export async function updateDannaContact(
  db,
  userId,
  saved
) {
  if (!saved.contactId) return;

  await persistDannaCommitment(db, userId, saved);

  if (saved.nextAction) {
    const linked = await db
      .from('relational_memory')
      .update({
        contact_id: saved.contactId,
      })
      .eq('id', saved.interactionId)
      .eq('user_id', userId);

    if (linked.error) throw linked.error;
  }

  const patch = {
    last_interaction_at: saved.savedAt,
  };

  if (saved.nextAction) {
    patch.next_action = saved.nextAction;

    // Um novo passo sem data não pode herdar a data
    // de um compromisso antigo.
    patch.next_action_date = validDateOnly(
      saved.nextActionDate
    );
  }

  const { error } = await db
    .from("contacts")
    .update(patch)
    .eq("id", saved.contactId)
    .eq("user_id", userId);

  if (error) throw error;
}
