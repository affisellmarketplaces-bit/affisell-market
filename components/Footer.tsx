import Link from "next/link"
import { getTranslations } from "next-intl/server"

import { readCompanyLegal } from "@/lib/legal/company-env"
import { cn } from "@/lib/utils"

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-gray-300 transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  )
}

function StripeTrustBadge() {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/80 px-3 py-1.5"
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

  return (
    <footer
      role="contentinfo"
      className="affisell-site-footer mt-auto shrink-0 border-t border-gray-800 bg-gray-900 text-gray-300"
    >
      <div className="affisell-site-footer__pad mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pb-12">
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
              <p className="text-sm leading-relaxed text-gray-400">{t("vatNotice")}</p>
              <p className="text-sm leading-relaxed text-gray-400">{t("stripeNotice")}</p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-10 border-t border-gray-800 pt-6 text-center text-xs text-gray-500 sm:text-left"
          )}
        >
          <p>
            {t("copyright", { year, name: company.name, siret: company.siret })}{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-white"
            >
              {t("odrLink")}
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
