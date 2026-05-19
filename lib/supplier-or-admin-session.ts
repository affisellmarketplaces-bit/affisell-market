import type { Session } from "next-auth"

import { auth } from "@/auth"

export function isSupplierOrAdminRole(role: string | undefined | null): boolean {
  return role === "SUPPLIER" || role === "ADMIN"
}

/** Supplier dashboard routes; ADMIN may impersonate integrations. */
export async function requireSupplierOrAdminSession(): Promise<Session | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!isSupplierOrAdminRole(session.user.role)) return null
  return session
}
