"use client"

import Link from "next/link"
import { Loader2, Sparkles, Wand2 } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { BrandStudioSnapshot } from "@/lib/boutique/haute-gamme-themes-shared"
import { postBrandAiJson } from "@/lib/storefront-ai-fetch-shared"
import { cn } from "@/lib/utils"

type GenerateResponse = {
  success: boolean
  design: {
    id: string
    name: string
    palette: BrandStudioSnapshot["palette"]
    typography: BrandStudioSnapshot["typography"]
    heroTitle: string
    designIndex: number
  }
  tagline: string
  boutiquePath?: string
}

type Props = {
  role: "AFFILIATE" | "SUPPLIER"
  storeSlug: string
  disabled?: boolean
  boutiquePreviewHref?: string
}

export function BoutiqueAiPersonalizePanel({
  role,
  storeSlug,
  disabled = false,
  boutiquePreviewHref,
}: Props) {
  const t = useTranslations("storefront.brandStudio.aiBoutique")
  const locale = useLocale()
  const router = useRouter()
  const [vibe, setVibe] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<GenerateResponse | null>(null)

  const run = useCallback(async () => {
    const trimmed = vibe.trim()
    if (!trimmed) {
      setError(t("vibeRequired"))
      return
    }

    setBusy(true)
    setError(null)
    try {
      const result = await postBrandAiJson<GenerateResponse>(
        "/api/brand-studio/generate",
        { storeSlug, vibe: trimmed, locale },
        t("failed")
      )

      if (!result.ok || !result.data?.success || !result.data.design?.id) {
        throw new Error(result.error ?? t("failed"))
      }

      setLastResult(result.data)
      capturePosthogClient("boutique_haute_gamme_applied", {
        role,
        designId: result.data.design.id,
      })
      console.log("[brand-studio]", {
        event: "haute_gamme_personalize",
        role,
        designId: result.data.design.id,
        result: "ok",
      })

      toast.success(t("saved"))
      const target =
        boutiquePreviewHref ??
        result.data.boutiquePath ??
        `/boutique/${encodeURIComponent(storeSlug)}`
      router.push(
        `${target}?theme=${encodeURIComponent(result.data.design.id)}&vibe=${encodeURIComponent(trimmed)}`
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("failed")
      setError(msg)
      console.log("[brand-studio]", {
        event: "haute_gamme_personalize",
        role,
        result: "error",
        error: msg,
      })
    } finally {
      setBusy(false)
    }
  }, [boutiquePreviewHref, locale, role, router, storeSlug, t, vibe])

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-500/25 bg-gradient-to-br from-[#0c1222] via-[#1a1040] to-[#042f2e] p-[1px] shadow-[0_24px_80px_-24px_rgba(34,211,238,0.45)]">
      <div className="relative overflow-hidden rounded-[calc(1.75rem-1px)] bg-zinc-950/94 px-6 py-7 sm:px-8 sm:py-9">
        <div
          className="pointer-events-none absolute -left-24 top-8 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-20 bottom-4 h-56 w-56 rounded-full bg-violet-600/25 blur-3xl"
          aria-hidden
        />

        <div className="relative space-y-6">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-100">
              <Sparkles className="size-3.5" aria-hidden />
              {t("badge")}
            </div>
            <h2 className="text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {t("title")}
            </h2>
            <p className="text-sm leading-relaxed text-zinc-300/90">{t("subtitle")}</p>
            {role === "SUPPLIER" ? (
              <p className="text-xs text-zinc-400">{t("supplierHint")}</p>
            ) : null}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">{t("vibeLabel")}</span>
            <textarea
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              rows={3}
              maxLength={400}
              placeholder={t("vibePlaceholder")}
              disabled={disabled || busy}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-cyan-500/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 disabled:opacity-60"
            />
            <p className="text-xs text-zinc-500">{t("vibeHint")}</p>
          </label>

          {lastResult ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm text-zinc-200">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-cyan-200">{lastResult.design.name}</p>
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
                  {lastResult.design.id.toUpperCase()} · {lastResult.design.designIndex}/1024
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  lastResult.design.palette.bgFrom,
                  lastResult.design.palette.bgTo,
                  lastResult.design.palette.accent,
                  lastResult.design.palette.cardBg,
                ].map((swatch) => (
                  <span
                    key={swatch}
                    className="h-8 w-8 rounded-full border border-white/15 shadow-sm"
                    style={{ background: swatch }}
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-3 text-sm text-violet-100/90">{lastResult.tagline}</p>
              <p className="mt-1 text-xs text-zinc-500">{lastResult.design.heroTitle}</p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void run()}
              className={cn(
                "inline-flex h-12 min-w-[220px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-cyan-900/30 transition hover:from-cyan-400 hover:to-violet-500 disabled:opacity-60"
              )}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Wand2 className="size-4" aria-hidden />
              )}
              {busy ? t("designing") : t("cta")}
            </button>

            {lastResult && boutiquePreviewHref ? (
              <Link
                href={`${boutiquePreviewHref}?theme=${encodeURIComponent(lastResult.design.id)}&vibe=${encodeURIComponent(vibe.trim())}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
              >
                {t("viewBoutique")}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
