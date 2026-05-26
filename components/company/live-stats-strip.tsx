import { getTranslations } from "next-intl/server"

import { BentoCard } from "@/components/affisell/bento-ui"
import { loadHomeMarketplaceStatsSafe, loadPublicHomeStatsSafe } from "@/lib/public-home-data"

export async function LiveStatsStrip() {
  const t = await getTranslations("companyPages.stats")
  const [home, marketplace] = await Promise.all([
    loadPublicHomeStatsSafe(),
    loadHomeMarketplaceStatsSafe(),
  ])

  const items = [
    { label: t("stores"), value: home.shopCountLabel },
    { label: t("listings"), value: home.productCountLabel },
    { label: t("catalog"), value: marketplace.productCountLabel },
    { label: t("commission"), value: marketplace.avgCommissionLabel },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(({ label, value }) => (
        <BentoCard key={label} className="p-4 text-center md:p-5">
          <p className="text-2xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-300">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        </BentoCard>
      ))}
    </div>
  )
}
