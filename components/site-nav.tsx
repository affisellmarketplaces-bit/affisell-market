"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { NavAffiliate } from "@/components/nav/nav-affiliate"
import { NavPublic } from "@/components/nav/nav-public"
import { NavSupplier } from "@/components/nav/nav-supplier"

type Props = {
  /** SSR hint from `auth()` to avoid affiliate nav flash on public pages. */
  initialRole?: string | null
}

function normalizeRole(role: string | null | undefined): "AFFILIATE" | "SUPPLIER" | "CUSTOMER" | null {
  if (!role) return null
  const r = role.trim().toUpperCase()
  if (r === "AFFILIATE" || r === "SUPPLIER" || r === "CUSTOMER") return r
  return null
}

export function SiteNav({ initialRole = null }: Props) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  const isAuthRoute =
    pathname?.startsWith("/auth/") ||
    pathname === "/login" ||
    pathname?.startsWith("/login/") ||
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/onboarding/")
  const isShopStorefront = pathname === "/shops" || pathname?.startsWith("/shops/")

  if (isShopStorefront || isAuthRoute) {
    return null
  }

  const sessionRole = normalizeRole(session?.user?.role)
  const hintRole = normalizeRole(initialRole)
  const role = status === "loading" ? (sessionRole ?? hintRole) : sessionRole

  if (role === "SUPPLIER") {
    return <NavSupplier />
  }

  if (role === "AFFILIATE") {
    const onDashboard = Boolean(pathname?.startsWith("/dashboard/affiliate"))
    return <NavAffiliate showDashboardActions={onDashboard} />
  }

  return <NavPublic />
}
