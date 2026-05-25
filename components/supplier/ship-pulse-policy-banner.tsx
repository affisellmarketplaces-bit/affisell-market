import { Zap } from "lucide-react"
import { getTranslations } from "next-intl/server"

import { SUPPLIER_SHIP_SLA_DAYS } from "@/lib/supplier-ship-sla-shared"

export async function ShipPulsePolicyBanner() {
  const t = await getTranslations("supplierOrders.shipPulse")

  return (
    <div className="relative overflow-hidden rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-600 px-5 py-4 text-white shadow-lg shadow-violet-600/20 dark:border-violet-500/40">
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Zap className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide">{t("policyTitle")}</p>
            <p className="mt-1 max-w-xl text-sm text-white/90">{t("policyBody", { days: SUPPLIER_SHIP_SLA_DAYS })}</p>
          </div>
        </div>
        <p className="shrink-0 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] backdrop-blur-sm">
          {t("policyBadge")}
        </p>
      </div>
    </div>
  )
}
