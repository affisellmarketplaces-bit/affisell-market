/**
 * Replace an unsellable product of a reseller's shop by a REALLY equivalent one
 * (founder brief 2026-11-19). Pure, client-safe.
 *
 * Equivalence is earned, never assumed:
 *  - `identique`  : both products declare the SAME valid GTIN (same GS1 reference = same item);
 *  - `similaire`  : same catalogue category AND names that share most of their words
 *                   (≥ 50 % of distinctive words, Jaccard) AND the alternative offers at
 *                   least half of the original's colours / sizes when the original has any.
 * Anything else is not proposed: when nothing passes, the answer is « no reliable
 * alternative » rather than an unrelated product.
 *
 * An alternative is only proposed when it can REALLY be sold today: explicit
 * commission (a sale can be allocated), published and on sale (`mayList`), a KNOWN
 * quantity > 0, a supplier price, not already live in this reseller's shop.
 *
 * Money: the reseller's net per sale (commission + markup − Affisell's fee) with the
 * SAME function as the catalogue and the copilot (`computeResellerNetPerSale`, pinned
 * to the real settlement), for the original at its CURRENT price and for the
 * alternative at the price the replacement will really write (the reseller's own
 * earlier listing price when one exists, else the quick-add default).
 */
import { computeResellerNetPerSale, type ResellerNet } from "@/lib/reseller-copilot/net-per-sale"

export type ReplacementProblem = "out_of_stock" | "product_unavailable" | "awaiting_review" | "no_commission"

export type OriginalListing = {
  listingId: string
  productId: string
  name: string
  categoryId: string | null
  gtin14: string | null
  brand: string | null
  supplierPriceCents: number
  commissionPct: number
  sellingPriceHtCents: number
  colors: string[]
  sizes: string[]
  deliveryMaxDays: number | null
  returnWindowDays: number
  problem: ReplacementProblem | null
}

export type ReplacementCandidate = {
  productId: string
  name: string
  imageUrl: string | null
  categoryId: string | null
  gtin14: string | null
  brand: string | null
  supplierLabel: string
  supplierPriceCents: number
  commissionPct: number
  commissionExplicit: boolean
  /** Units a buyer can take; null = unknown (never proposed). */
  available: number | null
  mayList: boolean
  colors: string[]
  sizes: string[]
  deliveryMaxDays: number | null
  returnWindowDays: number
  /** The reseller already has a listing on it: its own selling price is what a re-listing keeps. */
  existingListing: { sellingPriceCents: number; isListed: boolean } | null
  /** What the quick add would write for a new listing. */
  defaultSellingPriceCents: number
}

export type Difference = {
  field:
    | "identity"
    | "selling_price"
    | "net_per_sale"
    | "supplier_price"
    | "commission"
    | "delivery"
    | "return_window"
    | "variants_missing"
    | "brand"
    | "supplier"
  before: string | number | null
  after: string | number | null
  /** better / worse for the reseller or its buyers; neutral when it is only different. */
  direction: "better" | "worse" | "neutral"
}

export type Alternative = {
  productId: string
  name: string
  imageUrl: string | null
  supplierLabel: string
  match: "identique" | "similaire"
  similarity: number
  sellingPriceHtCents: number
  net: ResellerNet
  available: number
  differences: Difference[]
}

export type ReplacementProposal =
  | { status: "found"; original: OriginalListing; originalNet: ResellerNet; alternatives: Alternative[] }
  | { status: "none"; original: OriginalListing; originalNet: ResellerNet; reason: "no_sellable_candidate" | "no_reliable_match" }

export const MIN_NAME_SIMILARITY = 0.5
export const MIN_VARIANT_COVERAGE = 0.5
export const MAX_ALTERNATIVES = 3

const STOPWORDS = new Set([
  "the", "and", "for", "with", "pour", "avec", "les", "des", "une", "sans", "dans", "aux", "par", "sur",
  "new", "neuf", "nouveau", "nouvelle", "hot", "sale", "promo", "lot", "pack", "pcs", "piece", "pieces",
  "pièce", "pièces", "mode", "style", "qualite", "qualité", "haute", "high", "quality", "best", "top",
])

export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  )
}

