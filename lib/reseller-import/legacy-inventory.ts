/**
 * Inventory of the reseller URL imports made BEFORE the validation flow (2026-11-18): products imported by resellers
 * that no admin ever reviewed and that may still be on sale. READ-ONLY and pure: the script
 * (`npm run report:legacy-reseller-imports`) reads the rows, this module counts them and names the risks.
 * Nothing here unpublishes, unlists or changes anything — pulling them is a founder decision.
 */
import { evaluateListingReadiness } from "@/lib/listing-compliance/evaluate"

export type LegacyImportRow = {
  createdAt: Date
  active: boolean
  isDraft: boolean
  listingKind: string | null
  sourceUrl: string | null
  basePriceCents: number
  stock: number
  imageCount: number
  descriptionLength: number
  attributes: ReadonlyArray<{ key: string; value: string }>
  listings: ReadonlyArray<{ isListed: boolean; affiliateId: string }>
  paidOrders90d: number
  paidOrdersAllTime: number
  openRecalls: number
}

export type LegacyImportInventory = {
  products: number
  live: number
  draftOrPaused: number
  listings: number
  listedListings: number
  resellers: number
  /** Products that sold at least once in the last 90 days, and their paid orders. */
  soldIn90d: { products: number; orders: number }
  paidOrdersAllTime: number
  bySourceHost: Array<{ host: string; products: number; live: number }>
  byImportMonth: Array<{ month: string; products: number }>
  risks: {
    liveWithoutSafetyData: number
    liveWithOpenRecall: number
    liveWithoutImage: number
    liveWithPlaceholderStock: number
    liveWithEmptyDescription: number
    liveWithZeroPrice: number
    liveFromUnknownSource: number
  }
}

const PLACEHOLDER_STOCKS = new Set([1, 99, 100, 999])

export function hostOf(url: string | null): string {
  if (!url) return "inconnue"
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase() || "inconnue"
  } catch {
    return "inconnue"
  }
}

export function summarizeLegacyImports(rows: ReadonlyArray<LegacyImportRow>): LegacyImportInventory {
  const resellers = new Set<string>()
  const hosts = new Map<string, { products: number; live: number }>()
  const months = new Map<string, number>()
  const out: LegacyImportInventory = {
    products: rows.length,
    live: 0,
    draftOrPaused: 0,
    listings: 0,
    listedListings: 0,
    resellers: 0,
    soldIn90d: { products: 0, orders: 0 },
    paidOrdersAllTime: 0,
    bySourceHost: [],
    byImportMonth: [],
    risks: {
      liveWithoutSafetyData: 0,
      liveWithOpenRecall: 0,
      liveWithoutImage: 0,
      liveWithPlaceholderStock: 0,
      liveWithEmptyDescription: 0,
      liveWithZeroPrice: 0,
      liveFromUnknownSource: 0,
    },
  }
  for (const r of rows) {
    const live = r.active && !r.isDraft
    if (live) out.live += 1
    else out.draftOrPaused += 1
    out.listings += r.listings.length
    for (const l of r.listings) {
      if (l.isListed) out.listedListings += 1
      resellers.add(l.affiliateId)
    }
    if (r.paidOrders90d > 0) {
      out.soldIn90d.products += 1
      out.soldIn90d.orders += r.paidOrders90d
    }
    out.paidOrdersAllTime += r.paidOrdersAllTime
    const host = hostOf(r.sourceUrl)
    const h = hosts.get(host) ?? { products: 0, live: 0 }
    h.products += 1
    if (live) h.live += 1
    hosts.set(host, h)
    const month = r.createdAt.toISOString().slice(0, 7)
    months.set(month, (months.get(month) ?? 0) + 1)
    if (!live) continue
    if (!evaluateListingReadiness({ listingKind: r.listingKind, attributes: r.attributes }).ready) {
      out.risks.liveWithoutSafetyData += 1
    }
    if (r.openRecalls > 0) out.risks.liveWithOpenRecall += 1
    if (r.imageCount === 0) out.risks.liveWithoutImage += 1
    if (PLACEHOLDER_STOCKS.has(r.stock)) out.risks.liveWithPlaceholderStock += 1
    if (r.descriptionLength < 20) out.risks.liveWithEmptyDescription += 1
    if (r.basePriceCents <= 0) out.risks.liveWithZeroPrice += 1
    if (host === "inconnue") out.risks.liveFromUnknownSource += 1
  }
  out.resellers = resellers.size
  out.bySourceHost = [...hosts.entries()]
    .map(([host, v]) => ({ host, ...v }))
    .sort((a, b) => b.products - a.products || a.host.localeCompare(b.host))
    .slice(0, 15)
  out.byImportMonth = [...months.entries()].map(([month, products]) => ({ month, products })).sort((a, b) => a.month.localeCompare(b.month))
  return out
}
