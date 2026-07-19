"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { Radar, X } from "lucide-react"

import { parseSupplierKind } from "@/lib/supplier-kind"
import { cn } from "@/lib/utils"

export const RADAR_UNLOCK_BANNER_DISMISS_KEY = "affisell_radar_unlock_banner_dismissed_v1"

/**
 * Sticky top banner for SUPPLIER with unset supplierKind.
 * Never shown for Admin / Affiliate / already dismissed.
 */
export function RadarUnlockBanner() {
  const { data: session, status } = useSession()
  const pathname = usePathname() ?? ""
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status !== "authenticated") {
      setVisible(false)
      return
    }
    const role = String(session?.user?.role ?? "").toUpperCase()
    if (role !== "SUPPLIER") {
      setVisible(false)
      return
    }
    if (pathname.startsWith("/dashboard/admin") || pathname.startsWith("/admin")) {
      setVisible(false)
      return
    }
    if (pathname.startsWith("/dashboard/supplier/onboarding/kind")) {
      setVisible(false)
      return
    }
    try {
      if (localStorage.getItem(RADAR_UNLOCK_BANNER_DISMISS_KEY) === "1") {
        setVisible(false)
        return
      }
    } catch {
      /* private mode */
    }

    let cancelled = false
    void fetch("/api/supplier-profile/me", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { supplierKind?: unknown }
        const kind = parseSupplierKind(data.supplierKind)
        if (!cancelled) setVisible(kind === "unset")
      })
      .catch(() => {
        if (!cancelled) setVisible(false)
      })

    return () => {
      cancelled = true
    }
  }, [status, session?.user?.role, pathname])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(RADAR_UNLOCK_BANNER_DISMISS_KEY, "1")
    } catch {
      /* ignore */
    }
    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        "sticky top-0 z-40 border-b border-violet-400/40",
        "bg-gradient-to-r from-[#7C3AED] via-violet-600 to-indigo-700 text-white shadow-md"
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
        <Link
          href="/dashboard/supplier/onboarding/kind"
          className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium hover:underline"
        >
          <Radar className="size-4 shrink-0 opacity-90" aria-hidden />
          <span className="truncate">
            Nouveau: Débloque ton Radar adapté Producteur vs Stockeur →
          </span>
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          aria-label="Fermer"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
