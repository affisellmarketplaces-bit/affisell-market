"use client"

import { BadgeCheck, ShieldCheck, ShieldEllipsis, Sparkles } from "lucide-react"
import { useTranslations } from "next-intl"
import type { CSSProperties, ReactNode } from "react"

import { brandOrbitStorefrontTrustRail } from "@/lib/affisell-brand-orbit-shared"
import type { StorefrontTrustSnapshot } from "@/lib/storefront-trust-shared"
import {
  resolveStorefrontTrustRailColors,
  storefrontHeaderTrustRailStyle,
  storefrontTrustRailTextColor,
  type StorefrontTrustRailColors,
} from "@/lib/storefront-header-chrome-shared"
import {
  trustRailChipPalette,
  type TrustRailChipTone,
} from "@/lib/storefront-trust-rail-shared"
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

function TrustConnector() {
  return (
    <span className="affisell-trust-quantum-connector mx-1 hidden shrink-0 sm:inline-flex" aria-hidden>
      <span className="affisell-trust-quantum-connector__line" />
      <span className="affisell-trust-quantum-connector__dot" />
    </span>
  )
}

function QuantumChip({
  tone,
  colors,
  icon,
  label,
  sublabel,
  live = false,
  delayMs = 0,
}: {
  tone: TrustRailChipTone
  colors: StorefrontTrustRailColors
  icon: ReactNode
  label: ReactNode
  sublabel?: ReactNode
  live?: boolean
  delayMs?: number
}) {
  const palette = trustRailChipPalette(tone, colors)

  return (
    <span
      className="affisell-trust-quantum-chip group relative inline-flex shrink-0"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span
        className="affisell-trust-quantum-chip__halo pointer-events-none absolute -inset-1 rounded-full opacity-60 blur-md transition-opacity duration-500 group-hover:opacity-90"
        style={{ background: palette.glow }}
        aria-hidden
      />
      <span
        className="affisell-trust-quantum-chip__shell relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 sm:px-3.5 sm:py-2"
        style={{
          color: palette.text,
          borderColor: palette.border,
          background: palette.bg,
          boxShadow: `0 0 0 1px color-mix(in srgb, white 55%, transparent), 0 8px 22px -14px ${palette.glow}`,
        }}
      >
        <span
          className="affisell-trust-quantum-chip__icon-orbit relative flex size-6 shrink-0 items-center justify-center rounded-full sm:size-7"
          style={{
            color: palette.icon,
            background: palette.iconBg,
            boxShadow: `inset 0 1px 0 color-mix(in srgb, white 70%, transparent), 0 0 16px -4px ${palette.glow}`,
          }}
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.14em]">
            {label}
          </span>
          {sublabel ? (
            <span className="hidden truncate text-[9px] font-medium tracking-[0.08em] text-current/65 sm:block">
              {sublabel}
            </span>
          ) : null}
        </span>
        {live ? (
          <span className="affisell-trust-live-signal ml-0.5 hidden shrink-0 sm:inline-flex" aria-hidden>
            <span className="affisell-trust-live-signal__ping" />
            <span className="affisell-trust-live-signal__core" />
          </span>
        ) : null}
      </span>
    </span>
  )
}

function ClassicChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "accent" | "verified" | "secure"
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
          "border-amber-200/70 bg-amber-50/85 text-amber-900 dark:border-amber-900/45 dark:bg-amber-950/30 dark:text-amber-100"
      )}
    >
      {children}
    </span>
  )
}

