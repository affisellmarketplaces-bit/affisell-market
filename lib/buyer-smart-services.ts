import type { LucideIcon } from "lucide-react"
import { Brain, LayoutGrid, Sparkles, Store } from "lucide-react"

import { PUBLIC_SHOPS_PATH } from "@/lib/affiliate-routes"
import { BUYER_TILE_ACCENTS } from "@/lib/home-buyer-accent-palette"

export const FEATURED_SHOPS_TILE = {
  href: PUBLIC_SHOPS_PATH,
  label: "Boutiques à la une",
  hint: "Sélection créateurs",
  accent: BUYER_TILE_ACCENTS.stores.glow,
  cardClass: `${BUYER_TILE_ACCENTS.stores.card} text-white shadow-violet-500/25`,
} as const

export type BuyerSmartService = {
  href: string
  label: string
  hint: string
  Icon: LucideIcon
  /** Tailwind gradient stops for hero glass icon glow */
  accent: string
  /** Solid gradient for marketplace pulse cards */
  cardClass: string
  /** Red “LIVE” pill (Affisell Pulse feed). */
  liveBadge?: boolean
}

/** Unique buyer entry points — one role per tile (no duplicate CTAs on home). */
export const BUYER_SMART_SERVICES: BuyerSmartService[] = [
  {
    href: "/agent",
    label: "Agent shopping",
    hint: "Conseiller IA pour trouver le bon produit",
    Icon: Brain,
    accent: BUYER_TILE_ACCENTS.agent.glow,
    cardClass: `${BUYER_TILE_ACCENTS.agent.card} text-white shadow-violet-500/25`,
  },
  {
    href: "/discover",
    label: "Affisell Pulse",
    hint: "Signaux marché",
    Icon: Sparkles,
    accent: BUYER_TILE_ACCENTS.pulse.glow,
    cardClass: `${BUYER_TILE_ACCENTS.pulse.card} text-white shadow-fuchsia-500/25`,
    liveBadge: true,
  },
  {
    href: "/#explorer",
    label: "Catalogue live",
    hint: "Rayons, filtres & fiches produit",
    Icon: LayoutGrid,
    accent: BUYER_TILE_ACCENTS.catalog.glow,
    cardClass: `${BUYER_TILE_ACCENTS.catalog.card} text-white shadow-indigo-500/25`,
  },
  {
    href: PUBLIC_SHOPS_PATH,
    label: "Boutiques",
    hint: "Toutes les vitrines créateurs",
    Icon: Store,
    accent: BUYER_TILE_ACCENTS.stores.glow,
    cardClass: `${BUYER_TILE_ACCENTS.stores.card} text-white shadow-violet-500/25`,
  },
]
