import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { FaqAccordion } from "@/components/support/faq-accordion"
import { SupportAgentChat } from "@/components/support/support-agent-chat"
import { buttonVariants } from "@/components/ui/button"
import { FAQ_SECTIONS, L221_28_LEGIFRANCE_URL } from "@/lib/support/faq-content"
import { cn } from "@/lib/utils"

export async function generateBuyerFaqMetadata() {
  const t = await getTranslations("faq")
  return { title: t("metaTitle") }
}

export async function BuyerFaqPage() {
  const t = await getTranslations("faq")

  const sections = FAQ_SECTIONS.map((section) => ({
    id: section.id,
    title: t(section.titleKey),
    items: section.items.map((item) => ({
      id: item.id,
      question: t(item.qKey),
      answer: item.richAnswer
        ? t.rich(item.aKey, {
            l22128: (chunks) => (
              <a
                href={L221_28_LEGIFRANCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {chunks}
              </a>
            ),
            protectedCheckout: (chunks) => (
              <Link
                href="/protected-checkout"
                className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
              >
                {chunks}
              </Link>
            ),
          })
        : t(item.aKey),
    })),
  }))

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-10 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <FaqAccordion sections={sections} />

        <BentoCard className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("stillNeedHelp")}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("stillNeedHelpBody")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/support" className={cn(buttonVariants({ variant: "bentoAccent", size: "bento" }))}>
              {t("supportAgentCta")}
            </Link>
            <Link href="/contact" className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}>
              {t("contactCta")}
            </Link>
          </div>
        </BentoCard>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">{t("agentInlineTitle")}</h2>
          <SupportAgentChat />
        </div>

        <Link
          href="/marketplace/account/wallet"
          className="inline-flex text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          {t("walletCta")}
        </Link>

        <Link
          href="/#explorer"
          className="block text-sm font-medium text-violet-700 underline-offset-4 hover:underline dark:text-violet-300"
        >
          {t("backMarketplace")}
        </Link>
      </BentoContainer>
    </BentoShell>
  )
}
