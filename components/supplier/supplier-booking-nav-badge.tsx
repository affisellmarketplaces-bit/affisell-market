"use client"

import { useEffect, useState, type ReactNode } from "react"

type Props = {
  children: (count: number) => ReactNode
}

export function SupplierBookingNavBadge({ children }: Props) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/supplier/booking/pending-count", { cache: "no-store" })
        if (!res.ok || cancelled) return
        const json = (await res.json()) as { count?: number }
        if (!cancelled) setCount(Math.max(0, json.count ?? 0))
      } catch {
        // non-blocking nav badge
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return <>{children(count)}</>
}
