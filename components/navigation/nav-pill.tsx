"use client"

import NextLink from "next/link"
import type { LucideIcon } from "lucide-react"
import { useCallback } from "react"

import { Link as LocaleLink, useRouter as useLocaleRouter } from "@/i18n/navigation"
import { normalizePrefetchHref } from "@/lib/prefetch-href.client"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  /** Shorter label below `xl` when the bar is tight. */
  shortLabel?: string
  active?: boolean
  /** Visual treatment when `active` — `brand` is softer (public buyer nav). */
  activeVariant?: "solid" | "brand"
  icon?: LucideIcon
  className?: string
  /** Prefix with /en or /fr (marketing routes only). */
  localeAware?: boolean
  /** Optional count badge (e.g. pending booking check-ins). */
  badgeCount?: number
}

export function NavPill({
  href,
  label,
  shortLabel,
  active = false,
  activeVariant = "solid",
  icon: Icon,
  className,
  localeAware = false,
  badgeCount = 0,
}: Props) {
  const localeRouter = useLocaleRouter()
  const warm = useCallback(() => {
    const path = normalizePrefetchHref(href)
    if (!path) return
    try {
      localeRouter.prefetch(path)
    } catch {
      /* ignore */
    }
  }, [href, localeRouter])

  const classNames = cn(
    "affisell-fast-link relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 lg:px-3.5",
    active && activeVariant === "solid"
      ? "bg-zinc-900 text-white shadow-md dark:bg-white dark:text-zinc-900"
      : active && activeVariant === "brand"
        ? "bg-violet-100 text-violet-900 shadow-sm ring-1 ring-violet-200/70 dark:bg-violet-950/45 dark:text-violet-100 dark:ring-violet-500/35"
        : "text-zinc-600 hover:bg-zinc-100/90 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800/90",
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
      {badgeCount > 0 ? (
        <span className="ml-0.5 rounded-full bg-cyan-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </>
  )

  const prefetchHandlers = {
    prefetch: true as const,
    onMouseEnter: warm,
    onFocus: warm,
    onTouchStart: warm,
  }

  if (localeAware) {
    return (
      <LocaleLink
        href={href}
        className={classNames}
        aria-current={active ? "page" : undefined}
        {...prefetchHandlers}
      >
        {content}
      </LocaleLink>
    )
  }

  return (
    <NextLink
      href={href}
      className={classNames}
      aria-current={active ? "page" : undefined}
      {...prefetchHandlers}
    >
      {content}
    </NextLink>
  )
}
