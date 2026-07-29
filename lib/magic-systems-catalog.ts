/**
 * Affisell Magic Systems — client-safe directory of signature product systems.
 * Used by /lab and navigation. Keep hrefs real & stable.
 */

export type MagicSystemPersona = "supplier" | "affiliate" | "platform" | "buyer"

export type MagicSystemStatus = "live" | "beta" | "new"

export type MagicSystemEntry = {
  id: string
  persona: MagicSystemPersona
  /** i18n key under magicSystems.entries.{id}.* */
  titleKey: string
  blurbKey: string
  href: string
  status: MagicSystemStatus
  /** Accent token for UI chips */
  accent: "violet" | "emerald" | "cyan" | "amber" | "rose" | "sky"
  keywords: string[]
}

export const MAGIC_SYSTEMS_HREF = "/lab" as const
export const MAGIC_SYSTEMS_PRODUCT_NAME = "Magic Systems" as const

export const MAGIC_SYSTEMS_CATALOG: MagicSystemEntry[] = [
  {
    id: "affisellStock",
    persona: "supplier",
    titleKey: "affisellStock",
    blurbKey: "affisellStock",
    href: "/dashboard/supplier/supply#affisell-stock",
    status: "live",
    accent: "sky",
    keywords: ["stock", "warehouse", "native", "inventory", "affisell", "catalog"],
  },
  {
    id: "dropforge",
    persona: "supplier",
    titleKey: "dropforge",
    blurbKey: "dropforge",
    href: "/dropforge",
    status: "new",
    accent: "violet",
    keywords: ["dropforge", "import", "aliexpress", "1688", "scrape", "wholesale", "b2b"],
  },
  {
    id: "supplyHub",
    persona: "supplier",
    titleKey: "supplyHub",
    blurbKey: "supplyHub",
    href: "/dashboard/supplier/supply",
    status: "live",
    accent: "emerald",
    keywords: ["supply", "channels", "1688", "connectors"],
  },
  {
    id: "supplierImport",
    persona: "supplier",
    titleKey: "supplierImport",
    blurbKey: "supplierImport",
    href: "/dashboard/supplier/import",
    status: "live",
    accent: "cyan",
    keywords: ["csv", "url", "import", "bulk"],
  },
  {
    id: "radar",
    persona: "platform",
    titleKey: "radar",
    blurbKey: "radar",
    href: "/radar",
    status: "live",
    accent: "sky",
    keywords: ["radar", "arbitrage", "globe", "demand"],
  },
  {
    id: "pulse",
    persona: "affiliate",
    titleKey: "pulse",
    blurbKey: "pulse",
    href: "/discover",
    status: "live",
    accent: "rose",
    keywords: ["pulse", "discover", "swipe", "commerce"],
  },
  {
    id: "battle",
    persona: "affiliate",
    titleKey: "battle",
    blurbKey: "battle",
    href: "/dashboard/affiliate/hub?mode=battle",
    status: "beta",
    accent: "amber",
    keywords: ["battle", "flash", "discount", "dgccrf"],
  },
  {
    id: "swipeHub",
    persona: "affiliate",
    titleKey: "swipeHub",
    blurbKey: "swipeHub",
    href: "/dashboard/affiliate/hub?mode=swipe",
    status: "live",
    accent: "violet",
    keywords: ["swipe", "hub", "listing", "feed"],
  },
  {
    id: "brandStudio",
    persona: "affiliate",
    titleKey: "brandStudio",
    blurbKey: "brandStudio",
    href: "/dashboard/affiliate/brand-studio",
    status: "live",
    accent: "cyan",
    keywords: ["brand", "theme", "storefront"],
  },
  {
    id: "demoLab",
    persona: "platform",
    titleKey: "demoLab",
    blurbKey: "demoLab",
    href: "/demo",
    status: "live",
    accent: "emerald",
    keywords: ["demo", "lab", "try", "sandbox"],
  },
  {
    id: "auctions",
    persona: "buyer",
    titleKey: "auctions",
    blurbKey: "auctions",
    href: "/auctions",
    status: "live",
    accent: "amber",
    keywords: ["auction", "live", "bid"],
  },
  {
    id: "battlesHub",
    persona: "buyer",
    titleKey: "battlesHub",
    blurbKey: "battlesHub",
    href: "/battles",
    status: "new",
    accent: "rose",
    keywords: ["battle", "pulse", "vote", "flash", "duel", "hub"],
  },
  {
    id: "luxe",
    persona: "buyer",
    titleKey: "luxe",
    blurbKey: "luxe",
    href: "/luxe",
    status: "live",
    accent: "rose",
    keywords: ["luxe", "premium"],
  },
  {
    id: "pricingRadar",
    persona: "platform",
    titleKey: "pricingRadar",
    blurbKey: "pricingRadar",
    href: "/pricing?feature=radar",
    status: "live",
    accent: "sky",
    keywords: ["pricing", "radar", "subscription"],
  },
]

export type MagicSystemsFilter = "all" | MagicSystemPersona

export function filterMagicSystems(
  filter: MagicSystemsFilter,
  catalog: MagicSystemEntry[] = MAGIC_SYSTEMS_CATALOG
): MagicSystemEntry[] {
  if (filter === "all") return catalog
  return catalog.filter((e) => e.persona === filter)
}

export function magicSystemsForRole(
  role: string | undefined | null
): MagicSystemEntry[] {
  if (role === "SUPPLIER" || role === "ADMIN") {
    return MAGIC_SYSTEMS_CATALOG.filter(
      (e) => e.persona === "supplier" || e.persona === "platform"
    )
  }
  if (role === "AFFILIATE") {
    return MAGIC_SYSTEMS_CATALOG.filter(
      (e) => e.persona === "affiliate" || e.persona === "platform"
    )
  }
  /** Buyer + guest: only buyer-facing systems (no DropForge / Supply / Brand Studio). */
  return MAGIC_SYSTEMS_CATALOG.filter((e) => e.persona === "buyer")
}

/** Filter tabs visible for a session role. */
export function magicSystemsFiltersForRole(
  role: string | undefined | null
): MagicSystemsFilter[] {
  if (role === "SUPPLIER" || role === "ADMIN") {
    return ["supplier", "platform", "all"]
  }
  if (role === "AFFILIATE") {
    return ["affiliate", "platform", "all"]
  }
  return ["buyer"]
}

/** Pathname only — strips query + hash for route integrity checks. */
export function magicSystemPathname(href: string): string {
  const path = href.split("#")[0]?.split("?")[0]?.trim() || "/"
  return path.startsWith("/") ? path : `/${path}`
}

/** Known App Router pages for Magic Systems hrefs (no dynamic segments except verified). */
export const MAGIC_SYSTEM_ROUTE_FILES: Record<string, string> = {
  "/dashboard/supplier/supply": "app/dashboard/supplier/supply/page.tsx",
  "/dropforge": "app/dropforge/page.tsx",
  "/dashboard/supplier/import": "app/dashboard/supplier/import/page.tsx",
  "/radar": "app/radar/page.tsx",
  "/discover": "app/discover/page.tsx",
  "/dashboard/affiliate/hub": "app/dashboard/affiliate/hub/page.tsx",
  "/dashboard/affiliate/brand-studio": "app/dashboard/affiliate/brand-studio/page.tsx",
  "/demo": "app/demo/page.tsx",
  "/auctions": "app/auctions/page.tsx",
  "/battles": "app/battles/page.tsx",
  "/luxe": "app/luxe/page.tsx",
  "/pricing": "app/pricing/page.tsx",
  "/lab": "app/lab/page.tsx",
}
