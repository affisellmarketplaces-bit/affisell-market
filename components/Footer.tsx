import { getTranslations } from "next-intl/server"

import { FooterDesktopFuture } from "@/components/footer/footer-desktop-future"
import { FooterMobileShell } from "@/components/footer/footer-mobile-shell"
import { footerHeroGrid, footerHeroShell } from "@/components/footer/footer-hero-tokens"
import { buildFooterGlobalContent } from "@/lib/footer-global-content"
import { readCompanyLegal } from "@/lib/legal/company-env"

export async function Footer() {
  const t = await getTranslations("footer.global")
  const company = readCompanyLegal()
  const year = new Date().getFullYear()
  const footerContent = buildFooterGlobalContent(t, company, year)

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
