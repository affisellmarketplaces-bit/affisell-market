/**
 * Product lifecycle (founder decision 2026-11-18): the commercial status has two causes that must not be confused —
 * a PAUSE decided by the supplier and a SUSPENSION decided by Affisell (today: a product-safety recall, `createRecall`
 * in `lib/legal/gpsr.ts`, which sets `active = false`). Both share the single `Product.active` column, so without this
 * check a supplier could put a recalled product back on sale with one click.
 *
 * Until a dedicated suspension field exists (migration — founder decision), an OPEN recall is the suspension:
 * any recall whose status is not `closed`.
 */
export const PRODUCT_RECALLED_ERROR = "product_recalled"

export function isRecallOpen(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() !== "closed"
}

/** May the SUPPLIER set this product on sale / publish it? False while Affisell holds it under an open recall. */
export function supplierMayActivate(recallStatuses: ReadonlyArray<string | null | undefined>): boolean {
  return !recallStatuses.some((s) => isRecallOpen(s))
}