function QuantumRailCanvas({ colors }: { colors: StorefrontTrustRailColors }) {
  return (
    <>
      <div
        className="affisell-trust-quantum-aurora pointer-events-none absolute inset-0 opacity-90"
        style={{ background: colors.aurora }}
        aria-hidden
      />
      <div
        className="affisell-trust-quantum-grid pointer-events-none absolute inset-0 opacity-[0.35]"
        style={
          {
            "--trust-rail-mesh": colors.mesh,
          } as CSSProperties
        }
        aria-hidden
      />
      <div className="affisell-storefront-trust-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px opacity-90" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-black/8 to-transparent"
        aria-hidden
      />
    </>
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
  const quantum = visual === "futuristic" && integrated
  const colors = resolveStorefrontTrustRailColors(primary, accent, trustRailText)
  const labelColor = quantum ? colors.text : storefrontTrustRailTextColor(trustRailText)

  return (
    <div
      className={cn(
        "affisell-storefront-trust-rail relative overflow-hidden",
        quantum
          ? "min-h-10 border-b backdrop-blur-xl sm:min-h-11"
          : integrated
            ? brandOrbitStorefrontTrustRail
            : "border-b border-zinc-200/80 bg-gradient-to-r from-violet-50/90 via-white to-emerald-50/70 dark:border-zinc-800 dark:from-violet-950/30 dark:via-zinc-950 dark:to-emerald-950/20",
        className
      )}
      style={
        quantum
          ? ({
              ...storefrontHeaderTrustRailStyle(primary, accent),
              color: labelColor,
              "--store-trust-accent": accent,
              "--store-trust-rail-text": labelColor,
              "--store-trust-glow": colors.glow,
            } as CSSProperties)
          : integrated && !quantum
            ? ({ "--store-trust-accent": accent } as CSSProperties)
            : undefined
      }
    >
      {quantum ? (
        <QuantumRailCanvas colors={colors} />
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,color-mix(in_srgb,var(--store-trust-accent,#7c3aed)_6%,transparent)_50%,transparent_60%)] opacity-80"
            aria-hidden
          />
          <div className="affisell-storefront-trust-rail__scan pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
        </>
      )}

      <div
        className={cn(
          "relative mx-auto flex max-w-6xl items-center overflow-x-auto overscroll-x-contain",
          quantum
            ? "min-h-10 gap-0.5 px-4 py-2 sm:min-h-11 sm:gap-1 sm:px-6 sm:py-2.5"
            : "gap-1.5 px-4 py-1.5 sm:gap-2 sm:px-6 sm:py-2",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
        role="region"
        aria-label={t("headerTrustAria")}
      >
        {quantum ? (
          <>
            {!isCustomDomain ? (
              <>
                <QuantumChip
                  tone="orbit"
                  colors={colors}
                  live
                  delayMs={0}
                  icon={<Sparkles className="size-3.5 sm:size-4" aria-hidden />}
                  label={t("poweredBy")}
                  sublabel={t("poweredBySub")}
                />
                <TrustConnector />
              </>
            ) : null}

            {trust.merchantVerified ? (
              <>
                <QuantumChip
                  tone="verified"
                  colors={colors}
                  delayMs={80}
                  icon={<BadgeCheck className="size-3.5 sm:size-4" aria-hidden />}
                  label={
                    <>
                      <span className="hidden sm:inline">
                        {isCustomDomain ? t("merchantVerified") : t("verifiedBy")}
                      </span>
                      <span className="sm:hidden">{t("verifiedShort")}</span>
                    </>
                  }
                  sublabel={t("verifiedSub")}
                />
                <TrustConnector />
              </>
            ) : (
              <>
                <QuantumChip
                  tone="secure"
                  colors={colors}
                  live
                  delayMs={80}
                  icon={<ShieldCheck className="size-3.5 sm:size-4" aria-hidden />}
                  label={
                    <>
                      <span className="hidden sm:inline">
                        {isCustomDomain ? t("secureCheckout") : t("platformSecured")}
                      </span>
                      <span className="sm:hidden">{t("securedShort")}</span>
                    </>
                  }
                  sublabel={t("platformSecuredSub")}
                />
                <TrustConnector />
              </>
            )}

            <QuantumChip
              tone="compliance"
              colors={colors}
              delayMs={160}
              icon={<ShieldEllipsis className="size-3.5 sm:size-4" aria-hidden />}
              label={
                <>
                  <span className="hidden md:inline">{t("euProtection")}</span>
                  <span className="md:hidden">{t("euProtectionShort")}</span>
                </>
              }
              sublabel={t("euProtectionSub")}
            />
          </>
        ) : (
          <>
            {!isCustomDomain ? (
              <ClassicChip tone="accent">
                <span className="relative flex size-1.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                </span>
                <Sparkles className="size-3 shrink-0 opacity-80" aria-hidden />
                <span>{t("poweredBy")}</span>
              </ClassicChip>
            ) : null}

            {trust.merchantVerified ? (
              <ClassicChip tone="verified">
                <BadgeCheck className="size-3 shrink-0 opacity-80" aria-hidden />
                <span className="hidden sm:inline">
                  {isCustomDomain ? t("merchantVerified") : t("verifiedBy")}
                </span>
                <span className="sm:hidden">{t("verifiedShort")}</span>
              </ClassicChip>
            ) : (
              <ClassicChip tone="secure">
                <ShieldCheck className="size-3 shrink-0 opacity-80" aria-hidden />
                <span className="hidden sm:inline">
                  {isCustomDomain ? t("secureCheckout") : t("platformSecured")}
                </span>
                <span className="sm:hidden">{t("securedShort")}</span>
              </ClassicChip>
            )}

            {!isCustomDomain ? (
              <span
                className={cn(
                  "ml-auto hidden shrink-0 uppercase tracking-[0.18em] text-zinc-500",
                  integrated ? "text-[9px] font-medium text-zinc-400 md:inline dark:text-zinc-500" : "sm:inline"
                )}
              >
                {t("officialStorefront")}
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
