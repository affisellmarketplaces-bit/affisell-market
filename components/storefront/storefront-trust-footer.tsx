"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  Globe2,
  Lock,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo, useState } from "react"

import { FooterTrustBeacon, FooterTrustBeaconCompact } from "@/components/footer/footer-trust-beacon"
import { PaymentMethodsStrip } from "@/components/checkout/payment-methods-strip"
import {
  footerHeroCard,
  footerHeroCardTile,
  footerHeroGlow,
  footerHeroGrid,
  footerHeroLink,
  footerHeroPillBtn,
  footerHeroShell,
  footerHeroTagline,
  footerHeroTitle,
  footerLiveBadge,
} from "@/components/footer/footer-hero-tokens"
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
  shopHomePath?: string
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

function NavColumn({
  title,
  children,
  accent = "from-violet-400/90 to-indigo-500/90",
}: {
  title: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <nav className={cn(footerHeroCardTile, "min-h-0 overflow-visible")}>
      <span className={cn(footerHeroGlow, accent)} aria-hidden />
      <h2 className={cn("relative", footerHeroTitle)}>{title}</h2>
      <div className="relative mt-4 space-y-2.5 pb-1">{children}</div>
      <ArrowUpRight
        className="absolute right-4 top-4 size-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/80"
        aria-hidden
      />
    </nav>
  )
}

function StorefrontFooterLegalBar({
  legalLinks,
  disclaimer,
  copyrightLine,
  className,
}: {
  legalLinks: { href: string; label: string }[]
  disclaimer: string
  copyrightLine: string
  className?: string
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <nav
        aria-label="Legal"
        className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {legalLinks.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            prefetch
            className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-violet-100/90 backdrop-blur-md transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/15 pt-4">
        <p className="max-w-3xl text-[11px] leading-relaxed text-violet-100/70">{disclaimer}</p>
        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.16em] text-violet-100/55">
          {copyrightLine}
        </p>
      </div>
    </div>
  )
}

function MobileAccordion({
  title,
  open,
  onToggle,
  children,
  panelId,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
  panelId: string
}) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className={footerHeroTitle}>{title}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#C4B5FD] transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="space-y-2.5 pb-4 pl-0.5">
          {children}
        </div>
      ) : null}
    </div>
  )
}

