"use client"

import { Package, ShieldCheck, Sparkles, Truck } from "lucide-react"
import { useMemo, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import {
  countryLabel,
  resolveCarriersForRoute,
  SHIPPING_DESTINATION_COUNTRIES,
  SHIPPING_ORIGIN_COUNTRIES,
  type CarrierTier,
  type ShippingCarrierDef,
} from "@/lib/shipping/carrier-directory"
import { cn } from "@/lib/utils"

type Props = {
  locale?: "fr" | "en"
  labels: {
    title: string
    subtitle: string
    originLabel: string
    destinationLabel: string
    reliability: string
    popular: string
    eta: string
    etaUnit: string
    empty: string
    tierPremium: string
    tierStandard: string
    tierEconomy: string
    tagExpress: string
    tagTracked: string
    tagPickup: string
    tagInternational: string
    tagLastMile: string
    tagMarketplace: string
    routeSummary: string
  }
}

function tierLabel(tier: CarrierTier, labels: Props["labels"]): string {
  if (tier === "premium") return labels.tierPremium
  if (tier === "economy") return labels.tierEconomy
  return labels.tierStandard
}

function tierStyle(tier: CarrierTier): string {
  if (tier === "premium") {
    return "border-violet-300/60 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 text-violet-800 dark:border-violet-700 dark:text-violet-200"
  }
  if (tier === "economy") {
    return "border-zinc-300/60 bg-zinc-100/80 text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-300"
  }
  return "border-sky-300/50 bg-sky-50/80 text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
}

function tagLabel(tag: ShippingCarrierDef["tags"][number], labels: Props["labels"]): string {
  const map: Record<ShippingCarrierDef["tags"][number], string> = {
    express: labels.tagExpress,
    tracked: labels.tagTracked,
    pickup: labels.tagPickup,
    international: labels.tagInternational,
    last_mile: labels.tagLastMile,
    marketplace: labels.tagMarketplace,
  }
  return map[tag]
}

function CarrierRow({
  carrier,
  locale,
  labels,
}: {
  carrier: ShippingCarrierDef
  locale: "fr" | "en"
  labels: Props["labels"]
}) {
  return (
    <li className="group rounded-2xl border border-zinc-200/80 bg-white/80 p-4 transition hover:border-violet-300/60 hover:shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/60 dark:hover:border-violet-700/50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">{carrier.name}</p>
            {carrier.popular ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                <Sparkles className="size-3" aria-hidden />
                {labels.popular}
              </span>
            ) : null}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                tierStyle(carrier.tier)
              )}
            >
              {tierLabel(carrier.tier, labels)}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
            {locale === "fr" ? carrier.trackingHintFr : carrier.trackingHintEn}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {carrier.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              >
                {tagLabel(tag, labels)}
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center justify-end gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" aria-hidden />
            {labels.reliability} {carrier.reliabilityScore}%
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {labels.eta} {carrier.etaDaysMin}–{carrier.etaDaysMax} {labels.etaUnit}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
          style={{ width: `${carrier.reliabilityScore}%` }}
        />
      </div>
    </li>
  )
}

export function ShippingCarrierDirectory({ locale = "fr", labels }: Props) {
  const [origin, setOrigin] = useState("CN")
  const [destination, setDestination] = useState("FR")

  const carriers = useMemo(() => resolveCarriersForRoute(origin, destination), [origin, destination])

  return (
    <BentoCard className="overflow-hidden border-violet-200/50 bg-gradient-to-br from-violet-50/30 via-white to-fuchsia-50/20 p-0 dark:border-violet-900/40 dark:from-violet-950/20 dark:via-zinc-950 dark:to-fuchsia-950/10">
      <div className="border-b border-violet-200/40 px-6 py-5 dark:border-violet-900/40">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
            <Truck className="size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{labels.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{labels.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-b border-violet-200/30 px-6 py-4 sm:grid-cols-2 dark:border-violet-900/30">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {labels.originLabel}
          </span>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          >
            {SHIPPING_ORIGIN_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {locale === "fr" ? c.labelFr : c.labelEn}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {labels.destinationLabel}
          </span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none ring-violet-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          >
            {SHIPPING_DESTINATION_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {locale === "fr" ? c.labelFr : c.labelEn}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="px-6 py-4">
        <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
          {labels.routeSummary
            .replace("{origin}", countryLabel(origin, locale))
            .replace("{destination}", countryLabel(destination, locale))
            .replace("{count}", String(carriers.length))}
        </p>

        {carriers.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <Package className="size-5 shrink-0 opacity-50" aria-hidden />
            {labels.empty}
          </div>
        ) : (
          <ul className="space-y-3">
            {carriers.map((carrier) => (
              <CarrierRow key={carrier.id} carrier={carrier} locale={locale} labels={labels} />
            ))}
          </ul>
        )}
      </div>
    </BentoCard>
  )
}
