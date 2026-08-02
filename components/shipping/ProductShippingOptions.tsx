"use client"

import Link from "next/link"
import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"

import {
  getRecommended,
  type Carrier,
} from "@/lib/shipping/carriers"
import { cn } from "@/lib/utils"

type Props = {
  country?: string | null
  className?: string
}

function CarrierLogo({ carrier }: { carrier: Carrier }) {
  const [broken, setBroken] = useState(false)
  const initial = carrier.name.trim().charAt(0).toUpperCase() || "?"

  if (broken || !carrier.logo) {
    return (
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: carrier.color || "#52525b" }}
        aria-hidden
      >
        {initial}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={carrier.logo}
      alt=""
      className="h-9 w-9 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-zinc-200/80 dark:bg-zinc-900 dark:ring-zinc-700"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

function CarrierRow({
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
        "flex min-w-0 items-center gap-3 rounded-2xl border border-zinc-200/90 bg-white/95 px-3 py-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/80",
        accent
      )}
    >
      <CarrierLogo carrier={carrier} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            {label}
          </p>
          <p className="shrink-0 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {carrier.reliability}%
          </p>
        </div>
        <p className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {carrier.name}
        </p>
        <p className="text-[11px] tabular-nums text-zinc-500">
          {carrier.delivery_min}–{carrier.delivery_max}j
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
    <div className={cn("@container/ship mt-3 space-y-2", className)} lang={locale}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {t("pdpOptionsTitle")}
        </p>
        <Link
          href="/shipping/verify"
          className="shrink-0 text-[11px] font-semibold text-violet-700 underline-offset-2 hover:underline dark:text-violet-300"
        >
          {t("verify")}
        </Link>
      </div>
      {/* Sidebar PDP is ~280–360px: always stack. Wide embeds can go 3-col. */}
      <div className="grid grid-cols-1 gap-2 @[36rem]/grid-cols-3">
        {visible.map((slot) =>
          slot.carrier ? (
            <CarrierRow
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
