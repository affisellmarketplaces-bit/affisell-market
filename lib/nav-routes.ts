import { AFFILIATE_CATALOG_PATH, PUBLIC_MARKETPLACE_BROWSE_PATH, PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"

/** Routes préchargées au survol / au chargement pour une navigation instantanée. */
export const BUYER_WARM_ROUTES = [
  "/",
  PUBLIC_SHOPS_PATH,
  PUBLIC_MARKETPLACE_BROWSE_PATH,
  "/login",
  "/cart",
  "/wishlist",
] as const

export const AFFILIATE_WARM_ROUTES = [
  "/dashboard/affiliate",
  AFFILIATE_CATALOG_PATH,
  "/agent",
  "/dashboard/affiliate/earnings",
] as const

export const SUPPLIER_WARM_ROUTES = [
  "/dashboard/supplier",
  "/dashboard/supplier/products",
  "/dashboard/supplier/orders",
] as const

export type QuickNavItem = {
  id: string
  label: string
  href: string
  keywords: string[]
  group: string
}

export const BUYER_QUICK_NAV: QuickNavItem[] = [
  { id: "home", label: "Accueil", href: "/", keywords: ["home", "accueil"], group: "Acheter" },
  {
    id: "shops",
    label: "Boutiques créateurs",
    href: PUBLIC_SHOPS_PATH,
    keywords: ["boutique", "créateur", "shop"],
    group: "Acheter",
  },
  {
    id: "browse",
    label: "Marketplace",
    href: PUBLIC_MARKETPLACE_BROWSE_PATH,
    keywords: ["marketplace", "produit", "catalogue"],
    group: "Acheter",
  },
  { id: "cart", label: "Panier", href: "/cart", keywords: ["cart", "panier"], group: "Acheter" },
  { id: "wishlist", label: "Favoris", href: "/wishlist", keywords: ["wishlist", "favoris"], group: "Acheter" },
  { id: "login", label: "Connexion", href: "/login", keywords: ["login", "connexion"], group: "Compte" },
  {
    id: "affiliate-signup",
    label: "Devenir créateur",
    href: "/signup/affiliate",
    keywords: ["affilié", "créateur"],
    group: "Compte",
  },
]

export const AFFILIATE_QUICK_NAV: QuickNavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard/affiliate",
    keywords: ["dashboard", "accueil"],
    group: "Affilié",
  },
  {
    id: "catalog",
    label: "Catalogue",
    href: AFFILIATE_CATALOG_PATH,
    keywords: ["catalogue", "discover", "produit"],
    group: "Affilié",
  },
  { id: "agent", label: "Agent IA", href: "/agent", keywords: ["agent", "ia"], group: "Affilié" },
  {
    id: "earnings",
    label: "Revenus",
    href: "/dashboard/affiliate/earnings",
    keywords: ["revenus", "earnings"],
    group: "Affilié",
  },
]

export const SUPPLIER_QUICK_NAV: QuickNavItem[] = [
  {
    id: "dashboard",
    label: "Mission control",
    href: "/dashboard/supplier",
    keywords: ["dashboard"],
    group: "Fournisseur",
  },
  {
    id: "products",
    label: "Produits",
    href: "/dashboard/supplier/products",
    keywords: ["produits", "catalogue"],
    group: "Fournisseur",
  },
  {
    id: "orders",
    label: "Commandes",
    href: "/dashboard/supplier/orders",
    keywords: ["commandes", "orders"],
    group: "Fournisseur",
  },
]
