import { getTranslations } from "next-intl/server"

import { FooterDesktopFuture } from "@/components/footer/footer-desktop-future"
import { FooterMobileShell } from "@/components/footer/footer-mobile-shell"
import { footerHeroGrid, footerHeroShell } from "@/components/footer/footer-hero-tokens"
import { readCompanyLegal } from "@/lib/legal/company-env"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"

export async function Footer() {
  const t = await getTranslations("footer.global")
  const company = readCompanyLegal()
  const year = new Date().getFullYear()

  const footerContent: FooterGlobalContent = {
    siteTitle: t("siteTitle"),
    tagline: t("desktopTagline"),
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
          { href: "/conditions-fournisseur", label: t("supplierConditions") },
          { href: "/conditions-affilie", label: t("affiliateConditions") },
          { href: "/mentions-legales", label: t("legalNotice") },
          { href: "/privacy", label: t("privacyPolicy") },
          { href: "/cookies", label: t("cookieSettings") },
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
      className={`affisell-site-footer affisell-footer-future ${footerHeroShell}`}
    >
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
        <FooterMobileShell
          content={{
            ...footerContent,
            tagline: t("mobileTagline"),
          }}
        />
        <FooterDesktopFuture content={footerContent} />
      </div>
    </footer>
  )
}
