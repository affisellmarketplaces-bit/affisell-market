"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useMemo, useState, type FormEvent } from "react"
import { toast } from "sonner"

import {
  getAggregatedSlaForCountries,
  getResellerSlaHintForCountries,
  type DeliveryPriority,
  resolveDeliverySLAForCountries,
} from "@/lib/logistics/delivery-sla"
import {
  PRODUCT_REQUEST_CATEGORIES,
  parseProductRequestCountries,
  PRODUCT_REQUEST_COUNTRIES,
} from "@/lib/product-request-types"
import { cn } from "@/lib/utils"

const PRIORITY_OPTIONS: Array<{
  id: DeliveryPriority
  label: string
  hint: string
}> = [
  { id: "speed", label: "⚡ Vitesse max", hint: "idéal marché" },
  { id: "balanced", label: "⚖️ Équilibré", hint: "max SLA" },
  { id: "price", label: "💰 Prix bas", hint: "délai plus souple" },
]

export function ResellerRequestForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
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

  const toggleCountry = useCallback((code: string) => {
    setCountries((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code)
        return next.length > 0 ? next : prev
      }
      return [...prev, code].sort(
        (a, b) =>
          PRODUCT_REQUEST_COUNTRIES.indexOf(a as (typeof PRODUCT_REQUEST_COUNTRIES)[number]) -
          PRODUCT_REQUEST_COUNTRIES.indexOf(b as (typeof PRODUCT_REQUEST_COUNTRIES)[number])
      )
    })
  }, [])

  const sla = getAggregatedSlaForCountries(countries)
  const slaHint = getResellerSlaHintForCountries(countries)
  const priorityDays = resolveDeliverySLAForCountries(countries, deliveryPriority)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (title.trim().length < 2) {
      toast.error("Titre requis")
      return
    }
    if (countries.length < 1) {
      toast.error("Sélectionne au moins un pays")
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
        toast.error(data.error ?? "Échec envoi")
        return
      }
      toast.success("Demande envoyée — fournisseurs alertés")
      router.push("/dashboard/reseller/requests")
      router.refresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-xl space-y-4">
      {fromCatalogSearch || catalogHint ? (
        <p className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
          Tu cherchais « <strong>{catalogHint}</strong> » dans le catalogue — On prévient les
          fournisseurs.
        </p>
      ) : null}
      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-title">
          Titre *
        </label>
        <input
          id="req-title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Ex: Babyphone WiFi 1080p"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-zinc-700" htmlFor="req-cat">
            Catégorie
          </label>
          <select
            id="req-cat"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          >
            {PRODUCT_REQUEST_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold text-zinc-700" id="req-countries-label">
            Pays de promotion *
          </p>
          <p className="mt-0.5 text-[11px] text-zinc-500">Un ou plusieurs marchés ciblés</p>
          <div
            className="mt-2 flex flex-wrap gap-1.5"
            role="group"
            aria-labelledby="req-countries-label"
          >
            {PRODUCT_REQUEST_COUNTRIES.map((code) => {
              const selected = countries.includes(code)
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleCountry(code)}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition",
                    selected
                      ? "border-violet-500 bg-violet-600 text-white shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-violet-300 hover:bg-violet-50"
                  )}
                >
                  {code}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <fieldset className="rounded-xl border border-zinc-200 bg-white p-3">
        <legend className="px-1 text-xs font-semibold text-zinc-700">Priorité livraison</legend>
        <div className="mt-1 grid gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                deliveryPriority === opt.id
                  ? "border-violet-400 bg-violet-50"
                  : "border-zinc-100 hover:bg-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="deliveryPriority"
                value={opt.id}
                checked={deliveryPriority === opt.id}
                onChange={() => setDeliveryPriority(opt.id)}
              />
              <span className="font-medium text-zinc-900">
                {opt.label}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  (
                  {opt.id === "speed"
                    ? `${sla.idealDays}j`
                    : opt.id === "balanced"
                      ? `${sla.maxDays}j max`
                      : `${Math.max(sla.maxDays, 10)}j ok`}
                  )
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-600">{slaHint}</p>
        <p className="mt-1 text-[11px] font-semibold text-violet-700">
          SLA enregistré: {priorityDays}j ({sla.label})
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-zinc-700" htmlFor="req-qty">
            Quantité
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
            Prix cible (€)
          </label>
          <input
            id="req-price"
            type="text"
            inputMode="decimal"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            placeholder="ex: 14.95"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-desc">
          Description
        </label>
        <textarea
          id="req-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="Specs, couleurs, délais…"
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-zinc-700" htmlFor="req-img">
          Image URL (optionnel)
        </label>
        <input
          id="req-img"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          placeholder="https://"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#6D28D9] px-4 py-3 text-sm font-semibold text-white hover:bg-[#5B21B6] disabled:opacity-60"
      >
        {busy ? "Envoi…" : "Envoyer la demande → Alerter les fournisseurs"}
      </button>
    </form>
  )
}
