// In-memory stand-in for the parts of the Supabase client our data layer uses.
// Each call is recorded; results come from handlers keyed by "table.op" or "storage.op".

export interface FakeCall {
  table: string;
  op: string;
  payload?: unknown;
  options?: unknown;
  filters: [string, string, unknown][];
}

export interface FakeResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

type Handler = (call: FakeCall) => FakeResult;

export function fakeSupabase(handlers: Record<string, Handler>) {
  const calls: FakeCall[] = [];

  const run = (call: FakeCall): FakeResult => {
    const handler = handlers[`${call.table}.${call.op}`];
    if (!handler) throw new Error(`fakeSupabase: no handler for ${call.table}.${call.op}`);
    return { data: null, error: null, count: null, ...handler(call) };
  };

  function from(table: string) {
    const call: FakeCall = { table, op: 'select', filters: [] };
    let writeOp = false;
    calls.push(call);
    const filter = (kind: string) => (column: string, value: unknown) => {
      call.filters.push([kind, column, value]);
      return builder;
    };
    const write = (op: string) => (payload?: unknown, options?: unknown) => {
      Object.assign(call, { op, payload, options });
      writeOp = true;
      return builder;
    };
    const builder = {
      select: (_columns?: string, options?: unknown) => {
        if (!writeOp) call.options = options;
        return builder;
      },
      insert: write('insert'),
      upsert: write('upsert'),
      update: write('update'),
      delete: write('delete'),
      eq: filter('eq'),
      gte: filter('gte'),
      is: filter('is'),
      in: filter('in'),
      order: () => builder,
      limit: () => builder,
      single: () => builder,
      maybeSingle: () => builder,
      then: (resolve: (r: FakeResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => run(call)).then(resolve, reject),
    };
    return builder;
  }

  const storage = {
    from: (bucket: string) => {
      const storageOp = (op: string) => async (...args: unknown[]) => {
        const call: FakeCall = { table: 'storage', op, payload: { bucket, args }, filters: [] };
        calls.push(call);
        return run(call);
      };
      return { upload: storageOp('upload'), remove: storageOp('remove') };
    },
  };

  // db.rpc('fn', args): handler key "rpc.fn", args recorded as payload.
  function rpc(fn: string, args?: unknown) {
    const call: FakeCall = { table: 'rpc', op: fn, payload: args, filters: [] };
    calls.push(call);
    return {
      then: (resolve: (r: FakeResult) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve().then(() => run(call)).then(resolve, reject),
    };
  }

  return {
    client: { from, storage, rpc } as never,
    calls,
    find: (key: string) => calls.filter((c) => `${c.table}.${c.op}` === key),
  };
}
