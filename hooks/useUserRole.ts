"use client"

import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import { useMemo } from "react"

import { resolveUserRole, type UserRole } from "@/lib/user-role"

/**
 * Effective UI role from next-auth session + current URL path.
 * Shop routes always resolve to `customer`.
 */
export function useUserRole(): UserRole {
  const pathname = usePathname()
  const { data: session, status } = useSession()

  return useMemo(() => {
    if (status === "loading") {
      return "customer"
    }

    return (
      resolveUserRole({
        sessionRole: session?.user?.role ?? null,
        pathname,
      }) ?? "customer"
    )
  }, [pathname, session?.user?.role, status])
}
