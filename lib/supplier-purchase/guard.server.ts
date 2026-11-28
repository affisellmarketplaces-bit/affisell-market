import { randomUUID } from "node:crypto"

import {
  supplierPurchaseDecision,
  type SupplierPurchaseChannel,
  type SupplierPurchaseDecision,
} from "@/lib/supplier-purchase/policy"

/**
 * The single door every supplier purchase goes through (AliExpress DS API, AliExpress browser checkout, CJ, partner
 * REST, China buying agents, the batch engine's supplier payment). Two locks, in this order:
 *
 *   1. POLICY (`policy.ts`, fail-closed): no explicit, exact activation for this channel → nothing is sent.
 *   2. CLAIM (table `SupplierPurchaseClaim`, one row per purchase key — the ORDER, not the code path or channel): a key
 *      is bought AT MOST ONCE, whichever path (auto-buy, ops route, batch engine, worker, adapter, China agent) tries.
 *        - first caller inserts the rows (`claimed`, with a random TOKEN) and sends;
 *        - the supplier answered with an order id      → `placed`   — a later call gets that id back, nothing re-sent;
 *        - the supplier answered "no" (nothing created) → `rejected` — the ONLY state that may be claimed again,
 *          and only if NO MONEY left with this claim (`paidCents` set → `uncertain` instead);
 *        - timeout / network / unreadable answer       → `uncertain`— never retried automatically (an order may exist);
 *        - row still `claimed` (concurrent call, or a crash mid-send) → refused as in-flight / uncertain.
 *      Claim = one atomic `INSERT … ON CONFLICT DO UPDATE … WHERE status = 'rejected'` per key, all keys in one
 *      transaction, so two concurrent callers can never both send. A missing table / unreachable database refuses the
 *      purchase (fail-closed, never a crash).
 *
 *   A claim can be HELD across steps (the batch engine claims, pays the supplier, then the adapter — inline or in the
 *   BullMQ worker — places the order): the holder passes the claim's token, the next step verifies it
 *   (`heldToken`) instead of claiming again, and settles. Payment is recorded ON the claim, in the same transaction
 *   as the wallet debit (`debitWalletForClaim`), so a crash between "paid" and "placed" leaves a claim that says
 *   "paid, not placed" — refused automatically, visible for reconciliation (`npm run report:supplier-purchase-claims`).
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

export type ClaimRow = {
  status: string
  supplierOrderId: string | null
  attempts: number
  token?: string | null
  paidCents?: number | null
}
export type SettleStatus = "placed" | "rejected" | "uncertain"

/** The SQL behind the claim, injectable for tests (real implementation below uses the app's Prisma client). */
export type ClaimStore = {
  /**
   * Claims EVERY key or none (one transaction), stamping `token`: true when THIS caller now holds them all, false when
   * any key is held by someone else or already settled (then nothing was changed). With a `dailyLimit`, the channel's
   * purchases started in the last 24 h are counted UNDER a per-channel transaction lock in the same transaction, and
   * "daily_limit_reached" is returned (nothing changed) when the quota is used up — concurrent claims cannot overshoot.
   */
  tryClaimAll(
    keys: string[],
    channel: SupplierPurchaseChannel,
    path: string,
    token: string,
    dailyLimit?: number | null,
  ): Promise<boolean | "daily_limit_reached">
  readAll(keys: string[]): Promise<Array<ClaimRow & { id: string }>>
  /** Settles only rows still `claimed` with this token. A `rejected` on a paid claim is stored as `uncertain`. */
  settleAll(
    keys: string[],
    token: string,
    status: SettleStatus,
    supplierOrderId: string | null,
    error: string | null,
  ): Promise<void>
  /** Records a non-wallet payment (Stripe transfer id) on a held claim. True when every row was stamped. */
  recordPayment(keys: string[], token: string, paymentRef: string, cents: number): Promise<boolean>
  /**
   * ONE transaction: stamp `paidCents` on the held claim (only if not paid yet) AND debit the wallet (only if the
   * balance covers it). Either both happen or neither: a second call for the same claim debits nothing.
   */
  debitWalletForClaim(
    keys: string[],
    token: string,
    providerId: string,
    cents: number,
  ): Promise<"debited" | "already_paid_or_not_held" | "insufficient_wallet_balance">
}

