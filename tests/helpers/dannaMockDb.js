export function createDannaMockDb(tables = {}, failures = {}) {
  const calls = [], writes = [], rpcs = [];
  class Query {
    constructor(table) { this.table = table; this.filters = []; this.start = 0; this.end = Infinity; this.singleRow = false; calls.push(this); }
    select(columns) { this.columns = columns; return this; }
    eq(key, value) { this.filters.push(row => row[key] === value); (this.scopes ||= []).push([key, value]); return this; }
    in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
    gte(key, value) { this.filters.push(row => row[key] >= value); return this; }
    lte(key, value) { this.filters.push(row => row[key] <= value); return this; }
    order(key, options = {}) { this.sort = [key, options.ascending !== false]; return this; }
    range(start, end) { this.start = start; this.end = end; return this; }
    limit(size) { this.end = size - 1; return this; }
    maybeSingle() { this.singleRow = true; return this; }
    single() { this.singleRow = true; return this; }
    upsert(row) { writes.push({ table: this.table, kind: 'upsert', row }); return this; }
    insert(row) { writes.push({ table: this.table, kind: 'insert', row }); this.inserted = { id: 'inserted-row', created_at: new Date().toISOString(), ...row }; return this; }
    update(row) { writes.push({ table: this.table, kind: 'update', row }); return this; }
    result() {
      if (failures[this.table]) return { data: null, error: { message: 'Fonte indisponível' } };
      if (this.inserted) return { data: this.singleRow ? this.inserted : [this.inserted], error: null };
      let rows = (tables[this.table] || []).filter(row => this.filters.every(filter => filter(row)));
      if (this.sort) { const [key, asc] = this.sort; rows = [...rows].sort((a, b) => String(a[key] || '').localeCompare(String(b[key] || '')) * (asc ? 1 : -1)); }
      rows = rows.slice(this.start, this.end + 1);
      return { data: this.singleRow ? rows[0] || null : rows, error: null };
    }
    then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); }
  }
  return { calls, writes, rpcs, from: table => new Query(table),
    rpc: async (name, args) => { rpcs.push({ name, args }); return { data: tables[name] || [], error: null }; },
    auth: { getSession: async () => ({ data: { session: { access_token: 'test-session' } } }) } };
}
