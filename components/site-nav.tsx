"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"

import { NavAffiliate } from "@/components/nav/nav-affiliate"
import { NavPublic } from "@/components/nav/nav-public"
import { NavSupplier } from "@/components/nav/nav-supplier"
import { resolveMerchantNavRole } from "@/lib/site-nav-merchant-role"

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

  const merchantRole = resolveMerchantNavRole({
    pathname,
    status,
    sessionRole,
    hintRole,
  })

  if (merchantRole === "SUPPLIER") {
    return <NavSupplier />
  }

  if (merchantRole === "AFFILIATE") {
    return <NavAffiliate />
  }

  return <NavPublic />
}
