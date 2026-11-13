import type { Prisma } from "@prisma/client"

import {
  planStockMovement,
  resolveCheckoutStockMode,
  type StockScope,
  type StockShortfallInfo,
} from "@/lib/checkout-stock"
import { parseListingKind } from "@/lib/supplier-commission"

type Tx = Prisma.TransactionClient

export type StockReservationResult =
  /**
   * Units taken from the stock (the order may be created). `shortfall` is set only in `warn` mode: the stock could not
   * serve the quantity, it was emptied (never below 0) and the order goes ahead — the caller logs "would_drop".
   */
  | { kind: "reserved"; scope: StockScope; before: number; after: number; shortfall?: StockShortfallInfo }
  /** Not enough left (`enforce` mode): the caller must NOT create the order (nothing was written). */
  | { kind: "insufficient"; scope: StockScope; available: number; requested: number }
  /** Stock is not managed for this line (or the guard is off): behave exactly as before. */
  | {
      kind: "skipped"
      reason:
        | "guard_off"
        | "product_not_found"
        | "non_physical"
        | "variant_unresolved"
        | "variants_not_tracked"
        | "invalid_quantity"
    }

type LockedProductRow = {
  stock: number | null
  variants: unknown
  listingKind: string | null
  hasVariants: boolean | null
}

/** A raw query may hand a json column back as text depending on the driver path: accept both. */
function jsonColumn(value: unknown): unknown {
  if (typeof value !== "string") return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

/**
 * Locks the product rows of a cart ONE BY ONE, in ascending id order, before any line is processed. Two carts that hold
 * the same two products in opposite order would otherwise lock them in opposite order and deadlock (Postgres aborts one
 * with 40P01 and the buyer's order only appears on the next webhook retry). One statement per row on purpose: the order
 * of the locks must not depend on a query plan. Non-physical products are skipped (they are never locked).
 */
export async function lockProductsForStockInTransaction(tx: Tx, productIds: string[]): Promise<void> {
  if (resolveCheckoutStockMode() === "off") return
  const ids = [...new Set(productIds.filter((id) => id.trim()))].sort()
  for (const id of ids) {
    await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${id} FOR NO KEY UPDATE`
  }
}

/**
 * Takes `qty` units from the stock of a product, inside the payment-processing transaction, so that the decrement
 * commits or rolls back WITH the order it pays for (a replayed webhook finds the order already paid and never gets
 * here again: no double decrement).
 *
 * Atomic against concurrent payments: the product row is locked (`SELECT … FOR NO KEY UPDATE`) before the stock is
 * read, so two payments of the last unit are serialised and the second one sees 0. `NO KEY UPDATE` and not `UPDATE`: the
 * key never changes, and a plain `FOR UPDATE` would also block every `INSERT` of an order of that product (the foreign
 * key check takes `FOR KEY SHARE` on the parent row), including the checkout that creates the pending order. For a
 * product-level movement the write itself is ALSO guarded (`updateMany … WHERE stock >= qty`): the stock can never go
 * negative, even if the lock is ever removed. The per-session advisory lock of the fulfilment only serialises the SAME
 * checkout session — it does nothing between two different buyers, which is exactly the oversell case.
 *
 * Mode (`CHECKOUT_STOCK_MODE`): `enforce` writes nothing when the stock is short and answers `insufficient` (the caller
 * then records the line as unallocated); `warn` (default) empties the stock instead — never below 0 — and answers
 * `reserved` with the `shortfall`, so a paid line is NEVER dropped; `off` does nothing.
 */
export async function reserveStockInTransaction(
  tx: Tx,
  args: {
    productId: string
    variantSignature: string | null | undefined
    qty: number
    /** Kind the caller already loaded: a non-physical listing is skipped WITHOUT locking its row. */
    listingKind?: string | null
  }
): Promise<StockReservationResult> {
  const mode = resolveCheckoutStockMode()
  if (mode === "off") return { kind: "skipped", reason: "guard_off" }
  if (args.listingKind != null && parseListingKind(args.listingKind) !== "PHYSICAL") {
    return { kind: "skipped", reason: "non_physical" }
  }

  const rows = await tx.$queryRaw<LockedProductRow[]>`
    SELECT "stock", "variants", "listingKind", "hasVariants" FROM "Product" WHERE "id" = ${args.productId} FOR NO KEY UPDATE`
  const row = rows[0]
  if (!row) return { kind: "skipped", reason: "product_not_found" }

  const plan = planStockMovement({
    listingKind: row.listingKind,
    stock: row.stock,
    variants: jsonColumn(row.variants),
    hasVariants: row.hasVariants,
    variantSignature: args.variantSignature,
    qty: args.qty,
    onShortfall: mode === "warn" ? "clamp" : "refuse",
  })

  if (plan.kind === "unmanaged") return { kind: "skipped", reason: plan.reason }
  const requested = Math.round(Number(args.qty))
  if (plan.kind === "insufficient") {
    return { kind: "insufficient", scope: plan.scope, available: plan.available, requested }
  }

  if (plan.scope === "product" && !plan.shortfall) {
    const updated = await tx.product.updateMany({
      where: { id: args.productId, stock: { gte: requested } },
      data: { stock: { decrement: requested } },
    })
    if (updated.count !== 1) {
      // The guarded write found less than the locked read said (the lock was bypassed somewhere): never go negative.
      if (mode === "enforce") {
        return { kind: "insufficient", scope: "product", available: plan.available, requested }
      }
      await tx.product.updateMany({ where: { id: args.productId, stock: { gt: 0 } }, data: { stock: 0 } })
      return {
        kind: "reserved",
        scope: "product",
        before: plan.available,
        after: 0,
        shortfall: { available: plan.available, requested },
      }
    }
  } else if (plan.scope === "product") {
    // warn mode, nothing (or not enough) left: empty what is there, never below 0.
    if (plan.available > 0) {
      await tx.product.updateMany({ where: { id: args.productId, stock: { gt: 0 } }, data: { stock: 0 } })
    }
  } else {
    await tx.product.update({
      where: { id: args.productId },
      data: { stock: plan.nextStock, variants: plan.nextVariants as Prisma.InputJsonValue },
    })
  }

  return {
    kind: "reserved",
    scope: plan.scope,
    before: plan.available,
    after: plan.shortfall ? 0 : plan.available - requested,
    ...(plan.shortfall ? { shortfall: plan.shortfall } : {}),
  }
}
