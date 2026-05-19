"use client"

import type { LucideIcon } from "lucide-react"

import { FastLink } from "@/components/navigation/fast-link"
import { cn } from "@/lib/utils"

type Props = {
  href: string
  label: string
  active?: boolean
  icon?: LucideIcon
  className?: string
}

export function NavPill({ href, label, active = false, icon: Icon, className }: Props) {
  return (
    <FastLink
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-150",
        active
          ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20 dark:bg-white dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white",
        className
      )}
      aria-current={active ? "page" : undefined}
    >
      {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden /> : null}
      {label}
    </FastLink>
  )
}
