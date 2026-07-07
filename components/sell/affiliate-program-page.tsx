import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Cookie,
  FileSpreadsheet,
  Landmark,
  Percent,
  ShieldAlert,
  Wallet,
} from "lucide-react"

import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import {
  AFFILIATE_CATALOG_VERTICALS,
  AFFILIATE_PROGRAM_PROHIBITIONS,
  AFFILIATE_TAX_RESIDENCE_ROWS,
  affiliateProgramFinanceFacts,
} from "@/lib/affiliate-program-finance"
import { PayoutPolicyDisclaimer } from "@/components/merchant/payout-policy-disclaimer"
import {
  AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
  PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
} from "@/lib/payout-policy-copy-shared"
import { cn } from "@/lib/utils"

export async function AffiliateProgramPage() {
  const t = await getTranslations("sellAffiliateProgram")
  const locale = await getLocale()
  const facts = affiliateProgramFinanceFacts
  const isFr = locale === "fr"

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-10 py-12">
        <BentoPageHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("hero.subtitle", {
            min: facts.commissionMinPct,
            max: facts.commissionMaxPct,
            days: facts.cookieDays,
          })}
        />

        <BentoCard className="flex flex-wrap items-center gap-4 border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/50 p-5 dark:border-violet-900/40 dark:from-violet-950/40 dark:via-zinc-950 dark:to-indigo-950/30">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-600/15 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">
            <Percent className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-zinc-900 dark:text-white">
              {t("hero.commission", { min: facts.commissionMinPct, max: facts.commissionMaxPct })}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              <Cookie className="size-4 shrink-0" aria-hidden />
              {t("hero.cookie", { days: facts.cookieDays })}
            </p>
          </div>
        </BentoCard>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup/affiliate"
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex gap-2")}
          >
            {t("ctaSignup")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/conditions-affilie"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
          >
            {t("ctaCgs")}
          </Link>
          <Link href="/login/affiliate" className={cn(buttonVariants({ variant: "ghost", size: "bento" }))}>
            {t("ctaLogin")}
          </Link>
        </div>

        {/* Statut indépendant — anti-URSSAF */}
        <section aria-labelledby="affiliate-status-heading">
          <BentoCard className="border-rose-300/80 bg-rose-50/90 p-5 dark:border-rose-900/60 dark:bg-rose-950/40">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-6 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden />
              <div>
                <h2
                  id="affiliate-status-heading"
                  className="text-lg font-bold text-rose-950 dark:text-rose-100"
                >
                  {t("status.title")}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-rose-900 dark:text-rose-100">
                  {t("status.warning")}
                </p>
                <p className="mt-2 text-xs text-rose-800/90 dark:text-rose-200/80">{t("status.legalRef")}</p>
              </div>
            </div>
          </BentoCard>
        </section>

        {/* Catalogue anonymisé */}
        <section className="space-y-3" aria-labelledby="affiliate-catalog-heading">
          <h2 id="affiliate-catalog-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
            {t("catalog.title")}
          </h2>
          <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{t("catalog.body")}</p>
          <div className="flex flex-wrap gap-2">
            {AFFILIATE_CATALOG_VERTICALS.map((v) => (
              <span
                key={v.labelFr}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <span aria-hidden>{v.icon}</span>
                {isFr ? v.labelFr : v.labelEn}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-500">{t("catalog.noSuppliers")}</p>
        </section>

        {/* Fiscalité */}
        <section className="space-y-4" aria-labelledby="affiliate-tax-heading">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <h2 id="affiliate-tax-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("tax.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("tax.body")}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{t("tax.tableCaption")}</caption>
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t("tax.colCountry")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("tax.colRegime")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {AFFILIATE_TAX_RESIDENCE_ROWS.map((row) => (
                  <tr key={row.code} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                      {isFr ? row.labelFr : row.labelEn}
                      <span className="ml-2 font-mono text-xs text-zinc-400">{row.code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">
                      {isFr ? row.regimeFr : row.regimeEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <BentoCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="size-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("tax.dac7Dashboard")}</p>
            </div>
            <Link
              href="/dashboard/affiliate/earnings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
            >
              {t("tax.dac7Cta")}
            </Link>
          </BentoCard>
        </section>

        {/* Payout */}
        <section className="space-y-4" aria-labelledby="affiliate-payout-heading">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-6 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <div>
              <h2 id="affiliate-payout-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("payout.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("payout.body", {
                  days: PAYOUT_DAYS_AFTER_DELIVERY_CONFIRM,
                  autoDays: AUTO_CONFIRM_DAYS_AFTER_DELIVERY,
                })}
              </p>
            </div>
          </div>
          <BentoCard className="space-y-2 p-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p>{t("payout.clawback")}</p>
          </BentoCard>
          <PayoutPolicyDisclaimer role="AFFILIATE" />
        </section>

        {/* Interdits */}
        <section className="space-y-4" aria-labelledby="affiliate-prohibited-heading">
          <div className="flex items-start gap-3">
            <Ban className="mt-0.5 size-6 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <div>
              <h2 id="affiliate-prohibited-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("prohibited.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">{t("prohibited.body")}</p>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {AFFILIATE_PROGRAM_PROHIBITIONS.map((key) => (
              <li
                key={key}
                className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-100"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                {t(`prohibited.items.${key}`)}
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            {t("prohibited.sanction", { days: facts.sanctionHoldDays })}
          </p>
        </section>

        <footer className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <p className="text-xs leading-relaxed text-zinc-500">{t("footerLegal")}</p>
        </footer>
      </BentoContainer>
    </BentoShell>
  )
}
