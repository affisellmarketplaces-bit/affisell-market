"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react"

import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  content: FooterGlobalContent
}

function FutureLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="group inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors duration-300 hover:text-white"
      >
        <span className="relative">
          {children}
          <span
            className="absolute -bottom-px left-0 h-px w-0 max-w-full bg-gradient-to-r from-violet-400 to-cyan-400 transition-all duration-300 group-hover:w-full"
            aria-hidden
          />
        </span>
        <ArrowUpRight
          className="size-3 shrink-0 opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-70"
          aria-hidden
        />
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
  accent: "violet" | "cyan" | "fuchsia"
}) {
  const accentRing =
    accent === "violet"
      ? "from-violet-500/40"
      : accent === "cyan"
        ? "from-cyan-500/40"
        : "from-fuchsia-500/40"

  return (
    <nav
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 backdrop-blur-xl",
        "transition-colors duration-500 hover:border-white/[0.14] hover:bg-white/[0.05]"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r via-transparent to-transparent",
          accentRing
        )}
        aria-hidden
      />
      <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-300">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <FutureLink key={link.href + link.label} href={link.href}>
            {link.label}
          </FutureLink>
        ))}
      </ul>
    </nav>
  )
}

export function FooterDesktopFuture({ content }: Props) {
  const affisell = content.sections.find((s) => s.id === "affisell")
  const legal = content.sections.find((s) => s.id === "legal")
  const support = content.sections.find((s) => s.id === "support")

  return (
    <div className="affisell-footer-future__desktop relative hidden md:block">
      <div className="affisell-footer-future__mesh pointer-events-none absolute inset-0" aria-hidden />
      <div className="affisell-footer-future__orb affisell-footer-future__orb--violet pointer-events-none absolute -left-32 top-0 size-96 rounded-full opacity-40" aria-hidden />
      <div className="affisell-footer-future__orb affisell-footer-future__orb--cyan pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full opacity-30" aria-hidden />

      <div className="affisell-site-footer__pad relative mx-auto max-w-7xl px-4 pb-12 pt-14 sm:px-6 lg:px-8">
        <div className="affisell-footer-future__scanline mb-10 h-px w-full max-w-3xl" aria-hidden />

        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link href="/" className="group inline-flex items-center gap-2">
              <span className="flex size-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 shadow-[0_0_24px_rgba(139,92,246,0.25)]">
                <Sparkles className="size-5 text-violet-300" aria-hidden />
              </span>
              <span className="bg-gradient-to-r from-white via-violet-100 to-cyan-200 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                {content.siteTitle}
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-zinc-500">{content.tagline}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {content.quickLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur-md transition hover:border-violet-400/50 hover:bg-violet-500/15 hover:text-violet-100 hover:shadow-[0_0_20px_rgba(139,92,246,0.2)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300/90">
                <ShieldCheck className="size-3.5" aria-hidden />
                EU · RGPD
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/90">
                <Zap className="size-3.5" aria-hidden />
                3D Secure
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-8">
            {affisell ? <NavColumn title={affisell.title} links={affisell.links} accent="violet" /> : null}
            {legal ? <NavColumn title={legal.title} links={legal.links} accent="fuchsia" /> : null}
            {support ? <NavColumn title={support.title} links={support.links} accent="cyan" /> : null}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-black/40 to-cyan-950/30 p-5 backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,255,255,0.03)_50%,transparent_60%)]" aria-hidden />
            <div className="relative flex flex-wrap items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-xl border border-[#635BFF]/40 bg-[#635BFF]/10">
                <Lock className="size-5 text-[#635BFF]" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200/90">
                  {content.paymentTitle}
                </p>
                <p className="text-sm leading-relaxed text-zinc-400">{content.stripeNotice}</p>
                <p className="text-xs text-zinc-500">{content.vatNotice}</p>
              </div>
              <span
                className="inline-flex shrink-0 items-center rounded-lg border border-[#635BFF]/30 bg-black/50 px-3 py-1.5 text-sm font-bold tracking-tight text-[#635BFF]"
                role="img"
                aria-label="Stripe"
              >
                Stripe
              </span>
            </div>
          </div>
        </div>

        <div className="affisell-footer-future__legal mt-10 flex flex-col gap-3 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px] leading-relaxed text-zinc-600">
            {content.copyrightLine}{" "}
            <a
              href={content.odrHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 underline decoration-violet-500/40 underline-offset-2 transition hover:text-violet-300"
            >
              {content.odrLink}
            </a>
          </p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-zinc-700">
            Affisell · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  )
}
