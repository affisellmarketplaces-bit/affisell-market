import Image from "next/image"
import Link from "next/link"
import { Archive, Rocket, Sparkles, TrendingUp } from "lucide-react"

import type { SupplierGrowthSnapshot } from "@/lib/supplier-mission-control"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  growth: SupplierGrowthSnapshot
}

export function SupplierGrowthSection({ growth }: Props) {
  return (
    <section aria-labelledby="growth-heading" className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
          <h2 id="growth-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Opportunités
          </h2>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Affiliés ayant consulté vos produits sans les ajouter à leur boutique — proposez +2&nbsp;% de commission
          pour accélérer l’adoption.
        </p>
        {growth.opportunities.length === 0 ? (
          <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:bg-zinc-900/60">
            Aucune piste détectée sur les 30 derniers jours. Publiez plus de SKUs visibles sur le marketplace.
          </p>
        ) : (
          <ul className="space-y-2">
            {growth.opportunities.map((o) => (
              <li
                key={`${o.affiliateId}-${o.productId}`}
                className="flex flex-col gap-2 rounded-xl border border-zinc-100 px-3 py-2.5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{o.affiliateName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {o.productName} · {o.viewCount} vue{o.viewCount > 1 ? "s" : ""}
                  </p>
                </div>
                <Link
                  href={`/dashboard/supplier/products/${o.productId}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
                >
                  +2&nbsp;% commission
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" aria-hidden />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Performance catalogue</h2>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {growth.adoptionRatePct}%
          </p>
          <p className="text-sm text-zinc-500">taux d’adoption (7j)</p>
        </div>
        <p className="text-xs text-zinc-500">
          {growth.skusWithSales} SKU avec ventes · {growth.totalSkus} SKU actifs au total
        </p>

        <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">SKU dormants (30j)</p>
          {growth.dormantSkus.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">Tous vos SKUs actifs ont enregistré une vente récente.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {growth.dormantSkus.map((sku) => (
                <li
                  key={sku.id}
                  className="flex items-center gap-3 rounded-xl border border-zinc-100 px-2 py-2 dark:border-zinc-800"
                >
                  {sku.imageUrl ? (
                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                      <Image src={sku.imageUrl} alt="" fill className="object-cover" sizes="36px" />
                    </div>
                  ) : (
                    <div className="h-9 w-9 shrink-0 rounded-md bg-zinc-100 dark:bg-zinc-900" />
                  )}
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {sku.name}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <Link
                      href={`/dashboard/supplier/products/${sku.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 px-2 text-xs")}
                    >
                      <Rocket className="mr-1 h-3 w-3" aria-hidden />
                      Booster
                    </Link>
                    <Link
                      href={`/dashboard/supplier/products/${sku.id}?archive=1`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2 text-xs")}
                    >
                      <Archive className="h-3 w-3" aria-hidden />
                      <span className="sr-only">Archiver</span>
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
