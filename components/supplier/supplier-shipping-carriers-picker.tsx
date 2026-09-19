"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Truck } from "lucide-react"
import { useTranslations } from "next-intl"

import { CARRIERS } from "@/lib/shipping/carriers"
import type { ShopShippingOffer } from "@/lib/shipping/supplier-carrier-offers-shared"
import { cn } from "@/lib/utils"

const byId = new Map(CARRIERS.map((c) => [c.id, c]))

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
  className?: string
}

/**
 * Product-level narrowing of the SHOP shipping profile. Only carriers the supplier defined
 * in their shop can be picked; nothing is suggested or pre-selected. Empty = all shop carriers.
 */
export function SupplierShippingCarriersPicker({ value, onChange, className }: Props) {
  const t = useTranslations("supplierShipping")
  const tShip = useTranslations("shipping")
  const [offers, setOffers] = useState<ShopShippingOffer[] | null>(null)

  useEffect(() => {
    let alive = true
    fetch("/api/supplier/shipping-profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { offers: [] }))
      .then((d: { offers?: ShopShippingOffer[] }) => alive && setOffers(d.offers ?? []))
      .catch(() => alive && setOffers([]))
    return () => {
      alive = false
    }
  }, [])

  const carriers = useMemo(
    () => (offers ?? []).flatMap((o) => { const c = byId.get(o.carrierId); return c ? [{ carrier: c, offer: o }] : [] }),
    [offers]
  )

  if (offers === null) return <div className={cn("h-16 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-900", className)} />

  if (carriers.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 dark:border-violet-800 dark:bg-violet-950/20", className)}>
        <p className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
          <Truck className="size-4" aria-hidden /> {t("emptyTitle")}
        </p>
        <p className="mt-1 text-xs text-violet-900/80 dark:text-violet-200/80">{t("emptyBody")}</p>
        <Link href="/dashboard/supplier/settings/shipping" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500">
          {t("configureCta")}
        </Link>
      </div>
    )
  }

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("pickerHint")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {carriers.map(({ carrier, offer }) => {
          const on = value.includes(carrier.id)
          return (
            <li key={carrier.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(carrier.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                  on
                    ? "border-violet-600 bg-violet-600 text-white shadow-md shadow-violet-500/25"
                    : "border-zinc-200 bg-white hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900/60"
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: carrier.color }} aria-hidden>
                  {carrier.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{carrier.name}</span>
                  <span className={cn("block text-[11px] tabular-nums", on ? "text-violet-100" : "text-zinc-500")}>
                    {tShip(`carrierType.${carrier.type}`)} · {tShip("deliveryDays", { min: offer.deliveryMin, max: offer.deliveryMax })}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-zinc-500">
        {value.length === 0 ? t("pickerAll") : t("yourCarriersCount", { count: value.length })}
        {" · "}
        <Link href="/dashboard/supplier/settings/shipping" className="font-medium text-violet-700 hover:underline dark:text-violet-300">{t("configureCta")}</Link>
      </p>
    </div>
  )
}
