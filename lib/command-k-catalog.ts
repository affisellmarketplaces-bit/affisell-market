import {
  AFFILIATE_CATALOG_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  PUBLIC_SHOPS_PATH,
} from "@/lib/affiliate-routes"

export type CommandKSegment = "buy" | "sell" | "account"

export type CommandKPersona = "guest" | "buyer" | "seller" | "affiliate"

export type CommandKAction = "navigate" | "signOut"

export type CommandKItem = {
  id: string
  segment: CommandKSegment
  labelKey: string
  action: CommandKAction
  href?: string
  keywords: string[]
}

type CatalogEntry = CommandKItem & {
  hideForPersona?: CommandKPersona[]
  showOnlyWhenLoggedIn?: boolean
  showOnlyWhenLoggedOut?: boolean
}

export const COMMAND_K_SEGMENT_ORDER: CommandKSegment[] = ["buy", "sell", "account"]

export const COMMAND_K_SEGMENT_LABEL_KEYS: Record<CommandKSegment, string> = {
  buy: "groups.buy",
  sell: "groups.sell",
  account: "groups.account",
}

function personaFromRole(role: string | undefined, loggedIn: boolean): CommandKPersona {
  if (!loggedIn) return "guest"
  if (role === "CUSTOMER") return "buyer"
  if (role === "SUPPLIER") return "seller"
  if (role === "AFFILIATE") return "affiliate"
  return "guest"
}

function settingsHref(role: string | undefined): string {
  if (role === "SUPPLIER") return "/dashboard/supplier/settings/store"
  if (role === "AFFILIATE") return "/dashboard/affiliate/settings/store"
  return "/dashboard/settings/account"
}

