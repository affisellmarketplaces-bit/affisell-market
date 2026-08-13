"use client"

import Link from "next/link"
import { Loader2, Sparkles, Wand2, Zap } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useCallback, useState } from "react"

import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandAiThemePayload } from "@/lib/storefront-brand-ai-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  disabled?: boolean
  boutiquePreviewHref?: string
  onApplyAndSave: (payload: BrandAiThemePayload) => Promise<boolean>
}

export function StorefrontAiThemeStudioPanel({
  role,
  disabled = false,
  boutiquePreviewHref,
  onApplyAndSave,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiTheme")
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<BrandAiThemePayload | null>(null)
  const [saved, setSaved] = useState(false)

  const run = useCallback(async () => {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch("/api/store/generate-brand-theme", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale }),
      })
      const json = (await res.json()) as { theme?: BrandAiThemePayload; error?: string }
      if (!res.ok || !json.theme) {
        throw new Error(json.error ?? t("failed"))
      }

      setLastResult(json.theme)

      const ok = await onApplyAndSave(json.theme)
      if (!ok) {
        throw new Error(t("saveFailed"))
      }

      setSaved(true)
      capturePosthogClient("brand_ai_theme_applied", {
        role,
        presetId: json.theme.presetId,
        source: json.theme.source,
      })
      console.log("[brand-studio]", {
        event: "ai_theme_applied",
        role,
        presetId: json.theme.presetId,
        source: json.theme.source,
        result: "ok",
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", { event: "ai_theme_applied", role, result: "error", error: msg })
    } finally {
      setBusy(false)
    }
  }, [locale, onApplyAndSave, role, t])

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-violet-500/30 bg-gradient-to-br from-[#1e0a3c] via-[#2d1b69] to-[#0e7490] p-[1px] shadow-[0_24px_80px_-24px_rgba(91,33,217,0.65)]">
      <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-zinc-950/92 px-6 py-7 sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-violet-600/30 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-cyan-500/25 blur-3xl animate-pulse"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, #a78bfa 0%, transparent 42%), radial-gradient(circle at 80% 10%, #22d3ee 0%, transparent 38%)",
          }}
          aria-hidden
        />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              <Zap className="size-3.5" aria-hidden />
              {t("badge")}
            </div>
            <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t("title")}
            </h2>
            <p className="text-sm leading-relaxed text-violet-100/85">{t("subtitle")}</p>
            {lastResult ? (
              <p className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-violet-100/90">
                <span className="font-semibold text-cyan-200">{lastResult.presetId}</span>
                {" · "}
                {lastResult.rationale}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-3 sm:min-w-[240px]">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void run()}
              className={cn(
                "group relative inline-flex h-14 items-center justify-center gap-2.5 overflow-hidden rounded-2xl px-6 text-sm font-bold text-white shadow-[0_20px_50px_-20px_rgba(34,211,238,0.55)] transition",
                "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 hover:scale-[1.02] hover:shadow-[0_24px_60px_-18px_rgba(34,211,238,0.7)] disabled:cursor-not-allowed disabled:opacity-70"
              )}
            >
              <span
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition group-hover:translate-x-full duration-700"
                aria-hidden
              />
              {busy ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-5" aria-hidden />
              )}
              {busy ? t("generating") : t("cta")}
            </button>
            {saved && boutiquePreviewHref ? (
              <Link
                href={boutiquePreviewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
              >
                <Sparkles className="size-4" aria-hidden />
                {t("viewBoutique")}
              </Link>
            ) : null}
            <p className="text-center text-[10px] text-violet-200/70">{t("hint")}</p>
            {error ? <p className="text-center text-[11px] text-rose-300">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
