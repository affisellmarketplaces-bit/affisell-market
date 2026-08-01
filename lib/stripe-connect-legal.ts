import { resolvePublicAppUrl } from "@/lib/public-app-url"

function connectAppBase(): string {
  return resolvePublicAppUrl().replace(/\/$/, "")
}

/** URL CGU/CGA/CGS affichée sur le dashboard Stripe Connect du marchand. */
export function stripeConnectBusinessUrl(role: string): string {
  const base = connectAppBase()
  if (role === "SUPPLIER") {
    return `${base}/conditions-fournisseur`
  }
  if (role === "AGENT") {
    return `${base}/conditions-affilie`
  }
  return `${base}/conditions-affilie`
}

export function stripeConnectReturnUrls(role: string): { refresh_url: string; return_url: string } {
  const base = connectAppBase()
  const path =
    role === "SUPPLIER"
      ? "/dashboard/supplier/balance"
      : role === "AGENT"
        ? "/dashboard/agent"
        : "/dashboard/affiliate/earnings"
  return {
    refresh_url: `${base}${path}?stripe=refresh`,
    return_url: `${base}${path}?stripe=return`,
  }
}
