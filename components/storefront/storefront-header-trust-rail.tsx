"use client"

import { BadgeCheck, Lock, ShieldCheck, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties, ReactNode } from "react"

import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot
  accent?: string
  isCustomDomain?: boolean
  variant?: "integrated" | "standalone"
  className?: string
}

function TrustChip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode
  tone?: "neutral" | "accent" | "verified" | "secure"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] backdrop-blur-md",
        tone === "neutral" &&
          "border-zinc-200/70 bg-white/70 text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/60 dark:text-zinc-300",
        tone === "accent" &&
          "border-violet-200/60 bg-violet-50/80 text-violet-800 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100",
        tone === "verified" &&
          "border-emerald-300/60 bg-emerald-50/85 text-emerald-900 dark:border-emerald-800/45 dark:bg-emerald-950/35 dark:text-emerald-100",
        tone === "secure" &&
          "border-amber-200/70 bg-amber-50/85 text-amber-900 dark:border-amber-900/45 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
    >
      {children}
    </span>
  )
}

export function StorefrontHeaderTrustRail({
  trust,
  accent = "#7c3aed",
  isCustomDomain = false,
  variant = "integrated",
  className,
}: Props) {
  const t = useTranslations("boutique.trust")

  const integrated = variant === "integrated"

  return (
    <div
      className={cn(
        "affisell-storefront-trust-rail relative overflow-hidden",
        integrated
          ? "border-t border-zinc-200/60 bg-gradient-to-r from-zinc-50/95 via-white/90 to-violet-50/50 dark:border-zinc-800/70 dark:from-zinc-950/95 dark:via-zinc-950/90 dark:to-violet-950/25"
          : "border-b border-zinc-200/80 bg-gradient-to-r from-violet-50/90 via-white to-emerald-50/70 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-emerald-950/20",
        className
      )}
      style={
        integrated
          ? ({ "--store-trust-accent": accent } as CSSProperties)
          : undefined
      }
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,color-mix(in_srgb,var(--store-trust-accent,#7c3aed)_6%,transparent)_50%,transparent_60%)] opacity-80"
        aria-hidden
      />
      <div className="affisell-storefront-trust-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />

      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center gap-1.5 overflow-x-auto overscroll-x-contain px-4 py-1.5 sm:gap-2 sm:px-6 sm:py-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        role="region"
        aria-label={t("headerTrustAria")}
      >
        <TrustChip tone={integrated && isCustomDomain ? "neutral" : "accent"}>
          <span className="relative flex size-1.5 shrink-0" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
          <span className={cn(integrated && isCustomDomain && "hidden min-[380px]:inline")}>
            {t("poweredBy")}
          </span>
          <span className={cn(!integrated || !isCustomDomain ? "hidden" : "min-[380px]:hidden")}>
            Affisell
          </span>
        </TrustChip>

        {trust.merchantVerified ? (
          <TrustChip tone="verified">
            <BadgeCheck className="size-3 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("verifiedBy")}</span>
            <span className="sm:hidden">{t("verifiedShort")}</span>
          </TrustChip>
        ) : (
          <TrustChip tone="secure">
            <ShieldCheck className="size-3 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{t("platformSecured")}</span>
            <span className="sm:hidden">{t("securedShort")}</span>
          </TrustChip>
        )}

        <TrustChip tone="neutral" className="font-mono tabular-nums tracking-normal normal-case">
          <Lock className="size-2.5 shrink-0 opacity-70" aria-hidden />
          {t("partnerRef", { code: trust.partnerListingCode })}
        </TrustChip>

        {isCustomDomain ? (
          <span
            className={cn(
              "ml-auto hidden shrink-0 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500",
              integrated ? "md:inline" : "sm:inline"
            )}
          >
            {t("officialStorefront")}
          </span>
        ) : null}
      </div>
    </div>
  )
}
