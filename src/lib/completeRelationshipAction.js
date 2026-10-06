export async function completeRelationshipAction(db, userId, action) {
  if (!userId || !action?.relationshipId) throw new Error('Sessão não autenticada.');
  const { source, sourceId } = action.evidence || {};
  let nextAction = action.evidence?.text || action.evidence?.nextAction;
  if (source === 'relational_memory') {
    const { data, error } = await db.from('relational_memory').select('metadata')
      .eq('id', sourceId).eq('contact_id', action.relationshipId).eq('user_id', userId).single();
    if (error) throw error;
    nextAction = data.metadata?.next_action;
    const updated = await db.from('relational_memory').update({ status: 'superseded',
      metadata: { ...data.metadata, completed: true, completed_at: new Date().toISOString() } })
      .eq('id', sourceId).eq('user_id', userId).select('id').single();
    if (updated.error) throw updated.error;
  }
  if (nextAction) {
    const { error } = await db.from('contacts').update({ next_action: null, next_action_date: null })
      .eq('id', action.relationshipId).eq('user_id', userId).eq('next_action', nextAction);
    if (error) throw error;
  }
}
