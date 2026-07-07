import Link from "next/link"
import { getLocale, getTranslations } from "next-intl/server"
import {
  ArrowRight,
  Building2,
  FileSpreadsheet,
  Landmark,
  RefreshCcw,
  Scale,
  Wallet,
} from "lucide-react"

import { PayoutPolicyDisclaimer } from "@/components/merchant/payout-policy-disclaimer"
import { BentoCard, BentoContainer, BentoPageHeading, BentoShell } from "@/components/affisell/bento-ui"
import { buttonVariants } from "@/components/ui/button"
import {
  EU_STANDARD_VAT_AS_OF,
  euStandardVatRows,
  formatVatRatePercent,
} from "@/lib/eu-standard-vat-rates"
import {
  SUPPLIER_PAYOUT_EXAMPLE,
  supplierBecomeFinanceFacts,
} from "@/lib/supplier-become-page-finance"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

function PayoutStep({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="relative flex flex-col gap-1 rounded-xl border border-zinc-200/80 bg-white/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="text-lg font-bold text-zinc-900 dark:text-white">{value}</p>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
    </div>
  )
}

export async function BecomeSupplierPage() {
  const t = await getTranslations("sellBecomeSupplier")
  const locale = await getLocale()
  const vatRows = euStandardVatRows(locale)
  const facts = supplierBecomeFinanceFacts
  const ex = SUPPLIER_PAYOUT_EXAMPLE

  return (
    <BentoShell>
      <BentoContainer maxWidth="5xl" className="space-y-10 py-12">
        <BentoPageHeading
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <div className="flex flex-wrap gap-3">
          <Link
            href="/signup/supplier"
            className={cn(buttonVariants({ variant: "bentoSolid", size: "bento" }), "inline-flex gap-2")}
          >
            {t("ctaSignup")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/conditions-fournisseur"
            className={cn(buttonVariants({ variant: "bentoOutline", size: "bento" }))}
          >
            {t("ctaCga")}
          </Link>
          <Link href="/login/supplier" className={cn(buttonVariants({ variant: "ghost", size: "bento" }))}>
            {t("ctaLogin")}
          </Link>
        </div>

        <p className="rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {t("b2bNotice")}
        </p>

        {/* Fiscalité / OSS */}
        <section className="space-y-4" aria-labelledby="supplier-tax-heading">
          <div className="flex items-start gap-3">
            <Landmark className="mt-0.5 size-6 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <h2 id="supplier-tax-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("tax.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("tax.body")}
              </p>
            </div>
          </div>

          <BentoCard className="space-y-4 p-5 sm:p-6">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t("tax.ossExampleTitle")}</p>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("tax.ossExampleBody")}</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
              <li>{t("tax.bulletHt")}</li>
              <li>{t("tax.bulletVat")}</li>
              <li>{t("tax.bulletInvoice")}</li>
            </ul>
          </BentoCard>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">{t("tax.tableCaption")}</caption>
              <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    {t("tax.colCountry")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("tax.colCode")}
                  </th>
                  <th scope="col" className="px-4 py-3">
                    {t("tax.colRate")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {vatRows.map((row) => (
                  <tr key={row.code} className="bg-white dark:bg-zinc-950">
                    <td className="px-4 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">{row.country}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-500">{row.code}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatVatRatePercent(row.rate, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            {t("tax.tableFootnote", { date: EU_STANDARD_VAT_AS_OF, count: vatRows.length })}
          </p>
        </section>

        {/* Payout */}
        <section className="space-y-4" aria-labelledby="supplier-payout-heading">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 size-6 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <div>
              <h2 id="supplier-payout-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("payout.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("payout.body", { fee: facts.catalogPlatformFeeLabel })}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PayoutStep
              label={t("payout.stepClient")}
              value={formatStoreCurrencyFromCents(ex.clientPaidTtcCents)}
              hint={t("payout.stepClientHint")}
            />
            <PayoutStep
              label={t("payout.stepAffisell")}
              value={formatStoreCurrencyFromCents(ex.affisellKeepsCents)}
              hint={t("payout.stepAffisellHint", { fee: facts.catalogPlatformFeeLabel })}
            />
            <PayoutStep
              label={t("payout.stepStripe")}
              value={formatStoreCurrencyFromCents(ex.stripeFeeCents)}
              hint={t("payout.stepStripeHint")}
            />
            <PayoutStep
              label={t("payout.stepYou")}
              value={formatStoreCurrencyFromCents(ex.supplierNetBeforeVatTimingCents)}
              hint={t("payout.stepYouHint")}
            />
          </div>
          <p className="text-xs text-zinc-500">{t("payout.disclaimer")}</p>
          <PayoutPolicyDisclaimer role="SUPPLIER" />
        </section>

        {/* Clawback */}
        <section className="space-y-4" aria-labelledby="supplier-clawback-heading">
          <div className="flex items-start gap-3">
            <RefreshCcw className="mt-0.5 size-6 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
            <div>
              <h2 id="supplier-clawback-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("clawback.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("clawback.body", { days: facts.euWithdrawalDays })}
              </p>
            </div>
          </div>
          <BentoCard className="space-y-3 p-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <p>{t("clawback.debit")}</p>
            <p>
              {t("clawback.provision", {
                threshold: facts.returnProvisionThresholdPct,
                reserve: facts.returnProvisionReservePct,
              })}
            </p>
            <p className="text-xs text-zinc-500">
              <Link href="/legal/refund-policy" className="text-violet-700 underline-offset-2 hover:underline dark:text-violet-300">
                {t("clawback.policyLink")}
              </Link>
            </p>
          </BentoCard>
        </section>

        {/* DAC7 */}
        <section className="space-y-4" aria-labelledby="supplier-dac7-heading">
          <div className="flex items-start gap-3">
            <FileSpreadsheet className="mt-0.5 size-6 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
            <div>
              <h2 id="supplier-dac7-heading" className="text-xl font-bold text-zinc-900 dark:text-white">
                {t("dac7.title")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t("dac7.body", {
                  eur: facts.dac7EurThreshold,
                  tx: facts.dac7TxThreshold,
                })}
              </p>
            </div>
          </div>
          <BentoCard className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Building2 className="size-5 shrink-0 text-zinc-500" aria-hidden />
              <p className="text-sm text-zinc-700 dark:text-zinc-300">{t("dac7.csv")}</p>
            </div>
          </BentoCard>
        </section>

        <footer className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
          <div className="flex items-start gap-3">
            <Scale className="size-5 shrink-0 text-zinc-400" aria-hidden />
            <p className="text-xs leading-relaxed text-zinc-500">{t("footerLegal")}</p>
          </div>
        </footer>
      </BentoContainer>
    </BentoShell>
  )
}
