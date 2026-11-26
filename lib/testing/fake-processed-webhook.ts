/**
 * In-memory stand-in for the `processedWebhook` Prisma delegate (tests only, no database).
 * Implements exactly what the dispute hold ledger and the webhook replay job use: find / count / upsert / updateMany.
 */
export type FakeProcessedWebhookRow = {
  id: string
  orderId: string | null
  status: string
  error: string | null
  createdAt?: Date
}

type Where = Record<string, unknown>

function matches(row: FakeProcessedWebhookRow, where: Where): boolean {
  const id = where.id
  if (typeof id === "string" && row.id !== id) return false
  if (id && typeof id === "object") {
    const cond = id as { startsWith?: string; in?: string[] }
    if (cond.startsWith !== undefined && !row.id.startsWith(cond.startsWith)) return false
    if (cond.in !== undefined && !cond.in.includes(row.id)) return false
  }
  const orderId = where.orderId
  if (typeof orderId === "string" && row.orderId !== orderId) return false
  if (orderId && typeof orderId === "object") {
    const cond = orderId as { in?: string[] }
    if (cond.in !== undefined && !(row.orderId && cond.in.includes(row.orderId))) return false
  }
  if (where.status !== undefined && row.status !== where.status) return false
  const createdAt = where.createdAt as { gte?: Date; lt?: Date; lte?: Date } | undefined
  if (createdAt) {
    const at = row.createdAt ?? new Date(0)
    if (createdAt.gte && at < createdAt.gte) return false
    if (createdAt.lt && !(at < createdAt.lt)) return false
    if (createdAt.lte && !(at <= createdAt.lte)) return false
  }
  const not = where.NOT as { id?: string | { startsWith?: string } } | undefined
  if (typeof not?.id === "string" && row.id === not.id) return false
  if (typeof not?.id === "object" && not.id.startsWith !== undefined && row.id.startsWith(not.id.startsWith)) return false
  return true
}

export function createFakeProcessedWebhook(initial: FakeProcessedWebhookRow[] = []) {
  const rows = new Map<string, FakeProcessedWebhookRow>(initial.map((r) => [r.id, { ...r }]))
  const delegate = {
    count: async ({ where }: { where: Where }) => [...rows.values()].filter((r) => matches(r, where)).length,
    findUnique: async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null,
    findMany: async ({
      where,
      take,
      orderBy,
    }: {
      where: Where
      take?: number
      orderBy?: { createdAt?: "asc" | "desc" }
    }) => {
      const direction = orderBy?.createdAt === "desc" ? -1 : 1
      const found = [...rows.values()]
        .filter((r) => matches(r, where))
        .sort((a, b) => direction * ((a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)))
      return take ? found.slice(0, take) : found
    },
    upsert: async ({
      where,
      create,
      update,
    }: {
      where: { id: string }
      create: FakeProcessedWebhookRow
      update: Partial<FakeProcessedWebhookRow>
    }) => {
      const existing = rows.get(where.id)
      if (existing) Object.assign(existing, update)
      else rows.set(where.id, { createdAt: new Date(), ...create })
      return rows.get(where.id)
    },
    updateMany: async ({ where, data }: { where: Where; data: Partial<FakeProcessedWebhookRow> }) => {
      let count = 0
      for (const row of rows.values()) {
        if (matches(row, where)) {
          Object.assign(row, data)
          count += 1
        }
      }
      return { count }
    },
  }
  return { delegate, rows }
}
