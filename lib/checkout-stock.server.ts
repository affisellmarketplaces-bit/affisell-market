import type { Prisma } from "@prisma/client"

import {
  isStockManagedForLine,
  planStockMovement,
  resolveCheckoutStockMode,
  type StockScope,
} from "@/lib/checkout-stock"
import { parseListingKind } from "@/lib/supplier-commission"

type Tx = Prisma.TransactionClient

export type StockReservationResult =
  /** `enforce`: units taken from the stock (the order may be created). */
  | { kind: "reserved"; scope: StockScope; before: number; after: number }
  /** `enforce`: not enough left — the caller must NOT create the order (nothing was written). */
  | { kind: "insufficient"; scope: StockScope; available: number; requested: number }
  /**
   * `warn`: a DRY RUN — nothing was read with a lock and nothing was written. `would_decrement` = what `enforce` would
   * have taken; `would_drop` = the stock could not have served this paid line (enforce would have made it unallocated).
   * The paid line is never removed.
   */
  | { kind: "dry_run"; outcome: "would_decrement"; scope: StockScope; before: number; after: number }
  | { kind: "dry_run"; outcome: "would_drop"; scope: StockScope; available: number; requested: number }
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
        | "no_snapshot"
    }

type LockedProductRow = {
  stock: number | null
  variants: unknown
  listingKind: string | null
  hasVariants: boolean | null
}

function hasVariantRows(variants: unknown): boolean {
  const rows = (variants as { variantRows?: unknown } | null)?.variantRows
  return Array.isArray(rows) && rows.length > 0
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
 * of the locks must not depend on a query plan. Only `enforce` writes the stock, so only `enforce` locks.
 */
export async function lockProductsForStockInTransaction(tx: Tx, productIds: string[]): Promise<void> {
  if (resolveCheckoutStockMode() !== "enforce") return
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
 * Mode (`CHECKOUT_STOCK_MODE`):
 * - `enforce`: atomic against concurrent payments — the product row is locked (`SELECT … FOR NO KEY UPDATE`) before the
 *   stock is read, so two payments of the last unit are serialised and the second one sees 0. `NO KEY UPDATE` and not
 *   `UPDATE`: the key never changes, and a plain `FOR UPDATE` would also block every `INSERT` of an order of that product
 *   (the foreign key check takes `FOR KEY SHARE` on the parent row). For a product-level movement the write itself is ALSO
 *   guarded (`updateMany … WHERE stock >= qty`): the stock can never go negative, even if the lock is ever removed. The
 *   per-session advisory lock of the fulfilment only serialises the SAME checkout session — it does nothing between two
 *   different buyers, which is exactly the oversell case. A shortfall writes nothing and answers `insufficient` (the
 *   caller then records the line as unallocated).
 * - `warn` (default): a DRY RUN from the snapshot the caller already loaded (`known`) — no lock, no read, NO WRITE
 *   (`Product.stock` is read by the PDP / showcase card / JSON-LD: writing it would already change what shoppers see).
 *   Answers `dry_run` with what enforce would have done; a paid line is never dropped.
 * - `off`: nothing.
 */
export async function reserveStockInTransaction(
  tx: Tx,
  args: {
    productId: string
    variantSignature: string | null | undefined
    qty: number
    /** Kind the caller already loaded: a non-physical listing is skipped WITHOUT locking its row. */
    listingKind?: string | null
    /**
     * What the caller already loaded: the stock / variant structure of the listing's product. Lets a line that can only be
     * unmanaged skip the row lock, and is the ONLY source `warn` mode computes its dry run from.
     */
    known?: { hasVariants?: boolean | null; variants: unknown; stock?: number | null }
  }
): Promise<StockReservationResult> {
  const mode = resolveCheckoutStockMode()
  if (mode === "off") return { kind: "skipped", reason: "guard_off" }
  if (args.listingKind != null && parseListingKind(args.listingKind) !== "PHYSICAL") {
    return { kind: "skipped", reason: "non_physical" }
  }
  if (
    args.known &&
    !isStockManagedForLine({
      listingKind: args.listingKind ?? "PHYSICAL",
      hasVariants: args.known.hasVariants,
      variants: args.known.variants,
      variantSignature: args.variantSignature,
    })
  ) {
    return {
      kind: "skipped",
      reason: args.known.hasVariants === true && !hasVariantRows(args.known.variants) ? "variants_not_tracked" : "variant_unresolved",
    }
  }

  const requested = Math.round(Number(args.qty))

  if (mode === "warn") {
    if (!args.known || args.known.stock === undefined) return { kind: "skipped", reason: "no_snapshot" }
    const dry = planStockMovement({
      listingKind: args.listingKind ?? "PHYSICAL",
      stock: args.known.stock,
      variants: args.known.variants,
      hasVariants: args.known.hasVariants,
      variantSignature: args.variantSignature,
      qty: args.qty,
    })
    if (dry.kind === "unmanaged") return { kind: "skipped", reason: dry.reason }
    if (dry.kind === "insufficient") {
      return { kind: "dry_run", outcome: "would_drop", scope: dry.scope, available: dry.available, requested }
    }
    return { kind: "dry_run", outcome: "would_decrement", scope: dry.scope, before: dry.available, after: dry.available - requested }
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
  })

  if (plan.kind === "unmanaged") return { kind: "skipped", reason: plan.reason }
  if (plan.kind === "insufficient") {
    return { kind: "insufficient", scope: plan.scope, available: plan.available, requested }
  }

  if (plan.scope === "product") {
    const updated = await tx.product.updateMany({
      where: { id: args.productId, stock: { gte: requested } },
      data: { stock: { decrement: requested } },
    })
    if (updated.count !== 1) {
      // The guarded write found less than the locked read said (the lock was bypassed somewhere): never go negative.
      return { kind: "insufficient", scope: "product", available: plan.available, requested }
    }
  } else {
    await tx.product.update({
      where: { id: args.productId },
      data: { stock: plan.nextStock, variants: plan.nextVariants as Prisma.InputJsonValue },
    })
  }

  return { kind: "reserved", scope: plan.scope, before: plan.available, after: plan.available - requested }
}
