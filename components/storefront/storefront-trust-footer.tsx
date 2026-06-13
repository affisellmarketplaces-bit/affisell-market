"use client"

import Link from "next/link"
import { BadgeCheck, ExternalLink, ShieldCheck, Sparkles } from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

import {
  STOREFRONT_TRUST_LEGAL_LINKS,
  type StorefrontTrustSnapshot,
} from "@/lib/storefront-trust-shared"
import type { StorefrontTheme } from "@/lib/storefront-theme-shared"
import { appBaseUrl } from "@/lib/app-base-url"

type Props = {
  trust: StorefrontTrustSnapshot
  isCustomDomain?: boolean
  theme?: StorefrontTheme
}

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

export function StorefrontTrustFooter({ trust, isCustomDomain = false, theme }: Props) {
  const t = useTranslations("boutique.trust")
  const locale = useLocale()
  const accent = theme?.accent ?? "#7c3aed"
  const platformOrigin = appBaseUrl()

  return (
    <footer
      className="relative mt-12 border-t border-zinc-200/90 bg-zinc-950 text-zinc-100 dark:border-zinc-800"
      aria-labelledby="storefront-trust-footer-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-8 h-40 w-40 rounded-full opacity-30 blur-3xl"
        style={{ background: `color-mix(in srgb, ${accent} 35%, transparent)` }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xl space-y-4">
            <p
              id="storefront-trust-footer-title"
              className="flex items-center gap-2 text-sm font-bold tracking-tight text-white"
            >
              <Sparkles className="size-4 text-violet-300" aria-hidden />
              {t("footerTitle")}
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">{t("footerBody")}</p>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-100">
                <Sparkles className="size-3.5" aria-hidden />
                {t("poweredBy")}
              </span>
              {trust.merchantVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {t("verifiedBy")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {t("verificationPending")}
                </span>
              )}
            </div>
          </div>

          <nav aria-label={t("legalNavAria")} className="min-w-[14rem]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
              {t("legalLinksTitle")}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {STOREFRONT_TRUST_LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-zinc-300 transition hover:text-white"
                  >
                    {t(`legalLinks.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("merchantIdentity")}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">{trust.storeName}</p>
            {trust.legalDisplayName ? (
              <p className="mt-0.5 text-xs text-zinc-400">
                {t("legalName", { name: trust.legalDisplayName })}
              </p>
            ) : null}
            {trust.legalStatus ? (
              <p className="mt-1 text-xs text-zinc-500">
                {t(`legalStatus.${trust.legalStatus}` as "legalStatus.COMPANY")}
                {trust.countryCode ? ` · ${trust.countryCode}` : ""}
              </p>
            ) : null}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("partnerListing")}
            </p>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-emerald-300">
              {trust.partnerListingCode}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{t("partnerListingHint")}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {t("platformOperator")}
            </p>
            <a
              href={platformOrigin}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-violet-300 hover:text-violet-200"
            >
              Affisell
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <p className="mt-1 text-xs text-zinc-500">{t("platformOperatorHint")}</p>
            {trust.verifiedAt ? (
              <p className="mt-2 text-[11px] text-zinc-500">
                {t("verifiedOn", { date: formatVerifiedDate(trust.verifiedAt, locale) })}
              </p>
            ) : null}
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-zinc-600">
          {isCustomDomain ? t("customDomainDisclaimer") : t("platformDisclaimer")}
        </p>
      </div>
    </footer>
  )
}
