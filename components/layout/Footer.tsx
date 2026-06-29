import Link from "next/link"
import { getTranslations } from "next-intl/server"
import { Building2, Cpu, Sparkles, type LucideIcon } from "lucide-react"

import type { ReactNode } from "react"

import { FooterNewsletter } from "@/components/layout/footer-newsletter"
import { PUBLIC_MARKETPLACE_BROWSE_PATH } from "@/lib/affiliate-routes"
import { cn } from "@/lib/utils"

function siteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim()
  if (!raw) return "https://affisell.com"
  if (raw.startsWith("http")) return raw.replace(/\/$/, "")
  return `https://${raw.replace(/\/$/, "")}`
}

function FooterCtaCard({
  href,
  icon: Icon,
  title,
  text,
  cta,
}: {
  href: string
  icon: LucideIcon
  title: string
  text: string
  cta: string
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/10"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-violet-500/20 to-blue-500/20 text-violet-300 transition group-hover:from-violet-500/30 group-hover:to-blue-500/30">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-white/55">{text}</p>
      <span className="mt-5 text-sm font-semibold text-transparent bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text transition group-hover:from-purple-200 group-hover:to-blue-200">
        {cta}
      </span>
    </Link>
  )
}

function FooterNavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="footer-gradient-link text-sm">
        {children}
      </Link>
    </li>
  )
}

function SocialX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function SocialInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function SocialTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.69a8.18 8.18 0 004.77 1.52V6.76a4.85 4.85 0 01-1-.07z" />
    </svg>
  )
}

function SocialDiscord({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037 12.3 12.3 0 00-.608 1.25 18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  )
}

const SOCIAL_LINKS = [
  { href: "https://x.com/affisell", Icon: SocialX, labelKey: "x" as const },
  { href: "https://instagram.com/affisell", Icon: SocialInstagram, labelKey: "instagram" as const },
  { href: "https://tiktok.com/@affisell", Icon: SocialTikTok, labelKey: "tiktok" as const },
  { href: "https://discord.gg/affisell", Icon: SocialDiscord, labelKey: "discord" as const },
]

export async function Footer() {
  const t = await getTranslations("footer")
  const year = new Date().getFullYear()
  const origin = siteOrigin()

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Affisell",
    url: origin,
    logo: `${origin}/placeholder.png`,
    sameAs: SOCIAL_LINKS.map((s) => s.href),
    description: t("brand.tagline"),
  }

  return (
    <footer
      role="contentinfo"
      className="relative mt-auto hidden border-t border-white/5 bg-gradient-to-b from-[#0A0A0F] to-black pt-20 pb-8 text-white md:block"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section aria-label="Get started" className="grid gap-4 md:grid-cols-3">
          <FooterCtaCard
            href="/creators"
            icon={Sparkles}
            title={t("cta.creator.title")}
            text={t("cta.creator.text")}
            cta={t("cta.creator.cta")}
          />
          <FooterCtaCard
            href="/supplier"
            icon={Building2}
            title={t("cta.supplier.title")}
            text={t("cta.supplier.text")}
            cta={t("cta.supplier.cta")}
          />
          <FooterCtaCard
            href="/agent"
            icon={Cpu}
            title={t("cta.agent.title")}
            text={t("cta.agent.text")}
            cta={t("cta.agent.cta")}
          />
        </section>

        <div className="mt-16 grid gap-12 lg:grid-cols-4 lg:gap-12">
          <div className="lg:col-span-1">
            <Link href="/" className="inline-block">
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-2xl font-bold text-transparent">
                Affisell
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/50">{t("brand.tagline")}</p>
            <div className="mt-6 flex items-center gap-4">
              {SOCIAL_LINKS.map(({ href, Icon, labelKey }) => (
                <a
                  key={labelKey}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(`social.${labelKey}`)}
                  className="text-white/60 transition hover:text-white"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          <nav aria-labelledby="footer-product-heading">
            <h2 id="footer-product-heading" className="text-sm font-semibold uppercase tracking-wider text-white/90">
              {t("product.title")}
            </h2>
            <ul className="mt-5 space-y-3">
              <FooterNavLink href={PUBLIC_MARKETPLACE_BROWSE_PATH}>{t("product.exploreCatalog")}</FooterNavLink>
              <FooterNavLink href="/creators">{t("product.topCreators")}</FooterNavLink>
              <FooterNavLink href="/discover">{t("product.liveShopping")}</FooterNavLink>
              <FooterNavLink href="/affiliate">{t("product.affiliateProgram")}</FooterNavLink>
            </ul>
          </nav>

          <nav aria-labelledby="footer-company-heading">
            <h2 id="footer-company-heading" className="text-sm font-semibold uppercase tracking-wider text-white/90">
              {t("company.title")}
            </h2>
            <ul className="mt-5 space-y-3">
              <FooterNavLink href="/about">{t("company.about")}</FooterNavLink>
              <FooterNavLink href="/blog">{t("company.blog")}</FooterNavLink>
              <FooterNavLink href="/careers">{t("company.careers")}</FooterNavLink>
              <FooterNavLink href="/press">{t("company.press")}</FooterNavLink>
            </ul>
          </nav>

          <FooterNewsletter />
        </div>

        <div
          className={cn(
            "mt-16 flex flex-col gap-4 border-t border-white/5 pt-8 text-sm text-white/40",
            "sm:flex-row sm:items-center sm:justify-between"
          )}
        >
          <p>{t("subfooter.copyright", { year })}</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link href="/legal/mentions" className="footer-gradient-link">
              {t("global.legalNotice")}
            </Link>
            <Link href="/legal/terms-of-service" className="footer-gradient-link">
              {t("terms")}
            </Link>
            <Link href="/legal/privacy-policy" className="footer-gradient-link">
              {t("privacy")}
            </Link>
            <Link href="/legal/cookies-policy" className="footer-gradient-link">
              {t("cookies")}
            </Link>
            <Link href="/legal/refund-policy" className="footer-gradient-link">
              {t("global.returns")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