export const SUPPLIER_PURCHASE_CLAIM_SQL = {
  tryClaim: `INSERT INTO "SupplierPurchaseClaim" ("id", "channel", "path", "status", "attempts", "token", "createdAt", "updatedAt")
VALUES ($1, $2, $3, 'claimed', 1, $4, now(), now())
ON CONFLICT ("id") DO UPDATE SET "status" = 'claimed', "path" = EXCLUDED."path", "error" = NULL, "token" = EXCLUDED."token",
  "paidCents" = NULL, "paymentRef" = NULL, "attempts" = "SupplierPurchaseClaim"."attempts" + 1, "updatedAt" = now()
WHERE "SupplierPurchaseClaim"."status" = 'rejected' AND "SupplierPurchaseClaim"."paidCents" IS NULL
RETURNING "status", "supplierOrderId", "attempts"`,
  /** Serialises quota checks per channel for the rest of the transaction (released at COMMIT / ROLLBACK). */
  quotaLock: `SELECT pg_advisory_xact_lock(hashtext('affisell:supplier-purchase-quota:' || $1))`,
  /** Purchases started on a channel in the last 24 h: one per claim token, a supplier refusal does not count. */
  quotaCount: `SELECT count(DISTINCT "token")::int AS "n" FROM "SupplierPurchaseClaim"
WHERE "channel" = $1 AND "status" <> 'rejected' AND "updatedAt" >= now() - interval '24 hours'`,
  /** Keys that a claim could NOT take (held or settled): such a call is a conflict / replay, never a new purchase. */
  quotaBlockedKeys: `SELECT count(*)::int AS "n" FROM "SupplierPurchaseClaim"
WHERE "id" = ANY($1::text[]) AND NOT ("status" = 'rejected' AND "paidCents" IS NULL)`,
  readAll: `SELECT "id", "status", "supplierOrderId", "attempts", "token", "paidCents" FROM "SupplierPurchaseClaim" WHERE "id" = ANY($1::text[])`,
  settleAll: `UPDATE "SupplierPurchaseClaim"
SET "status" = CASE WHEN $3 = 'rejected' AND "paidCents" IS NOT NULL THEN 'uncertain' ELSE $3 END,
  "supplierOrderId" = $4,
  "error" = CASE WHEN $3 = 'rejected' AND "paidCents" IS NOT NULL THEN 'paid_but_not_placed: ' || coalesce($5, '') ELSE $5 END,
  "updatedAt" = now()
WHERE "id" = ANY($1::text[]) AND "status" = 'claimed' AND "token" = $2`,
  recordPayment: `UPDATE "SupplierPurchaseClaim" SET "paidCents" = $4, "paymentRef" = $3, "updatedAt" = now()
WHERE "id" = ANY($1::text[]) AND "status" = 'claimed' AND "token" = $2 AND "paidCents" IS NULL`,
  walletStamp: `UPDATE "SupplierPurchaseClaim" SET "paidCents" = $3, "paymentRef" = 'wallet:' || $4, "updatedAt" = now()
WHERE "id" = ANY($1::text[]) AND "status" = 'claimed' AND "token" = $2 AND "paidCents" IS NULL`,
  walletDebit: `UPDATE "FulfillmentProvider" SET "walletBalanceCents" = "walletBalanceCents" - $2
WHERE "id" = $1 AND "walletBalanceCents" >= $2`,
} as const

type RawDb = {
  $queryRawUnsafe<R = unknown>(sql: string, ...values: unknown[]): Promise<R>
  $executeRawUnsafe(sql: string, ...values: unknown[]): Promise<number>
}
type RawDbWithTx = RawDb & { $transaction<R>(fn: (tx: RawDb) => Promise<R>): Promise<R> }

class Rollback extends Error {
  constructor(readonly reason: string) {
    super(reason)
  }
}

