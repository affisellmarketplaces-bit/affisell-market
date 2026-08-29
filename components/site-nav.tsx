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

/** Prefer dashboard path while session is loading — avoids wrong nav + notification API. */
function roleFromDashboardPath(pathname: string | null): "AFFILIATE" | "SUPPLIER" | null {
  if (!pathname) return null
  if (pathname.startsWith("/dashboard/affiliate") || pathname.startsWith("/dashboard/reseller")) {
    return "AFFILIATE"
  }
  if (pathname.startsWith("/dashboard/supplier")) return "SUPPLIER"
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
  /** Individual creator storefront (`/shops/:slug`), not directory or browse. */
  const isCreatorStorefront =
    pathname?.startsWith("/shops/") &&
    !pathname.startsWith("/shops/browse")
  const isResellerBoutique = pathname?.startsWith("/boutique/")

  if (isCreatorStorefront || isAuthRoute || isResellerBoutique) {
    return null
  }

  const sessionRole = normalizeRole(session?.user?.role)
  const hintRole = normalizeRole(initialRole)
  const pathRole = roleFromDashboardPath(pathname)

  /** Dashboard URL wins over JWT role — avoids supplier bell polling on affiliate routes. */
  const merchantRole =
    status === "unauthenticated"
      ? null
      : status === "loading"
        ? (pathRole ?? sessionRole ?? hintRole)
        : (pathRole ?? sessionRole)

  if (merchantRole === "SUPPLIER") {
    return <NavSupplier />
  }

  if (merchantRole === "AFFILIATE") {
    return <NavAffiliate />
  }

  return <NavPublic />
}
