"use client"

import Image from "next/image"
import Link from "next/link"
import {
  ArrowUpRight,
  Eye,
  FileEdit,
  Package,
  Percent,
  Plus,
  Sparkles,
  Store,
  Upload,
  Users,
  Video,
} from "lucide-react"

import { BentoCard, BentoPageHeading, BentoStat } from "@/components/affisell/bento-ui"
import { SupplierDeleteDraftButton } from "@/components/supplier/supplier-delete-draft-button"
import { buttonVariants } from "@/components/ui/button"
import { affisellBrand } from "@/lib/affisell-brand"
import { formatStoreCurrency, formatStoreCurrencyFromCents } from "@/lib/market-config"
import { primaryProductImage } from "@/lib/product-images"
import { cn } from "@/lib/utils"
import type { SupplierDashboardCatalogProduct } from "@/lib/supplier-product-is-draft-fallback"

type CatalogProduct = SupplierDashboardCatalogProduct

const LISTING_LABEL: Record<string, string> = {
  PHYSICAL: "Physique",
  SOFTWARE: "Digital",
  SUBSCRIPTION: "Abonnement",
  SERVICE: "Service",
  EXPERIENCE: "Expérience",
}

function statusMeta(p: CatalogProduct) {
  if (p.isDraft) {
    return {
      label: "Brouillon",
      className:
        "border-amber-200/90 bg-amber-500/95 text-white shadow-sm shadow-amber-500/20 dark:border-amber-800/60",
    }
  }
  if (!p.active) {
    return {
      label: "En pause",
      className: "border-zinc-300/80 bg-zinc-800/90 text-white backdrop-blur-sm dark:border-zinc-600",
    }
  }
  return {
    label: "En ligne",
    className:
      "border-emerald-200/90 bg-emerald-600/95 text-white shadow-sm shadow-emerald-600/25 dark:border-emerald-800/60",
  }
}

