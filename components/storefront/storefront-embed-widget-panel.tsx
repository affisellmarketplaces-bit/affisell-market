"use client"

import { Check, Copy, LayoutPanelTop } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  buildStoreEmbedIframeSnippet,
  storeEmbedPublicUrl,
  type StorefrontEmbedWidget,
} from "@/lib/storefront-embed-shared"
import { cn } from "@/lib/utils"

type Props = {
  slug: string
  storeName: string
  widget: StorefrontEmbedWidget
  onChange: (widget: StorefrontEmbedWidget) => void
}

export function StorefrontEmbedWidgetPanel({ slug, storeName, widget, onChange }: Props) {
  const t = useTranslations("storefront.brandStudio.embedWidget")
  const [copied, setCopied] = useState(false)

  const snippet = useMemo(
    () => buildStoreEmbedIframeSnippet({ slug, storeName }),
    [slug, storeName]
  )
  const previewUrl = useMemo(() => storeEmbedPublicUrl(slug), [slug])

  const copySnippet = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [snippet])

  return (
    <div
      className={cn(
        "space-y-4 rounded-2xl border p-4 transition",
        widget.enabled
          ? "border-emerald-300/70 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          : "border-gray-200 dark:border-zinc-800"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
            <LayoutPanelTop className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("title")}</p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={widget.enabled}
            onChange={(e) => onChange({ ...widget, enabled: e.target.checked })}
            className="size-4 rounded border-gray-300 accent-emerald-600"
          />
          {t("enable")}
        </label>
      </div>

      {widget.enabled ? (
        <>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
              {t("headline")}
            </span>
            <Input
              value={widget.title ?? ""}
              onChange={(e) =>
                onChange({ ...widget, title: e.target.value.trim() ? e.target.value : undefined })
              }
              placeholder={t("headlinePlaceholder", { name: storeName })}
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">
              {t("productCount")}
            </span>
            <Input
              type="number"
              min={2}
              max={6}
              value={widget.productLimit ?? 4}
              onChange={(e) => {
                const n = Number(e.target.value)
                onChange({
                  ...widget,
                  productLimit: Number.isFinite(n) ? Math.min(6, Math.max(2, n)) : 4,
                })
              }}
            />
          </label>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("preview")}</p>
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              <iframe
                src={previewUrl}
                title={t("previewTitle", { name: storeName })}
                className="h-[420px] w-full border-0"
                loading="lazy"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-medium text-gray-600 dark:text-zinc-400">{t("snippet")}</p>
            <pre className="max-h-32 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-[10px] leading-relaxed text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {snippet}
            </pre>
            <Button type="button" size="sm" variant="outline" onClick={() => void copySnippet()}>
              {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
