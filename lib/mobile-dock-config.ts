import { PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import type { PublicNavMode } from "@/lib/public-nav-mode"

export type MobileDockItemId =
  | "home"
  | "explore"
  | "pulse"
  | "stores"
  | "cart"
  | "orders"
  | "account"
  | "wishlist"

export type MobileDockItemDef = {
  id: MobileDockItemId
  href: string
  /** Key under `nav.dock` in messages. */
  labelKey:
    | "home"
    | "explore"
    | "pulse"
    | "stores"
    | "cart"
    | "orders"
    | "account"
    | "wishlist"
  featured?: boolean
  match: (barePath: string) => boolean
}

const BROWSE_DOCK_ITEMS: MobileDockItemDef[] = [
  {
    id: "home",
    href: "/",
    labelKey: "home",
    match: (p) => p === "/",
  },
  {
    id: "explore",
    href: PUBLIC_MARKETPLACE_BROWSE_PATH,
    labelKey: "explore",
    match: (p) => p === PUBLIC_MARKETPLACE_BROWSE_PATH,
  },
  {
    id: "pulse",
    href: "/discover",
    labelKey: "pulse",
    featured: true,
    match: (p) => p.startsWith("/discover"),
  },
  {
    id: "stores",
    href: PUBLIC_SHOPS_PATH,
    labelKey: "stores",
    match: (p) =>
      p === PUBLIC_SHOPS_PATH ||
      (/^\/shops\/[^/]+$/.test(p) && p !== PUBLIC_MARKETPLACE_BROWSE_PATH),
  },
  {
    id: "cart",
    href: "/cart",
    labelKey: "cart",
    match: (p) => p === "/cart",
  },
]

const ACCOUNT_DOCK_ITEMS: MobileDockItemDef[] = [
  {
    id: "home",
    href: "/",
    labelKey: "home",
    match: (p) => p === "/",
  },
  {
    id: "orders",
    href: "/marketplace/account/orders",
    labelKey: "orders",
    match: (p) => p === "/marketplace/account/orders" || p.startsWith("/marketplace/account/orders/"),
  },
  {
    id: "account",
    href: "/marketplace/account",
    labelKey: "account",
    featured: true,
    match: (p) =>
      p === "/marketplace/account" ||
      p === "/track-order" ||
      (p.startsWith("/marketplace/account/") && !p.startsWith("/marketplace/account/orders")),
  },
  {
    id: "wishlist",
    href: "/wishlist",
    labelKey: "wishlist",
    match: (p) => p === "/wishlist" || p.startsWith("/wishlist/"),
  },
  {
    id: "cart",
    href: "/cart",
    labelKey: "cart",
    match: (p) => p === "/cart",
  },
]

/** Buyer thumb dock items — browse discovery vs account hub layouts. */
export function resolveMobileDockItems(mode: PublicNavMode): MobileDockItemDef[] {
  if (mode === "account") return ACCOUNT_DOCK_ITEMS
  return BROWSE_DOCK_ITEMS
}
