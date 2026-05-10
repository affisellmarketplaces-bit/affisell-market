import { Prisma } from "@prisma/client"

/** Compare-at for live listings (strict). */
export function parseCompareAtStrict(
  basePriceCents: number,
  compareAtRaw: unknown
): { ok: true; decimal: Prisma.Decimal | null } | { ok: false; error: string } {
  if (compareAtRaw == null || String(compareAtRaw).trim() === "") {
    return { ok: true, decimal: null }
  }
  const compareAtNumber = Number(compareAtRaw)
  if (!Number.isFinite(compareAtNumber) || compareAtNumber <= 0) {
    return { ok: false, error: "Invalid compare-at price" }
  }
  const compareAtCents = Math.round(compareAtNumber * 100)
  if (compareAtCents <= basePriceCents) {
    return { ok: false, error: "Compare-at price must be greater than price" }
  }
  const discountPct = ((compareAtCents - basePriceCents) / compareAtCents) * 100
  if (discountPct > 70) {
    return { ok: false, error: "Discount cannot exceed 70%" }
  }
  return { ok: true, decimal: new Prisma.Decimal(compareAtNumber.toFixed(2)) }
}

/** Compare-at while saving a draft — invalid combos become null instead of rejecting. */
export function parseCompareAtDraftLax(basePriceCents: number, compareAtRaw: unknown): Prisma.Decimal | null {
  const r = parseCompareAtStrict(basePriceCents, compareAtRaw)
  if (!r.ok) return null
  return r.decimal
}
