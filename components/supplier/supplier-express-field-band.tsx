"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

type Props = {
  children: ReactNode
  required?: boolean
  className?: string
}

/** Bandeau violet (express product form) — aligné Add photos & catégories suggérées. */
export function SupplierExpressFieldBand({ children, required, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm",
        className
      )}
    >
      {required ? (
        <span className="text-violet-200" aria-hidden>
          *
        </span>
      ) : null}
      {children}
    </span>
  )
}
