"use client"

import Link from "next/link"
import { BadgeCheck, Lock, ShieldCheck, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"

import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot
  isCustomDomain?: boolean
  theme?: StorefrontTheme
  className?: string
}

export function StorefrontTrustStrip({ trust, isCustomDomain = false, theme, className }: Props) {
  const t = useTranslations("boutique.trust")
  const accent = theme?.accent ?? "#7c3aed"

  return (
    <div
      className={cn(
        "border-b border-zinc-200/80 bg-gradient-to-r from-violet-50/90 via-white to-emerald-50/70 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-emerald-950/20",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 sm:gap-3 sm:px-6">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-900 shadow-sm dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-100"
          style={{ boxShadow: `0 0 20px color-mix(in srgb, ${accent} 18%, transparent)` }}
        >
          <Sparkles className="size-3.5 shrink-0 text-violet-600 dark:text-violet-300" aria-hidden />
          {t("poweredBy")}
        </span>

        {trust.merchantVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
            {t("verifiedBy")}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50/90 px-2.5 py-1 text-[10px] font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            {t("platformSecured")}
          </span>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200/80 bg-white/80 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-200">
          <Lock className="size-3 shrink-0 opacity-70" aria-hidden />
          {t("partnerRef", { code: trust.partnerListingCode })}
        </span>

        {isCustomDomain ? (
          <span className="ml-auto hidden text-[10px] font-medium text-zinc-500 sm:inline dark:text-zinc-400">
            {t("officialStorefront")}
          </span>
        ) : null}
      </div>
    </div>
  )
}
