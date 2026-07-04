"use client"

import { Monitor, Smartphone } from "lucide-react"
import { useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { StorefrontLivePreview, type StorefrontDraft } from "@/components/storefront/storefront-live-preview"
import { cn } from "@/lib/utils"

type Props = {
  previewHref: string
  isDirty: boolean
  draft: StorefrontDraft
  refreshKey: number
}

export function StorefrontBrandPreviewPanel({
  previewHref,
  isDirty,
  draft,
  refreshKey,
}: Props) {
  const t = useTranslations("storefront.brandStudio.preview")
  const [viewport, setViewport] = useState<"mobile" | "desktop">("mobile")

  const iframeSrc = useMemo(() => {
    const sep = previewHref.includes("?") ? "&" : "?"
    return `${previewHref}${sep}v=${refreshKey}`
  }, [previewHref, refreshKey])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{t("title")}</p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-400">
            {isDirty ? t("draftHint") : t("liveHint")}
          </p>
        </div>
        {!isDirty ? (
          <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-zinc-700">
            <button
              type="button"
              aria-pressed={viewport === "mobile"}
              onClick={() => setViewport("mobile")}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold",
                viewport === "mobile"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 dark:text-zinc-400"
              )}
            >
              <Smartphone className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-pressed={viewport === "desktop"}
              onClick={() => setViewport("desktop")}
              className={cn(
                "rounded-md px-2 py-1 text-[10px] font-semibold",
                viewport === "desktop"
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 dark:text-zinc-400"
              )}
            >
              <Monitor className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      {isDirty ? (
        <StorefrontLivePreview draft={draft} />
      ) : (
        <div
          className={cn(
            "mx-auto overflow-hidden rounded-[1.75rem] border border-gray-200 shadow-2xl ring-1 ring-black/5 dark:border-zinc-700 dark:ring-white/10",
            viewport === "mobile" ? "max-w-[280px]" : "w-full"
          )}
        >
          <iframe
            key={iframeSrc}
            src={iframeSrc}
            title={t("iframeTitle")}
            className={cn(
              "w-full border-0 bg-white dark:bg-zinc-950",
              viewport === "mobile" ? "h-[520px]" : "h-[640px]"
            )}
            loading="lazy"
          />
        </div>
      )}
    </div>
  )
}
