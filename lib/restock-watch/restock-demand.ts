/**
 * « N acheteurs attendent le retour de cette déclinaison » — the supplier-facing demand signal built from the buyers'
 * explicit « Prévenez-moi au retour » requests (founder brief 2026-11-19). Pure, client-safe types.
 *
 * Rules (each one pinned by `restock-demand.test.ts`):
 *  - only ACTIVE requests that are still VALID count: not cancelled / notified / closed / expired (90 days, even before
 *    the cron closes them), and the variant is still sold out in the product as it is today;
 *  - DISTINCT buyers, never raw requests: one buyer asking on two shops showing the same product counts once;
 *  - one count per EXACT variant (the shared variant key) — never sizes or colours added together;
 *  - shown only from `RESTOCK_DEMAND_MIN_BUYERS` (3) distinct buyers; below that NOTHING is said, not even that a
 *    request exists (one or two people could be identified by the supplier);
 *  - the output carries counts and the variant's own label only — no buyer id, date, order, shop or address;
 *  - a variant that is back in stock, removed, or ambiguous drops out at once (computed on read, never stored, so a
 *    count can not go stale).
 * It is an indication of REAL, explicit demand — not a sales forecast (a buyer may not buy when it is back).
 */
import { RESTOCK_WATCH_TTL_DAYS, type RestockWatch } from "@/lib/restock-watch/restock-watch"

export const RESTOCK_DEMAND_MIN_BUYERS = 3

/** What the product says TODAY about the watched variant (read by the caller from its own data). */
export type WatchedVariantToday = { status: "sold_out"; label: string } | { status: "available" | "gone" | "ambiguous" | "unknown" }

export type RestockDemandVariant = {
  productId: string
  variantKey: string
  /** The variant's own label in the supplier's product sheet. */
  variantLabel: string
  /** Distinct buyers waiting (≥ RESTOCK_DEMAND_MIN_BUYERS). */
  buyers: number
}

const DAY = 86_400_000

export function aggregateRestockDemand(args: {
  watches: ReadonlyArray<RestockWatch>
  now: Date
  variantToday: (productId: string, variantKey: string) => WatchedVariantToday
  minBuyers?: number
}): RestockDemandVariant[] {
  const min = Math.max(RESTOCK_DEMAND_MIN_BUYERS, args.minBuyers ?? RESTOCK_DEMAND_MIN_BUYERS)
  const groups = new Map<string, { productId: string; variantKey: string; buyers: Set<string> }>()
  for (const w of args.watches) {
    if (w.state !== "active" || !w.userId || !w.productId || !w.variantKey) continue
    const since = Date.parse(w.requestedAt)
    if (!Number.isFinite(since) || args.now.getTime() - since > RESTOCK_WATCH_TTL_DAYS * DAY) continue
    const k = `${w.productId}\u0000${w.variantKey}`
    const g = groups.get(k) ?? { productId: w.productId, variantKey: w.variantKey, buyers: new Set<string>() }
    g.buyers.add(w.userId)
    groups.set(k, g)
  }
  const out: RestockDemandVariant[] = []
  for (const g of groups.values()) {
    if (g.buyers.size < min) continue
    const today = args.variantToday(g.productId, g.variantKey)
    if (today.status !== "sold_out") continue
    out.push({ productId: g.productId, variantKey: g.variantKey, variantLabel: today.label, buyers: g.buyers.size })
  }
  return out.sort((a, b) => b.buyers - a.buyers || a.variantLabel.localeCompare(b.variantLabel))
}

export type RestockDemandProduct = { productId: string; productName: string; variants: RestockDemandVariant[] }

export function groupRestockDemandByProduct(variants: ReadonlyArray<RestockDemandVariant>, names: ReadonlyMap<string, string>): RestockDemandProduct[] {
  const byProduct = new Map<string, RestockDemandVariant[]>()
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v])
  return [...byProduct.entries()]
    .map(([productId, vs]) => ({ productId, productName: names.get(productId) ?? "", variants: vs }))
    .sort((a, b) => b.variants.reduce((s, v) => s + v.buyers, 0) - a.variants.reduce((s, v) => s + v.buyers, 0))
}
