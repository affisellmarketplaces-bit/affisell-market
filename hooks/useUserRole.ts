"use client"

import { useMemo } from "react"
import { useSession } from "next-auth/react"

export type UserRoleView = "buyer" | "seller" | "admin"

export function useUserRole(): UserRoleView {
  const { data: session } = useSession()

  return useMemo(() => {
    const rawRole = String(session?.user?.role ?? "").toUpperCase()
    if (rawRole === "ADMIN") return "admin"
    if (rawRole === "SUPPLIER" || rawRole === "SELLER" || rawRole === "AFFILIATE") {
      return "seller"
    }
    return "buyer"
  }, [session?.user?.role])
}
