"use client"

import NextLink from "next/link"
import { motion } from "framer-motion"
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
  "affisell-premium-cta group relative inline-flex rounded-[1.35rem] px-8 py-3.5 text-base font-semibold text-white transition-all duration-200"

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
  const linkClass = cn(btnClass, "affisell-fast-link", className)

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.15 }} className="inline-flex">
      {localeAware ? (
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
      ) : href.startsWith("/#") ? (
        <a href={href} className={linkClass}>
          {inner}
        </a>
      ) : (
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
      )}
    </motion.div>
  )
}
