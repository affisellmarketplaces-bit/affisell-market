/**
 * In-memory stand-in for the slice of Prisma the supplier-purchase gate and the three AliExpress paths use — NO database, NO
 * network. It exists to SIMULATE CONCURRENCY faithfully enough to catch a missing lock:
 *
 *  - every operation yields to the event loop (`setImmediate`), so two callers really interleave between a read and a write;
 *  - `$transaction(cb)` runs `cb` with a tx client whose `$executeRaw` implements `pg_advisory_xact_lock(hashtext(key))`:
 *    a second transaction asking for the same key WAITS until the first one's callback has finished (commit), exactly like
 *    Postgres. A transaction that never takes the lock gets no protection — which is what the mutation tests rely on;
 *  - writes are visible immediately (READ COMMITTED), there is no rollback: the gate only writes at the end of its transaction.
 */

export type FakeOrder = Record<string, unknown> & {
  id: string
  status: string
  supplierOrderId: string | null
  fulfillmentStatus: string
}

export type FakeLog = {
  id: string
  orderId: string
  orderItemId: string
  status: "PENDING" | "BUYING" | "BOUGHT" | "FAILED" | "REFUNDED"
  aeOrderId: string | null
  aeTracking: string | null
  virtualCardId: string | null
  errorMsg: string | null
  attempts: number
  createdAt: Date
  updatedAt: Date
}

export type FakeJob = { id: string; supplierOrderId: string | null; status: string; orderIds: string[] }

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

type LogWhere = { id?: string; orderId?: string; status?: string | { in?: string[]; not?: string } }

/** The subset of Prisma's `where` the code under test uses on FulfillmentLog: id / orderId / status (equals, in, not). */
function logMatches(log: FakeLog, where: LogWhere): boolean {
  if (where.id !== undefined && log.id !== where.id) return false
  if (where.orderId !== undefined && log.orderId !== where.orderId) return false
  const st = where.status
  if (st === undefined) return true
  if (typeof st === "string") return log.status === st
  if (st.in && !st.in.includes(log.status)) return false
  if (st.not !== undefined && log.status === st.not) return false
  return true
}
const clone = <T,>(v: T): T => (v === undefined ? v : (structuredClone(v) as T))

export function createFakePurchaseDb(seed: { orders: FakeOrder[]; logs?: FakeLog[]; jobs?: FakeJob[]; now?: () => Date }) {
  const now = seed.now ?? (() => new Date())
  const orders = new Map<string, FakeOrder>(seed.orders.map((o) => [o.id, o]))
  const logs = new Map<string, FakeLog>((seed.logs ?? []).map((l) => [l.orderId, l]))
  const jobs: FakeJob[] = [...(seed.jobs ?? [])]
  let logSeq = logs.size

  const lockTails = new Map<string, Promise<void>>()
  const stats = { lockAcquisitions: 0, transactions: 0, lockKeys: [] as string[] }

  function acquire(key: string): Promise<() => void> {
    stats.lockAcquisitions += 1
    stats.lockKeys.push(key)
    const previous = lockTails.get(key) ?? Promise.resolve()
    let release!: () => void
    const mine = new Promise<void>((resolve) => (release = resolve))
    lockTails.set(
      key,
      previous.then(() => mine)
    )
    return previous.then(() => release)
  }

  function orderView(id: string) {
    const order = orders.get(id)
    if (!order) return null
    const log = logs.get(id) ?? null
    return {
      ...clone(order),
      autoBuyLog: log ? clone(log) : null,
      supplierFulfillmentLinks: jobs
        .filter((j) => j.orderIds.includes(id))
        .map((j) => ({
          supplierFulfillmentOrder: {
            id: j.id,
            supplierOrderId: j.supplierOrderId,
            status: j.status,
            lines: j.orderIds.slice(0, 1).map((orderId) => ({ orderId })),
          },
        })),
    }
  }

  function logWithOrder(log: FakeLog, include: unknown) {
    const out: Record<string, unknown> = clone(log)
    if (include && typeof include === "object" && "order" in include) out.order = orderView(log.orderId)
    return out
  }

  const models = {
    order: {
      findUnique: async (args: { where: { id: string } }) => {
        await tick()
        return orderView(args.where.id)
      },
      update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        await tick()
        const order = orders.get(args.where.id)
        if (!order) throw new Error("P2025 order not found")
        Object.assign(order, args.data)
        return clone(order)
      },
      updateMany: async (args: { where: { id: string; supplierOrderId?: null }; data: Record<string, unknown> }) => {
        await tick()
        const order = orders.get(args.where.id)
        if (!order || (args.where.supplierOrderId === null && order.supplierOrderId !== null)) return { count: 0 }
        Object.assign(order, args.data)
        return { count: 1 }
      },
    },
    fulfillmentLog: {
      findUnique: async (args: { where: { id?: string; orderId?: string }; include?: unknown }) => {
        await tick()
        const log = [...logs.values()].find((l) =>
          args.where.id ? l.id === args.where.id : l.orderId === args.where.orderId
        )
        return log ? logWithOrder(log, args.include) : null
      },
      count: async () => {
        await tick()
        return [...logs.values()].filter((l) => l.status === "BOUGHT" && !l.aeOrderId?.startsWith("DRY_RUN_")).length
      },
      upsert: async (args: {
        where: { orderId: string }
        create: Partial<FakeLog> & { orderId: string }
        update: Partial<FakeLog>
      }) => {
        await tick()
        const existing = logs.get(args.where.orderId)
        if (existing) {
          Object.assign(existing, args.update, { updatedAt: now() })
          return clone(existing)
        }
        logSeq += 1
        const created: FakeLog = {
          id: `log_${logSeq}`,
          orderItemId: args.create.orderId,
          status: "PENDING",
          aeOrderId: null,
          aeTracking: null,
          virtualCardId: null,
          errorMsg: null,
          attempts: 0,
          createdAt: now(),
          updatedAt: now(),
          ...args.create,
        }
        logs.set(created.orderId, created)
        return clone(created)
      },
      update: async (args: { where: { id?: string; orderId?: string }; data: Partial<FakeLog> }) => {
        await tick()
        const log = [...logs.values()].find((l) => (args.where.id ? l.id === args.where.id : l.orderId === args.where.orderId))
        if (!log) throw new Error("P2025 log not found")
        Object.assign(log, args.data, { updatedAt: now() })
        return clone(log)
      },
      updateMany: async (args: { where: LogWhere; data: Partial<FakeLog> }) => {
        await tick()
        const matching = [...logs.values()].filter((l) => logMatches(l, args.where))
        for (const log of matching) Object.assign(log, args.data, { updatedAt: now() })
        return { count: matching.length }
      },
    },
  }

  async function $transaction<T>(cb: (tx: unknown) => Promise<T>, _opts?: unknown): Promise<T> {
    stats.transactions += 1
    const releases: Array<() => void> = []
    const tx = {
      ...models,
      $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        if (strings.join("?").includes("pg_advisory_xact_lock")) {
          releases.push(await acquire(String(values[0])))
        }
        return 1
      },
    }
    try {
      return await cb(tx)
    } finally {
      for (const release of releases) release() // commit / rollback releases the xact lock
    }
  }

  return {
    prisma: { ...models, $transaction },
    orders,
    logs,
    jobs,
    stats,
    /** Everything that was recorded as a purchase, for assertions. */
    boughtLogs: () => [...logs.values()].filter((l) => l.status === "BOUGHT"),
  }
}

export type FakePurchaseDb = ReturnType<typeof createFakePurchaseDb>