function StorefrontFooterDesktop({
  trust,
  isCustomDomain,
  accent,
  shopHomePath,
  legalLinks,
  trustBeacon,
  tTrust,
  tFooter,
  platformOrigin,
  locale,
}: {
  trust: StorefrontTrustSnapshot
  isCustomDomain: boolean
  accent: string
  shopHomePath: string
  legalLinks: { href: string; label: string }[]
  trustBeacon: { href: string; title: string; hint: string; cta: string }
  tTrust: ReturnType<typeof useTranslations>
  tFooter: ReturnType<typeof useTranslations>
  platformOrigin: string
  locale: string
}) {
  const year = new Date().getFullYear()

  return (
    <div className="affisell-footer-future__desktop relative hidden md:block">
      <div className="affisell-site-footer__pad relative mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-5">
          <div className={cn(footerHeroCardTile, "lg:col-span-4")}>
            <span
              className={cn(footerHeroGlow, "from-violet-400/90 to-indigo-500/90")}
              aria-hidden
            />
            <Link href={shopHomePath} className="relative inline-flex flex-wrap items-center gap-2">
              <span
                className="flex size-10 items-center justify-center rounded-xl text-lg font-bold text-white shadow-inner"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 85%, white), color-mix(in srgb, ${accent} 55%, #312e81))`,
                }}
              >
                {trust.storeName.slice(0, 1).toUpperCase()}
              </span>
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                {trust.storeName}
              </span>
              {isCustomDomain ? (
                <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-100">
                  {tTrust("officialStorefront")}
                </span>
              ) : (
                <span className={footerLiveBadge}>Live</span>
              )}
            </Link>
            <p className={cn("relative mt-4 max-w-sm", footerHeroTagline)}>{tTrust("footerBody")}</p>

            <div className="relative mt-6 flex flex-wrap gap-2">
              <Link href={shopHomePath} prefetch className={footerHeroPillBtn}>
                {tTrust("shopHomeCta")}
              </Link>
              <Link href="/cart" prefetch className={footerHeroPillBtn}>
                {tTrust("cartCta")}
              </Link>
              <a
                href={platformOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className={footerHeroPillBtn}
              >
                Affisell
              </a>
            </div>

            <div className="relative mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <ShieldCheck className="size-3.5 text-violet-200" aria-hidden />
                EU · RGPD
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <Globe2 className="size-3.5 text-sky-200" aria-hidden />
                {tFooter("panEuBadge")}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <Zap className="size-3.5 text-sky-200" aria-hidden />
                3D Secure
              </span>
              {trust.merchantVerified ? (
                <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  {tTrust("verifiedBy")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {tTrust("verificationPending")}
                </span>
              )}
            </div>

            <FooterTrustBeacon beacon={trustBeacon} className="relative mt-6" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 lg:col-span-8">
            <NavColumn title={tTrust("legalLinksTitle")} accent="from-sky-400/90 to-indigo-500/90">
              <ul className="space-y-2.5">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} prefetch className={footerHeroLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </NavColumn>

            <NavColumn title={tTrust("merchantIdentity")} accent="from-emerald-400/90 to-teal-500/90">
              <p className="text-base font-bold text-white">{trust.storeName}</p>
              {trust.legalDisplayName ? (
                <p className="text-sm text-violet-100/80">
                  {tTrust("legalName", { name: trust.legalDisplayName })}
                </p>
              ) : null}
              {trust.legalStatus ? (
                <p className="text-xs text-violet-100/65">
                  {tTrust(`partnerLegalStatus.${trust.legalStatus}` as "partnerLegalStatus.COMPANY")}
                  {trust.countryCode ? ` · ${trust.countryCode}` : ""}
                </p>
              ) : null}
            </NavColumn>

            <NavColumn title={tTrust("platformOperator")} accent="from-fuchsia-400/90 to-violet-500/90">
              <a
                href={platformOrigin}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-base font-semibold text-violet-100 transition hover:text-white"
              >
                Affisell
                <ExternalLink className="size-3.5 opacity-80" aria-hidden />
              </a>
              <p className="text-sm text-violet-100/80">{tTrust("platformOperatorHint")}</p>
              {trust.verifiedAt ? (
                <p className="text-xs text-violet-100/65">
                  {tTrust("verifiedOn", { date: formatVerifiedDate(trust.verifiedAt, locale) })}
                </p>
              ) : null}
              <p className="pt-2 text-xs leading-relaxed text-violet-100/65">
                {isCustomDomain ? tTrust("customDomainDisclaimer") : tTrust("platformDisclaimer")}
              </p>
            </NavColumn>
          </div>
        </div>

        <div className={cn(footerHeroCardTile, "mt-8 p-5")}>
          <span className={cn(footerHeroGlow, "from-violet-400/90 to-indigo-500/90")} aria-hidden />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/20">
              <Lock className="size-5 text-[#C4B5FD]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className={footerHeroTitle}>{tFooter("paymentTitle")}</p>
              <PaymentMethodsStrip
                variant="footer"
                showStripeLead
                ariaLabel={tFooter("paymentMethodsAriaLabel")}
                processorSecureLabel={tFooter("paymentProcessorSecure")}
              />
              <p className={footerHeroTagline}>{tFooter("stripeNotice")}</p>
              <p className="text-xs text-violet-100/70">{tFooter("vatNotice")}</p>
            </div>
          </div>
        </div>

        <StorefrontFooterLegalBar
          legalLinks={legalLinks}
          disclaimer={tTrust("footerBody")}
          copyrightLine={
            isCustomDomain
              ? `© ${year} ${trust.storeName}`
              : `© ${year} ${trust.storeName} · ${tTrust("poweredBy")}`
          }
          className="mt-10"
        />
      </div>
    </div>
  )
}

