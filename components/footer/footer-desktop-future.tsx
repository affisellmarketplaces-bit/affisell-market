"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Globe2, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react"

import { FooterLegalBar } from "@/components/footer/footer-legal-bar"
import { FooterSocialOrbit } from "@/components/footer/footer-social-orbit"
import { FooterTrustBeacon } from "@/components/footer/footer-trust-beacon"
import { PaymentMethodsStrip } from "@/components/checkout/payment-methods-strip"
import {
  footerHeroCardTile,
  footerHeroGlow,
  footerHeroLink,
  footerHeroPillBtn,
  footerHeroTagline,
  footerHeroTitle,
  footerLiveBadge,
} from "@/components/footer/footer-hero-tokens"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { footerSectionAccent } from "@/lib/footer-section-accents"
import { cn } from "@/lib/utils"

type Props = {
  content: FooterGlobalContent
}

function FutureLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className={footerHeroLink}>
        {children}
      </Link>
    </li>
  )
}

function NavColumn({
  title,
  links,
  accent,
}: {
  title: string
  links: { href: string; label: string }[]
  accent: string
}) {
  return (
    <nav className={cn(footerHeroCardTile, "min-h-0 overflow-visible")}>
      <span className={cn(footerHeroGlow, accent)} aria-hidden />
      <h2 className={cn("relative", footerHeroTitle)}>{title}</h2>
      <ul className="relative mt-4 space-y-2.5 pb-1">
        {links.map((link) => (
          <FutureLink key={link.href + link.label} href={link.href}>
            {link.label}
          </FutureLink>
        ))}
      </ul>
      <ArrowUpRight
        className="absolute right-4 top-4 size-4 text-white/40 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/80"
        aria-hidden
      />
    </nav>
  )
}

export function FooterDesktopFuture({ content }: Props) {
  return (
    <div className="affisell-footer-future__desktop relative hidden md:block">
      <div className="affisell-site-footer__pad relative mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-12 lg:gap-5">
          <div className={cn(footerHeroCardTile, "lg:col-span-4")}>
            <span
              className={cn(footerHeroGlow, "from-violet-400/90 to-indigo-500/90")}
              aria-hidden
            />
            <Link href="/" className="relative inline-flex flex-wrap items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400/90 to-indigo-500/90 shadow-inner">
                <Sparkles className="size-5 text-white" aria-hidden />
              </span>
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                {content.siteTitle}
              </span>
              <span className={footerLiveBadge}>Live</span>
            </Link>
            <p className={cn("relative mt-4 max-w-sm", footerHeroTagline)}>{content.tagline}</p>

            <div className="relative mt-6 flex flex-wrap gap-2">
              {content.quickLinks.map((link) => (
                <Link key={link.href} href={link.href} className={footerHeroPillBtn}>
                  {link.label}
                </Link>
              ))}
            </div>

            <FooterSocialOrbit links={content.socialLinks} className="relative mt-6" />

            <div className="relative mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <ShieldCheck className="size-3.5 text-violet-200" aria-hidden />
                EU · RGPD
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <Globe2 className="size-3.5 text-sky-200" aria-hidden />
                {content.panEuBadge}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <Zap className="size-3.5 text-sky-200" aria-hidden />
                3D Secure
              </span>
            </div>

            <FooterTrustBeacon beacon={content.trustBeacon} className="relative mt-6" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 lg:col-span-8">
            {content.sections.map((section) => (
              <NavColumn
                key={section.id}
                title={section.title}
                links={section.links}
                accent={footerSectionAccent(section.id)}
              />
            ))}
          </div>
        </div>

        <div className={cn(footerHeroCardTile, "mt-8 p-5")}>
          <span
            className={cn(footerHeroGlow, "from-violet-400/90 to-indigo-500/90")}
            aria-hidden
          />
          <div className="relative flex flex-wrap items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-xl border border-[#8B5CF6]/40 bg-[#8B5CF6]/20">
              <Lock className="size-5 text-[#C4B5FD]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className={footerHeroTitle}>{content.paymentTitle}</p>
              <PaymentMethodsStrip
                variant="footer"
                showStripeLead
                ariaLabel={content.paymentMethodsAriaLabel}
                processorSecureLabel={content.paymentProcessorSecure}
              />
              <p className={footerHeroTagline}>{content.stripeNotice}</p>
              <p className="text-xs text-violet-100/70">{content.vatNotice}</p>
            </div>
          </div>
        </div>

        <FooterLegalBar content={content} className="mt-10" />
      </div>
    </div>
  )
}
