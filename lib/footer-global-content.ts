import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { FOOTER_SOCIAL_LINKS } from "@/lib/footer-social-links"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"

type FooterTranslator = (
  key: string,
  values?: Record<string, string | number>
) => string

export function buildFooterGlobalContent(
  t: FooterTranslator,
  company: { name: string; siret: string },
  year: number
): FooterGlobalContent {
  return {
    siteTitle: t("siteTitle"),
    tagline: t("desktopTagline"),
    sections: [
      {
        id: "buy",
        title: t("buyTitle"),
        links: [
          { href: PUBLIC_MARKETPLACE_BROWSE_PATH, label: t("browseCatalog") },
          { href: "/auctions", label: t("auctions") },
          { href: "/luxe", label: t("luxe") },
          { href: "/how-it-works", label: t("howItWorks") },
          { href: "/protected-checkout", label: t("buyerProtection") },
          { href: "/track-order", label: t("trackOrder") },
          { href: "/wishlist", label: t("wishlist") },
        ],
      },
      {
        id: "sell",
        title: t("sellTitle"),
        links: [
          { href: "/creators", label: t("becomeCreator") },
          { href: "/supplier", label: t("becomeSupplier") },
          { href: "/affiliate", label: t("affiliateProgram") },
          { href: "/how-it-works", label: t("howSellingWorks") },
          { href: "/demo", label: t("demoLab") },
        ],
      },
      {
        id: "company",
        title: t("companyTitle"),
        links: [
          { href: "/about", label: t("about") },
          { href: "/blog", label: t("blog") },
          { href: "/careers", label: t("careers") },
          { href: "/press", label: t("press") },
        ],
      },
      {
        id: "help",
        title: t("helpTitle"),
        links: [
          { href: "/help/faq", label: t("faq") },
          { href: "/support", label: t("supportAssistant") },
          { href: "/shipping", label: t("shipping") },
          { href: "/contact", label: t("contact") },
        ],
      },
    ],
    quickLinks: [
      { href: "/protected-checkout", label: t("buyerProtectionShort") },
      { href: "/help/faq", label: t("faq") },
      { href: "/support", label: t("supportAssistant") },
      { href: "/track-order", label: t("trackOrder") },
    ],
    trustBeacon: {
      href: "/protected-checkout",
      title: t("trustBeaconTitle"),
      hint: t("trustBeaconHint"),
      cta: t("trustBeaconCta"),
    },
    legalBar: [
      { href: "/accessibilite", label: t("accessibility") },
      { href: "/cgv", label: t("cgv") },
      { href: "/cgu", label: t("cgu") },
      { href: "/privacy", label: t("privacyPolicy") },
      { href: "/cookies", label: t("cookieSettings") },
      { href: "/legal/mentions", label: t("legalNotice") },
      { href: "/protected-checkout", label: t("returns") },
    ],
    socialLinks: FOOTER_SOCIAL_LINKS.map(({ id, href }) => ({
      id,
      href,
      label: t(`social.${id}`),
    })),
    paymentTitle: t("paymentTitle"),
    vatNotice: t("vatNotice"),
    stripeNotice: t("stripeNotice"),
    stripeNoticeShort: t("stripeNoticeShort"),
    copyrightLine: t("copyright", { year, name: company.name, siret: company.siret }),
    odrLink: t("odrLink"),
    odrHref: "https://ec.europa.eu/consumers/odr",
    panEuBadge: t("panEuBadge"),
    localeLabel: t("localeLabel"),
  }
}