export function nameSimilarity(a: string, b: string): number {
  const A = nameTokens(a)
  const B = nameTokens(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const t of A) if (B.has(t)) inter++
  return inter / (A.size + B.size - inter)
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase()

/** Share of the original's options (colours + sizes) that the candidate also offers; 1 when the original has none. */
export function variantCoverage(original: { colors: string[]; sizes: string[] }, candidate: { colors: string[]; sizes: string[] }) {
  const want = [...original.colors.map((c) => `c:${norm(c)}`), ...original.sizes.map((s) => `s:${norm(s)}`)].filter((x) => x.length > 2)
  if (want.length === 0) return { coverage: 1, missing: [] as string[] }
  const have = new Set([...candidate.colors.map((c) => `c:${norm(c)}`), ...candidate.sizes.map((s) => `s:${norm(s)}`)])
  const missing = want.filter((w) => !have.has(w))
  return { coverage: (want.length - missing.length) / want.length, missing: missing.map((m) => m.slice(2)) }
}

function sellable(c: ReplacementCandidate): boolean {
  return (
    c.commissionExplicit &&
    c.mayList &&
    c.available != null &&
    c.available > 0 &&
    c.supplierPriceCents > 0 &&
    !(c.existingListing?.isListed ?? false)
  )
}

function dir(before: number | null, after: number | null, higherIsBetter: boolean): Difference["direction"] {
  if (before == null || after == null || before === after) return "neutral"
  return (after > before) === higherIsBetter ? "better" : "worse"
}

export function buildReplacementProposal(
  original: OriginalListing,
  candidates: ReadonlyArray<ReplacementCandidate>,
  opts: { affiliateFeeBps: number | null }
): ReplacementProposal {
  const originalNet = computeResellerNetPerSale({
    supplierPriceCents: original.supplierPriceCents,
    commissionRatePct: original.commissionPct,
    sellingPriceHtCents: original.sellingPriceHtCents,
    affiliateFeeBps: opts.affiliateFeeBps,
  })
  const pool = candidates.filter((c) => c.productId !== original.productId && sellable(c))
  if (pool.length === 0) return { status: "none", original, originalNet, reason: "no_sellable_candidate" }

  const alternatives: Alternative[] = []
  for (const c of pool) {
    const identical = Boolean(original.gtin14 && c.gtin14 && original.gtin14 === c.gtin14)
    const similarity = nameSimilarity(original.name, c.name)
    const variants = variantCoverage(original, c)
    const similar =
      !identical &&
      Boolean(original.categoryId && c.categoryId === original.categoryId) &&
      similarity >= MIN_NAME_SIMILARITY &&
      variants.coverage >= MIN_VARIANT_COVERAGE
    if (!identical && !similar) continue

    const sellingPriceHtCents = c.existingListing?.sellingPriceCents ?? c.defaultSellingPriceCents
    const net = computeResellerNetPerSale({
      supplierPriceCents: c.supplierPriceCents,
      commissionRatePct: c.commissionPct,
      sellingPriceHtCents,
      affiliateFeeBps: opts.affiliateFeeBps,
    })
    const d: Difference[] = [
      { field: "identity", before: null, after: identical ? "same_gtin" : "similar", direction: "neutral" },
      {
        field: "selling_price",
        before: original.sellingPriceHtCents,
        after: sellingPriceHtCents,
        direction: dir(original.sellingPriceHtCents, sellingPriceHtCents, false),
      },
      { field: "net_per_sale", before: originalNet.netCents, after: net.netCents, direction: dir(originalNet.netCents, net.netCents, true) },
      {
        field: "supplier_price",
        before: original.supplierPriceCents,
        after: c.supplierPriceCents,
        direction: dir(original.supplierPriceCents, c.supplierPriceCents, false),
      },
      { field: "commission", before: original.commissionPct, after: c.commissionPct, direction: dir(original.commissionPct, c.commissionPct, true) },
      {
        field: "delivery",
        before: original.deliveryMaxDays,
        after: c.deliveryMaxDays,
        direction: dir(original.deliveryMaxDays, c.deliveryMaxDays, false),
      },
      {
        field: "return_window",
        before: original.returnWindowDays,
        after: c.returnWindowDays,
        direction: dir(original.returnWindowDays, c.returnWindowDays, true),
      },
      { field: "supplier", before: null, after: c.supplierLabel, direction: "neutral" },
    ]
    if (variants.missing.length > 0) {
      d.push({ field: "variants_missing", before: null, after: variants.missing.slice(0, 8).join(", "), direction: "worse" })
    }
    if (original.brand && c.brand && norm(original.brand) !== norm(c.brand)) {
      d.push({ field: "brand", before: original.brand, after: c.brand, direction: "neutral" })
    }
    alternatives.push({
      productId: c.productId,
      name: c.name,
      imageUrl: c.imageUrl,
      supplierLabel: c.supplierLabel,
      match: identical ? "identique" : "similaire",
      similarity: identical ? 1 : Math.round(similarity * 100) / 100,
      sellingPriceHtCents,
      net,
      available: c.available as number,
      differences: d,
    })
  }

  if (alternatives.length === 0) return { status: "none", original, originalNet, reason: "no_reliable_match" }
  alternatives.sort(
    (a, b) =>
      (a.match === b.match ? 0 : a.match === "identique" ? -1 : 1) ||
      b.similarity - a.similarity ||
      b.net.netCents - a.net.netCents ||
      a.productId.localeCompare(b.productId)
  )
  return { status: "found", original, originalNet, alternatives: alternatives.slice(0, MAX_ALTERNATIVES) }
}

/** GTIN-14 form of a declared barcode, or null when it is not a valid GS1 code. */
export function gtin14(raw: string | null | undefined, isValid: (g: string) => boolean): string | null {
  const g = (raw ?? "").replace(/[\s\-.]/g, "")
  if (!g || !isValid(g)) return null
  return g.padStart(14, "0")
}
