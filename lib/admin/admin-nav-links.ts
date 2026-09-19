/** Admin back-office navigation: single source for the desktop bar and the mobile drawer. */

export type AdminNavGroupId = "pilotage" | "operations" | "finance" | "supply" | "engineering" | "legal"

export type AdminNavLink = { href: string; label: string; group: AdminNavGroupId }

export const ADMIN_NAV_GROUPS: { id: AdminNavGroupId; label: string }[] = [
  { id: "pilotage", label: "Pilotage" },
  { id: "operations", label: "Opérations" },
  { id: "finance", label: "Finance & paiements" },
  { id: "supply", label: "Catalogue & supply" },
  { id: "engineering", label: "Ingénierie" },
  { id: "legal", label: "Juridique & conformité" },
]

export const ADMIN_NAV_LINKS: readonly AdminNavLink[] = [
  { href: "/admin/expansion", label: "Expansion", group: "pilotage" },
  { href: "/admin/terminal", label: "Terminal", group: "pilotage" },
  { href: "/admin/sentinel", label: "Sentinel", group: "pilotage" },
  { href: "/admin/radar", label: "Radar", group: "pilotage" },
  { href: "/admin/kyc", label: "KYC", group: "operations" },
  { href: "/admin/support", label: "Support", group: "operations" },
  { href: "/admin/returns", label: "Retours", group: "operations" },
  { href: "/admin/auto-fulfill", label: "Auto-Fulfill", group: "supply" },
  { href: "/admin/products/new", label: "Produit AE", group: "supply" },
  { href: "/admin/orders", label: "Commandes", group: "operations" },
  { href: "/admin/providers", label: "Fournisseurs API", group: "supply" },
  { href: "/admin/supply-lab", label: "Supply Lab", group: "supply" },
  { href: "/admin/agents", label: "Agents", group: "pilotage" },
  { href: "/admin/stripe-health", label: "Stripe", group: "finance" },
  { href: "/admin/suppliers/lightning", label: "Lightning", group: "supply" },
  { href: "/admin/queues", label: "Queues", group: "pilotage" },
  { href: "/admin/splits", label: "Splits", group: "finance" },
  { href: "/admin/settings/commission-rates", label: "Taux commission", group: "finance" },
  { href: "/admin/reviews", label: "Avis", group: "operations" },
  { href: "/crm", label: "CRM", group: "operations" },
  { href: "/admin/ing", label: "Ing Ops", group: "engineering" },
  { href: "/dashboard/admin/ing", label: "Ing AI", group: "engineering" },
  { href: "/dashboard/admin/legal", label: "Avocat", group: "legal" },
  { href: "/dashboard/admin/leads", label: "Leads", group: "operations" },
  { href: "/dashboard/admin/product-funnel", label: "Funnel produit", group: "pilotage" },
  { href: "/admin/instantscan-performance", label: "InstantScan", group: "pilotage" },
  { href: "/admin/rgpd-registre", label: "RGPD", group: "legal" },
  { href: "/admin/terms-logs", label: "Consentements", group: "legal" },
]

/** Sections whose parent link stays highlighted on nested pages. */
export function isAdminNavActive(href: string, pathname: string): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) {
    // Auto-Fulfill owns /admin/products/*, "Produit AE" owns /admin/products/new only.
    return true
  }
  return href === "/admin/auto-fulfill" && pathname.startsWith("/admin/products")
}

export function adminNavCurrent(pathname: string): AdminNavLink | null {
  const exact = ADMIN_NAV_LINKS.find((l) => pathname === l.href)
  if (exact) return exact
  // Longest matching prefix wins (/admin/suppliers/lightning before nothing shorter).
  return (
    [...ADMIN_NAV_LINKS]
      .filter((l) => isAdminNavActive(l.href, pathname))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? null
  )
}
