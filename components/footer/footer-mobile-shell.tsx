"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown, Globe2, ShieldCheck, Sparkles } from "lucide-react"

import { FooterLegalBar } from "@/components/footer/footer-legal-bar"
import { FooterSocialOrbit } from "@/components/footer/footer-social-orbit"
import { FooterTrustBeaconCompact } from "@/components/footer/footer-trust-beacon"
import { PaymentMethodsStrip } from "@/components/checkout/payment-methods-strip"
import {
  footerHeroCard,
  footerHeroLink,
  footerHeroPillBtn,
  footerHeroTagline,
  footerHeroTitle,
  footerLiveBadge,
} from "@/components/footer/footer-hero-tokens"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  content: FooterGlobalContent
}

function FooterAccordion({
  section,
  open,
  onToggle,
}: {
  section: FooterGlobalContent["sections"][number]
  open: boolean
  onToggle: () => void
}) {
  const panelId = `footer-panel-${section.id}`
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        id={`footer-trigger-${section.id}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className={footerHeroTitle}>{section.title}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-[#C4B5FD] transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul id={panelId} role="list" className="space-y-2.5 pb-4 pl-0.5">
          {section.links.map((link) => (
            <li key={link.href + link.label}>
              <Link href={link.href} className={footerHeroLink}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function FooterMobileShell({ content }: Props) {
  const [openId, setOpenId] = useState<string | null>(content.sections[0]?.id ?? null)

  return (
    <div className="relative md:hidden">
      <div className="relative px-4 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="inline-flex flex-wrap items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400/90 to-indigo-500/90 shadow-inner">
                <Sparkles className="size-4 text-white" aria-hidden />
              </span>
              <span className="bg-gradient-to-r from-violet-200 via-fuchsia-200 to-sky-200 bg-clip-text text-xl font-bold text-transparent">
                {content.siteTitle}
              </span>
              <span className={footerLiveBadge}>Live</span>
            </Link>
            <p className={cn("mt-1.5 max-w-[15rem]", footerHeroTagline)}>{content.tagline}</p>
          </div>
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg">
            <ShieldCheck className="size-4 text-violet-200" aria-hidden />
          </span>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {content.quickLinks.slice(0, 4).map((link) => (
            <Link key={link.href} href={link.href} className={footerHeroPillBtn}>
              {link.label}
            </Link>
          ))}
        </div>

        <FooterTrustBeaconCompact beacon={content.trustBeacon} className="mt-3" />

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
            <Globe2 className="size-3 text-sky-200" aria-hidden />
            {content.panEuBadge}
          </span>
        </div>

        <FooterSocialOrbit links={content.socialLinks} className="mt-3" />

        <div className={cn(footerHeroCard, "mt-4 overflow-hidden p-0")}>
          {content.sections.map((section) => (
            <FooterAccordion
              key={section.id}
              section={section}
              open={openId === section.id}
              onToggle={() => setOpenId((prev) => (prev === section.id ? null : section.id))}
            />
          ))}
        </div>

        <div className={cn(footerHeroCard, "mt-3 space-y-2.5 p-3")}>
          <p className={footerHeroTitle}>{content.paymentTitle}</p>
          <PaymentMethodsStrip
            variant="footer"
            showStripeLead
            ariaLabel={content.paymentMethodsAriaLabel}
            processorSecureLabel={content.paymentProcessorSecure}
            complianceNote={content.paymentMethodsComplianceNote}
          />
          <p className="text-[11px] leading-snug text-violet-100/85">{content.stripeNoticeShort}</p>
        </div>

        <FooterLegalBar content={content} className="affisell-site-footer__pad mt-4 pb-0" />
      </div>
    </div>
  )
}
