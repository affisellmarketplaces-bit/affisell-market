"use client"

import { Loader2, Rocket, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"

import { BentoCard } from "@/components/affisell/bento-ui"
import { capturePosthogClient } from "@/lib/analytics/posthog"
import {
  BRAND_LAUNCH_NICHES,
  buildBrandLaunchConfig,
  type BrandLaunchConfig,
  type BrandLaunchNiche,
} from "@/lib/storefront-brand-launch"
import { cn } from "@/lib/utils"

type Props = {
  storeName: string
  role: "AFFILIATE" | "SUPPLIER"
  busy?: boolean
  onLaunch: (config: BrandLaunchConfig) => Promise<void>
}

export function StorefrontBrandLaunchPanel({ storeName, role, busy = false, onLaunch }: Props) {
  const t = useTranslations("storefront.brandStudio.launch")
  const [selected, setSelected] = useState<BrandLaunchNiche>("fashion")
  const [launching, setLaunching] = useState(false)
  const mountedRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  async function handleLaunch() {
    setLaunching(true)
    try {
      const trimmedName = storeName.trim() || t("defaultStoreName")
      const config = buildBrandLaunchConfig({
        niche: selected,
        description: t(`niches.${selected}.description`, { name: trimmedName }),
        storeName: trimmedName,
      })
      capturePosthogClient("brand_launch_applied", {
        niche: selected,
        role,
        presetId: config.presetId,
      })
      console.log("[brand-launch]", {
        niche: selected,
        role,
        presetId: config.presetId,
        result: "applied",
      })
      await onLaunch(config)
    } finally {
      if (mountedRef.current) setLaunching(false)
    }
  }

  const disabled = busy || launching

  return (
    <BentoCard className="border-violet-300/60 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/50 dark:border-violet-800/50 dark:from-violet-950/30 dark:via-zinc-950 dark:to-indigo-950/20">
      <div className="flex flex-col gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Rocket className="size-4 text-violet-600" aria-hidden />
            {t("title")}
          </p>
          <p className="mt-1 text-sm text-violet-900/80 dark:text-violet-200/80">{t("subtitle")}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {BRAND_LAUNCH_NICHES.map((niche) => (
            <button
              key={niche}
              type="button"
              disabled={disabled}
              onClick={() => setSelected(niche)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition",
                selected === niche
                  ? "border-violet-500 bg-white shadow-sm ring-2 ring-violet-500/25 dark:bg-zinc-950"
                  : "border-violet-200/80 bg-white/60 hover:border-violet-400 dark:border-violet-900/50 dark:bg-zinc-950/40"
              )}
            >
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {t(`niches.${niche}.label`)}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-600 dark:text-zinc-400">
                {t(`niches.${niche}.hint`)}
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() => void handleLaunch()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {launching ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("launching")}
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden />
              {t("cta")}
            </>
          )}
        </button>
      </div>
    </BentoCard>
  )
}
