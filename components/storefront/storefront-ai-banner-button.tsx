"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  niche?: BrandLaunchNiche | null
  disabled?: boolean
  onApply: (bannerUrl: string) => void
}

export function StorefrontAiBannerButton({
  role,
  niche = null,
  disabled = false,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiBanner")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await postBrandAiJson<{ bannerUrl?: string; source?: string }>(
        "/api/store/generate-brand-banner",
        { niche: niche ?? undefined },
        t("failed")
      )
      const bannerUrl = result.data?.bannerUrl
      if (!result.ok || !bannerUrl) {
        throw new Error(result.error ?? t("failed"))
      }
      onApply(bannerUrl)
      capturePosthogClient("brand_ai_banner_generated", {
        role,
        niche: niche ?? "auto",
        source: result.data?.source ?? "unknown",
      })
      console.log("[brand-studio]", {
        event: "ai_banner_generated",
        role,
        source: result.data?.source,
        result: "ok",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", { event: "ai_banner_generated", role, result: "error", error: msg })
    } finally {
      setBusy(false)
    }
  }, [niche, onApply, role, t])

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
