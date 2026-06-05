import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

export async function generateMetadata() {
  const t = await getTranslations("legalPages.accessibility")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

export default async function AccessibilityPage() {
  const t = await getTranslations("legalPages.accessibility")
  const company = readCompanyLegal()

  const commitments = ["perceivable", "operable", "understandable", "robust"] as const

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

        <BentoCard className="space-y-4">
          <h2 className="text-lg font-bold">{t("commitmentTitle")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {commitments.map((key) => (
              <li
                key={key}
                className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
              >
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t(`commitments.${key}.title`)}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {t(`commitments.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </BentoCard>

        <BentoCard className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("statusTitle")}</h2>
          <p>{t("statusBody")}</p>
          <p>{t("feedbackBody", { email: company.supportEmail })}</p>
        </BentoCard>

        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className={cn(buttonVariants({ variant: "default" }))}>
            {t("contactCta")}
          </Link>
          <Link href="/faq" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("faqCta")}
          </Link>
        </div>
      </BentoContainer>
    </BentoShell>
  )
}
