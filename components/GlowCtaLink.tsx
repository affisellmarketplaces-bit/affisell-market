"use client"

import NextLink from "next/link"
import { useCallback } from "react"

import { Link as LocaleLink, useRouter } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  children: React.ReactNode
  className?: string
  localeAware?: boolean
}

const btnClass =
  "affisell-premium-cta affisell-fast-link group relative inline-flex rounded-[1.35rem] px-8 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"

export function GlowCtaLink({ href, children, className, localeAware = false }: Props) {
  const router = useRouter()
  const warm = useCallback(() => {
    if (href.startsWith("/#")) return
    try {
      router.prefetch(href)
    } catch {
      /* ignore */
    }
  }, [router, href])

  const inner = <span className="relative">{children}</span>
  const linkClass = cn(btnClass, className)

  if (localeAware) {
    return (
      <LocaleLink
        href={href}
        prefetch
        onMouseEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        className={linkClass}
      >
        {inner}
      </LocaleLink>
    )
  }

  if (href.startsWith("/#")) {
    return (
      <a href={href} className={linkClass}>
        {inner}
      </a>
    )
  }

  return (
    <NextLink
      href={href}
      prefetch
      onMouseEnter={warm}
      onFocus={warm}
      onTouchStart={warm}
      className={linkClass}
    >
      {inner}
    </NextLink>
  )
}