export function SupplierDashboardProductsCatalog({
  ownerUserId,
  products,
  draftsOnly = false,
  storefrontHref,
  storefrontName,
  partnerListingCountByProductId = {},
}: {
  ownerUserId: string
  products: CatalogProduct[]
  draftsOnly?: boolean
  storefrontHref: string
  storefrontName: string | null
  partnerListingCountByProductId?: Record<string, number>
}) {
  const liveCount = products.filter((p) => !p.isDraft && p.active).length
  const draftCount = products.filter((p) => p.isDraft).length
  const partnerListedTotal = Object.values(partnerListingCountByProductId).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-8">
      <header className={cn(affisellBrand.headerShell, "overflow-hidden rounded-3xl border-0 shadow-lg")}>
        <div className={affisellBrand.headerMesh} aria-hidden />
        <div className="relative flex flex-col gap-8 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <BentoPageHeading
            eyebrow={draftsOnly ? "Catalogue · Brouillons" : "Catalogue fournisseur"}
            title={draftsOnly ? "Brouillons" : "Produits"}
            description={
              draftsOnly ? (
                <>
                  Reprenez un brouillon ou{" "}
                  <Link
                    href="/dashboard/supplier/products"
                    className="font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
                  >
                    retournez au catalogue complet
                  </Link>
                  .
                </>
              ) : (
                <>
                  Pilotez vos SKU : prix catalogue, stock, commission partenaires et logistique. Les acheteurs passent par
                  les boutiques affiliées — utilisez{" "}
                  <strong className="font-semibold text-zinc-800 dark:text-zinc-100">Aperçu partenaire</strong> pour
                  valider la fiche telle que les créateurs la voient dans Discover.
                </>
              )
            }
            className="max-w-2xl"
          />
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:min-w-[14rem]">
            <Link
              href="/dashboard/supplier/products/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/25 hover:from-violet-500 hover:to-indigo-500 sm:w-auto"
              )}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nouveau produit
            </Link>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/dashboard/supplier/bulk-import"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center justify-center gap-1.5 rounded-xl border-zinc-200/90 bg-white/90 backdrop-blur dark:border-zinc-700 dark:bg-zinc-950/80"
                )}
              >
                <Upload className="h-3.5 w-3.5 opacity-70" aria-hidden />
                Import
              </Link>
              <Link
                href={storefrontHref}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "inline-flex items-center justify-center gap-1.5 rounded-xl border-teal-200/90 bg-teal-50/90 text-teal-900 hover:bg-teal-100 dark:border-teal-900/50 dark:bg-teal-950/40 dark:text-teal-100"
                )}
              >
                <Store className="h-3.5 w-3.5" aria-hidden />
                Vitrine
                <ArrowUpRight className="h-3 w-3 opacity-60" aria-hidden />
              </Link>
            </div>
            {storefrontName ? (
              <p className="text-center text-[11px] text-zinc-500 dark:text-zinc-400 sm:text-left">{storefrontName}</p>
            ) : null}
          </div>
        </div>
      </header>

      {!draftsOnly ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BentoStat label="SKUs" value={products.length} hint="Total dans ce catalogue" />
          <BentoStat
            label="En ligne"
            value={liveCount}
            valueClassName="text-emerald-600 dark:text-emerald-400"
            hint="Visibles dans Discover"
          />
          <BentoStat
            label="Brouillons"
            value={draftCount}
            valueClassName={draftCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            hint={draftCount > 0 ? "À publier" : "Aucun brouillon"}
          />
          <BentoStat
            label="Listings partenaires"
            value={partnerListedTotal}
            valueClassName="text-violet-600 dark:text-violet-400"
            hint="Annonces live chez les créateurs"
          />
        </div>
      ) : null}

      {products.length === 0 ? (
        <BentoCard className="flex flex-col items-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <Package className="h-7 w-7" aria-hidden />
          </div>
          <p className="mt-6 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            {draftsOnly ? "Aucun brouillon" : "Votre catalogue est vide"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {draftsOnly
              ? "Créez une fiche — l’enregistrement automatique conserve votre travail."
              : "Publiez votre premier SKU pour apparaître dans Discover et sur votre vitrine fournisseur."}
          </p>
          <Link
            href="/dashboard/supplier/products/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-8 inline-flex gap-2 rounded-2xl bg-violet-600 shadow-md hover:bg-violet-700"
            )}
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {draftsOnly ? "Nouvelle fiche" : "Créer un produit"}
          </Link>
        </BentoCard>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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
            const status = statusMeta(p)
            const editHref = p.isDraft
              ? `/dashboard/supplier/products/new?compose=1&draft=${p.id}`
              : `/dashboard/supplier/products/new?edit=${p.id}`
            const previewHref = `/dashboard/supplier/products/affiliate-preview/${p.id}`

            return (
              <li key={p.id}>
                <article
                  className={cn(
                    "group flex h-full flex-col overflow-hidden rounded-3xl border bg-white/90 shadow-sm ring-1 ring-black/[0.03] backdrop-blur-sm transition duration-300",
                    "hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-500/8 dark:bg-zinc-950/90 dark:ring-white/[0.04]",
                    p.isDraft
                      ? "border-amber-200/80 dark:border-amber-900/50"
                      : "border-zinc-200/90 dark:border-zinc-800/90"
                  )}
                >
                  <Link
                    href={previewHref}
                    className="relative block aspect-[5/4] w-full overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-indigo-50/30 dark:from-zinc-900 dark:via-zinc-950 dark:to-indigo-950/20"
                  >
                    <Image
                      src={img}
                      alt=""
                      fill
                      className="object-contain p-5 transition duration-500 group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 380px"
                      unoptimized={
                        typeof img === "string" &&
                        (img.startsWith("http://") ||
                          img.startsWith("https://") ||
                          img.startsWith("/uploads"))
                      }
                    />
                    <div
                      className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-900/20 via-transparent to-transparent opacity-0 transition group-hover:opacity-100"
                      aria-hidden
                    />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                      {hasDeal ? (
                        <span className="rounded-full border border-rose-200/80 bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          −{discountPct}%
                        </span>
                      ) : null}
                    </div>
                  </Link>

                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <Link href={previewHref} className="line-clamp-2 text-base font-semibold leading-snug text-zinc-900 transition hover:text-violet-800 dark:text-zinc-50 dark:hover:text-violet-200">
                        {p.name}
                      </Link>
                      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-900 dark:text-white">
                          {formatStoreCurrencyFromCents(p.basePriceCents)}
                        </span>
                        {hasDeal && compareNum != null ? (
                          <span className="text-sm tabular-nums text-zinc-400 line-through">
                            {formatStoreCurrency(compareNum)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Type · Stock</p>
                        <p className="mt-0.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {kindShort} · {p.stock}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white px-3 py-2.5 dark:border-violet-900/50 dark:from-violet-950/40 dark:to-zinc-950">
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                          <Percent className="h-3 w-3" aria-hidden />
                          Commission
                        </p>
                        <p className="mt-0.5 text-sm font-bold tabular-nums text-violet-950 dark:text-violet-100">
                          {p.displayCommissionRate}%
                        </p>
                      </div>
                    </div>

                    {!p.isDraft && p.active && partnersListed > 0 ? (
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {partnersListed} créateur{partnersListed === 1 ? "" : "s"} en boutique live
                      </p>
                    ) : null}

                    <div className="mt-auto space-y-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                      <Link
                        href={previewHref}
                        className={cn(
                          buttonVariants({ size: "sm" }),
                          "flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 font-semibold shadow-md shadow-violet-600/20 hover:from-violet-500 hover:to-indigo-500"
                        )}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        Aperçu partenaire
                      </Link>
                      <div className="grid grid-cols-2 gap-2">
                        <Link
                          href={editHref}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex items-center justify-center gap-1.5 rounded-xl"
                          )}
                        >
                          <FileEdit className="h-3.5 w-3.5 opacity-70" aria-hidden />
                          {p.isDraft ? "Reprendre" : "Modifier"}
                        </Link>
                        {!p.isDraft ? (
                          <Link
                            href={`/dashboard/supplier/products/${p.id}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "inline-flex items-center justify-center gap-1.5 rounded-xl border-zinc-200 dark:border-zinc-700"
                            )}
                          >
                            <Video className="h-3.5 w-3.5 opacity-70" aria-hidden />
                            Vidéo produit
                          </Link>
                        ) : (
                          <SupplierDeleteDraftButton
                            ownerUserId={ownerUserId}
                            productId={p.id}
                            productName={p.name}
                            variant="icon"
                            className="flex h-9 w-full items-center justify-center rounded-xl border border-zinc-200 dark:border-zinc-700"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
