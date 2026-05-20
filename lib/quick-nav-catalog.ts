import {
  AFFILIATE_AGENT_PATH,
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  PUBLIC_SHOPS_PATH,
} from "@/lib/affiliate-routes"

export type QuickNavSegment = "achat" | "vendre" | "compte"

export type QuickNavPersona = "guest" | "buyer" | "seller" | "affiliate"

export type QuickNavItem = {
  id: string
  segment: QuickNavSegment
  labelKey: string
  href: string
  keywords: string[]
}

type CatalogEntry = QuickNavItem & {
  hideForPersona?: QuickNavPersona[]
  showOnlyWhenLoggedIn?: boolean
  showOnlyWhenLoggedOut?: boolean
}

export const QUICK_NAV_SEGMENT_ORDER: QuickNavSegment[] = ["achat", "vendre", "compte"]

export const QUICK_NAV_SEGMENT_LABEL_KEYS: Record<QuickNavSegment, string> = {
  achat: "groups.buy",
  vendre: "groups.sell",
  compte: "groups.account",
}

function personaFromRole(role: string | undefined, loggedIn: boolean): QuickNavPersona {
  if (!loggedIn) return "guest"
  if (role === "CUSTOMER") return "buyer"
  if (role === "SUPPLIER") return "seller"
  if (role === "AFFILIATE") return "affiliate"
  return "guest"
}

const CATALOG: CatalogEntry[] = [
  {
    id: "home",
    segment: "achat",
    labelKey: "items.home",
    href: "/",
    keywords: ["home", "accueil"],
  },
  {
    id: "shops",
    segment: "achat",
    labelKey: "items.shops",
    href: PUBLIC_SHOPS_PATH,
    keywords: ["boutique", "créateur", "shop", "shops"],
  },
  {
    id: "browse",
    segment: "achat",
    labelKey: "items.marketplace",
    href: PUBLIC_MARKETPLACE_BROWSE_PATH,
    keywords: ["marketplace", "produit", "catalogue", "explorer"],
  },
  {
    id: "cart",
    segment: "achat",
    labelKey: "items.cart",
    href: "/cart",
    keywords: ["cart", "panier"],
    hideForPersona: ["seller"],
  },
  {
    id: "wishlist",
    segment: "achat",
    labelKey: "items.wishlist",
    href: "/wishlist",
    keywords: ["wishlist", "favoris"],
    hideForPersona: ["seller"],
  },
  {
    id: "sell-on-affisell",
    segment: "vendre",
    labelKey: "items.sellOnAffisell",
    href: "/signup/affiliate",
    keywords: ["vendre", "affilié", "créateur", "affisell"],
    hideForPersona: ["buyer"],
  },
  {
    id: "become-supplier",
    segment: "vendre",
    labelKey: "items.becomeSupplier",
    href: "/signup/supplier",
    keywords: ["fournisseur", "supplier", "b2b"],
    hideForPersona: ["buyer"],
  },
  {
    id: "supplier-dashboard",
    segment: "vendre",
    labelKey: "items.supplierDashboard",
    href: "/dashboard/supplier",
    keywords: ["dashboard", "mission", "fournisseur"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "supplier-products",
    segment: "vendre",
    labelKey: "items.supplierProducts",
    href: "/dashboard/supplier/products",
    keywords: ["produits", "catalogue"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "supplier-orders",
    segment: "vendre",
    labelKey: "items.supplierOrders",
    href: "/dashboard/supplier/orders",
    keywords: ["commandes", "orders"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "affiliate-dashboard",
    segment: "vendre",
    labelKey: "items.affiliateDashboard",
    href: "/dashboard/affiliate",
    keywords: ["dashboard", "affilié", "créateur"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "affiliate-catalog",
    segment: "vendre",
    labelKey: "items.affiliateCatalog",
    href: AFFILIATE_CATALOG_PATH,
    keywords: ["catalogue", "discover"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "affiliate-agent",
    segment: "vendre",
    labelKey: "items.affiliateAgent",
    href: AFFILIATE_AGENT_PATH,
    keywords: ["agent", "ia", "sourcing"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "affiliate-earnings",
    segment: "vendre",
    labelKey: "items.affiliateEarnings",
    href: "/dashboard/affiliate/earnings",
    keywords: ["revenus", "earnings"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "login-buyer",
    segment: "compte",
    labelKey: "items.loginBuyer",
    href: "/signup/customer?callbackUrl=/marketplace/account",
    keywords: ["connexion", "acheteur", "login", "compte"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "login-seller-account",
    segment: "compte",
    labelKey: "items.loginSeller",
    href: "/login/supplier",
    keywords: ["connexion", "vendeur", "fournisseur"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "create-buyer-account",
    segment: "compte",
    labelKey: "items.createBuyerAccount",
    href: "/signup/customer?callbackUrl=/marketplace",
    keywords: ["créer", "compte", "acheteur", "inscription"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "buyer-account",
    segment: "compte",
    labelKey: "items.buyerAccount",
    href: "/marketplace/account",
    keywords: ["compte", "espace", "client"],
    hideForPersona: ["guest", "seller", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "buyer-orders",
    segment: "compte",
    labelKey: "items.buyerOrders",
    href: "/marketplace/account/orders",
    keywords: ["commandes", "orders", "achats"],
    hideForPersona: ["guest", "seller", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "buyer-wallet",
    segment: "compte",
    labelKey: "items.buyerWallet",
    href: "/marketplace/account/wallet",
    keywords: ["portefeuille", "cashback", "wallet"],
    hideForPersona: ["guest", "seller", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
]

export function buildQuickNavCatalog(
  role: string | undefined,
  loggedIn: boolean
): QuickNavItem[] {
  const persona = personaFromRole(role, loggedIn)

  return CATALOG.filter((entry) => {
    if (entry.hideForPersona?.includes(persona)) return false
    if (entry.showOnlyWhenLoggedIn && !loggedIn) return false
    if (entry.showOnlyWhenLoggedOut && loggedIn) return false
    return true
  }).map(({ hideForPersona: _h, showOnlyWhenLoggedIn: _a, showOnlyWhenLoggedOut: _b, ...item }) => item)
}

export function groupQuickNavItems<T extends QuickNavItem>(
  items: T[],
  groupLabel: (segment: QuickNavSegment) => string
): Array<{ segment: QuickNavSegment; label: string; items: T[] }> {
  const out: Array<{ segment: QuickNavSegment; label: string; items: T[] }> = []
  for (const segment of QUICK_NAV_SEGMENT_ORDER) {
    const segmentItems = items.filter((i) => i.segment === segment)
    if (segmentItems.length === 0) continue
    out.push({ segment, label: groupLabel(segment), items: segmentItems })
  }
  return out
}
