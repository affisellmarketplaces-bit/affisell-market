import { Scale } from "lucide-react"
import { getTranslations } from "next-intl/server"

export async function PartnerTaxCompliancePanel() {
  const t = await getTranslations("affiliate.earnings.taxCompliance")

  return (
    <section
      className="rounded-2xl border border-violet-500/25 bg-gradient-to-br from-violet-950/80 via-zinc-950 to-fuchsia-950/60 p-5 text-violet-50"
      aria-labelledby="partner-tax-compliance-title"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/15"
          aria-hidden
        >
          <Scale className="size-5 text-violet-200" />
        </span>
        <div className="min-w-0 space-y-2">
          <h2 id="partner-tax-compliance-title" className="text-sm font-semibold text-white">
            {t("title")}
          </h2>
          <p className="text-sm leading-relaxed text-violet-100/85">{t("body")}</p>
          <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-violet-100/75">
            <li>{t("buyerVat")}</li>
            <li>{t("records")}</li>
            <li>{t("dac7")}</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
