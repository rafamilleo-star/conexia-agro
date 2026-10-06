// Paginação estável: não apresenta os primeiros 1000 registros como rede inteira.
export async function readUserRows(db, table, userId, select = '*', configure = q => q) {
  const rows = [];
  const size = 500;

  for (let offset = 0; ; offset += size) {
    const query = configure(
      db.from(table).select(select).eq('user_id', userId)
    );

    const { data, error } = await query
      .order('id', { ascending: true })
      .range(offset, offset + size - 1);

    if (error) throw new Error(`${table}: ${error.message}`);

    rows.push(...(data || []));

    if (!data || data.length < size) return rows;
  }
}

export async function loadRelationshipData(db, userId, now = new Date()) {
  if (!userId) throw new Error('Sessão não autenticada.');

  const [
    contacts,
    interactions,
    alerts,
    memories,
    events,
    profileRes,
  ] = await Promise.all([
    readUserRows(db, 'contacts', userId),

    readUserRows(db, 'interactions', userId),

    readUserRows(db, 'alerts', userId),

    readUserRows(
      db,
      'relational_memory',
      userId,
      '*',
      q => q.eq('status', 'active')
    ),

    readUserRows(
      db,
      'scheduled_events',
      userId,
      '*',
      q =>
        q
          .gte(
            'scheduled_at',
            new Date(now.getTime() - 7 * 86400000).toISOString()
          )
          .lte(
            'scheduled_at',
            new Date(now.getTime() + 45 * 86400000).toISOString()
          )
    ),

    db
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    throw new Error(`profiles: ${profileRes.error.message}`);
  }

  interactions.sort(
    (a, b) => String(b.created_at).localeCompare(String(a.created_at))
  );

  memories.sort(
    (a, b) => String(b.created_at).localeCompare(String(a.created_at))
  );

  events.sort(
    (a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at))
  );

  alerts.sort(
    (a, b) => String(a.created_at).localeCompare(String(b.created_at))
  );

  return {
    contacts,
    interactions,
    alerts,
    memories,
    events,
    profile: profileRes.data,
  };
}
