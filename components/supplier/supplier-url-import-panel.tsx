"use client"

import { useCallback, useState } from "react"
import { ChevronDown, Link2, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CategoryAttrRow } from "@/components/supplier/category-attribute-fields"
import { cn } from "@/lib/utils"

export type UrlImportApplyPayload = {
  name: string
  description: string
  images: string[]
  stock: string
  price: string
  compareAt: string
  shippingCountry: string
  warehouseType: "" | "local" | "regional" | "international"
  processingTime: string
  deliveryMin: string
  deliveryMax: string
  shippingCost: string
  specValuesPatch: Record<string, string>
}

type Props = {
  categoryAttrs: CategoryAttrRow[]
  onApply: (payload: UrlImportApplyPayload) => void
}

function guessIso2Country(label: string): string {
  const l = label.toLowerCase().trim()
  const map: Record<string, string> = {
    china: "CN",
    "hong kong": "HK",
    usa: "US",
    "united states": "US",
    uk: "GB",
    "united kingdom": "GB",
    france: "FR",
    germany: "DE",
    spain: "ES",
    italy: "IT",
    netherlands: "NL",
    belgium: "BE",
    poland: "PL",
    japan: "JP",
    korea: "KR",
    canada: "CA",
    australia: "AU",
  }
  for (const [word, cc] of Object.entries(map)) {
    if (l.includes(word)) return cc
  }
  if (/^[a-z]{2}$/i.test(label.trim())) return label.trim().toUpperCase()
  return ""
}

function parseDeliveryRange(s: string): { min: string; max: string } {
  const t = s.replace(/–/g, "-")
  const m = t.match(/(\d+)\s*-\s*(\d+)/)
  if (m) {
    const lo = m[1] ?? "2"
    const hi = m[2] ?? "5"
    return { min: lo, max: hi }
  }
  const one = t.match(/(\d+)/)
  return one ? { min: one[1]!, max: one[1]! } : { min: "2", max: "5" }
}

function mergeSpecsFromImport(
  defs: CategoryAttrRow[],
  specs: Record<string, unknown>
): Record<string, string> {
  if (!defs.length) return {}
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const flat: Record<string, string> = {}
  for (const [k, v] of Object.entries(specs)) {
    if (typeof v !== "string" || !v.trim()) continue
    flat[norm(k)] = v.trim()
  }

  const out: Record<string, string> = {}
  for (const d of defs) {
    const fromKey = flat[norm(d.key)]
    const fromLabel = flat[norm(d.label)]
    const val = fromKey ?? fromLabel
    if (val) out[d.key] = val
  }
  return out
}

function asRec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

