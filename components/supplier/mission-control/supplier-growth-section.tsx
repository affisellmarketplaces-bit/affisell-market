import Image from "next/image"
import Link from "next/link"
import { Archive, Lightbulb, Rocket, TrendingUp } from "lucide-react"

import { SupplierOpportunityBoostButton } from "@/components/supplier/mission-control/supplier-opportunity-boost-button"
import type { SupplierGrowthSnapshot } from "@/lib/supplier-mission-control"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = {
  growth: SupplierGrowthSnapshot
}

export function SupplierGrowthSection({ growth }: Props) {
  const opp = growth.topOpportunity

  return (
    <section aria-labelledby="growth-heading" className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/70 via-white to-white p-5 shadow-sm dark:border-violet-900/50 dark:from-violet-950/35 dark:via-zinc-950 dark:to-zinc-950">
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            💡
          </span>
          <h2 id="growth-heading" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Opportunités
          </h2>
        </div>

        {!opp ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Aucune piste détectée sur les 30 derniers jours. Publiez plus de SKUs visibles sur le
            marketplace.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              <span className="font-semibold text-violet-900 dark:text-violet-100">
                {opp.affiliateViewerCount} affilié{opp.affiliateViewerCount > 1 ? "s" : ""}
              </span>{" "}
              ont vu{" "}
              <span className="font-medium">« {opp.productName} »</span>{" "}
              <span className="font-semibold tabular-nums">{opp.totalViews}×</span> sans l’ajouter.
            </p>
            <p className="flex items-start gap-2 rounded-xl border border-violet-100 bg-white/80 px-3 py-2.5 text-sm text-violet-950 dark:border-violet-900/50 dark:bg-zinc-900/50 dark:text-violet-100">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
              <span>
                Passe commission{" "}
                <span className="font-semibold tabular-nums">{opp.currentCommissionPct}%</span>
                {" → "}
                <span className="font-semibold tabular-nums">{opp.suggestedCommissionPct}%</span>
                {" = "}
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  +{opp.estimatedExtraSales7d} vente{opp.estimatedExtraSales7d > 1 ? "s" : ""} estimée
                  {opp.estimatedExtraSales7d > 1 ? "s" : ""} / 7j
                </span>
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <SupplierOpportunityBoostButton opportunity={opp} />
              <Link
                href={`/dashboard/supplier/products/${opp.productId}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                Voir la fiche
              </Link>
            </div>
          </div>
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
