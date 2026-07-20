"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useCallback, useState, useTransition } from "react"

const MARKETPLACES = [
  { value: "", label: "Tous les marketplaces" },
  { value: "tiktok_shop", label: "TikTok Shop" },
  { value: "amazon", label: "Amazon" },
  { value: "shopify", label: "Shopify" },
  { value: "ebay", label: "eBay" },
  { value: "shopee", label: "Shopee" },
  { value: "mercadolibre", label: "Mercado Libre" },
  { value: "walmart", label: "Walmart" },
  { value: "lazada", label: "Lazada" },
  { value: "flipkart", label: "Flipkart" },
  { value: "rakuten", label: "Rakuten" },
  { value: "coupang", label: "Coupang" },
  { value: "noon", label: "Noon" },
  { value: "jumia", label: "Jumia" },
  { value: "temu", label: "Temu" },
] as const

const COUNTRIES = [
  { value: "FR", label: "🇫🇷 France (Stock FR)" },
  { value: "US", label: "🇺🇸 États-Unis" },
  { value: "CA", label: "CA" },
  { value: "MX", label: "MX" },
  { value: "BR", label: "BR" },
  { value: "AR", label: "AR" },
  { value: "DE", label: "DE" },
  { value: "UK", label: "UK" },
  { value: "PL", label: "PL" },
  { value: "TR", label: "TR" },
  { value: "AE", label: "AE" },
  { value: "SA", label: "SA" },
  { value: "NG", label: "NG" },
  { value: "ZA", label: "ZA" },
  { value: "IN", label: "IN" },
  { value: "ID", label: "ID" },
  { value: "VN", label: "VN" },
  { value: "SG", label: "SG" },
  { value: "JP", label: "JP" },
  { value: "KR", label: "KR" },
  { value: "CN", label: "CN" },
  { value: "AU", label: "AU" },
  { value: "NZ", label: "NZ" },
] as const

export default function RadarDashboardFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get("q") ?? "")

  const pushFilters = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (!value) next.delete(key)
        else next.set(key, value)
      }
      if (!next.get("country")) {
        next.set("country", "FR")
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`)
      })
    },
    [pathname, router, searchParams]
  )

  const countryValue = searchParams.get("country")?.trim().toUpperCase() || "FR"

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        pushFilters({ q: q.trim() })
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Marketplace
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          value={searchParams.get("marketplace") ?? ""}
          disabled={pending}
          onChange={(e) => pushFilters({ marketplace: e.target.value })}
        >
          {MARKETPLACES.map((m) => (
            <option key={m.value || "all"} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Pays
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
          value={countryValue}
          disabled={pending}
          onChange={(e) => pushFilters({ country: e.target.value || "FR" })}
        >
          {COUNTRIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-zinc-600">
        Recherche
        <input
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Titre produit…"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
      >
        Filtrer
      </button>
    </form>
  )
}
