import { Package, ShieldCheck, Star, Truck } from "lucide-react"
import { getLocale, getTranslations } from "next-intl/server"

import { SupplierTrustBadge } from "@/components/suppliers/supplier-trust-badge"
import type { SupplierStorefrontTrustMetrics } from "@/lib/supplier-storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  isVerifiedSupplier: boolean
  supplierTrustTier: string | null
  supplierSuccessfulOrders: number
  metrics: SupplierStorefrontTrustMetrics
  className?: string
}

export async function SupplierStorefrontTrustRail({
  isVerifiedSupplier,
  supplierTrustTier,
  supplierSuccessfulOrders,
  metrics,
  className,
}: Props) {
  const locale = (await getLocale()) === "fr" ? "fr" : "en"
  const t = await getTranslations("supplierStorefront.trust")

  const items = [
    supplierSuccessfulOrders > 0
      ? {
          icon: Package,
          label: t("ordersFulfilled"),
          value: t("ordersCount", { count: supplierSuccessfulOrders }),
        }
      : null,
    metrics.averageRating != null && metrics.averageRating > 0
      ? {
          icon: Star,
          label: t("avgRating"),
          value: metrics.averageRating.toFixed(1),
        }
      : null,
    metrics.shippedWithin48hPct != null
      ? {
          icon: Truck,
          label: t("fastShip"),
          value: `${Math.round(metrics.shippedWithin48hPct)}%`,
        }
      : null,
    metrics.disputeRatePct != null
      ? {
          icon: ShieldCheck,
          label: t("disputeRate"),
          value: `${metrics.disputeRatePct.toFixed(1)}%`,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof Package; label: string; value: string }>

  return (
    <section
      className={cn(
        "rounded-2xl border border-zinc-200/80 bg-white/90 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80",
        className
      )}
      data-testid="supplier-storefront-trust-rail"
    >
      <div className="flex flex-wrap items-center gap-3">
        <SupplierTrustBadge
          tier={supplierTrustTier}
          isVerifiedSupplier={isVerifiedSupplier}
          locale={locale}
          size="md"
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      </div>
      {items.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.label}
                className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  <Icon className="size-3.5" aria-hidden />
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{item.value}</p>
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
