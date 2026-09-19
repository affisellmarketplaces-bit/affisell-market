import type { LucideIcon } from "lucide-react"
import {
  CalendarCheck,
  Flame,
  Gift,
  Handshake,
  Inbox,
  Layers,
  LayoutDashboard,
  Package,
  Palette,
  Plus,
  Radar,
  Rocket,
  ShoppingCart,
  Sparkles,
  Store,
  Swords,
  TrendingUp,
  Truck,
  Wallet,
} from "lucide-react"

import {
  AFFILIATE_AGENT_PATH,
  AFFILIATE_CATALOG_PATH,
  AFFILIATE_HUB_BATTLE_HREF,
  AFFILIATE_HUB_SWIPE_HREF,
  PUBLIC_SHOPS_PATH,
} from "@/lib/affiliate-routes"
import { DROPFORGE_HREF } from "@/lib/affiliate-onboarding-shared"
import { barePathname } from "@/lib/mobile-chrome"
import { MAGIC_SYSTEMS_HREF } from "@/lib/magic-systems-catalog"

export type PartnerRole = "SUPPLIER" | "AFFILIATE"

export type PartnerNavItem = {
  id: string
  href: string
  /** i18n path (next-intl, absolute) for the label. */
  label: string
  icon: LucideIcon
  match: (pathname: string, search: URLSearchParams) => boolean
}

export type PartnerDockTab = PartnerNavItem & { featured?: boolean }

