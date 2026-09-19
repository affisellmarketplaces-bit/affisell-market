"use client"

import { Loader2, MapPin, Plus, Search, Trash2, Truck } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { CARRIERS, carrierCoversCountry, type Carrier } from "@/lib/shipping/carriers"
import { EUROPE_COUNTRY_CODES } from "@/lib/shipping/carriers-europe"
import {
  MAX_SHOP_SHIPPING_OFFERS,
  type ShopShippingOffer,
} from "@/lib/shipping/supplier-carrier-offers-shared"
import { cn } from "@/lib/utils"

const PAGE = 48

const flag = (cc: string): string =>
  cc.length === 2 ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)) : ""

const byCarrierId = new Map(CARRIERS.map((c) => [c.id, c]))

function Monogram({ carrier }: { carrier: Carrier }) {
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
      style={{ backgroundColor: carrier.color }}
      aria-hidden
    >
      {carrier.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

type Props = { initialOffers: ShopShippingOffer[] }

/** Shop shipping profile: the ONLY thing buyers ever see about carriers. Full European catalog, per-carrier windows. */
export function SupplierShippingProfileEditor({ initialOffers }: Props) {
  const t = useTranslations("supplierShipping")
  const tShip = useTranslations("shipping")
  const locale = useLocale()

  const [offers, setOffers] = useState<ShopShippingOffer[]>(initialOffers)
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialOffers))
  const [query, setQuery] = useState("")
  const [type, setType] = useState<"all" | Carrier["type"]>("all")
  const [country, setCountry] = useState("")
  const [limit, setLimit] = useState(PAGE)
  const [busy, setBusy] = useState(false)

  const regionNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" })
    } catch {
      return null
    }
  }, [locale])
  const countryName = useCallback((cc: string) => regionNames?.of(cc) ?? cc, [regionNames])

  const countries = useMemo(
    () =>
      [...EUROPE_COUNTRY_CODES]
        .map((cc) => ({ cc, name: countryName(cc) }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [countryName, locale]
  )

  const dirty = JSON.stringify(offers) !== savedSnapshot
  const offeredIds = useMemo(() => new Set(offers.map((o) => o.carrierId)), [offers])
  const atLimit = offers.length >= MAX_SHOP_SHIPPING_OFFERS

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = CARRIERS.filter((c) => {
      if (offeredIds.has(c.id)) return false
      if (type !== "all" && c.type !== type) return false
      if (country && !carrierCoversCountry(c, country)) return false
      if (!q) return true
      if (c.name.toLowerCase().includes(q)) return true
      return c.country.some((cc) => cc.toLowerCase() === q || countryName(cc).toLowerCase().includes(q))
    })
    const rank = (c: Carrier) => (c.country.includes("EUROPE") ? 0 : c.country.includes("WORLD") ? 2 : 1)
    return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
  }, [offeredIds, query, type, country, countryName])

  const add = (carrier: Carrier) => {
    if (atLimit) {
      toast.message(t("limitReached", { count: MAX_SHOP_SHIPPING_OFFERS }))
      return
    }
    setOffers((prev) => [...prev, { carrierId: carrier.id, deliveryMin: carrier.delivery_min, deliveryMax: carrier.delivery_max }])
  }
  const remove = (id: string) => setOffers((prev) => prev.filter((o) => o.carrierId !== id))
  const patch = (id: string, next: Partial<ShopShippingOffer>) =>
    setOffers((prev) => prev.map((o) => (o.carrierId === id ? { ...o, ...next } : o)))

  const setDays = (id: string, key: "deliveryMin" | "deliveryMax", raw: string) => {
    const n = Math.min(90, Math.max(1, Math.round(Number(raw)) || 1))
    setOffers((prev) =>
      prev.map((o) => {
        if (o.carrierId !== id) return o
        const next = { ...o, [key]: n }
        if (next.deliveryMin > next.deliveryMax) {
          if (key === "deliveryMin") next.deliveryMax = next.deliveryMin
          else next.deliveryMin = next.deliveryMax
        }
        return next
      })
    )
  }

  const toggleCountry = (id: string, cc: string) =>
    setOffers((prev) =>
      prev.map((o) => {
        if (o.carrierId !== id) return o
        const cur = new Set(o.countries ?? [])
        if (cur.has(cc)) cur.delete(cc)
        else cur.add(cc)
        const list = [...cur]
        const { countries: _drop, ...rest } = o
        return list.length > 0 ? { ...rest, countries: list } : rest
      })
    )

  async function save() {
    setBusy(true)
    try {
      const res = await fetch("/api/supplier/shipping-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ offers }),
      })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as { offers: ShopShippingOffer[] }
      setOffers(data.offers)
      setSavedSnapshot(JSON.stringify(data.offers))
      toast.success(t("saved"))
    } catch {
      toast.error(t("saveError"))
    } finally {
      setBusy(false)
    }
  }

  const typeChips: Array<{ id: "all" | Carrier["type"]; label: string }> = [
    { id: "all", label: t("allTypes") },
    { id: "express", label: tShip("carrierType.express") },
    { id: "standard", label: tShip("carrierType.standard") },
    { id: "economy", label: tShip("carrierType.economy") },
    { id: "pickup", label: tShip("carrierType.pickup") },
  ]

  return (
    <div className="space-y-8 pb-28 md:pb-10">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/25">
            <Truck className="size-5" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white sm:text-3xl">{t("title")}</h1>
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
        <p className="max-w-2xl rounded-xl border border-violet-200/70 bg-violet-50/60 px-3 py-2 text-xs leading-relaxed text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-200">
          {t("buyerNote")}
        </p>
      </header>

      {/* Your carriers */}
      <section aria-labelledby="ship-yours" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="ship-yours" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("yourCarriers")}</h2>
          <span className="text-xs text-zinc-500">{t("yourCarriersCount", { count: offers.length })}</span>
        </div>

        {offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{t("emptyTitle")}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">{t("emptyBody")}</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {offers.map((o) => {
              const carrier = byCarrierId.get(o.carrierId)
              if (!carrier) return null
              const nDest = o.countries?.length ?? 0
              return (
                <li key={o.carrierId} className="rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Monogram carrier={carrier} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{carrier.name}</p>
                      <p className="text-xs text-zinc-500">{tShip(`carrierType.${carrier.type}`)}</p>
                    </div>
                    <div className="flex items-end gap-2">
                      {(["deliveryMin", "deliveryMax"] as const).map((key) => (
                        <label key={key} className="block text-[11px] font-medium text-zinc-500">
                          {key === "deliveryMin" ? t("daysMin") : t("daysMax")}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={90}
                            value={o[key]}
                            onChange={(e) => setDays(o.carrierId, key, e.target.value)}
                            className="mt-1 h-11 w-[4.5rem] rounded-lg border border-zinc-300 bg-white px-2 text-center text-base tabular-nums outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 md:h-9 md:text-sm"
                          />
                        </label>
                      ))}
                      <span className="pb-3 text-xs text-zinc-500 md:pb-2">{t("daysUnit")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(o.carrierId)}
                      aria-label={`${t("remove")} — ${carrier.name}`}
                      className="flex size-11 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-red-50 hover:text-red-600 md:size-9 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>

                  <details className="mt-3 rounded-xl bg-zinc-50/80 px-3 py-2 dark:bg-zinc-900/50">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <MapPin className="size-3.5 text-violet-500" aria-hidden />
                      {t("destinations")} · {nDest === 0 ? t("allDestinations") : t("nDestinations", { count: nDest })}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto pr-1">
                        {countries.map(({ cc, name }) => {
                          const on = o.countries?.includes(cc) ?? false
                          return (
                            <button
                              key={cc}
                              type="button"
                              aria-pressed={on}
                              onClick={() => toggleCountry(o.carrierId, cc)}
                              className={cn(
                                "inline-flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-xs transition",
                                on
                                  ? "border-violet-500 bg-violet-600 text-white"
                                  : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                              )}
                            >
                              <span aria-hidden>{flag(cc)}</span>
                              {name}
                            </button>
                          )
                        })}
                      </div>
                      {nDest > 0 ? (
                        <button type="button" onClick={() => patch(o.carrierId, { countries: undefined })} className="text-xs font-medium text-violet-700 hover:underline dark:text-violet-300">
                          {t("destClear")}
                        </button>
                      ) : null}
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Catalog */}
      <section aria-labelledby="ship-catalog" className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="ship-catalog" className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{t("catalogTitle")}</h2>
          <span className="text-xs text-zinc-500">{t("catalogCount", { count: catalog.length })}</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setLimit(PAGE) }}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 md:text-sm"
            />
          </label>
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setLimit(PAGE) }}
            aria-label={t("allCountries")}
            className="h-11 rounded-xl border border-zinc-300 bg-white px-3 text-base outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 md:text-sm"
          >
            <option value="">{t("allCountries")}</option>
            {countries.map(({ cc, name }) => (
              <option key={cc} value={cc}>{flag(cc)} {name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {typeChips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { setType(c.id); setLimit(PAGE) }}
              aria-pressed={type === c.id}
              className={cn(
                "min-h-9 rounded-full border px-3.5 text-xs font-semibold transition",
                type === c.id
                  ? "border-violet-600 bg-violet-600 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {catalog.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">{t("noResults")}</p>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-2">
              {catalog.slice(0, limit).map((c) => {
                const pan = c.country.includes("EUROPE")
                const label = pan
                  ? t("allCountries")
                  : c.country.filter((cc) => cc.length === 2).slice(0, 3).map((cc) => `${flag(cc)} ${cc}`).join("  ")
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200/90 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950">
                    <Monogram carrier={c} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</p>
                      <p className="truncate text-[11px] text-zinc-500">{tShip(`carrierType.${c.type}`)} · {label}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => add(c)}
                      disabled={atLimit}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50 md:min-h-9"
                    >
                      <Plus className="size-4" aria-hidden />
                      {t("add")}
                    </button>
                  </li>
                )
              })}
            </ul>
            {catalog.length > limit ? (
              <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="mx-auto block min-h-11 rounded-xl border border-zinc-300 px-5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                +{Math.min(PAGE, catalog.length - limit)}
              </button>
            ) : null}
          </>
        )}
      </section>

      {/* Save bar */}
      <div className="sticky z-20 max-md:bottom-[5.75rem] md:bottom-4">
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-2.5 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
          <p className={cn("min-w-0 flex-1 truncate px-2 text-xs", dirty ? "font-medium text-amber-700 dark:text-amber-300" : "text-zinc-500")} role="status">
            {dirty ? t("unsaved") : t("yourCarriersCount", { count: offers.length })}
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !dirty}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  )
}
