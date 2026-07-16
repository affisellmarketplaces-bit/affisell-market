"use client"

import type { ReactNode } from "react"

import { useViewportRoutePrefetch } from "@/hooks/use-viewport-route-prefetch"

type Props = {
  children: ReactNode
  max?: number
  className?: string
}

/** Warms visible product links before the shopper taps (home grid, shop catalog). */
export function CatalogGridPrefetch({ children, max = 24, className }: Props) {
  const ref = useViewportRoutePrefetch<HTMLDivElement>({ max })
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
