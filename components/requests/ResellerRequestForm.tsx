"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, type FormEvent } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import {
  buildResellerSlaHint,
  priorityDaysLabel,
} from "@/lib/product-request-i18n"
import {
  getAggregatedSlaForCountries,
  type DeliveryPriority,
  resolveDeliverySLAForCountries,
} from "@/lib/logistics/delivery-sla"
import {
  getProductRequestCountryGroups,
  PRODUCT_REQUEST_CATEGORIES,
  parseProductRequestCountries,
  PRODUCT_REQUEST_COUNTRIES,
  productRequestCountryChipLabel,
  sortProductRequestCountries,
} from "@/lib/product-request-types"
import { cn } from "@/lib/utils"

const PRIORITY_IDS: DeliveryPriority[] = ["speed", "balanced", "price"]

export function ResellerRequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("productRequests")
  const tForm = useTranslations("productRequests.reseller.form")
  const [busy, setBusy] = useState(false)

  const defaults = useMemo(() => {
    const q = searchParams.get("q")?.trim() ?? ""
    const titleParam = searchParams.get("title")?.trim() ?? ""
    const countriesParam =
      searchParams.get("countries")?.trim() ||
      searchParams.get("country")?.trim() ||
      "FR"
    return {
      title: titleParam || q,
      q,
      category: (searchParams.get("category")?.trim().toLowerCase() || "general") as string,
      countries: parseProductRequestCountries(countriesParam),
    }
  }, [searchParams])

  const [title, setTitle] = useState(defaults.title)
  const catalogHint = defaults.q || (searchParams.get("title")?.trim() ?? "")
  const fromCatalogSearch = Boolean(defaults.q)
  const [category, setCategory] = useState(
    PRODUCT_REQUEST_CATEGORIES.some((c) => c.id === defaults.category)
      ? defaults.category
      : "general"
  )
  const [countries, setCountries] = useState<string[]>(defaults.countries)
  const [quantity, setQuantity] = useState(100)
  const [targetPrice, setTargetPrice] = useState("")
  const [description, setDescription] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [deliveryPriority, setDeliveryPriority] = useState<DeliveryPriority>("balanced")

  const countryGroups = useMemo(() => getProductRequestCountryGroups(), [])

  const toggleCountry = useCallback((code: string) => {
    setCountries((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code)
        return next.length > 0 ? next : prev
      }
      return sortProductRequestCountries([...prev, code])
    })
  }, [])

  const selectAllCountries = useCallback(() => {
    setCountries([...PRODUCT_REQUEST_COUNTRIES])
  }, [])

  const clearCountries = useCallback(() => {
    setCountries(["FR"])
  }, [])

  const sla = getAggregatedSlaForCountries(countries)
  const slaHint = useMemo(
    () => buildResellerSlaHint(countries, (key, values) => t(`sla.${key}`, values ?? {})),
    [countries, t]
  )
  const priorityDays = resolveDeliverySLAForCountries(countries, deliveryPriority)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (title.trim().length < 2) {
      toast.error(tForm("toastTitleRequired"))
      return
    }
    if (countries.length < 1) {
      toast.error(tForm("toastCountryRequired"))
      return
    }
    setBusy(true)
    try {
      const priceNum = targetPrice.trim() ? Number(targetPrice.replace(",", ".")) : null
      const res = await fetch("/api/requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category,
          quantity,
          targetPrice: priceNum != null && Number.isFinite(priceNum) ? priceNum : null,
          countries,
          imageUrl: imageUrl.trim() || null,
          deliveryPriority,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string }
      if (!res.ok) {
        toast.error(data.error ?? tForm("toastSubmitFailed"))
        return
      }
      toast.success(tForm("toastSubmitSuccess"))
      router.push("/dashboard/reseller/requests")
      router.refresh()
    } catch {
      toast.error(t("common.networkError"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-4">
      {fromCatalogSearch || catalogHint ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
          {tForm("catalogHint", { query: catalogHint })}
        </p>
      ) : null}
      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-title">
          {tForm("titleLabel")}
        </label>
        <input
          id="req-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder={tForm("titlePlaceholder")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-zinc-700" htmlFor="req-cat">
            {tForm("categoryLabel")}
          </label>
          <select
            id="req-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          >
            {PRODUCT_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(`categories.${c.id}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-zinc-700" id="req-countries-label">
                {tForm("countriesLabel")}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {tForm("countriesHint", {
                  selected: countries.length,
                  total: PRODUCT_REQUEST_COUNTRIES.length,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAllCountries}
                className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
              >
                {tForm("selectAll")}
              </button>
              <button
                type="button"
                onClick={clearCountries}
                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50"
              >
                {tForm("reset")}
              </button>
            </div>
          </div>
          <div
            className="mt-2 max-h-56 space-y-3 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
            role="group"
            aria-labelledby="req-countries-label"
          >
            {countryGroups.map((group) => (
              <div key={group.id}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  {t(`regions.${group.id}`)}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {group.codes.map((code) => {
                    const selected = countries.includes(code)
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleCountry(code)}
                        className={cn(
                          "rounded-lg border px-2 py-1 text-xs font-semibold tabular-nums transition",
                          selected
                            ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                            : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:bg-violet-50"
                        )}
                      >
                        {productRequestCountryChipLabel(code)}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <fieldset className="rounded-xl border border-zinc-200 bg-white p-3">
        <legend className="px-1 text-xs font-semibold text-zinc-700">
          {t("priorities.legend")}
        </legend>
        <div className="mt-1 grid gap-2">
          {PRIORITY_IDS.map((id) => (
            <label
              key={id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                deliveryPriority === id
                  ? "border-violet-400 bg-violet-50"
                  : "border-zinc-100 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="deliveryPriority"
                value={id}
                checked={deliveryPriority === id}
                onChange={() => setDeliveryPriority(id)}
              />
              <span className="font-medium text-zinc-900">
                {t(`priorities.${id}`)}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  ({priorityDaysLabel(id, sla, (key, values) => t(`priorities.${key}`, values ?? {}))})
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600">{slaHint}</p>
        <p className="mt-1 text-[11px] font-semibold text-violet-700">
          {t("sla.registered", { days: priorityDays, label: sla.label })}
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-zinc-700" htmlFor="req-qty">
            {tForm("quantityLabel")}
          </label>
          <input
            id="req-qty"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value) || 100)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-zinc-700" htmlFor="req-price">
            {tForm("targetPriceLabel")}
          </label>
          <input
            id="req-price"
            type="text"
            inputMode="decimal"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            placeholder={tForm("targetPricePlaceholder")}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-desc">
          {tForm("descriptionLabel")}
        </label>
        <textarea
          id="req-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder={tForm("descriptionPlaceholder")}
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-img">
          {tForm("imageLabel")}
        </label>
        <input
          id="req-img"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder={tForm("imagePlaceholder")}
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
      >
        {busy ? tForm("submitting") : tForm("submit")}
      </button>
    </form>
  )
}
