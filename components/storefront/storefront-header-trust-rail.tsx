"use client"

import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties, ReactNode } from "react"

import { brandOrbitStorefrontTrustRail } from "@/lib/affisell-brand-orbit-shared"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import {
  resolveStorefrontTrustRailColors,
  storefrontHeaderTrustRailStyle,
  storefrontTrustRailTextColor,
} from "@/lib/storefront-header-chrome-shared"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot
  accent?: string
  primary?: string
  trustRailText?: string
  isCustomDomain?: boolean
  variant?: "integrated" | "standalone"
  visual?: "default" | "futuristic"
  className?: string
}

function TrustSeparator({ colors }: { colors: { text: string } }) {
  return (
    <span
      className="mx-2.5 hidden h-4 w-px shrink-0 sm:inline"
      style={{ backgroundColor: `color-mix(in srgb, ${colors.text} 22%, transparent)` }}
      aria-hidden
    />
  )
}

function TrustChip({
  children,
  tone = "neutral",
  futuristic = false,
  colors,
  className,
}: {
  children: ReactNode
  tone?: "neutral" | "accent" | "verified" | "secure"
  futuristic?: boolean
  colors?: { text: string; icon: string; pillBorder: string; pillBg: string }
  className?: string
}) {
  if (futuristic && colors) {
    const toneStyles =
      tone === "verified"
        ? {
            border: "color-mix(in srgb, #10b981 45%, transparent)",
            bg: "color-mix(in srgb, #10b981 12%, white 88%)",
            icon: "#059669",
          }
        : tone === "secure"
          ? {
              border: "color-mix(in srgb, #f59e0b 40%, transparent)",
              bg: "color-mix(in srgb, #f59e0b 10%, white 90%)",
              icon: "#d97706",
            }
          : {
              border: colors.pillBorder,
              bg: colors.pillBg,
              icon: colors.icon,
            }

    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1",
          "text-[11px] font-bold uppercase tracking-[0.1em] shadow-sm backdrop-blur-md sm:text-xs sm:tracking-[0.12em]",
          className
        )}
        style={{
          color: colors.text,
          borderColor: toneStyles.border,
          background: toneStyles.bg,
          boxShadow: `0 1px 8px -2px color-mix(in srgb, ${toneStyles.icon} 28%, transparent)`,
        }}
      >
        {children}
      </span>
    )
  }

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
  primary = "#18181b",
  trustRailText,
  isCustomDomain = false,
  variant = "integrated",
  visual = "default",
  className,
}: Props) {
  const t = useTranslations("boutique.trust")

  const integrated = variant === "integrated"
  const futuristic = visual === "futuristic" && integrated
  const colors = resolveStorefrontTrustRailColors(primary, accent, trustRailText)
  const labelColor = futuristic ? colors.text : storefrontTrustRailTextColor(trustRailText)

  return (
    <div
      className={cn(
        "affisell-storefront-trust-rail relative overflow-hidden",
        futuristic
          ? "min-h-9 border-b backdrop-blur-lg sm:min-h-10"
          : integrated
            ? brandOrbitStorefrontTrustRail
            : "border-b border-zinc-200/80 bg-gradient-to-r from-violet-50/90 via-white to-emerald-50/70 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-emerald-950/20",
        className
      )}
      style={
        futuristic
          ? ({
              ...storefrontHeaderTrustRailStyle(primary, accent),
              color: labelColor,
              "--store-trust-accent": accent,
              "--store-trust-rail-text": labelColor,
            } as CSSProperties)
          : integrated && !futuristic
            ? ({ "--store-trust-accent": accent } as CSSProperties)
            : undefined
      }
    >
      {!futuristic ? (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,color-mix(in_srgb,var(--store-trust-accent,#7c3aed)_6%,transparent)_50%,transparent_60%)] opacity-80"
            aria-hidden
          />
          <div className="affisell-storefront-trust-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_38%,color-mix(in_srgb,var(--store-trust-accent,#7c3aed)_12%,transparent)_50%,transparent_62%)]"
            aria-hidden
          />
          <div className="affisell-storefront-trust-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px opacity-80" aria-hidden />
        </>
      )}

      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center overflow-x-auto overscroll-x-contain",
          futuristic
            ? "min-h-9 gap-1 px-4 py-1.5 sm:min-h-10 sm:gap-1.5 sm:px-6 sm:py-2"
            : "gap-1.5 px-4 py-1.5 sm:gap-2 sm:px-6 sm:py-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        role="region"
        aria-label={t("headerTrustAria")}
      >
        {!isCustomDomain ? (
          <TrustChip tone="accent" futuristic={futuristic} colors={colors}>
            {futuristic ? (
              <>
                <Sparkles
                  className="size-3.5 shrink-0 sm:size-4"
                  style={{ color: colors.icon }}
                  aria-hidden
                />
                <span>{t("poweredBy")}</span>
              </>
            ) : (
              <>
                <span className="relative flex size-1.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
                <span>{t("poweredBy")}</span>
              </>
            )}
          </TrustChip>
        ) : null}

        {futuristic && !isCustomDomain ? <TrustSeparator colors={colors} /> : null}

        {trust.merchantVerified ? (
          <TrustChip tone="verified" futuristic={futuristic} colors={colors}>
            <BadgeCheck className="size-3.5 shrink-0 sm:size-4" style={{ color: "#059669" }} aria-hidden />
            <span className="hidden sm:inline">
              {isCustomDomain ? t("merchantVerified") : t("verifiedBy")}
            </span>
            <span className="sm:hidden">{t("verifiedShort")}</span>
          </TrustChip>
        ) : (
          <TrustChip tone="secure" futuristic={futuristic} colors={colors}>
            <ShieldCheck className="size-3.5 shrink-0 sm:size-4" style={{ color: "#d97706" }} aria-hidden />
            <span className="hidden sm:inline">
              {isCustomDomain ? t("secureCheckout") : t("platformSecured")}
            </span>
            <span className="sm:hidden">{t("securedShort")}</span>
          </TrustChip>
        )}

        {futuristic ? <TrustSeparator colors={colors} /> : null}

        {!futuristic && isCustomDomain ? (
          <span
            className={cn(
              "ml-auto hidden shrink-0 uppercase tracking-[0.18em] text-zinc-500",
              integrated ? "text-[9px] font-medium text-zinc-400 md:inline dark:text-zinc-500" : "sm:inline"
            )}
          >
            {t("officialStorefront")}
          </span>
        ) : null}
      </div>
    </div>
  )
}
