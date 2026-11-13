import type { Prisma } from "@prisma/client"

import { isCheckoutStockGuardEnabled, planStockMovement, type StockScope } from "@/lib/checkout-stock"
import { parseListingKind } from "@/lib/supplier-commission"

type Tx = Prisma.TransactionClient

export type StockReservationResult =
  /** Units taken from the stock (the order may be created). */
  | { kind: "reserved"; scope: StockScope; before: number; after: number }
  /** Not enough left: the caller must NOT create the order (nothing was written). */
  | { kind: "insufficient"; scope: StockScope; available: number; requested: number }
  /** Stock is not managed for this line (or the guard is off): behave exactly as before. */
  | { kind: "skipped"; reason: "guard_off" | "product_not_found" | "non_physical" | "variant_unresolved" | "invalid_quantity" }

type LockedProductRow = { stock: number | null; variants: unknown; listingKind: string | null }

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
 * Takes `qty` units from the stock of a product, inside the payment-processing transaction, so that the decrement
 * commits or rolls back WITH the order it pays for (a replayed webhook finds the order already paid and never gets
 * here again: no double decrement).
 *
 * Atomic against concurrent payments: the product row is locked (`SELECT … FOR UPDATE`) before the stock is read, so two
 * payments of the last unit are serialised and the second one sees 0. For a product-level movement the write itself is
 * ALSO guarded (`updateMany … WHERE stock >= qty`): the stock can never go negative, even if the lock is ever removed.
 * The per-session advisory lock of the fulfilment only serialises the SAME checkout session — it does nothing between
 * two different buyers, which is exactly the oversell case.
 *
 * Writes nothing when the stock is short; the caller then records the line as unallocated.
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
  if (!isCheckoutStockGuardEnabled()) return { kind: "skipped", reason: "guard_off" }
  if (args.listingKind != null && parseListingKind(args.listingKind) !== "PHYSICAL") {
    return { kind: "skipped", reason: "non_physical" }
  }

  const rows = await tx.$queryRaw<LockedProductRow[]>`
    SELECT "stock", "variants", "listingKind" FROM "Product" WHERE "id" = ${args.productId} FOR UPDATE`
  const row = rows[0]
  if (!row) return { kind: "skipped", reason: "product_not_found" }

  const plan = planStockMovement({
    listingKind: row.listingKind,
    stock: row.stock,
    variants: jsonColumn(row.variants),
    variantSignature: args.variantSignature,
    qty: args.qty,
  })

  if (plan.kind === "unmanaged") return { kind: "skipped", reason: plan.reason }
  const requested = Math.round(Number(args.qty))
  if (plan.kind === "insufficient") {
    return { kind: "insufficient", scope: plan.scope, available: plan.available, requested }
  }

  if (plan.scope === "product") {
    const updated = await tx.product.updateMany({
      where: { id: args.productId, stock: { gte: requested } },
      data: { stock: { decrement: requested } },
    })
    if (updated.count !== 1) {
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
