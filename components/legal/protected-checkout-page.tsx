import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import { Lock, RotateCcw, ShieldCheck } from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buildNormativeRichTags } from "@/components/legal/normative-rich-tags"
import { buttonVariants } from "@/components/ui/button"
import { normativeUrl } from "@/lib/legal/normative-sources"
import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

export async function generateProtectedCheckoutMetadata() {
  const t = await getTranslations("legalPages.protectedCheckout")
  return { title: t("metaTitle"), description: t("metaDescription") }
}

const RETURN_ROWS = ["changeMind", "defective"] as const

export async function ProtectedCheckoutPage() {
  const locale = await getLocale()
  const t = await getTranslations("legalPages.protectedCheckout")
  const company = readCompanyLegal()
  const norms = buildNormativeRichTags(locale)

  return (
    <BentoShell>
      <BentoContainer maxWidth="4xl" className="space-y-8 py-12">
        <BentoPageHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t.rich("description", norms)}
        />

        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3 py-1.5 text-xs font-semibold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <RotateCcw className="size-3.5" aria-hidden />
            {t("badgeReturns")}
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1.5 text-xs font-semibold text-violet-900 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-200">
            <Lock className="size-3.5" aria-hidden />
            {t("badge3ds")}
          </span>
        </div>

        <BentoCard className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            <ShieldCheck className="size-5 text-violet-600 dark:text-violet-400" aria-hidden />
            {t("paymentTitle")}
          </h2>
          <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{t("paymentBody")}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.rich("paymentHint", norms)}</p>
        </BentoCard>

        <BentoCard className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("returnsTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              {t.rich("returnsIntro", norms)}
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("returnsTable.situation")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("returnsTable.returnCost")}
                  </th>
                  <th className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("returnsTable.refundDelay")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {RETURN_ROWS.map((key) => (
                  <tr
                    key={key}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/80"
                  >
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {t(`returnsRows.${key}.situation`)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t(`returnsRows.${key}.returnCost`)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t(`returnsRows.${key}.refundDelay`)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p>
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{t("returnsHowTitle")}</span>{" "}
              {t("returnsHowBody")}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t.rich("returnsExceptions", norms)}</p>
          </div>
        </BentoCard>

        <BentoCard className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("warrantyTitle")}</h2>
          <p>{t.rich("warrantyBody", norms)}</p>
        </BentoCard>

        <BentoCard className="space-y-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{t("mediationTitle")}</h2>
          <p>{t.rich("mediationBody", norms)}</p>
          <a
            href={company.mediatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
          >
            {t("mediationLinkLabel")}
          </a>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            <a
              href={normativeUrl("EU_ODR_524_2013", locale)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
            >
              {t("odrPlatformLabel")}
            </a>
          </p>
        </BentoCard>

        <div className="flex flex-wrap gap-3">
          <Link href="/contact" className={cn(buttonVariants({ variant: "default" }))}>
            {t("contactCta")}
          </Link>
          <Link href="/track-order" className={cn(buttonVariants({ variant: "outline" }))}>
            {t("trackCta")}
          </Link>
          <Link href="/cgv" className={cn(buttonVariants({ variant: "ghost" }))}>
            {t("legalCta")}
          </Link>
        </div>

        <p className="border-t border-zinc-200/80 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {t("footerHost")}
        </p>
      </BentoContainer>
    </BentoShell>
  )
}
