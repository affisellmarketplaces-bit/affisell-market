/** Order-linked sale/order alerts — keep newest row when legacy duplicates exist. */
const DEDUPE_TYPES = new Set(["NEW_ORDER", "NEW_SALE"])

export function dedupeMerchantNotifications<
  T extends { id: string; type: string; orderId: string | null; createdAt: string | Date },
>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []

  for (const row of rows) {
    const orderId = row.orderId?.trim()
    if (orderId && DEDUPE_TYPES.has(row.type)) {
      const key = `${row.type}:${orderId}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(row)
  }

  return out
}
