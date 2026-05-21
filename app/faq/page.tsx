import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("faq")
  return { title: t("metaTitle") }
}

export default async function FaqPage() {
  const t = await getTranslations("faq")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <BentoCard id="cashback" className="scroll-mt-24 p-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{t("cashbackTitle")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("cashbackBody")}</p>
          <Link
            href="/marketplace/account/wallet"
            className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }), "mt-4 inline-flex")}
          >
            {t("walletCta")}
          </Link>
        </BentoCard>

        <Link
          href="/#explorer"
          className="text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          {t("backMarketplace")}
        </Link>
      </BentoContainer>
    </BentoShell>
  )
}