function StorefrontFooterMobile({
  trust,
  isCustomDomain,
  accent,
  shopHomePath,
  legalLinks,
  trustBeacon,
  tTrust,
  tFooter,
  platformOrigin,
}: {
  trust: StorefrontTrustSnapshot
  isCustomDomain: boolean
  accent: string
  shopHomePath: string
  legalLinks: { href: string; label: string }[]
  trustBeacon: { href: string; title: string; hint: string; cta: string }
  tTrust: ReturnType<typeof useTranslations>
  tFooter: ReturnType<typeof useTranslations>
  platformOrigin: string
}) {
  const [openPanel, setOpenPanel] = useState<"legal" | "merchant" | null>("legal")
  const year = new Date().getFullYear()

  return (
    <div className="relative md:hidden">
      <div className="relative px-4 pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={shopHomePath} className="inline-flex flex-wrap items-center gap-2">
              <span
                className="flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-inner"
                style={{
                  background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 85%, white), color-mix(in srgb, ${accent} 55%, #312e81))`,
                }}
              >
                {trust.storeName.slice(0, 1).toUpperCase()}
              </span>
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-xl font-bold text-transparent">
                {trust.storeName}
              </span>
            </Link>
            <p className={cn("mt-2 max-w-[16rem]", footerHeroTagline)}>{tTrust("footerBody")}</p>
          </div>
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg">
            <ShieldCheck className="size-4 text-violet-200" aria-hidden />
          </span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={shopHomePath} prefetch className={footerHeroPillBtn}>
            {tTrust("shopHomeCta")}
          </Link>
          <Link href="/cart" prefetch className={footerHeroPillBtn}>
            {tTrust("cartCta")}
          </Link>
          <a href={platformOrigin} target="_blank" rel="noopener noreferrer" className={footerHeroPillBtn}>
            Affisell
          </a>
        </div>

        <FooterTrustBeaconCompact beacon={trustBeacon} className="mt-4" />

        <div className={cn(footerHeroCard, "mt-5 overflow-hidden p-0")}>
          <MobileAccordion
            title={tTrust("legalLinksTitle")}
            open={openPanel === "legal"}
            onToggle={() => setOpenPanel((p) => (p === "legal" ? null : "legal"))}
            panelId="storefront-footer-legal"
          >
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} prefetch className={footerHeroLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </MobileAccordion>
          <MobileAccordion
            title={tTrust("merchantIdentity")}
            open={openPanel === "merchant"}
            onToggle={() => setOpenPanel((p) => (p === "merchant" ? null : "merchant"))}
            panelId="storefront-footer-merchant"
          >
            <p className="text-sm font-semibold text-white">{trust.storeName}</p>
          </MobileAccordion>
        </div>

        <div className={cn(footerHeroCard, "mt-4 space-y-3 p-3")}>
          <p className={footerHeroTitle}>{tFooter("paymentTitle")}</p>
          <PaymentMethodsStrip
            variant="footer"
            showStripeLead
            ariaLabel={tFooter("paymentMethodsAriaLabel")}
            processorSecureLabel={tFooter("paymentProcessorSecure")}
          />
          <p className="text-[11px] leading-snug text-violet-100/85">{tFooter("stripeNoticeShort")}</p>
        </div>

        <StorefrontFooterLegalBar
          legalLinks={legalLinks}
          disclaimer={
            isCustomDomain ? tTrust("customDomainDisclaimer") : tTrust("platformDisclaimer")
          }
          copyrightLine={
            isCustomDomain
              ? `© ${year} ${trust.storeName}`
              : `© ${year} ${trust.storeName} · ${tTrust("poweredBy")}`
          }
          className="affisell-site-footer__pad mt-5 pb-0"
        />
      </div>
    </div>
  )
}

export function StorefrontTrustFooter({
  trust,
  isCustomDomain = false,
  theme,
  shopHomePath = "/",
}: Props) {
  const tTrust = useTranslations("boutique.trust")
  const tFooter = useTranslations("footer.global")
  const locale = useLocale()
  const accent = theme?.accent ?? "#7c3aed"
  const platformOrigin = appBaseUrl()

  const legalLinks = useMemo(
    () =>
      STOREFRONT_TRUST_LEGAL_LINKS.map((link) => ({
        href: link.href,
        label: tTrust(`legalLinks.${link.key}`),
      })),
    [tTrust]
  )

  const trustBeacon = useMemo(
    () => ({
      href: "/protected-checkout",
      title: tFooter("trustBeaconTitle"),
      hint: tFooter("trustBeaconHint"),
      cta: tFooter("trustBeaconCta"),
    }),
    [tFooter]
  )

  return (
    <footer
      role="contentinfo"
      className={cn("affisell-storefront-trust-footer affisell-footer-future mt-16", footerHeroShell)}
      aria-labelledby="storefront-trust-footer-title"
    >
      <span id="storefront-trust-footer-title" className="sr-only">
        {tTrust("footerTitle")}
      </span>
      <div className={footerHeroGrid} aria-hidden />
      <div
        className="pointer-events-none absolute -left-1/4 top-0 h-2/3 w-1/2 rounded-full bg-violet-500/20 blur-[80px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/4 bottom-0 h-1/2 w-1/2 rounded-full bg-sky-500/15 blur-[70px]"
        aria-hidden
      />

      <div className="relative z-10">
        <StorefrontFooterMobile
          trust={trust}
          isCustomDomain={isCustomDomain}
          accent={accent}
          shopHomePath={shopHomePath}
          legalLinks={legalLinks}
          trustBeacon={trustBeacon}
          tTrust={tTrust}
          tFooter={tFooter}
          platformOrigin={platformOrigin}
        />
        <StorefrontFooterDesktop
          trust={trust}
          isCustomDomain={isCustomDomain}
          accent={accent}
          shopHomePath={shopHomePath}
          legalLinks={legalLinks}
          trustBeacon={trustBeacon}
          tTrust={tTrust}
          tFooter={tFooter}
          platformOrigin={platformOrigin}
          locale={locale}
        />
      </div>
    </footer>
  )
}
