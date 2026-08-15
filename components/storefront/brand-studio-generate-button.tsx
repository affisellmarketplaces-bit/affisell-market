"use client"

import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { Button } from "@/components/ui/button"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandFieldGenerateResponse, BrandStudioGenerateField } from "@/lib/storefront-brand-field-generate-shared"
import type { BrandLaunchNiche } from "@/lib/storefront-brand-launch"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"
import type { HomepageSectionType } from "@/lib/storefront-sections-shared"
import { cn } from "@/lib/utils"

type Props = {
  field: BrandStudioGenerateField
  role: "AFFILIATE" | "SUPPLIER"
  disabled?: boolean
  niche?: BrandLaunchNiche | null
  sectionType?: HomepageSectionType
  /** compact = inline pill in field headers; default = slightly larger with optional hint */
  variant?: "compact" | "default"
  label?: string
  hint?: string
  className?: string
  onApply: (result: BrandFieldGenerateResponse) => void
}

export function BrandStudioGenerateButton({
  field,
  role,
  disabled = false,
  niche = null,
  sectionType,
  variant = "compact",
  label,
  hint,
  className,
  onApply,
}: Props) {
  const t = useTranslations("storefront.brandStudio.generate")
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await postBrandAiJson<BrandFieldGenerateResponse>(
        "/api/store/generate-brand-field",
        {
          field,
          locale,
          niche: niche ?? undefined,
          sectionType,
        },
        t("failed")
      )
      if (!result.ok || !result.data) {
        throw new Error(result.error ?? t("failed"))
      }
      onApply(result.data)
      capturePosthogClient("brand_field_generated", {
        role,
        field,
        source: result.data.source ?? "unknown",
        sectionType: sectionType ?? null,
      })
      console.log("[brand-studio]", {
        event: "field_generated",
        role,
        field,
        source: result.data.source,
        result: "ok",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", { event: "field_generated", role, field, result: "error", error: msg })
    } finally {
      setBusy(false)
    }
  }, [field, locale, niche, onApply, role, sectionType, t])

  const cta = label ?? t(`fields.${field}`)
  const isCompact = variant === "compact"

  return (
    <div className={cn(isCompact ? "inline-flex flex-col items-end" : "space-y-2", className)}>
      <Button
        type="button"
        variant="outline"
        size={isCompact ? "xs" : "sm"}
        disabled={disabled || busy}
        onClick={() => void generate()}
        title={hint ?? t(`hints.${field}`)}
        className={cn(
          "group relative shrink-0 overflow-hidden border-violet-300/60 bg-gradient-to-r from-violet-50/80 via-white to-cyan-50/60 font-semibold text-violet-900 shadow-sm transition hover:border-violet-400 hover:from-violet-100 hover:to-cyan-100 dark:border-violet-800/70 dark:from-violet-950/40 dark:via-zinc-950 dark:to-cyan-950/30 dark:text-violet-100",
          isCompact && "h-7 gap-1.5 rounded-lg px-2.5 text-[11px]"
        )}
      >
        <span
          className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
          aria-hidden
          style={{
            background:
              "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.12) 50%, transparent 60%)",
          }}
        />
        {busy ? (
          <Loader2 className={cn("animate-spin", isCompact ? "size-3" : "mr-2 size-4")} aria-hidden />
        ) : isCompact ? (
          <Wand2 className="size-3" aria-hidden />
        ) : (
          <Sparkles className="mr-2 size-4" aria-hidden />
        )}
        {busy ? t("generating") : cta}
      </Button>
      {!isCompact && hint ? (
        <p className="text-[11px] text-gray-500 dark:text-zinc-500">{hint}</p>
      ) : null}
      {error ? (
        <p className={cn("text-rose-600 dark:text-rose-400", isCompact ? "mt-1 max-w-[14rem] text-right text-[10px]" : "text-[11px]")}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
