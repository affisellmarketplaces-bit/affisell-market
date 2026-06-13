"use client"

import Link from "next/link"
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Headphones,
  Lock,
  RotateCcw,
  Scale,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import type { CSSProperties } from "react"

import {
  STOREFRONT_TRUST_LEGAL_LINKS,
  type StorefrontTrustSnapshot,
} from "@/lib/storefront-trust-shared"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { appBaseUrl } from "@/lib/app-base-url"
import { cn } from "@/lib/utils"

type Props = {
  trust: StorefrontTrustSnapshot
  isCustomDomain?: boolean
  theme?: StorefrontTheme
}

const LEGAL_LINK_ICONS = {
  termsOfSale: FileText,
  privacy: Shield,
  legalNotice: Scale,
  returns: RotateCcw,
  support: Headphones,
} as const

function formatVerifiedDate(iso: string, locale: string): string {
  try {
    return new Date(iso).toLocaleDateString(locale.startsWith("fr") ? "fr-FR" : "en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
  } catch {
    return iso.slice(0, 10)
  }
}

function TrustPillar({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof Lock
  label: string
  accent: string
}) {
  return (
    <div className="affisell-trust-glass-panel group relative overflow-hidden rounded-2xl p-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 30% 20%, color-mix(in srgb, ${accent} 18%, transparent), transparent 65%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-start gap-3">
        <span
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-white/15"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 35%, rgb(255 255 255 / 0.08)), rgb(255 255 255 / 0.04))`,
            boxShadow: `0 0 24px -8px color-mix(in srgb, ${accent} 50%, transparent)`,
          }}
        >
          <Icon className="size-4 text-white" strokeWidth={2.25} aria-hidden />
        </span>
        <p className="pt-1.5 text-xs font-semibold leading-snug text-zinc-200">{label}</p>
      </div>
    </div>
  )
}

export function StorefrontTrustFooter({ trust, isCustomDomain = false, theme }: Props) {
  const t = useTranslations("boutique.trust")
  const locale = useLocale()
  const accent = theme?.accent ?? "#7c3aed"
  const primary = theme?.primary ?? "#18181b"
  const platformOrigin = appBaseUrl()

  const footerStyle = {
    "--trust-accent": accent,
  } as CSSProperties

  return (
    <footer
      className="affisell-storefront-trust-footer affisell-trust-footer-aurora relative mt-16 overflow-hidden text-zinc-100"
      style={footerStyle}
      aria-labelledby="storefront-trust-footer-title"
    >
      <div className="affisell-trust-footer-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="affisell-trust-footer-orb pointer-events-none absolute -right-16 top-6 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `color-mix(in srgb, ${accent} 28%, transparent)` }}
        aria-hidden
      />
      <div
        className="affisell-trust-footer-orb pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full blur-3xl"
        style={{
          background: `color-mix(in srgb, ${primary} 22%, ${accent})`,
          animationDelay: "-6s",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div
        className="affisell-trust-footer-sheen pointer-events-none absolute inset-x-0 top-0 h-32 opacity-40"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl space-y-5">
            {!isCustomDomain ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                <span
                  className="inline-flex h-1.5 w-1.5 rounded-full"
                  style={{
                    background: accent,
                    boxShadow: `0 0 10px color-mix(in srgb, ${accent} 80%, transparent)`,
                  }}
                  aria-hidden
                />
                {t("poweredBy")}
              </div>
            ) : null}

            <p
              id="storefront-trust-footer-title"
              className="text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]"
            >
              <Sparkles
                className="mr-2 inline size-5 align-text-bottom text-violet-300"
                aria-hidden
              />
              {t("footerTitle")}
            </p>
            <p className="max-w-xl text-sm leading-relaxed text-zinc-400">{t("footerBody")}</p>

            <div className="flex flex-wrap gap-2.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-violet-100"
                style={{
                  borderColor: `color-mix(in srgb, ${accent} 40%, transparent)`,
                  background: `color-mix(in srgb, ${accent} 16%, rgb(255 255 255 / 0.04))`,
                }}
              >
                <Sparkles className="size-3.5" aria-hidden />
                {t("poweredBy")}
              </span>
              {trust.merchantVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t("verifiedBy")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {t("verificationPending")}
                </span>
              )}
            </div>
          </div>

          <div className="grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-none lg:grid-cols-1 lg:gap-2.5 xl:grid-cols-3 xl:gap-3">
            <TrustPillar icon={Lock} label={t("platformSecured")} accent={accent} />
            <TrustPillar icon={ShieldCheck} label={t("partnerListingHint")} accent={accent} />
            <TrustPillar icon={Sparkles} label={t("poweredBy")} accent={accent} />
          </div>
        </div>

        <div className="affisell-trust-glass-panel relative mt-10 overflow-hidden rounded-[1.35rem] p-5 sm:p-6">
          <div
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden
          />
          <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                {t("merchantIdentity")}
              </p>
              <p className="text-lg font-bold tracking-tight text-white">{trust.storeName}</p>
              {trust.legalDisplayName ? (
                <p className="text-xs text-zinc-400">{t("legalName", { name: trust.legalDisplayName })}</p>
              ) : null}
              {trust.legalStatus ? (
                <p className="text-xs text-zinc-500">
                  {t(`legalStatus.${trust.legalStatus}` as "legalStatus.COMPANY")}
                  {trust.countryCode ? ` · ${trust.countryCode}` : ""}
                </p>
              ) : null}
            </div>

            <div className="space-y-2 lg:border-x lg:border-white/10 lg:px-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                {t("partnerListing")}
              </p>
              <p className="affisell-trust-id-glow font-mono text-xl font-bold tabular-nums tracking-wide text-emerald-300">
                {trust.partnerListingCode}
              </p>
              <p className="text-xs leading-relaxed text-zinc-500">{t("partnerListingHint")}</p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                {t("platformOperator")}
              </p>
              <a
                href={platformOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-base font-semibold transition hover:opacity-90"
                style={{ color: `color-mix(in srgb, ${accent} 70%, white)` }}
              >
                Affisell
                <ExternalLink className="size-3.5 opacity-80" aria-hidden />
              </a>
              <p className="text-xs leading-relaxed text-zinc-500">{t("platformOperatorHint")}</p>
              {trust.verifiedAt ? (
                <p className="text-[11px] text-zinc-500">
                  {t("verifiedOn", { date: formatVerifiedDate(trust.verifiedAt, locale) })}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <nav aria-label={t("legalNavAria")} className="mt-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
            {t("legalLinksTitle")}
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {STOREFRONT_TRUST_LEGAL_LINKS.map((link) => {
              const Icon = LEGAL_LINK_ICONS[link.key]
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    prefetch
                    className={cn(
                      "affisell-trust-legal-chip group flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-medium text-zinc-200"
                    )}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] ring-1 ring-white/10 transition group-hover:bg-white/[0.1]">
                      <Icon className="size-3.5 text-zinc-300" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="min-w-0 leading-snug">{t(`legalLinks.${link.key}`)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-white/[0.06] pt-6 text-center">
          <p className="max-w-2xl text-[11px] leading-relaxed text-zinc-500">
            {isCustomDomain ? t("customDomainDisclaimer") : t("platformDisclaimer")}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-600">
            © {new Date().getFullYear()} {trust.storeName} · {t("poweredBy")}
          </p>
        </div>
      </div>
    </footer>
  )
}
