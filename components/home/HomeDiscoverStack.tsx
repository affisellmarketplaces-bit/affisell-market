import { Suspense } from "react"
import { getTranslations } from "next-intl/server"

import { BentoGrid } from "@/components/BentoGrid"
import { BentoGridSkeleton } from "@/components/home/BentoGridSkeleton"
import { HomeDiscoverTierHeader } from "@/components/home/HomeDiscoverTierHeader"
import { HomeOrbitalServicesRail } from "@/components/home/HomeOrbitalServicesRail"
import { HomeSectionTriDash } from "@/components/home/HomeSectionTriDash"
import { HomeTrustHandoff } from "@/components/home/HomeTrustHandoff"

/** Trois bandes home séparées par tirets — sans doublon hero. */
export async function HomeDiscoverStack() {
  const t = await getTranslations("home.discoverTiers")

  return (
    <div className="space-y-0">
      <section aria-labelledby="home-tier-1-heading">
        <HomeDiscoverTierHeader
          tier="01"
          eyebrow={t("tier1Eyebrow")}
          title={t("tier1Title")}
        />
        <h2 id="home-tier-1-heading" className="sr-only">
          {t("tier1Title")}
        </h2>
        <Suspense fallback={<BentoGridSkeleton />}>
          <BentoGrid />
        </Suspense>
      </section>

      <HomeSectionTriDash />

      <HomeOrbitalServicesRail />

      <HomeSectionTriDash />

      <section aria-labelledby="home-tier-3-heading">
        <HomeDiscoverTierHeader
          tier="03"
          eyebrow={t("tier3Eyebrow")}
          title={t("tier3Title")}
        />
        <h2 id="home-tier-3-heading" className="sr-only">
          {t("tier3Title")}
        </h2>
        <HomeTrustHandoff />
      </section>
    </div>
  )
}