const startsWith = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`)

const hubMode = (mode: string) => (p: string, s: URLSearchParams) =>
  p.startsWith("/dashboard/affiliate/hub") && s.get("mode") === mode

/** Routes where the partner (supplier / reseller) thumb dock replaces the header pill strip. */
export function isPartnerDockRoute(pathname: string): boolean {
  const bare = barePathname(pathname)
  if (bare.startsWith("/dashboard/admin")) return false
  return (
    bare.startsWith("/dashboard") || bare.startsWith("/radar") || bare.startsWith("/dropforge")
  )
}

/** Full-screen partner surfaces that bring their own bottom controls. */
export function isPartnerDockSuppressed(pathname: string, search: URLSearchParams): boolean {
  const bare = barePathname(pathname)
  if (bare.startsWith("/radar/globe")) return true
  if (bare.startsWith("/dashboard/affiliate/hub")) {
    const mode = search.get("mode")
    return mode === "swipe" || mode === "battle"
  }
  return false
}

const SUPPLIER_TABS: PartnerDockTab[] = [
  {
    id: "dashboard",
    href: "/dashboard/supplier",
    label: "nav.supplier.dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard/supplier",
  },
  {
    id: "products",
    href: "/dashboard/supplier/products",
    label: "nav.supplier.products",
    icon: Package,
    match: (p) =>
      startsWith("/dashboard/supplier/products")(p) &&
      !p.startsWith("/dashboard/supplier/products/new"),
  },
  {
    id: "add",
    href: "/dashboard/supplier/products/new",
    label: "partnerDock.add",
    icon: Plus,
    featured: true,
    match: (p) => p.startsWith("/dashboard/supplier/products/new"),
  },
  {
    id: "orders",
    href: "/dashboard/supplier/orders",
    label: "nav.supplier.orders",
    icon: ShoppingCart,
    match: startsWith("/dashboard/supplier/orders"),
  },
]

const SUPPLIER_MORE: PartnerNavItem[] = [
  { id: "supply", href: "/dashboard/supplier/supply#affisell-stock", label: "nav.supplier.supply", icon: Layers, match: (p) => p.startsWith("/dashboard/supplier/supply") },
  { id: "dropforge", href: DROPFORGE_HREF, label: "nav.supplier.dropforge", icon: Flame, match: (p) => p.startsWith(DROPFORGE_HREF) },
  { id: "lab", href: MAGIC_SYSTEMS_HREF, label: "nav.supplier.magicLab", icon: Sparkles, match: (p) => p.startsWith(MAGIC_SYSTEMS_HREF) },
  { id: "radar", href: "/radar", label: "partnerDock.radar", icon: Radar, match: (p) => p.startsWith("/radar") },
  { id: "bookings", href: "/dashboard/supplier/bookings", label: "nav.supplier.bookings", icon: CalendarCheck, match: startsWith("/dashboard/supplier/bookings") },
  { id: "shipping", href: "/dashboard/supplier/settings/shipping", label: "nav.supplier.shipping", icon: Truck, match: startsWith("/dashboard/supplier/settings/shipping") },
  { id: "promote", href: "/dashboard/supplier/promote", label: "partnerDock.promote", icon: Rocket, match: startsWith("/dashboard/supplier/promote") },
  { id: "invite", href: "/dashboard/supplier/invite-affiliate", label: "nav.supplier.inviteAffiliate", icon: Handshake, match: startsWith("/dashboard/supplier/invite-affiliate") },
]

const AFFILIATE_TABS: PartnerDockTab[] = [
  {
    id: "dashboard",
    href: "/dashboard/affiliate",
    label: "nav.affiliate.dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard/affiliate",
  },
  {
    id: "catalog",
    href: AFFILIATE_CATALOG_PATH,
    label: "nav.affiliate.catalog",
    icon: Store,
    match: startsWith(AFFILIATE_CATALOG_PATH),
  },
  {
    id: "swipe",
    href: AFFILIATE_HUB_SWIPE_HREF,
    label: "partnerDock.swipe",
    icon: Layers,
    featured: true,
    match: hubMode("swipe"),
  },
  {
    id: "earnings",
    href: "/dashboard/affiliate/earnings",
    label: "nav.affiliate.earnings",
    icon: Wallet,
    match: (p) =>
      p.startsWith("/dashboard/affiliate/earnings") ||
      p.startsWith("/dashboard/affiliate/settings/payouts") ||
      p.startsWith("/dashboard/affiliate/payout-methods"),
  },
]

const AFFILIATE_MORE: PartnerNavItem[] = [
  { id: "agent", href: AFFILIATE_AGENT_PATH, label: "nav.affiliate.agent", icon: Sparkles, match: (p) => p.startsWith(AFFILIATE_AGENT_PATH) },
  { id: "shops", href: PUBLIC_SHOPS_PATH, label: "partnerDock.shops", icon: TrendingUp, match: (p) => p === PUBLIC_SHOPS_PATH },
  { id: "battle", href: AFFILIATE_HUB_BATTLE_HREF, label: "partnerDock.battle", icon: Swords, match: hubMode("battle") },
  { id: "lab", href: MAGIC_SYSTEMS_HREF, label: "nav.affiliate.magicLab", icon: Sparkles, match: (p) => p.startsWith(MAGIC_SYSTEMS_HREF) },
  { id: "promote", href: "/dashboard/affiliate/promote", label: "partnerDock.promote", icon: Rocket, match: startsWith("/dashboard/affiliate/promote") },
  { id: "radar", href: "/radar", label: "partnerDock.radar", icon: Radar, match: (p) => p.startsWith("/radar") },
  { id: "requests", href: "/dashboard/reseller/requests", label: "partnerDock.requests", icon: Inbox, match: (p) => p.startsWith("/dashboard/reseller") },
  { id: "referral", href: "/dashboard/affiliate/referral", label: "nav.affiliate.referral", icon: Gift, match: startsWith("/dashboard/affiliate/referral") },
  { id: "brand", href: "/dashboard/affiliate/brand-studio", label: "nav.affiliate.brandStudio", icon: Palette, match: startsWith("/dashboard/affiliate/brand-studio") },
  { id: "invite", href: "/dashboard/affiliate/invite-supplier", label: "nav.affiliate.inviteSupplier", icon: Handshake, match: startsWith("/dashboard/affiliate/invite-supplier") },
]

export function partnerDockConfig(role: PartnerRole): { tabs: PartnerDockTab[]; more: PartnerNavItem[] } {
  return role === "SUPPLIER"
    ? { tabs: SUPPLIER_TABS, more: SUPPLIER_MORE }
    : { tabs: AFFILIATE_TABS, more: AFFILIATE_MORE }
}
