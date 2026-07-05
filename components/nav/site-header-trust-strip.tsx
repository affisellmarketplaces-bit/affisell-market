"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"

import { PublicNavTrustStrip } from "@/components/nav/public-nav-trust-strip"
import { shouldShowPublicTrustStrip } from "@/lib/public-nav-mode"

/** Trust band above the glass nav shell — avoids mobile overflow clipping. */
export function SiteHeaderTrustStrip() {
  const pathname = usePathname()
  const visible = useMemo(() => shouldShowPublicTrustStrip(pathname), [pathname])

  return (
    <PublicNavTrustStrip
      visible={visible}
      className="affisell-site-header-trust-strip rounded-t-2xl border-t-0"
    />
  )
}
