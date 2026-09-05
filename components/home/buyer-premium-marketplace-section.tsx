import { Suspense } from "react"
import { getLocale } from "next-intl/server"

import { BuyerPremiumMarketplaceLayoutClient } from "@/components/home/buyer-premium-marketplace-layout"
import { BuyerMarketplaceExplorer } from "@/components/home/BuyerMarketplaceExplorer"
import { resolveAppLocale } from "@/lib/i18n-locale"
import { loadHomeMarketplaceShellSafe } from "@/lib/home-marketplace-shell"
import { loadBrowseDepartmentsCached } from "@/lib/taxonomy/resolve-browse-departments.server"

async function PremiumMarketplaceSection() {
  const locale = resolveAppLocale(await getLocale())
  const [shell, browsePayload] = await Promise.all([
    loadHomeMarketplaceShellSafe(locale),
    loadBrowseDepartmentsCached(locale),
  ])

  const browseDepartments = browsePayload.departments.filter((d) => d.resolved)

  return (
    <BuyerPremiumMarketplaceLayoutClient
      shell={shell}
      browseDepartments={browseDepartments}
      catalogExplorer={
        <Suspense fallback={<div className="min-h-[12rem] animate-pulse rounded-xl bg-slate-50" aria-hidden />}>
          <BuyerMarketplaceExplorer />
        </Suspense>
      }
    />
  )
}

export function BuyerPremiumMarketplaceSection() {
  return (
    <Suspense fallback={<div className="min-h-[28rem] animate-pulse rounded-2xl bg-white/90" aria-hidden />}>
      <PremiumMarketplaceSection />
    </Suspense>
  )
}
