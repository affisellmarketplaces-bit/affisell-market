"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"

import {
  getRecommended,
  type Carrier,
} from "@/lib/shipping/carriers"
import { cn } from "@/lib/utils"

type Props = {
  country?: string | null
  className?: string
}

function CarrierChip({
  carrier,
  label,
  accent,
}: {
  carrier: Carrier
  label: string
  accent: string
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-2xl border border-zinc-200/90 bg-white/90 px-2.5 py-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/80",
        accent
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={carrier.logo}
        alt=""
        className="h-6 w-10 shrink-0 object-contain"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="truncate text-xs font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {carrier.name}
        </p>
        <p className="text-[10px] tabular-nums text-zinc-500">
          {carrier.delivery_min}–{carrier.delivery_max}j · {carrier.reliability}%
        </p>
      </div>
    </div>
  )
}

/** PDP strip — fastest / balanced / cheapest reliable carriers for buyer country. */
export function ProductShippingOptions({ country = "FR", className }: Props) {
  const t = useTranslations("shipping")
  const locale = useLocale()
  const cc = (country?.trim() || "FR").toUpperCase()
  const rec = getRecommended(cc)

  const slots: Array<{ key: string; carrier: Carrier | null; label: string; accent: string }> = [
    {
      key: "fastest",
      carrier: rec.fastest,
      label: t("fastest"),
      accent: "ring-1 ring-sky-200/80 dark:ring-sky-900/50",
    },
    {
      key: "balanced",
      carrier: rec.balanced,
      label: t("balanced"),
      accent: "ring-1 ring-violet-200/80 dark:ring-violet-900/50",
    },
    {
      key: "cheapest",
      carrier: rec.cheapest,
      label: t("cheapest"),
      accent: "ring-1 ring-emerald-200/80 dark:ring-emerald-900/50",
    },
  ]

  const visible = slots.filter((s) => s.carrier)
  if (visible.length === 0) return null

  return (
    <div className={cn("mt-3 space-y-2", className)} lang={locale}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("pdpOptionsTitle")}
        </p>
        <Link
          href="/shipping/verify"
          className="text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          {t("verify")}
        </Link>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {visible.map((slot) =>
          slot.carrier ? (
            <CarrierChip
              key={slot.key}
              carrier={slot.carrier}
              label={slot.label}
              accent={slot.accent}
            />
          ) : null
        )}
      </div>
    </div>
  )
}
