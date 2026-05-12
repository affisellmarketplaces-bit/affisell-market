"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  ArrowDownWideNarrow,
  ArrowRight,
  LayoutGrid,
  Percent,
  Rocket,
  Search,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react"

import { ILLUSTRATIVE_RETAIL_MARKUP_PCT, illustrativePartnerShareUsd } from "@/lib/affiliate-earnings-hint"
import { WishlistHeart } from "@/components/wishlist-heart"
import { cn } from "@/lib/utils"

export type SupplierStorefrontListingSerializable = {
  id: string
  name: string
  basePriceCents: number
  commissionRate: number
  listingKind: string
  stock: number
  imageUrl: string
  compareAtNumber: number | null
  isOnSale: boolean
  createdAtIso: string
  tags: string[]
  deliveryMax: number
  /** Distinct affiliate listings live for this product (social proof). */
  partnerListingCount: number
}

const KIND_LABEL: Record<string, string> = {
  PHYSICAL: "Physical",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Subscription",
}

function formatUsdFromCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

type SortKey = "new" | "price-asc" | "price-desc" | "commission-desc" | "partners-desc"

function kindOf(p: SupplierStorefrontListingSerializable) {
  return String(p.listingKind ?? "").toUpperCase()
}

function fmtUsdRough(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
}

function affiliateHubProductHref(base: string, productId: string) {
  const join = base.includes("?") ? "&" : "?"
  return `${base}${join}productId=${encodeURIComponent(productId)}`
}

