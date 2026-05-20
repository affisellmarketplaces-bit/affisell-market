"use client"

import NextLink from "next/link"
import type { LucideIcon } from "lucide-react"

import { Link as LocaleLink } from "@/i18n/navigation"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  /** Shorter label below `xl` when the bar is tight. */
  shortLabel?: string
  active?: boolean
  icon?: LucideIcon
  className?: string
  /** Prefix with /en or /fr (marketing routes only). */
  localeAware?: boolean
}

export function NavPill({
  href,
  label,
  shortLabel,
  active = false,
  icon: Icon,
  className,
  localeAware = false,
}: Props) {
  const classNames = cn(
    "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 lg:px-3.5",
    active
      ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
    localeAware && !active && "hover:underline decoration-[#6366F1] decoration-2 underline-offset-4",
    className
  )

  const content = (
    <>
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
      {shortLabel ? (
        <>
          <span className="xl:hidden">{shortLabel}</span>
          <span className="hidden xl:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </>
  )

  if (localeAware) {
    return (
      <LocaleLink href={href} className={classNames} aria-current={active ? "page" : undefined}>
        {content}
      </LocaleLink>
    )
  }

  return (
    <NextLink href={href} className={classNames} aria-current={active ? "page" : undefined}>
      {content}
    </NextLink>
  )
}
