import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { SupportAgentChat } from "@/components/support/support-agent-chat"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("supportPage")
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  }
}

export default async function SupportPage() {
  const t = await getTranslations("supportPage")

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <SupportAgentChat />

        <div className="grid gap-4 sm:grid-cols-3">
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("cards.faq.title")}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("cards.faq.body")}</p>
            <Link href="/help/faq" className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}>
              {t("cards.faq.link")}
            </Link>
          </BentoCard>
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("cards.orders.title")}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("cards.orders.body")}</p>
            <Link
              href="/marketplace/account/orders"
              className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}
            >
              {t("cards.orders.link")}
            </Link>
          </BentoCard>
          <BentoCard className="p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{t("cards.contact.title")}</p>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("cards.contact.body")}</p>
            <Link href="/contact" className={cn(buttonVariants({ variant: "link", size: "sm" }), "mt-2 px-0")}>
              {t("cards.contact.link")}
            </Link>
          </BentoCard>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