export function sqlClaimStore(db: RawDbWithTx): ClaimStore {
  return {
    async tryClaimAll(keys, channel, path, token, dailyLimit) {
      try {
        await db.$transaction(async (tx) => {
          if (dailyLimit !== undefined && dailyLimit !== null) {
            await tx.$queryRawUnsafe(SUPPLIER_PURCHASE_CLAIM_SQL.quotaLock, channel)
            // A replay or a conflict (some key already held / placed) is not a new purchase: let the normal path
            // answer it (stored supplier order id, or refused as in flight) instead of reporting the quota.
            const [held] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
              SUPPLIER_PURCHASE_CLAIM_SQL.quotaBlockedKeys,
              keys,
            )
            if (Number(held?.n ?? 0) > 0) throw new Rollback("conflict")
            const [{ n }] = await tx.$queryRawUnsafe<Array<{ n: number }>>(
              SUPPLIER_PURCHASE_CLAIM_SQL.quotaCount,
              channel,
            )
            if (Number(n) >= dailyLimit) throw new Rollback("daily_limit_reached")
          }
          for (const key of [...keys].sort()) {
            const rows = await tx.$queryRawUnsafe<ClaimRow[]>(
              SUPPLIER_PURCHASE_CLAIM_SQL.tryClaim,
              key,
              channel,
              path,
              token,
            )
            if (!rows[0]) throw new Rollback(key) // rolls back the keys claimed so far
          }
        })
        return true
      } catch (e) {
        if (e instanceof Rollback) return e.reason === "daily_limit_reached" ? "daily_limit_reached" : false
        throw e
      }
    },
    async readAll(keys) {
      return db.$queryRawUnsafe<Array<ClaimRow & { id: string }>>(SUPPLIER_PURCHASE_CLAIM_SQL.readAll, keys)
    },
    async settleAll(keys, token, status, supplierOrderId, error) {
      await db.$executeRawUnsafe(
        SUPPLIER_PURCHASE_CLAIM_SQL.settleAll,
        keys,
        token,
        status,
        supplierOrderId,
        error?.slice(0, 2000) ?? null,
      )
    },
    async recordPayment(keys, token, paymentRef, cents) {
      const n = await db.$executeRawUnsafe(SUPPLIER_PURCHASE_CLAIM_SQL.recordPayment, keys, token, paymentRef, cents)
      return n === keys.length
    },
    async debitWalletForClaim(keys, token, providerId, cents) {
      try {
        await db.$transaction(async (tx) => {
          const stamped = await tx.$executeRawUnsafe(
            SUPPLIER_PURCHASE_CLAIM_SQL.walletStamp,
            keys,
            token,
            cents,
            providerId,
          )
          if (stamped !== keys.length) throw new Rollback("already_paid_or_not_held")
          const debited = await tx.$executeRawUnsafe(SUPPLIER_PURCHASE_CLAIM_SQL.walletDebit, providerId, cents)
          if (debited !== 1) throw new Rollback("insufficient_wallet_balance")
        })
        return "debited"
      } catch (e) {
        if (e instanceof Rollback) return e.reason as "already_paid_or_not_held" | "insufficient_wallet_balance"
        throw e
      }
    },
  }
}

let defaultStore: ClaimStore | null = null
/** Tests only: replace the app's claim store (pass null to go back to the database). */
export function setSupplierPurchaseClaimStoreForTests(store: ClaimStore | null): void {
  defaultStore = store
}
export async function appClaimStore(): Promise<ClaimStore> {
  if (!defaultStore) {
    const { prisma } = await import("@/lib/prisma")
    defaultStore = sqlClaimStore(prisma as unknown as RawDbWithTx)
  }
  return defaultStore
}

const log = (result: string, payload: Record<string, unknown>) =>
  console.log("[supplier-purchase]", { result, ...payload })

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500)

function normalizeKeys(keys: string[]): string[] | null {
  const out = [...new Set(keys.map((k) => k.trim()))]
  return out.length === 0 || out.some((k) => !k || k.length > 300) ? null : out
}

export type HeldClaim = { keys: string[]; token: string }

type BeginResult =
  | { kind: "claimed"; held: HeldClaim; store: ClaimStore }
  | Exclude<GuardResult<never>, { kind: "sent" }>

/**
 * Policy + claim, without sending. For flows with an irreversible step BEFORE the supplier call (the batch engine pays
 * first): the caller pays with `held`, then hands `held.token` to the purchase call (`heldToken`), which settles.
 */
