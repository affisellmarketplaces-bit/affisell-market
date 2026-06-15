"use client"

import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useLocale, useTranslations } from "next-intl"
import { toast } from "sonner"

import { useVisitorCheckoutRegion } from "@/hooks/use-visitor-checkout-region"
import { visitorCountryDisplayName } from "@/lib/visitor-country"

const SKIP_KEY = "affisell_graduated_shipsTo_skip"
const TOAST_KEY = "affisell_graduated_shipsTo_toast"

type Props = {
  basePath: string
  enabled: boolean
}

/** Auto-apply shipsTo for visitors from permanently graduated ROW countries. */
export function MarketplaceGraduatedShipsToBootstrap({ basePath, enabled }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = useLocale()
  const t = useTranslations("marketplace.browse")
  const { country, graduatedCheckout, loading } = useVisitorCheckoutRegion()
  const toastShownRef = useRef(false)

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

    if (
      !toastShownRef.current &&
      typeof window !== "undefined" &&
      sessionStorage.getItem(TOAST_KEY) !== "1"
    ) {
      toastShownRef.current = true
      sessionStorage.setItem(TOAST_KEY, "1")
      const countryName = visitorCountryDisplayName(country, locale)
      toast.message(t("graduatedShipsToToast", { country: countryName }), {
        description: t("graduatedShipsToToastBody"),
      })
      console.log("[offer-rail]", {
        action: "graduated_shipsTo_auto",
        country,
        path: basePath,
      })
    }
  }, [basePath, country, enabled, graduatedCheckout, loading, locale, router, searchParams, t])

  return null
}

export function skipGraduatedShipsToAutoFilter(): void {
  if (typeof window === "undefined") return
  sessionStorage.setItem(SKIP_KEY, "1")
  sessionStorage.setItem(TOAST_KEY, "1")
}
