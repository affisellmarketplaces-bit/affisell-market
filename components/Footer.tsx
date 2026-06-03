import Link from "next/link"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"

import { FooterMobileShell } from "@/components/footer/footer-mobile-shell"
import { readCompanyLegal } from "@/lib/legal/company-env"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-zinc-400 transition-colors hover:text-violet-200"
      >
        {children}
      </Link>
    </li>
  )
}

function StripeTrustBadge() {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-violet-500/25 bg-violet-950/40 px-3 py-1.5"
      role="img"
      aria-label="Stripe"
    >
      <span className="text-base font-semibold tracking-tight text-[#635BFF]">Stripe</span>
    </div>
  )
}

export async function Footer() {
  const t = await getTranslations("footer.global")
  const company = readCompanyLegal()
  const year = new Date().getFullYear()

  const mobileContent: FooterGlobalContent = {
    siteTitle: t("siteTitle"),
    tagline: t("mobileTagline"),
    sections: [
      {
        id: "affisell",
        title: t("siteTitle"),
        links: [
          { href: "/about", label: t("about") },
          { href: "/how-it-works", label: t("howItWorks") },
          { href: "/affiliate", label: t("affiliateProgram") },
          { href: "/supplier", label: t("becomeSupplier") },
          { href: "/demo", label: t("demoLab") },
        ],
      },
      {
        id: "legal",
        title: t("legalTitle"),
        links: [
          { href: "/cgv", label: t("cgv") },
          { href: "/cgu", label: t("cgu") },
          { href: "/mentions-legales", label: t("legalNotice") },
          { href: "/privacy", label: t("privacyPolicy") },
          { href: "/returns", label: t("returns") },
        ],
      },
      {
        id: "support",
        title: t("supportTitle"),
        links: [
          { href: "/faq", label: t("faq") },
          { href: "/support", label: t("supportAssistant") },
          { href: "/shipping", label: t("shipping") },
          { href: "/contact", label: t("contact") },
          { href: "/track-order", label: t("trackOrder") },
        ],
      },
    ],
    quickLinks: [
      { href: "/faq", label: t("faq") },
      { href: "/support", label: t("supportAssistant") },
      { href: "/track-order", label: t("trackOrder") },
    ],
    paymentTitle: t("paymentTitle"),
    vatNotice: t("vatNotice"),
    stripeNotice: t("stripeNotice"),
    stripeNoticeShort: t("stripeNoticeShort"),
    copyrightLine: t("copyright", { year, name: company.name, siret: company.siret }),
    odrLink: t("odrLink"),
    odrHref: "https://ec.europa.eu/consumers/odr",
  }

  return (
    <footer
      role="contentinfo"
      className="affisell-site-footer relative mt-auto shrink-0 overflow-hidden border-t border-white/[0.06] bg-gradient-to-b from-zinc-950 to-black text-zinc-300"
    >
      <FooterMobileShell content={mobileContent} />

      <div className="affisell-site-footer__pad mx-auto hidden max-w-7xl px-4 pt-12 sm:px-6 md:block lg:px-8 lg:pb-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-labelledby="footer-affisell-heading">
            <h2
              id="footer-affisell-heading"
              className="text-sm font-semibold uppercase tracking-wider text-white"
            >
              {t("siteTitle")}
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/about">{t("about")}</FooterLink>
              <FooterLink href="/how-it-works">{t("howItWorks")}</FooterLink>
              <FooterLink href="/affiliate">{t("affiliateProgram")}</FooterLink>
              <FooterLink href="/supplier">{t("becomeSupplier")}</FooterLink>
              <FooterLink href="/demo">{t("demoLab")}</FooterLink>
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal-heading">
            <h2
              id="footer-legal-heading"
              className="text-sm font-semibold uppercase tracking-wider text-white"
            >
              {t("legalTitle")}
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/cgv">{t("cgv")}</FooterLink>
              <FooterLink href="/cgu">{t("cgu")}</FooterLink>
              <FooterLink href="/mentions-legales">{t("legalNotice")}</FooterLink>
              <FooterLink href="/privacy">{t("privacyPolicy")}</FooterLink>
              <FooterLink href="/returns">{t("returns")}</FooterLink>
            </ul>
          </nav>

          <nav aria-labelledby="footer-support-heading">
            <h2
              id="footer-support-heading"
              className="text-sm font-semibold uppercase tracking-wider text-white"
            >
              {t("supportTitle")}
            </h2>
            <ul className="mt-4 space-y-2">
              <FooterLink href="/faq">{t("faq")}</FooterLink>
              <FooterLink href="/support">{t("supportAssistant")}</FooterLink>
              <FooterLink href="/shipping">{t("shipping")}</FooterLink>
              <FooterLink href="/contact">{t("contact")}</FooterLink>
              <FooterLink href="/track-order">{t("trackOrder")}</FooterLink>
            </ul>
          </nav>

          <div aria-labelledby="footer-payment-heading">
            <h2
              id="footer-payment-heading"
              className="text-sm font-semibold uppercase tracking-wider text-white"
            >
              {t("paymentTitle")}
            </h2>
            <div className="mt-4 space-y-3">
              <StripeTrustBadge />
              <p className="text-sm leading-relaxed text-zinc-500">{t("vatNotice")}</p>
              <p className="text-sm leading-relaxed text-zinc-500">{t("stripeNotice")}</p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-10 border-t border-white/[0.08] pt-6 text-center text-xs text-zinc-600 sm:text-left"
          )}
        >
          <p>
            {t("copyright", { year, name: company.name, siret: company.siret })}{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-violet-300"
            >
              {t("odrLink")}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
