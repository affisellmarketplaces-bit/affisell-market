"use client"

import { Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  endsAtFromPresetHours,
  FLASH_SALE_DURATION_PRESET_HOURS,
  FLASH_SALE_MAX_LISTINGS,
  parseFlashSaleListingIds,
} from "@/lib/storefront-flash-sale-shared"
import {
  updateHomepageSectionContent,
  type HomepageSection,
} from "@/lib/storefront-sections-shared"
import { formatStoreCurrencyFromCents } from "@/lib/market-config"
import { cn } from "@/lib/utils"

type CatalogPick = {
  listingId: string
  title: string
  imageUrl: string | null
  priceCents: number
}

type Props = {
  sections: HomepageSection[]
  onChange: (sections: HomepageSection[]) => void
}

function toDatetimeLocalValue(iso: string | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(raw: string): string | undefined {
  if (!raw.trim()) return undefined
  const d = new Date(raw)
  if (!Number.isFinite(d.getTime())) return undefined
  return d.toISOString()
}

export function StorefrontFlashSalePanel({ sections, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.flashSale")
  const section = sections.find((s) => s.type === "flash-sale")
  const content = section?.content

  const [catalog, setCatalog] = useState<CatalogPick[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const selectedIds = parseFlashSaleListingIds(content?.listingIds)

  const patchContent = useCallback(
    (patch: Parameters<typeof updateHomepageSectionContent>[2]) => {
      onChange(updateHomepageSectionContent(sections, "flash-sale", patch))
    },
    [onChange, sections]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch("/api/store/my-listings", { credentials: "include", cache: "no-store" })
        const json = (await res.json()) as { items?: CatalogPick[]; error?: string }
        if (!res.ok) throw new Error(json.error ?? t("loadFailed"))
        if (!cancelled) setCatalog(json.items ?? [])
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : t("loadFailed"))
          setCatalog([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  function toggleListing(listingId: string) {
    const set = new Set(selectedIds)
    if (set.has(listingId)) {
      set.delete(listingId)
    } else if (set.size < FLASH_SALE_MAX_LISTINGS) {
      set.add(listingId)
    }
    patchContent({ listingIds: [...set] })
  }

  function applyPresetHours(hours: number) {
    patchContent({ endsAt: endsAtFromPresetHours(hours) })
  }

  if (!section) return null

  return (
    <div className="mt-2 space-y-3 border-t border-violet-200/60 pt-2 dark:border-violet-900/40">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
        {t("title")}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-zinc-400">{t("hint")}</p>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("eyebrow")}</span>
        <Input
          value={content?.eyebrow ?? ""}
          onChange={(e) => patchContent({ eyebrow: e.target.value || undefined })}
          placeholder={t("eyebrowPlaceholder")}
          className="h-9 text-xs"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("headline")}</span>
        <Input
          value={content?.title ?? ""}
          onChange={(e) => patchContent({ title: e.target.value || undefined })}
          placeholder={t("headlinePlaceholder")}
          className="h-9 text-xs"
        />
      </label>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("duration")}</span>
        <div className="flex flex-wrap gap-1.5">
          {FLASH_SALE_DURATION_PRESET_HOURS.map((h) => (
            <Button
              key={h}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              onClick={() => applyPresetHours(h)}
            >
              {t("presetHours", { hours: h })}
            </Button>
          ))}
        </div>
        <Input
          type="datetime-local"
          value={toDatetimeLocalValue(content?.endsAt)}
          onChange={(e) => patchContent({ endsAt: fromDatetimeLocalValue(e.target.value) })}
          className="h-9 text-xs"
        />
      </div>

      <div className="space-y-1">
        <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
          {t("products", { count: selectedIds.length, max: FLASH_SALE_MAX_LISTINGS })}
        </span>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("loadingCatalog")}
          </p>
        ) : loadError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">{loadError}</p>
        ) : catalog.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-zinc-400">{t("emptyCatalog")}</p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-1 dark:border-zinc-700">
            {catalog.map((item) => {
              const checked = selectedIds.includes(item.listingId)
              const disabled = !checked && selectedIds.length >= FLASH_SALE_MAX_LISTINGS
              return (
                <li key={item.listingId}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleListing(item.listingId)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition",
                      checked
                        ? "bg-violet-100 text-violet-950 dark:bg-violet-950/50 dark:text-violet-100"
                        : "hover:bg-gray-50 dark:hover:bg-zinc-900",
                      disabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
                        checked
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-gray-300 dark:border-zinc-600"
                      )}
                      aria-hidden
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="size-8 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <span className="size-8 shrink-0 rounded bg-gray-100 dark:bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    <span className="shrink-0 text-gray-500">
                      {formatStoreCurrencyFromCents(item.priceCents)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
