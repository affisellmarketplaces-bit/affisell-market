import Image from "next/image"
import Link from "next/link"
import { ExternalLink, Percent, ShoppingBag, Users } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { primaryProductImage } from "@/lib/product-images"
import { cn } from "@/lib/utils"
import type { SupplierDashboardCatalogProduct } from "@/lib/supplier-product-is-draft-fallback"

type CatalogProduct = SupplierDashboardCatalogProduct

const LISTING_LABEL: Record<string, string> = {
  PHYSICAL: "Physical",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Subscription",
}

export function SupplierDashboardProductsCatalog({
  products,
  storefrontHref,
  storefrontName,
  partnerListingCountByProductId = {},
}: {
  products: CatalogProduct[]
  storefrontHref: string
  storefrontName: string | null
  /** How many distinct partner storefronts list this SKU (listed rows). */
  partnerListingCountByProductId?: Record<string, number>
}) {
  const liveCount = products.filter((p) => !p.isDraft && p.active).length
  const draftCount = products.filter((p) => p.isDraft).length
  const pausedCount = products.filter((p) => !p.isDraft && !p.active).length

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white/90 px-5 py-4 shadow-sm dark:border-zinc-700/90 dark:bg-zinc-950/60 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            Products
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            Manage SKUs you sell through Affisell: pricing, inventory, fulfillment details, and the margin shared with
            partners. Customer checkout runs on partner storefront listings—your job here is a clear, accurate wholesale
            anchor. Use <strong className="font-medium text-zinc-800 dark:text-zinc-200">Partner preview</strong> on each
            card to sanity-check economics from a reseller perspective.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-sm">
            <span>
              <strong className="text-zinc-900 dark:text-zinc-100">{products.length}</strong> SKU
              {products.length === 1 ? "" : "s"}
            </span>
            <span>
              <strong className="text-emerald-700 dark:text-emerald-400">{liveCount}</strong> published live
            </span>
            {draftCount ? (
              <span>
                <strong className="text-amber-800 dark:text-amber-400">{draftCount}</strong> drafts
              </span>
            ) : null}
            {pausedCount ? (
              <span>
                <strong className="text-zinc-600 dark:text-zinc-400">{pausedCount}</strong> paused
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
          <Link
            href="/dashboard/supplier/products/new"
            className={cn(buttonVariants({ size: "default" }), "w-full bg-violet-600 hover:bg-violet-700 sm:w-auto")}
          >
            Add product
          </Link>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/supplier/bulk-import"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
            >
              Bulk import
            </Link>
            <Link
              href={storefrontHref}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "inline-flex gap-2 border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-900 dark:bg-teal-950/50 dark:text-teal-100 dark:hover:bg-teal-950"
              )}
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              View storefront
              <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
            </Link>
          </div>
          {storefrontName ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{storefrontName}</p>
          ) : null}
        </div>
      </div>

      {products.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-6 py-20 text-center dark:border-zinc-600 dark:bg-zinc-950/40">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">No products yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            Add your first SKU to go live on the marketplace and your public supplier storefront. Partner discovery and
            resale tools live in their own workspace—this screen is your catalog control center.
          </p>
          <Link
            href="/dashboard/supplier/products/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-6 inline-flex bg-violet-600 hover:bg-violet-700"
            )}
          >
            List your first product
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => {
            const partnersListed = partnerListingCountByProductId[p.id] ?? 0
            const img = primaryProductImage(p.images) || "/placeholder-product.jpg"
            const compareNum = p.compareAt != null ? Number(p.compareAt) : null
            const baseNum = p.basePriceCents / 100
            const hasDeal = compareNum != null && Number.isFinite(compareNum) && compareNum > baseNum
            const discountPct =
              hasDeal && compareNum !== null ? Math.round(((compareNum - baseNum) / compareNum) * 100) : 0

            const kindKey = String(p.listingKind ?? "").toUpperCase()
            const kindShort = LISTING_LABEL[kindKey] ?? kindKey.replace(/_/g, " ").toLowerCase()

            const editHref = p.isDraft
              ? `/dashboard/supplier/products/new?compose=1&draft=${p.id}`
              : `/dashboard/supplier/products/new?edit=${p.id}`
            return (
              <li key={p.id}>
                <article
                  className={cn(
                    "flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md dark:bg-zinc-950",
                    p.isDraft ? "border-amber-300/80 dark:border-amber-900/60" : "border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <div className="relative aspect-[4/3] w-full shrink-0 bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
                    <Image
                      src={img}
                      alt=""
                      fill
                      className="object-contain p-3"
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px"
                      unoptimized={
                        typeof img === "string" &&
                        (img.startsWith("http://") ||
                          img.startsWith("https://") ||
                          img.startsWith("/uploads"))
                      }
                    />
                    <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1.5">
                      {p.isDraft ? (
                        <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
                          Draft
                        </span>
                      ) : !p.active ? (
                        <span className="rounded-full bg-zinc-900/85 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow backdrop-blur">
                          Paused
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
                          Live
                        </span>
                      )}
                      {hasDeal ? (
                        <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow">
                          −{discountPct}%
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
                    <h2 className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50">
                      {p.name}
                    </h2>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        {formatStoreCurrencyFromCents(p.basePriceCents)}
                      </span>
                      {hasDeal && compareNum != null ? (
                        <span className="text-compare-at text-sm tabular-nums line-through">
                          {formatStoreCurrency(compareNum)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] text-zinc-600 dark:text-zinc-400 sm:text-xs">
                      <span className="rounded-lg border border-zinc-200 px-2 py-1 dark:border-zinc-700">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{kindShort}</span>
                        {" · "}Stock{" "}
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{p.stock}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 dark:border-violet-900 dark:bg-violet-950/50">
                        <Percent className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" aria-hidden />
                        <span>
                          Commission offered:{" "}
                          <strong className="font-semibold text-violet-900 dark:text-violet-100">
                            {p.commissionRate}%
                          </strong>
                        </span>
                      </span>
                      {!p.isDraft && p.active && partnersListed > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 dark:border-emerald-900 dark:bg-emerald-950/50">
                          <Users className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden />
                          <span>
                            <strong className="font-semibold text-emerald-900 dark:text-emerald-100">
                              {partnersListed}
                            </strong>{" "}
                            partner storefront{partnersListed === 1 ? "" : "s"}
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex flex-col gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
                      <Link
                        href={editHref}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "justify-center border-violet-200 font-medium text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100 dark:hover:bg-violet-950/50 sm:flex-1"
                        )}
                      >
                        Edit listing
                      </Link>
                      <Link
                        href={`/dashboard/supplier/products/affiliate-preview/${p.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "justify-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        )}
                      >
                        Partner preview
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
