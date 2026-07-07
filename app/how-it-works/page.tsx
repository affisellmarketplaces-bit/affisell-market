import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("howItWorks")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function HowItWorksPage() {
  const t = await getTranslations("howItWorks")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("buyer.title")}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("buyer.body")}</p>
          </BentoCard>
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("creator.title")}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("creator.body")}</p>
          </BentoCard>
          <BentoCard className="p-5">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("supplier.title")}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{t("supplier.body")}</p>
          </BentoCard>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/marketplace" className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }))}>
            {t("ctaBrowse")}
          </Link>
          <Link href="/affiliate" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
            {t("ctaPartner")}
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
