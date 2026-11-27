import {
  supplierPurchaseDecision,
  type SupplierPurchaseChannel,
  type SupplierPurchaseDecision,
} from "@/lib/supplier-purchase/policy"

/**
 * The single door every supplier purchase goes through (AliExpress DS API, AliExpress browser checkout, CJ, partner
 * REST). Two locks, in this order:
 *
 *   1. POLICY (`policy.ts`, fail-closed): no explicit, exact activation for this channel → nothing is sent.
 *   2. CLAIM (table `SupplierPurchaseClaim`, one row per purchase key — the ORDER, not the code path or channel): a key
 *      is bought AT MOST ONCE, whichever path (auto-buy, ops route, batch engine, adapter) tries.
 *        - first caller inserts the row (`claimed`) and sends;
 *        - the supplier answered with an order id      → `placed`   — a later call gets that id back, nothing re-sent;
 *        - the supplier answered "no" (nothing created) → `rejected` — the ONLY state that may be claimed again;
 *        - timeout / network / unreadable answer       → `uncertain`— never retried automatically (an order may exist);
 *        - row still `claimed` (concurrent call, or a crash mid-send) → refused as in-flight / uncertain.
 *      Claim = one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE status = 'rejected'`, so two concurrent callers can
 *      never both send. A missing table / unreachable database refuses the purchase (fail-closed, never a crash).
 *
 * Purchases blocked or uncertain here are logged as `[supplier-purchase]` lines for a human to look at.
 */
export type PurchaseSendOutcome<T> =
  | { kind: "placed"; supplierOrderId: string; value: T }
  /** The supplier answered and created nothing (validation, stock, address, 4xx…). Safe to try again later. */
  | { kind: "rejected"; error: string; value: T }
  /** Unknown whether an order exists (timeout, 5xx, connection reset, answer without id). */
  | { kind: "uncertain"; error: string; value: T }

export type GuardResult<T> =
  | { kind: "sent"; outcome: PurchaseSendOutcome<T> }
  | { kind: "blocked"; decision: Extract<SupplierPurchaseDecision, { allowed: false }> }
  | { kind: "already_placed"; supplierOrderId: string }
  | { kind: "in_flight_or_uncertain"; status: string }
  | { kind: "claim_store_unavailable"; error: string }

export type ClaimRow = { status: string; supplierOrderId: string | null; attempts: number }

/** The SQL behind the claim, injectable for tests (real implementation below uses the app's Prisma client). */
export type ClaimStore = {
  /**
   * Claims EVERY key or none (one transaction): true when THIS caller now holds them all, false when any key is held
   * by someone else or already settled (then nothing was changed).
   */
  tryClaimAll(keys: string[], channel: SupplierPurchaseChannel, path: string): Promise<boolean>
  readAll(keys: string[]): Promise<Array<ClaimRow & { id: string }>>
  settleAll(
    keys: string[],
    status: "placed" | "rejected" | "uncertain",
    supplierOrderId: string | null,
    error: string | null,
  ): Promise<void>
}

export const SUPPLIER_PURCHASE_CLAIM_SQL = {
  tryClaim: `INSERT INTO "SupplierPurchaseClaim" ("id", "channel", "path", "status", "attempts", "createdAt", "updatedAt")
VALUES ($1, $2, $3, 'claimed', 1, now(), now())
ON CONFLICT ("id") DO UPDATE SET "status" = 'claimed', "path" = EXCLUDED."path", "error" = NULL,
  "attempts" = "SupplierPurchaseClaim"."attempts" + 1, "updatedAt" = now()
WHERE "SupplierPurchaseClaim"."status" = 'rejected'
RETURNING "status", "supplierOrderId", "attempts"`,
  readAll: `SELECT "id", "status", "supplierOrderId", "attempts" FROM "SupplierPurchaseClaim" WHERE "id" = ANY($1::text[])`,
  settleAll: `UPDATE "SupplierPurchaseClaim" SET "status" = $2, "supplierOrderId" = $3, "error" = $4, "updatedAt" = now()
WHERE "id" = ANY($1::text[]) AND "status" = 'claimed'`,
} as const