export async function beginSupplierPurchase(args: {
  channel: SupplierPurchaseChannel
  path: string
  keys: string[]
  env?: Record<string, string | undefined>
  store?: ClaimStore
}): Promise<BeginResult> {
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
  const keys = normalizeKeys(args.keys)
  if (!keys) {
    log("blocked_invalid_key", { channel: args.channel, path: args.path })
    return { kind: "claim_store_unavailable", error: "invalid_purchase_key" }
  }
  const ctx = { channel: args.channel, path: args.path, keys }
  const token = randomUUID()
  let store: ClaimStore
  let claimed: boolean | "daily_limit_reached"
  try {
    store = args.store ?? (await appClaimStore())
    claimed = await store.tryClaimAll(keys, args.channel, args.path, token, decision.dailyLimit)
  } catch (e) {
    log("claim_store_unavailable", { ...ctx, error: errText(e) })
    return { kind: "claim_store_unavailable", error: errText(e) }
  }
  if (claimed === "daily_limit_reached") {
    const refused = {
      allowed: false as const,
      channel: args.channel,
      reason: "daily_limit_reached" as const,
      detail: `${args.channel}: ${decision.dailyLimit} purchase(s) per 24 h already started`,
    }
    log("blocked_by_policy", { ...ctx, reason: refused.reason, detail: refused.detail })
    return { kind: "blocked", decision: refused }
  }
  if (claimed === true) return { kind: "claimed", held: { keys, token }, store }

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

/** Settles a claim the caller holds (e.g. the engine when its payment failed before any supplier call). */
export async function settleHeldSupplierPurchase(
  held: HeldClaim,
  status: SettleStatus,
  error: string | null,
  store?: ClaimStore,
): Promise<void> {
  await settleQuietly(store ?? (await appClaimStore()), held, status, null, error)
}

/**
 * After a placement under a held claim: settles whatever the adapter did not settle itself (adapters without a guard,
 * e.g. AFFISELL_NATIVE / MANUAL). A no-op when the adapter's own guard already settled (only `claimed` rows with this
 * token are touched). A FAILED placement after a payment ends `uncertain` (SQL), never re-claimable.
 */
export async function settleHeldAfterPlacement(
  held: HeldClaim,
  placed: { supplierOrderId: string | null; status: string; errorMessage?: string | null },
  store?: ClaimStore,
): Promise<void> {
  const status: SettleStatus = placed.supplierOrderId ? "placed" : placed.status === "FAILED" ? "rejected" : "uncertain"
  await settleQuietly(
    store ?? (await appClaimStore()),
    held,
    status,
    placed.supplierOrderId,
    placed.errorMessage ?? null,
  )
}

/** Verifies that every key is still `claimed` under this token (a held claim handed from a previous step). */
async function verifyHeld(store: ClaimStore, keys: string[], token: string): Promise<boolean> {
  const rows = await store.readAll(keys)
  return rows.length === keys.length && rows.every((r) => r.status === "claimed" && r.token === token)
}

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
    /** Continue a claim a previous step holds (see beginSupplierPurchase) instead of claiming again. */
    heldToken?: string | null
    env?: Record<string, string | undefined>
    store?: ClaimStore
  },
  send: (held: HeldClaim) => Promise<PurchaseSendOutcome<T>>,
): Promise<GuardResult<T>> {
  let held: HeldClaim
  let store: ClaimStore
  if (args.heldToken) {
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
    const keys = normalizeKeys(args.keys)
    if (!keys) return { kind: "claim_store_unavailable", error: "invalid_purchase_key" }
    try {
      store = args.store ?? (await appClaimStore())
      if (!(await verifyHeld(store, keys, args.heldToken))) {
        log("refused_held_claim_mismatch", { channel: args.channel, path: args.path, keys })
        return { kind: "in_flight_or_uncertain", status: "held_claim_mismatch" }
      }
    } catch (e) {
      return { kind: "claim_store_unavailable", error: errText(e) }
    }
    held = { keys, token: args.heldToken }
  } else {
    const begun = await beginSupplierPurchase(args)
    if (begun.kind !== "claimed") return begun
    held = begun.held
    store = begun.store
  }
  const ctx = { channel: args.channel, path: args.path, keys: held.keys }

  let outcome: PurchaseSendOutcome<T>
  try {
    outcome = await send(held)
  } catch (e) {
    // A throw after the claim is NOT proof that nothing was sent: uncertain, never retried automatically.
    await settleQuietly(store, held, "uncertain", null, errText(e))
    log("uncertain", { ...ctx, error: errText(e) })
    throw e
  }
  if (outcome.kind === "placed" && !outcome.supplierOrderId.trim()) {
    outcome = { kind: "uncertain", error: "placed_without_supplier_order_id", value: outcome.value }
  }
  await settleQuietly(
    store,
    held,
    outcome.kind,
    outcome.kind === "placed" ? outcome.supplierOrderId : null,
    outcome.kind === "placed" ? null : outcome.error,
  )
  log(outcome.kind, ctx)
  return { kind: "sent", outcome }
}

async function settleQuietly(
  store: ClaimStore,
  held: HeldClaim,
  status: SettleStatus,
  supplierOrderId: string | null,
  error: string | null,
): Promise<void> {
  try {
    await store.settleAll(held.keys, held.token, status, supplierOrderId, error)
  } catch (e) {
    // The rows stay `claimed` = refused as uncertain next time: safe side.
    log("settle_failed", { keys: held.keys, status, error: errText(e) })
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
 * Read-only pre-check: true when any key is already claimed / placed / uncertain — or when the claim store cannot be
 * read (fail-closed). Not a lock (the claim is the lock); used to skip work early and in reports.
 */
export async function supplierPurchaseKeysHeld(
  keys: string[],
  store?: ClaimStore,
): Promise<{ held: boolean; detail: string }> {
  try {
    const rows = await (store ?? (await appClaimStore())).readAll(keys)
    const busy = rows.filter((r) => r.status !== "rejected" || r.paidCents != null)
    return { held: busy.length > 0, detail: busy.map((r) => `${r.id}=${r.status}`).join(", ") }
  } catch (e) {
    return { held: true, detail: `claim_store_unavailable:${errText(e)}` }
  }
}