export function SupplierUrlImportPanel({ categoryAttrs, onApply }: Props) {
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [aiRewrite, setAiRewrite] = useState(false)
  const [markup, setMarkup] = useState("2.5")
  const [lastMeta, setLastMeta] = useState<{ platform: string; method: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const runImport = useCallback(async () => {
    const u = url.trim()
    if (!u) {
      toast.error("Paste a product URL.")
      return
    }
    if (!/^https?:\/\//i.test(u)) {
      toast.error("URL must start with http:// or https://")
      return
    }
    setLoading(true)
    setLastMeta(null)
    try {
      const mkNum = Number(markup.replace(",", "."))
      const mk = Number.isFinite(mkNum) && mkNum > 0 ? mkNum : 2.5
      const res = await fetch("/api/supplier/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: u,
          options: {
            aiRewrite,
            markup: mk,
          },
        }),
      })
      const data = (await res.json()) as {
        products?: unknown[]
        error?: string
        platform?: string
        method?: string
        innovations?: { quality_score?: number; duplicate?: boolean }
      }
      if (!res.ok) throw new Error(data.error ?? "Import failed")

      const raw = Array.isArray(data.products) ? data.products[0] : null
      const p = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
      if (!p) throw new Error("No product returned")

      const title = typeof p.title === "string" ? p.title.trim() : ""
      if (!title) throw new Error("Could not read a product title from this page.")

      const descRaw =
        typeof p.ai_description === "string" && p.ai_description.trim()
          ? String(p.ai_description)
          : typeof p.description === "string"
            ? p.description.trim()
            : ""
      const images = Array.isArray(p.images)
        ? p.images.filter((x): x is string => typeof x === "string" && /^https?:\/\//i.test(x)).slice(0, 12)
        : []

      const stockN = Math.max(0, Math.round(Number(p.stock) || 0))
      const priceScraped = Number(p.price) || 0
      const suggested = Number(p.suggested_price) || Number(p.basePrice) || 0
      const original = Number(p.original_price) || 0
      const priceUsd =
        suggested > 0
          ? suggested
          : priceScraped > 0
            ? Math.round(priceScraped * mk * 100) / 100
            : 0

      let compareAt = ""
      if (original > 0 && priceUsd > 0 && original > priceUsd) {
        compareAt = original.toFixed(2)
      }

      const ship = asRec(p.shipping)
      const fromCountry = typeof ship.from_country === "string" ? ship.from_country : ""
      const cc = guessIso2Country(fromCountry)
      const deliveryTime = typeof ship.delivery_time === "string" ? ship.delivery_time : ""
      const { min: dmin, max: dmax } = parseDeliveryRange(deliveryTime)
      const shipCost = Number(ship.shipping_cost)
      const fl = fromCountry.toLowerCase()
      const warehouseType: "" | "local" | "regional" | "international" =
        /china|hong kong|aliexpress|temu|shein/i.test(fl) || cc === "CN"
          ? "international"
          : cc === "US" || cc === "GB"
            ? "regional"
            : cc
              ? "regional"
              : ""

      const specs = asRec(p.specs)
      const specValuesPatch = mergeSpecsFromImport(categoryAttrs, specs)

      onApply({
        name: title.slice(0, 500),
        description: (descRaw || "—").slice(0, 8000),
        images,
        stock: String(stockN || 0),
        price: priceUsd > 0 ? priceUsd.toFixed(2) : "",
        compareAt,
        shippingCountry: cc,
        warehouseType,
        processingTime: "1",
        deliveryMin: dmin,
        deliveryMax: dmax,
        shippingCost: Number.isFinite(shipCost) && shipCost >= 0 ? String(shipCost) : "0",
        specValuesPatch,
      })

      setLastMeta({
        platform: String(data.platform ?? "unknown"),
        method: String(data.method ?? ""),
      })

      toast.success("Product fields filled from URL — review images and pricing.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed")
    } finally {
      setLoading(false)
    }
  }, [url, aiRewrite, markup, categoryAttrs, onApply])

  return (
    <Card className="border-zinc-200 bg-zinc-50/90 p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-zinc-950">
          <Link2 className="h-5 w-5 text-zinc-800 dark:text-zinc-100" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Add from URL</h2>
            <Badge
              variant="secondary"
              className="border border-sky-200 bg-sky-100 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100"
            >
              Beta
            </Badge>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Paste a product link — we pull title, description, images, price, and shipping.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Label htmlFor="url-import-field" className="sr-only">
                Product URL
              </Label>
              <Input
                id="url-import-field"
                type="url"
                placeholder="https://www.amazon.com/dp/… or https://brand.com/products/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="mt-0"
              />
            </div>
            <Button type="button" disabled={loading} onClick={() => void runImport()} className="shrink-0">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Fetching…
                </>
              ) : (
                "Import into form"
              )}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-violet-700 hover:underline dark:text-violet-300"
          >
            <ChevronDown className={cn("h-4 w-4 transition", showAdvanced && "rotate-180")} aria-hidden />
            Advanced options
          </button>

          {showAdvanced ? (
            <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white/80 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/60 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={aiRewrite}
                  onChange={(e) => setAiRewrite(e.target.checked)}
                  className="rounded border-zinc-300"
                />
                AI polish description (uses OpenAI when configured)
              </label>
              <div>
                <Label htmlFor="url-markup">Price markup vs. scraped cost</Label>
                <Input
                  id="url-markup"
                  type="number"
                  min={1}
                  step={0.1}
                  className="mt-1"
                  value={markup}
                  onChange={(e) => setMarkup(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {lastMeta ? (
            <div className="flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="rounded-md bg-white px-2 py-1 dark:bg-zinc-900">
                Platform: <strong className="text-zinc-900 dark:text-zinc-100">{lastMeta.platform}</strong>
              </span>
              {lastMeta.method ? (
                <span className="rounded-md bg-white px-2 py-1 dark:bg-zinc-900">Method: {lastMeta.method}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
