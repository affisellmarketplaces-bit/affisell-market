import type { LucideIcon } from "lucide-react"
import { Brain, Heart, LayoutGrid, Store } from "lucide-react"

import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"

export type BuyerSmartService = {
  href: string
  label: string
  hint: string
  Icon: LucideIcon
  /** Tailwind gradient stops for hero glass icon glow */
  accent: string
  /** Solid gradient for marketplace pulse cards */
  cardClass: string
}

/** Unique buyer entry points — one role per tile (no duplicate CTAs on home). */
export const BUYER_SMART_SERVICES: BuyerSmartService[] = [
  {
    href: "/agent",
    label: "Agent shopping",
    hint: "Conseiller IA pour trouver le bon produit",
    Icon: Brain,
    accent: "from-violet-400/90 to-indigo-500/90",
    cardClass: "from-violet-600 to-indigo-600 text-white shadow-violet-500/25",
  },
  {
    href: PUBLIC_SHOPS_PATH,
    label: "Boutiques créateurs",
    hint: "Parcourir les vitrines",
    Icon: Store,
    accent: "from-fuchsia-400/90 to-pink-500/90",
    cardClass: "from-fuchsia-600 to-pink-600 text-white shadow-fuchsia-500/25",
  },
  {
    href: "/#explorer",
    label: "Catalogue live",
    hint: "Rayons, filtres & fiches produit",
    Icon: LayoutGrid,
    accent: "from-sky-400/90 to-cyan-500/90",
    cardClass: "from-sky-600 to-cyan-600 text-white shadow-sky-500/25",
  },
  {
    href: "/wishlist",
    label: "Favoris",
    hint: "Alertes prix & wishlist",
    Icon: Heart,
    accent: "from-amber-400/90 to-orange-500/90",
    cardClass: "from-amber-600 to-orange-600 text-white shadow-amber-500/25",
  },
]
