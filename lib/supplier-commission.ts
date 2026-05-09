export const LISTING_KINDS = ["PHYSICAL", "SOFTWARE", "SUBSCRIPTION"] as const

export type ListingKind = (typeof LISTING_KINDS)[number]

export function parseListingKind(raw: unknown): ListingKind {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : ""
  if (s === "SOFTWARE" || s === "SUBSCRIPTION" || s === "PHYSICAL") {
    return s
  }
  return "PHYSICAL"
}

export function affiliateCommissionMaxPct(kind: ListingKind): number {
  return kind === "PHYSICAL" ? 99 : 100
}

export function defaultAffiliateCommissionPct(): number {
  return 15
}

export function normalizeAffiliateCommissionRatePct(
  raw: unknown,
  listingKind: ListingKind
): { ok: true; rate: number } | { ok: false; error: string } {
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    return { ok: false, error: "Invalid affiliate commission rate" }
  }
  const rounded = Math.round(n)
  const max = affiliateCommissionMaxPct(listingKind)
  if (rounded < 0) {
    return { ok: false, error: "Commission must be at least 0%" }
  }
  if (rounded > max) {
    return {
      ok: false,
      error:
        listingKind === "PHYSICAL"
          ? "Physical goods cannot exceed 99%. Select Software or Subscription to allow 100%."
          : "Commission cannot exceed 100%",
    }
  }
  return { ok: true, rate: rounded }
}
