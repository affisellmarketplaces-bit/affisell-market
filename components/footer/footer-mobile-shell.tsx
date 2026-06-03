"use client"

import Link from "next/link"
import { useState } from "react"
import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react"

import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  content: FooterGlobalContent
}

function StripeBadge() {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-lg border border-violet-500/30 bg-violet-950/50 px-2.5 py-1"
      role="img"
      aria-label="Stripe"
    >
      <span className="text-sm font-bold tracking-tight text-[#635BFF]">Stripe</span>
    </span>
  )
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
    <div className="border-b border-white/[0.08]">
      <button
        type="button"
        id={`footer-trigger-${section.id}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">
          {section.title}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-violet-400 transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <ul id={panelId} role="list" className="space-y-2.5 pb-4 pl-0.5">
          {section.links.map((link) => (
            <li key={link.href + link.label}>
              <Link
                href={link.href}
                className="text-sm text-zinc-400 transition hover:text-violet-200"
              >
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
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-32 bg-[radial-gradient(ellipse_80%_60%_at_50%_100%,rgba(139,92,246,0.22),transparent)]"
        aria-hidden
      />

      <div className="relative border-t border-white/[0.06] bg-gradient-to-b from-zinc-950 via-[#07070d] to-black px-4 pt-8 text-zinc-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/" className="inline-block">
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-sky-300 bg-clip-text text-xl font-bold text-transparent">
                {content.siteTitle}
              </span>
            </Link>
            <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-zinc-500">{content.tagline}</p>
          </div>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {content.quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-zinc-200 backdrop-blur-sm transition hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-100"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl">
          {content.sections.map((section) => (
            <FooterAccordion
              key={section.id}
              section={section}
              open={openId === section.id}
              onToggle={() => setOpenId((prev) => (prev === section.id ? null : section.id))}
            />
          ))}
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-3">
          <StripeBadge />
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/90">
              {content.paymentTitle}
            </p>
            <p className="text-[11px] leading-snug text-zinc-400">{content.stripeNoticeShort}</p>
          </div>
        </div>

        <p className="affisell-site-footer__pad mt-5 pb-0 text-center text-[10px] leading-relaxed text-zinc-600">
          {content.copyrightLine}{" "}
          <a
            href={content.odrHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-zinc-500 underline underline-offset-2 transition hover:text-violet-300"
          >
            {content.odrLink}
            <ExternalLink className="size-2.5" aria-hidden />
          </a>
        </p>
      </div>
    </div>
  )
}
