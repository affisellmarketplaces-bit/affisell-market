"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react"

import {
  footerHeroCardTile,
  footerHeroGlow,
  footerHeroLink,
  footerHeroPillBtn,
  footerHeroTagline,
  footerHeroTitle,
  footerLiveBadge,
  footerStripeBadge,
} from "@/components/footer/footer-hero-tokens"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
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
    <nav className={cn(footerHeroCardTile, "min-h-[12rem] justify-between")}>
      <span className={cn(footerHeroGlow, accent)} aria-hidden />
      <h2 className={cn("relative", footerHeroTitle)}>{title}</h2>
      <ul className="relative mt-4 space-y-2.5">
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
  const affisell = content.sections.find((s) => s.id === "affisell")
  const legal = content.sections.find((s) => s.id === "legal")
  const support = content.sections.find((s) => s.id === "support")

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

            <div className="relative mt-8 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <ShieldCheck className="size-3.5 text-violet-200" aria-hidden />
                EU · RGPD
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-lg">
                <Zap className="size-3.5 text-sky-200" aria-hidden />
                3D Secure
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-8">
            {affisell ? (
              <NavColumn
                title={affisell.title}
                links={affisell.links}
                accent="from-violet-400/90 to-indigo-500/90"
              />
            ) : null}
            {legal ? (
              <NavColumn
                title={legal.title}
                links={legal.links}
                accent="from-fuchsia-400/90 to-pink-500/90"
              />
            ) : null}
            {support ? (
              <NavColumn
                title={support.title}
                links={support.links}
                accent="from-sky-400/90 to-cyan-500/90"
              />
            ) : null}
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
            <div className="min-w-0 flex-1 space-y-2">
              <p className={footerHeroTitle}>{content.paymentTitle}</p>
              <p className={footerHeroTagline}>{content.stripeNotice}</p>
              <p className="text-xs text-violet-100/70">{content.vatNotice}</p>
            </div>
            <span className={footerStripeBadge} role="img" aria-label="Stripe">
              Stripe
            </span>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/20 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-violet-100/70">
            {content.copyrightLine}{" "}
            <a
              href={content.odrHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 underline decoration-[#8B5CF6]/50 underline-offset-2 transition-all hover:translate-x-0.5 hover:text-white"
            >
              {content.odrLink}
            </a>
          </p>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-100/50">
            Affisell · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