const CATALOG: CatalogEntry[] = [
  {
    id: "home",
    segment: "buy",
    labelKey: "items.home",
    action: "navigate",
    href: "/",
    keywords: ["home", "accueil"],
  },
  {
    id: "marketplace",
    segment: "buy",
    labelKey: "items.marketplace",
    action: "navigate",
    href: PUBLIC_MARKETPLACE_BROWSE_PATH,
    keywords: ["marketplace", "catalog", "shop"],
  },
  {
    id: "creator-stores",
    segment: "buy",
    labelKey: "items.creatorStores",
    action: "navigate",
    href: PUBLIC_SHOPS_PATH,
    keywords: ["creator", "shops", "boutique", "stores"],
  },
  {
    id: "cart",
    segment: "buy",
    labelKey: "items.cart",
    action: "navigate",
    href: "/cart",
    keywords: ["cart", "panier"],
    hideForPersona: ["seller"],
  },
  {
    id: "wishlist",
    segment: "buy",
    labelKey: "items.wishlist",
    action: "navigate",
    href: "/wishlist",
    keywords: ["wishlist", "favoris", "favorites"],
    hideForPersona: ["seller"],
  },
  {
    id: "auctions",
    segment: "buy",
    labelKey: "items.auctions",
    action: "navigate",
    href: "/auctions",
    keywords: ["auction", "enchères", "bid", "live", "arena", "arène"],
    hideForPersona: ["seller"],
  },
  {
    id: "become-seller",
    segment: "sell",
    labelKey: "items.becomeSeller",
    action: "navigate",
    href: "/signup/affiliate?role=creator",
    keywords: ["sell", "seller", "affiliate", "creator", "vendre"],
    hideForPersona: ["seller", "affiliate"],
  },
  {
    id: "analytics-affiliate",
    segment: "sell",
    labelKey: "items.analytics",
    action: "navigate",
    href: "/dashboard/affiliate",
    keywords: ["analytics", "stats"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "payouts-affiliate",
    segment: "sell",
    labelKey: "items.payouts",
    action: "navigate",
    href: "/dashboard/affiliate/earnings",
    keywords: ["payouts", "earnings", "money"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "analytics-supplier",
    segment: "sell",
    labelKey: "items.analytics",
    action: "navigate",
    href: "/dashboard/supplier",
    keywords: ["analytics", "stats"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "payouts-supplier",
    segment: "sell",
    labelKey: "items.payouts",
    action: "navigate",
    href: "/dashboard/supplier/balance",
    keywords: ["payouts", "balance"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "seller-dashboard",
    segment: "sell",
    labelKey: "items.sellerDashboard",
    action: "navigate",
    href: "/dashboard/supplier",
    keywords: ["dashboard", "supplier", "seller"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "list-product",
    segment: "sell",
    labelKey: "items.listProduct",
    action: "navigate",
    href: "/dashboard/supplier/products/new",
    keywords: ["product", "list", "new", "catalog"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "my-sales-supplier",
    segment: "sell",
    labelKey: "items.mySales",
    action: "navigate",
    href: "/dashboard/supplier/orders",
    keywords: ["sales", "orders", "commandes"],
    hideForPersona: ["buyer", "guest", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "affiliate-dashboard",
    segment: "sell",
    labelKey: "items.sellerDashboard",
    action: "navigate",
    href: "/dashboard/affiliate",
    keywords: ["dashboard", "creator", "affiliate"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "list-product-affiliate",
    segment: "sell",
    labelKey: "items.listProduct",
    action: "navigate",
    href: AFFILIATE_CATALOG_PATH,
    keywords: ["catalog", "list", "products"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "my-sales-affiliate",
    segment: "sell",
    labelKey: "items.mySales",
    action: "navigate",
    href: "/dashboard/affiliate/earnings",
    keywords: ["sales", "earnings", "revenus"],
    hideForPersona: ["buyer", "guest", "seller"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "sign-in",
    segment: "account",
    labelKey: "items.signIn",
    action: "navigate",
    href: "/login",
    keywords: ["sign in", "login", "connexion"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "create-buyer-account",
    segment: "account",
    labelKey: "items.createBuyerAccount",
    action: "navigate",
    href: "/signup/customer?callbackUrl=/marketplace",
    keywords: ["buyer", "account", "register", "signup"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "become-partner",
    segment: "account",
    labelKey: "items.becomePartner",
    action: "navigate",
    href: "/signup/supplier?role=supplier",
    keywords: ["partner", "supplier", "brand", "fournisseur"],
    hideForPersona: ["seller"],
    showOnlyWhenLoggedOut: true,
  },
  {
    id: "my-orders",
    segment: "account",
    labelKey: "items.myOrders",
    action: "navigate",
    href: "/marketplace/account/orders",
    keywords: ["orders", "commandes", "purchases"],
    hideForPersona: ["guest", "seller", "affiliate"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "settings",
    segment: "account",
    labelKey: "items.settings",
    action: "navigate",
    href: "/dashboard/settings/account",
    keywords: ["settings", "paramètres", "account"],
    showOnlyWhenLoggedIn: true,
  },
  {
    id: "sign-out",
    segment: "account",
    labelKey: "items.signOut",
    action: "signOut",
    keywords: ["sign out", "logout", "déconnexion"],
    showOnlyWhenLoggedIn: true,
  },
]

export function buildCommandKCatalog(
  role: string | undefined,
  loggedIn: boolean
): CommandKItem[] {
  const persona = personaFromRole(role, loggedIn)
  const settingsPath = settingsHref(role)

  return CATALOG.filter((entry) => {
    if (entry.hideForPersona?.includes(persona)) return false
    if (persona === "buyer" && entry.segment === "sell" && entry.id !== "become-seller") return false
    if (entry.showOnlyWhenLoggedIn && !loggedIn) return false
    if (entry.showOnlyWhenLoggedOut && loggedIn) return false
    return true
  }).map((entry) => {
    if (entry.id === "home" && (entry.href === "/home" || entry.href === "/")) {
      return { ...entry, href: "/" }
    }
    const { hideForPersona: _h, showOnlyWhenLoggedIn: _a, showOnlyWhenLoggedOut: _b, ...item } =
      entry
    if (item.id === "settings" && item.action === "navigate") {
      return { ...item, href: settingsPath }
    }
    return item
  })
}

export function groupCommandKItems<T extends CommandKItem>(
  items: T[],
  groupLabel: (segment: CommandKSegment) => string
): Array<{ segment: CommandKSegment; label: string; items: T[] }> {
  const out: Array<{ segment: CommandKSegment; label: string; items: T[] }> = []
  for (const segment of COMMAND_K_SEGMENT_ORDER) {
    const segmentItems = items.filter((i) => i.segment === segment)
    if (segmentItems.length === 0) continue
    out.push({ segment, label: groupLabel(segment), items: segmentItems })
  }
  return out
}
