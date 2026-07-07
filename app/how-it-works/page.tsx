import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SellerMarginExampleCard } from "@/components/marketing/seller-margin-example-card"
import { SellerPayoutSplitCard } from "@/components/marketing/seller-payout-split-card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("howItWorks")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

const ROLES = ["buyer", "seller", "creator", "supplier"] as const
const FLOW_KEYS = ["flowSupplier", "flowPlatform", "flowSeller", "flowAffiliate"] as const

export default async function HowItWorksPage() {
  const t = await getTranslations("howItWorks")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {ROLES.map((role) => (
            <BentoCard key={role} className="p-5">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t(`${role}.title`)}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t(`${role}.body`)}</p>
            </BentoCard>
          ))}
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("flowTitle")}</h2>
            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {FLOW_KEYS.map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="text-violet-500" aria-hidden>
                    →
                  </span>
                  {t(key)}
                </li>
              ))}
            </ul>
          </BentoCard>
          <SellerPayoutSplitCard />
        </div>
        <div className="mt-8">
          <SellerMarginExampleCard />
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/marketplace" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}>
            {t("ctaBrowse")}
          </Link>
          <Link href="/sellers" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            {t("ctaSeller")}
          </Link>
          <Link href="/supplier" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            {t("ctaSupplier")}
          </Link>
          <Link href="/creators" className={cn(buttonVariants({ variant: "ghost", size: "bento" }))}>
            {t("ctaPartner")}
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
