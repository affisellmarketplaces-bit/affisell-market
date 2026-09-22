import { Zap } from "lucide-react"
import { getTranslations } from "next-intl/server"

import {
  SHIP_HANDLING_DAYS_DOMESTIC,
  SHIP_HANDLING_DAYS_EUROPE,
  SHIP_HANDLING_DAYS_INTERNATIONAL,
} from "@/lib/supplier-ship-sla-shared"

export async function ShipPulsePolicyBanner() {
  const t = await getTranslations("supplierOrders.shipPulse")

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-indigo-950 via-violet-950 to-indigo-950 px-5 py-4 text-white shadow-lg shadow-indigo-950/30 ring-1 ring-inset ring-white/[0.06]">
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-violet-500/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-1/3 size-40 rounded-full bg-indigo-400/10 blur-3xl"
        aria-hidden
      />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-inset ring-white/10">
            <Zap className="size-5 text-violet-200" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-wide text-white">{t("policyTitle")}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-indigo-100/80">{t("policyBody")}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-indigo-50 ring-1 ring-inset ring-white/10">
                <span className="font-bold tabular-nums text-white">{SHIP_HANDLING_DAYS_DOMESTIC}</span>
                {t("tierDomestic")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-indigo-50 ring-1 ring-inset ring-white/10">
                <span className="font-bold tabular-nums text-white">{SHIP_HANDLING_DAYS_EUROPE}</span>
                {t("tierEurope")}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.08] px-2.5 py-1 text-[11px] font-medium text-indigo-50 ring-1 ring-inset ring-white/10">
                <span className="font-bold tabular-nums text-white">{SHIP_HANDLING_DAYS_INTERNATIONAL}</span>
                {t("tierInternational")}
              </span>
            </div>
          </div>
        </div>
        <p className="shrink-0 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-100">
          {t("policyBadge")}
        </p>
      </div>
    </div>
  )
}
