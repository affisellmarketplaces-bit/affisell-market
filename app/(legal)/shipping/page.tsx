import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buildNormativeRichTags } from "@/components/legal/normative-rich-tags"
import { ShippingCarrierDirectory } from "@/components/shipping/shipping-carrier-directory"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("shipping")
  return { title: t("metaTitle") }
}

export default async function ShippingPage() {
  const t = await getTranslations("shipping")
  const locale = (await getLocale()) === "en" ? "en" : "fr"
  const norms = buildNormativeRichTags(locale)

  const carrierLabels = {
    title: t("carriersTitle"),
    subtitle: t("carriersSubtitle"),
    originLabel: t("originLabel"),
    destinationLabel: t("destinationLabel"),
    reliability: t("reliability"),
    popular: t("popular"),
    eta: t("eta"),
    etaUnit: t("etaUnit"),
    empty: t("empty"),
    tierPremium: t("tierPremium"),
    tierStandard: t("tierStandard"),
    tierEconomy: t("tierEconomy"),
    tagExpress: t("tagExpress"),
    tagTracked: t("tagTracked"),
    tagPickup: t("tagPickup"),
    tagInternational: t("tagInternational"),
    tagLastMile: t("tagLastMile"),
    tagMarketplace: t("tagMarketplace"),
    routeSummary: t("routeSummary"),
  }

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <ShippingCarrierDirectory locale={locale} labels={carrierLabels} />

        <BentoCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("delaysTitle")}</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>
              <strong>{t("delayEu")}</strong>
            </li>
            <li>{t("delayIntl")}</li>
            <li>{t("delayProduct")}</li>
          </ul>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t.rich("legalNote", norms)}</p>
        </BentoCard>

        <BentoCard className="space-y-4 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("trackingTitle")}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>{t("tracking1")}</li>
            <li>{t("tracking2")}</li>
            <li>{t("tracking3")}</li>
          </ol>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/track-order" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}>
              {t("trackCta")}
            </Link>
            <Link
              href="/marketplace/account/orders"
              className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
            >
              {t("ordersCta")}
            </Link>
          </div>
        </BentoCard>

        <BentoCard className="space-y-3 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("issueTitle")}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("issueBody")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/support" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
              {t("supportCta")}
            </Link>
            <Link href="/faq" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              {t("faqCta")}
            </Link>
          </div>
        </BentoCard>
      </BentoContainer>
    </BentoShell>
  )
}
