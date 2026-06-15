"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"

const SKIP_KEY = "affisell_graduated_shipsTo_skip"

type Props = {
  basePath: string
  enabled: boolean
}

/** Auto-apply shipsTo for visitors from permanently graduated ROW countries. */
export function MarketplaceGraduatedShipsToBootstrap({ basePath, enabled }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { country, graduatedCheckout, loading } = useVisitorCheckoutRegion()

  useEffect(() => {
    if (!enabled || loading) return
    if (!country || !graduatedCheckout) return
    if (searchParams.get("shipsTo")) return
    if (typeof window !== "undefined" && sessionStorage.getItem(SKIP_KEY) === "1") return

    const params = new URLSearchParams(searchParams.toString())
    params.set("shipsTo", country.toLowerCase())
    const qs = params.toString()
    const path = `${basePath}${qs ? `?${qs}` : ""}`
    router.replace(basePath === "/" ? `${path}#explorer` : path)
  }, [basePath, country, enabled, graduatedCheckout, loading, router, searchParams])

  return null
}

export function skipGraduatedShipsToAutoFilter(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SKIP_KEY, "1")
}
