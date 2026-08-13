"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import type { StorefrontStaticPages } from "@/lib/storefront-static-pages-shared"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  niche?: BrandLaunchNiche | null
  disabled?: boolean
  onApply: (pages: StorefrontStaticPages) => void
}

export function StorefrontAiStaticPagesButton({
  role,
  niche = null,
  disabled = false,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiStaticPages")
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await postBrandAiJson<{ pages?: StorefrontStaticPages }>(
        "/api/store/generate-brand-static-pages",
        { niche: niche ?? undefined, locale },
        t("failed")
      )
      const pages = result.data?.pages
      if (!result.ok || !pages) {
        throw new Error(result.error ?? t("failed"))
      }
      onApply(pages)
      capturePosthogClient("brand_ai_static_pages_generated", { role, niche: niche ?? "auto" })
      console.log("[brand-studio]", { event: "ai_static_pages_generated", role, result: "ok" })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", {
        event: "ai_static_pages_generated",
        role,
        result: "error",
        error: msg,
      })
    } finally {
      setBusy(false)
    }
  }, [locale, niche, onApply, role, t])

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy}
        onClick={() => void generate()}
        className="border-violet-300/70 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-100"
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        {busy ? t("generating") : t("cta")}
      </Button>
      <p className="text-[11px] text-gray-500 dark:text-zinc-500">{t("hint")}</p>
      {error ? <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p> : null}
    </div>
  )
}