type RawDb = {
  $queryRawUnsafe<R = unknown>(sql: string, ...values: unknown[]): Promise<R>
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>
}
type RawDbWithTx = RawDb & { $transaction<R>(fn: (tx: RawDb) => Promise<R>): Promise<R> }

class ClaimHeldElsewhere extends Error {}

export function sqlClaimStore(db: RawDbWithTx): ClaimStore {
  return {
    async tryClaimAll(keys, channel, path) {
      try {
        await db.$transaction(async (tx) => {
          for (const key of [...keys].sort()) {
            const rows = await tx.$queryRawUnsafe<ClaimRow[]>(SUPPLIER_PURCHASE_CLAIM_SQL.tryClaim, key, channel, path)
            if (!rows[0]) throw new ClaimHeldElsewhere(key) // rolls back the keys claimed so far
          }
        })
        return true
      } catch (e) {
        if (e instanceof ClaimHeldElsewhere) return false
        throw e
      }
    },
    async readAll(keys) {
      return db.$queryRawUnsafe<Array<ClaimRow & { id: string }>>(SUPPLIER_PURCHASE_CLAIM_SQL.readAll, keys)
    },
    async settleAll(keys, status, supplierOrderId, error) {
      await db.$executeRawUnsafe(
        SUPPLIER_PURCHASE_CLAIM_SQL.settleAll,
        keys,
        status,
        supplierOrderId,
        error?.slice(0, 2000) ?? null,
      )
    },
  }
}

let defaultStore: ClaimStore | null = null
/** Tests only: replace the app's claim store (pass null to go back to the database). */
export function setSupplierPurchaseClaimStoreForTests(store: ClaimStore | null): void {
  defaultStore = store
}
async function appClaimStore(): Promise<ClaimStore> {
  if (!defaultStore) {
    const { prisma } = await import("@/lib/prisma")
    defaultStore = sqlClaimStore(prisma as unknown as RawDbWithTx)
  }
  return defaultStore
}

const log = (result: string, payload: Record<string, unknown>) =>
  console.log("[supplier-purchase]", { result, ...payload })

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500)