export function SupplierStorefrontBrowse({
  listings,
  /** Supplier showcase: shopper PDP plus affiliate path to hub (per-card `productId` deep link). */
  variant = "supplier-showcase",
  /** Affiliate hub base URL; `productId=` is appended for “Add to my store”. */
  affiliateHubHref = "/dashboard/affiliate",
}: {
  listings: SupplierStorefrontListingSerializable[]
  variant?: "supplier-showcase" | "generic"
  affiliateHubHref?: string
}) {
  const [q, setQ] = useState("")
  const [kind, setKind] = useState<string>("ALL")
  const [sort, setSort] = useState<SortKey>("new")

  const kindsPresent = useMemo(() => {
    const s = new Set<string>()
    for (const p of listings) {
      const k = kindOf(p)
      if (k) s.add(k)
    }
    return Array.from(s).sort()
  }, [listings])

  const filteredSorted = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let rows = listings.filter((p) => {
      if (kind !== "ALL" && kindOf(p) !== kind) return false
      if (!needle) return true
      if (p.name.toLowerCase().includes(needle)) return true
      return p.tags.some((t) => t.toLowerCase().includes(needle))
    })

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "price-asc":
          return a.basePriceCents - b.basePriceCents
        case "price-desc":
          return b.basePriceCents - a.basePriceCents
        case "commission-desc":
          return b.commissionRate - a.commissionRate
        case "partners-desc":
          return (b.partnerListingCount ?? 0) - (a.partnerListingCount ?? 0)
        case "new":
        default:
          return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
      }
    })

    return rows
  }, [listings, q, kind, sort])

  const maxPartnerCount = useMemo(
    () => listings.reduce((m, l) => Math.max(m, l.partnerListingCount ?? 0), 0),
    [listings]
  )

  const detailCta =
    variant === "supplier-showcase"
      ? { label: "View product", sub: "Shopper PDP on Affisell" }
      : { label: "View listing", sub: "Open details" }

  return (
    <section className="space-y-6" aria-labelledby="storefront-catalog-heading">
      <h2 id="storefront-catalog-heading" className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Catalog
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/60 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-3 sm:p-5">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="storefront-search" className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Search this shop
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              id="storefront-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Product name or tag…"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-violet-500/30 transition placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-violet-600"
            />
          </div>
        </div>

        <div className="flex min-w-[10rem] flex-col gap-1 sm:w-48">
          <label htmlFor="storefront-sort" className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sort
          </label>
          <div className="relative">
            <ArrowDownWideNarrow className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <select
              id="storefront-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-8 text-sm outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-violet-600"
            >
              <option value="new">Newest first</option>
              <option value="price-asc">Price · low → high</option>
              <option value="price-desc">Price · high → low</option>
              <option value="commission-desc">Commission · highest</option>
              <option value="partners-desc">Creator adoption · most listed</option>
            </select>
          </div>
        </div>
      </div>

      {kindsPresent.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Type</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind("ALL")}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                kind === "ALL"
                  ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              )}
            >
              All
            </button>
            {kindsPresent.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  kind === k
                    ? "border-teal-600 bg-teal-600 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                )}
              >
                {KIND_LABEL[k] ?? k}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Showing <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{filteredSorted.length}</strong> of{" "}
          <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{listings.length}</strong> listings
        </span>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/90 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <Sparkles className="mx-auto h-10 w-10 text-violet-500" aria-hidden />
          <p className="mt-4 text-lg font-medium text-zinc-900 dark:text-zinc-50">No matches</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Try another search, clear filters, or browse the full marketplace for similar suppliers.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQ("")
                setKind("ALL")
              }}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Reset filters
            </button>
            <Link
              href="/marketplace"
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              Explore marketplace
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSorted.map((p) => {
            const baseNum = p.basePriceCents / 100
            const compareN = p.compareAtNumber
            const hasDeal = compareN != null && Number.isFinite(compareN) && compareN > baseNum
            const discountPct =
              hasDeal && compareN != null ? Math.round(((compareN - baseNum) / compareN) * 100) : 0
            const kindKey = kindOf(p)
            const kindShort = KIND_LABEL[kindKey] ?? kindKey.replace(/_/g, " ").toLowerCase()
            const fastShip = p.deliveryMax <= 3
            const lowStock = p.stock > 0 && p.stock <= 8
            const img = p.imageUrl
            const unopt =
              typeof img === "string" &&
              (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/uploads"))
            const partners = p.partnerListingCount ?? 0
            const shareHint = illustrativePartnerShareUsd({
              basePriceCents: p.basePriceCents,
              commissionRatePct: p.commissionRate,
              retailMarkupPct: ILLUSTRATIVE_RETAIL_MARKUP_PCT,
            })
            const topAdoption = maxPartnerCount >= 2 && partners === maxPartnerCount && partners > 0
            const crowded = partners >= 3

            return (
              <li key={p.id}>
                <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-violet-200 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-violet-900/60">
                  <div className="relative aspect-[4/3] w-full shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
                    <Link href={`/product/${p.id}`} className="relative block h-full w-full">
                      <Image
                        src={img}
                        alt={p.name}
                        fill
                        className="object-contain p-3 transition duration-300 group-hover:scale-[1.02]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                        unoptimized={unopt}
                      />
                    </Link>
                    <WishlistHeart productId={p.id} className="absolute right-2.5 top-2.5 z-10" />
                    <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
                      {hasDeal ? (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
                          −{discountPct}%
                        </span>
                      ) : null}
                      {fastShip ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                          <Truck className="h-3 w-3" aria-hidden />
                          Fast ship
                        </span>
                      ) : null}
                      {lowStock ? (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          Low stock
                        </span>
                      ) : null}
                      {p.isOnSale && !hasDeal ? (
                        <span className="rounded-full bg-pink-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          Promo
                        </span>
                      ) : null}
                      {topAdoption ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
                          <TrendingUp className="h-3 w-3" aria-hidden />
                          Top pick
                        </span>
                      ) : null}
                      {crowded && !topAdoption ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                          <Users className="h-3 w-3" aria-hidden />
                          {partners} creators
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-4">
                    <Link href={`/product/${p.id}`}>
                      <h3 className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                        {p.name}
                      </h3>
                    </Link>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                        {formatUsdFromCents(p.basePriceCents)}
                      </span>
                      {hasDeal && compareN != null ? (
                        <span className="text-compare-at text-sm tabular-nums line-through">
                          {compareN.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                      <span className="rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{kindShort}</span>
                        {" · "}
                        <span className="text-zinc-500">Stock </span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{p.stock}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 dark:border-violet-900 dark:bg-violet-950/50">
                        <Percent className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
                        <span>
                          <span className="font-medium text-violet-900 dark:text-violet-100">
                            Commission offered: {p.commissionRate}%
                          </span>
                        </span>
                      </span>
                      {partners > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                          <Users className="h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
                          <span className="font-medium">
                            {partners} creator{partners === 1 ? "" : "s"} listing
                          </span>
                        </span>
                      ) : null}
                    </div>
                    {variant === "supplier-showcase" && shareHint ? (
                      <div className="rounded-xl border border-teal-100 bg-gradient-to-r from-teal-50/90 to-white px-3 py-2 dark:border-teal-900/60 dark:from-teal-950/35 dark:to-zinc-950">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-900 dark:text-teal-100">
                          <Rocket className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          Example partner payout*
                        </p>
                        <p className="mt-0.5 text-[11px] leading-snug text-teal-900/90 dark:text-teal-100/85">
                          ~{fmtUsdRough(shareHint.partnerShareUsd)} / sold unit if you retail ~{shareHint.retailMarkupPct}% above this
                          anchor ({fmtUsdRough(shareHint.retailUsd)} retail vs {formatUsdFromCents(p.basePriceCents)}{" "}
                          anchor).
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-auto space-y-2 pt-2">
                      <Link
                        href={`/product/${p.id}`}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                      >
                        {detailCta.label}
                        <ArrowRight className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                      </Link>
                      <p className="text-center text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {detailCta.sub}
                      </p>
                      {variant === "supplier-showcase" ? (
                        <Link
                          href={affiliateHubProductHref(affiliateHubHref, p.id)}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-400/80 bg-violet-50 py-2.5 text-center text-sm font-semibold text-violet-950 shadow-sm transition hover:border-violet-500 hover:bg-violet-100 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-50 dark:hover:bg-violet-950"
                          )}
                        >
                          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                          Add to my store
                        </Link>
                      ) : null}
                      {variant === "supplier-showcase" ? (
                        <p className="text-center text-[9px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                          *Illustrative only—your payout depends on the price you set. Opens the affiliate hub to list this
                          SKU.
                          {shareHint ? " Commission is a share of selling margin vs supplier anchor." : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
