"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

type Props = {
  children: ReactNode
  /** Refresh server data on tab focus (live metrics). */
  refreshOnFocus?: boolean
}

export function SupplierMissionControlLive({ children, refreshOnFocus = true }: Props) {
  const router = useRouter()

  useEffect(() => {
    if (!refreshOnFocus) return
    const onFocus = () => router.refresh()
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [router, refreshOnFocus])

  return <>{children}</>
}
