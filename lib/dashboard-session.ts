import { redirect } from "next/navigation"

import { safeAuth } from "@/lib/safe-auth"
import {
  loginAffiliatePath,
  loginAgentPath,
  loginSelectorPath,
  loginSupplierPath,
} from "@/lib/login-redirect"

type AuthSession = NonNullable<Awaited<ReturnType<typeof safeAuth>>>

export async function requireAffiliateSession(callbackPath?: string): Promise<AuthSession> {
  const session = await safeAuth()
  if (!session?.user?.id) {
    redirect(loginAffiliatePath(callbackPath))
  }
  const role = session.user.role
  if (role === "SUPPLIER") redirect("/dashboard/supplier")
  if (role === "CUSTOMER") redirect("/shops")
  if (role !== "AFFILIATE") {
    redirect(loginAffiliatePath(callbackPath))
  }
  return session
}

export async function requireSupplierSession(callbackPath?: string): Promise<AuthSession> {
  const session = await safeAuth()
  if (!session?.user?.id) {
    redirect(loginSupplierPath(callbackPath))
  }
  if (session.user.role !== "SUPPLIER") {
    redirect("/dashboard")
  }
  return session
}

export async function requireAgentSession(callbackPath?: string): Promise<AuthSession> {
  const session = await safeAuth()
  if (!session?.user?.id) {
    redirect(loginAgentPath(callbackPath))
  }
  if (session.user.role !== "AGENT") {
    redirect("/dashboard")
  }
  return session
}

/** Any signed-in merchant (affiliate or supplier). */
export async function requireMerchantSession(callbackPath?: string): Promise<AuthSession> {
  const session = await safeAuth()
  if (!session?.user?.id) {
    redirect(loginSelectorPath(callbackPath))
  }
  const role = session.user.role
  if (role !== "AFFILIATE" && role !== "SUPPLIER") {
    redirect(loginSelectorPath(callbackPath))
  }
  return session
}
