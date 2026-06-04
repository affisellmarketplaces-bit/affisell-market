/** URL CGU/CGA/CGS affichée sur le dashboard Stripe Connect du marchand. */
export function stripeConnectBusinessUrl(role: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")?.trim() || "https://affisell.com"
  if (role === "SUPPLIER") {
    return `${base}/conditions-fournisseur`
  }
  return `${base}/conditions-affilie`
}

export function stripeConnectReturnUrls(role: string): { refresh_url: string; return_url: string } {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")?.trim() || "https://affisell.com"
  const path = role === "SUPPLIER" ? "/dashboard/supplier" : "/dashboard/affiliate"
  return {
    refresh_url: `${base}${path}?stripe=refresh`,
    return_url: `${base}${path}?stripe=return`,
  }
}
