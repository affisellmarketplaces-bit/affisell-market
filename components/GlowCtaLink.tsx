"use client"

import NextLink from "next/link"
import { motion } from "framer-motion"

import { Link as LocaleLink } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  children: React.ReactNode
  className?: string
  localeAware?: boolean
}

const btnClass =
  "group relative inline-flex rounded-2xl bg-[#6366F1] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-all duration-200 hover:bg-[#5558E3] hover:shadow-xl"

export function GlowCtaLink({ href, children, className, localeAware = false }: Props) {
  const inner = <span className="relative">{children}</span>

  return (
    <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }} className="inline-flex">
      {localeAware ? (
        <LocaleLink href={href} className={cn(btnClass, className)}>
          {inner}
        </LocaleLink>
      ) : (
        <NextLink href={href} className={cn(btnClass, className)}>
          {inner}
        </NextLink>
      )}
    </motion.div>
  )
}
