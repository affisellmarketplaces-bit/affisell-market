"use client"

import { useEffect, useMemo, useState } from "react"
import { Sparkles, Truck, Zap } from "lucide-react"
import { useTranslations } from "next-intl"

import type { Carrier } from "@/lib/shipping/carriers"
import {
  carriersForShipFromCountry,
  suggestCarrierIdsForProduct,
} from "@/lib/shipping/supplier-carrier-offers-shared"
import { brandOrbitPillActive } from "@/lib/affisell-brand-orbit-shared"
import { cn } from "@/lib/utils"

type Props = {
  shipFromCountry: string | null
  shippingMethods: string[]
  value: string[]
  onChange: (ids: string[]) => void
  className?: string
}

function CarrierChipLogo({ carrier }: { carrier: Carrier }) {
  const [broken, setBroken] = useState(false)
  const initial = carrier.name.trim().charAt(0).toUpperCase() || "?"

  if (broken || !carrier.logo) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: carrier.color || "#6d28d9" }}
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
      className="size-9 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-violet-200/80 dark:ring-violet-800/60"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}

const TYPE_LABEL: Record<Carrier["type"], string> = {
  express: "Express",
  standard: "Standard",
  economy: "Économique",
  pickup: "Point relais",
}

/** Supplier dashboard — pick carriers Affisell promotes on marketplace PDP. */
export function SupplierShippingCarriersPicker({
  shipFromCountry,
  shippingMethods,
  value,
  onChange,
  className,
}: Props) {
  const t = useTranslations("shipping.supplierCarriers")
  const cc = shipFromCountry?.trim().toUpperCase() || "FR"

  const catalog = useMemo(() => carriersForShipFromCountry(shipFromCountry), [shipFromCountry])

  useEffect(() => {
    if (value.length > 0) return
    const suggested = suggestCarrierIdsForProduct({ shipFromCountry, shippingMethods })
    if (suggested.length > 0) onChange(suggested)
  }, [shipFromCountry, shippingMethods, value.length, onChange])

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id))
      return
    }
    onChange([...value, id].slice(0, 8))
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-600/[0.08] via-white to-indigo-500/[0.06] p-4 dark:border-violet-500/35 dark:from-violet-950/50 dark:via-zinc-950 dark:to-indigo-950/40">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgba(109,40,217,0.12),transparent)]" aria-hidden />
        <div className="relative flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-950/30">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">{t("promoTitle")}</p>
            <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/80">
              {t("promoBody")}
            </p>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Truck className="size-3.5 shrink-0 text-violet-500" aria-hidden />
        {t("catalogHint", { country: cc })}
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {catalog.map((carrier) => {
          const selected = value.includes(carrier.id)
          return (
            <li key={carrier.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                  selected
                    ? cn(brandOrbitPillActive, "border-transparent shadow-md shadow-violet-500/25")
                    : "border-zinc-200/90 bg-white hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-violet-600/50"
                )}
                onClick={() => toggle(carrier.id)}
                aria-pressed={selected}
              >
                <CarrierChipLogo carrier={carrier} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className={cn(
                        "truncate text-sm font-semibold",
                        selected ? "text-white" : "text-zinc-900 dark:text-zinc-50"
                      )}
                    >
                      {carrier.name}
                    </p>
                    {carrier.type === "express" ? (
                      <Zap
                        className={cn("size-3.5 shrink-0", selected ? "text-violet-100" : "text-violet-500")}
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <p
                    className={cn(
                      "text-[11px] tabular-nums",
                      selected ? "text-violet-100/90" : "text-zinc-500"
                    )}
                  >
                    {TYPE_LABEL[carrier.type]} · {carrier.delivery_min}–{carrier.delivery_max}j · {carrier.reliability}%
                  </p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {value.length === 0 ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{t("pickAtLeastOne")}</p>
      ) : (
        <p className="text-[11px] text-zinc-500">{t("selectedCount", { count: value.length })}</p>
      )}
    </div>
  )
}
