"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { FooterLocaleChip } from "@/components/footer/footer-locale-chip"
import { FooterScrollRail } from "@/components/footer/footer-scroll-rail"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  content: Pick<FooterGlobalContent, "legalBar" | "copyrightLine" | "odrLink" | "odrHref" | "localeLabel">
  className?: string
}

export function FooterLegalBar({ content, className }: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <FooterScrollRail ariaLabel="Legal" density="compact" className="-mx-1 px-1">
        {content.legalBar.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="affisell-premium-legal-chip inline-flex shrink-0 snap-start items-center rounded-full px-2.5 py-1.5 text-[10px] font-medium tracking-wide text-violet-100/90 transition hover:border-white/30 hover:bg-white/10 hover:text-white sm:px-3 sm:text-[11px]"
          >
            {link.label}
          </Link>
        ))}
      </FooterScrollRail>

      <div className="flex flex-col gap-4 border-t border-white/15 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-[10px] leading-relaxed text-violet-100/68 sm:text-[11px]">
          {content.copyrightLine}{" "}
          <a
            href={content.odrHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-zinc-300 underline decoration-[#8B5CF6]/50 underline-offset-2 transition hover:text-white"
          >
            {content.odrLink}
            <ExternalLink className="size-2.5" aria-hidden />
          </a>
        </p>
        <FooterLocaleChip label={content.localeLabel} />
      </div>
    </div>
  )
}
