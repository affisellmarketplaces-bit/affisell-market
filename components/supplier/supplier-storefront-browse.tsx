"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArrowDownWideNarrow,
  ArrowRight,
  LayoutGrid,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react"

import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
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
  partnerListingCount: number
  commissionDisplay?: string
  variants?: unknown
}

const KIND_LABEL: Record<string, string> = {
  PHYSICAL: "Physique",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Abonnement",
}

type SortKey = "new" | "price-asc" | "price-desc"

function kindOf(p: SupplierStorefrontListingSerializable) {
  return String(p.listingKind ?? "").toUpperCase()
}

/** Public supplier catalog — cards link to partner-catalog product sheets. */
export function SupplierStorefrontBrowse({
  listings,
  storeSlug,
}: {
  listings: SupplierStorefrontListingSerializable[]
  storeSlug: string
}) {
  const tBrowse = useTranslations("supplierStorefront.browse")
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
        case "new":
        default:
          return new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime()
      }
    })

    return rows
  }, [listings, q, kind, sort])

  return (
    <section className="space-y-8" aria-labelledby="storefront-catalog-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
            Catalogue
          </p>
          <h2
            id="storefront-catalog-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Produits disponibles
          </h2>
        </div>
        <p className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{filteredSorted.length}</strong>
            {" / "}
            {listings.length} article{listings.length === 1 ? "" : "s"}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-950/70 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="storefront-search"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Rechercher
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              id="storefront-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nom du produit…"
              className="h-11 w-full rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm outline-none ring-violet-500/20 transition placeholder:text-zinc-400 focus:border-violet-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-violet-600"
            />
          </div>
        </div>

        <div className="flex min-w-[10rem] flex-col gap-1 sm:w-44">
          <label
            htmlFor="storefront-sort"
            className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Trier
          </label>
          <div className="relative">
            <ArrowDownWideNarrow
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <select
              id="storefront-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white py-2 pl-10 pr-8 text-sm outline-none ring-violet-500/20 focus:border-violet-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-violet-600"
            >
              <option value="new">Nouveautés</option>
              <option value="price-asc">Prix croissant</option>
              <option value="price-desc">Prix décroissant</option>
            </select>
          </div>
        </div>
      </div>

      {kindsPresent.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Type
          </span>
          <div className="flex flex-wrap gap-2">
            {(["ALL", ...kindsPresent] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                  kind === k
                    ? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-600/25"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                )}
              >
                {k === "ALL" ? "Tout" : (KIND_LABEL[k] ?? k)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredSorted.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-300 bg-gradient-to-b from-zinc-50 to-white px-6 py-16 text-center dark:border-zinc-700 dark:from-zinc-950 dark:to-zinc-900">
          <Sparkles className="mx-auto h-10 w-10 text-violet-500" aria-hidden />
          <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Aucun résultat</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Modifiez votre recherche ou explorez d&apos;autres boutiques sur Affisell.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQ("")
                setKind("ALL")
              }}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              Réinitialiser
            </button>
            <Link
              href={PUBLIC_MARKETPLACE_BROWSE_PATH}
              className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-600/25 hover:bg-violet-700"
            >
              Explorer la marketplace
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSorted.map((p) => {
            const baseNum = p.basePriceCents / 100
            const compareN = p.compareAtNumber
            const hasDeal = compareN != null && Number.isFinite(compareN) && compareN > baseNum
            const discountPct =
              hasDeal && compareN != null ? Math.round(((compareN - baseNum) / compareN) * 100) : 0
            const kindKey = kindOf(p)
            const kindShort = KIND_LABEL[kindKey] ?? kindKey.replace(/_/g, " ").toLowerCase()
            const fastShip = p.deliveryMax <= 3
            const img = p.imageUrl
            const unopt =
              typeof img === "string" &&
              (img.startsWith("http://") || img.startsWith("https://") || img.startsWith("/uploads"))
            const productHref = `/store/supplier/${encodeURIComponent(storeSlug)}/product/${encodeURIComponent(p.id)}`

            return (
              <li key={p.id}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-sm ring-1 ring-black/[0.03] transition duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-xl hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-white/[0.04] dark:hover:border-violet-800/60">
                  <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-violet-50/40 dark:from-zinc-900 dark:via-zinc-950 dark:to-violet-950/20">
                    <Link href={productHref} className="relative block h-full w-full">
                      <Image
                        src={img}
                        alt={p.name}
                        fill
                        className="object-contain p-4 transition duration-500 group-hover:scale-[1.03]"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 280px"
                        unoptimized={unopt}
                      />
                      <div
                        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"
                        aria-hidden
                      />
                    </Link>
                    <WishlistHeart productId={p.id} className="absolute right-3 top-3 z-10" />
                    <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-4rem)] flex-wrap gap-1.5">
                      {hasDeal ? (
                        <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
                          −{discountPct}%
                        </span>
                      ) : null}
                      {fastShip ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow">
                          <Truck className="h-3 w-3" aria-hidden />
                          Livraison rapide
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-4 pt-3">
                    <Link href={productHref} className="min-h-[2.75rem]">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 transition group-hover:text-violet-800 dark:text-zinc-50 dark:group-hover:text-violet-200">
                        {p.name}
                      </h3>
                    </Link>

                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        {formatStoreCurrencyFromCents(p.basePriceCents)}
                      </span>
                      {hasDeal && compareN != null ? (
                        <span className="text-sm tabular-nums text-zinc-400 line-through">
                          {formatStoreCurrency(compareN)}
                        </span>
                      ) : null}
                    </div>

                    <p className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                      <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" aria-hidden />
                        {kindShort}
                      </span>
                      {p.stock > 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-400">En stock</span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">Rupture</span>
                      )}
                      {p.partnerListingCount > 0 ? (
                        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200">
                          {p.partnerListingCount === 1
                            ? tBrowse("partnerListingsOne", { count: p.partnerListingCount })
                            : tBrowse("partnerListingsMany", { count: p.partnerListingCount })}
                        </span>
                      ) : null}
                    </p>

                    <Link
                      href={productHref}
                      className="mt-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-center text-sm font-semibold text-white shadow-md shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 hover:shadow-lg"
                    >
                      Voir la fiche catalogue
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
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
