"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type Props = Omit<ComponentProps<typeof Link>, "className"> & {
  children: React.ReactNode
  className?: string
  accent?: string
}

/** Triangular futuristic nav chip for « All stores » directory links. */
export function AllStoresTriangleBadge({
  children,
  className,
  accent = "#7c3aed",
  ...linkProps
}: Props) {
  return (
    <Link
      {...linkProps}
      className={cn(
        "affisell-all-stores-triangle group inline-flex items-center text-sm font-bold uppercase tracking-[0.12em] text-white no-underline transition hover:brightness-110",
        className
      )}
      style={{ "--badge-accent": accent } as React.CSSProperties}
    >
      <span className="affisell-all-stores-triangle__shape" aria-hidden />
      <span className="affisell-all-stores-triangle__label relative z-[1] px-4 py-2 pl-5">
        {children}
      </span>
    </Link>
  )
}
