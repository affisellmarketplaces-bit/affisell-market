import type { LoginPortal } from "@/lib/auth-login-portal"

export function forgotPasswordHref(portal?: LoginPortal | null): string {
  if (portal === "AFFILIATE") return "/auth/forgot-password?portal=affiliate"
  if (portal === "SUPPLIER") return "/auth/forgot-password?portal=supplier"
  if (portal === "AGENT") return "/auth/forgot-password?portal=agent"
  return "/auth/forgot-password"
}