export async function guardSupplierPurchase<T>(
  args: {
    channel: SupplierPurchaseChannel
    /** Code path, for the log and the claim row ("auto-buy", "ops-route", "cj-adapter"…). */
    path: string
    /**
     * Stable identity of what is bought, independent of the channel and the code path: `order:<Order.id>` for each
     * marketplace order line in the supplier order, `blind:<orderId>:<supplierId>` for blind dropship. Two paths
     * buying the same order use the same key, so only one of them can ever send.
     */
    keys: string[]
    env?: Record<string, string | undefined>
    store?: ClaimStore
  },
  send: () => Promise<PurchaseSendOutcome<T>>,
): Promise<GuardResult<T>> {
  const decision = supplierPurchaseDecision(args.env ?? process.env, args.channel)
  if (!decision.allowed) {
    log("blocked_by_policy", {
      channel: args.channel,
      path: args.path,
      reason: decision.reason,
      detail: decision.detail,
    })
    return { kind: "blocked", decision }
  }
  const keys = [...new Set(args.keys.map((k) => k.trim()))]
  if (keys.length === 0 || keys.some((k) => !k || k.length > 300)) {
    log("blocked_invalid_key", { channel: args.channel, path: args.path })
    return { kind: "claim_store_unavailable", error: "invalid_purchase_key" }
  }
  const ctx = { channel: args.channel, path: args.path, keys }

  let store: ClaimStore
  let claimed: boolean
  try {
    store = args.store ?? (await appClaimStore())
    claimed = await store.tryClaimAll(keys, args.channel, args.path)
  } catch (e) {
    log("claim_store_unavailable", { ...ctx, error: errText(e) })
    return { kind: "claim_store_unavailable", error: errText(e) }
  }

  if (!claimed) {
    let existing: Array<ClaimRow & { id: string }>
    try {
      existing = await store.readAll(keys)
    } catch (e) {
      return { kind: "claim_store_unavailable", error: errText(e) }
    }
    const ids = new Set(existing.filter((r) => r.status === "placed").map((r) => r.supplierOrderId))
    if (
      existing.length === keys.length &&
      existing.every((r) => r.status === "placed" && r.supplierOrderId) &&
      ids.size === 1
    ) {
      log("already_placed", ctx)
      return { kind: "already_placed", supplierOrderId: [...ids][0]! }
    }
    const statuses = [...new Set(existing.map((r) => r.status))].sort().join("+") || "unknown"
    log("refused_in_flight_or_uncertain", { ...ctx, status: statuses })
    return { kind: "in_flight_or_uncertain", status: statuses }
  }

  let outcome: PurchaseSendOutcome<T>
  try {
    outcome = await send()
  } catch (e) {
    // A throw after the claim is NOT proof that nothing was sent: uncertain, never retried automatically.
    await settleQuietly(store, keys, "uncertain", null, errText(e))
    log("uncertain", { ...ctx, error: errText(e) })
    throw e
  }
  if (outcome.kind === "placed" && !outcome.supplierOrderId.trim()) {
    outcome = { kind: "uncertain", error: "placed_without_supplier_order_id", value: outcome.value }
  }
  await settleQuietly(
    store,
    keys,
    outcome.kind,
    outcome.kind === "placed" ? outcome.supplierOrderId : null,
    outcome.kind === "placed" ? null : outcome.error,
  )
  log(outcome.kind, ctx)
  return { kind: "sent", outcome }
}

async function settleQuietly(
  store: ClaimStore,
  keys: string[],
  status: "placed" | "rejected" | "uncertain",
  supplierOrderId: string | null,
  error: string | null,
): Promise<void> {
  try {
    await store.settleAll(keys, status, supplierOrderId, error)
  } catch (e) {
    // The rows stay `claimed` = refused as uncertain next time: safe side.
    log("settle_failed", { keys, status, error: errText(e) })
  }
}

/** Error code a caller returns when the guard did not send (prefix lets callers skip any fallback purchase). */
export function guardRefusalCode(
  r: Exclude<GuardResult<unknown>, { kind: "sent" } | { kind: "already_placed" }>,
): string {
  switch (r.kind) {
    case "blocked":
      return `supplier_purchase_blocked:${r.decision.reason}`
    case "in_flight_or_uncertain":
      return `supplier_purchase_in_flight_or_uncertain:${r.status}`
    case "claim_store_unavailable":
      return `supplier_purchase_claim_unavailable`
  }
}

/** True for any error produced by the guard — callers must never fall back to ANOTHER purchase route on it. */
export function isSupplierPurchaseGuardError(error: string | null | undefined): boolean {
  return Boolean(error && (error.startsWith("supplier_purchase_") || error.startsWith("uncertain:")))
}

/**
 * Read-only pre-check for flows that must do something irreversible BEFORE the purchase call (the batch engine pays a
 * supplier, then places the order): true when any key is already claimed / placed / uncertain — or when the claim
 * store cannot be read (fail-closed). Not a lock: the guarded purchase call stays the lock.
 */
export async function supplierPurchaseKeysHeld(
  keys: string[],
  store?: ClaimStore,
): Promise<{ held: boolean; detail: string }> {
  try {
    const rows = await (store ?? (await appClaimStore())).readAll(keys)
    const busy = rows.filter((r) => r.status !== "rejected")
    return { held: busy.length > 0, detail: busy.map((r) => `${r.id}=${r.status}`).join(", ") }
  } catch (e) {
    return { held: true, detail: `claim_store_unavailable:${errText(e)}` }
  }
}
