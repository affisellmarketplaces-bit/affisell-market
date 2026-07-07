"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"

import { FooterLocaleChip } from "@/components/footer/footer-locale-chip"
import type { FooterGlobalContent } from "@/lib/footer-global-sections"
import { cn } from "@/lib/utils"

type Props = {
  content: Pick<FooterGlobalContent, "legalBar" | "copyrightLine" | "odrLink" | "odrHref" | "localeLabel">
  className?: string
}

export function FooterLegalBar({ content, className }: Props) {
  return (
    <div className={cn("space-y-4", className)}>
      <nav
        aria-label="Legal"
        className="-mx-1 flex gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {content.legalBar.map((link) => (
          <Link
            key={link.href + link.label}
            href={link.href}
            className="affisell-premium-legal-chip inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[11px] font-medium text-violet-100/90 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </nav>

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
