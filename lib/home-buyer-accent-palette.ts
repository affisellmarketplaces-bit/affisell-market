/** Accents buyer home — famille indigo/violet uniquement (pas d’arc-en-ciel). */

export type BuyerTileAccent = {
  /** Glow derrière icône (glass hero) */
  glow: string
  /** Icône + cartes solides */
  icon: string
  /** Carte gradient pleine (rail orbital) */
  card: string
}

export const BUYER_TILE_ACCENTS = {
  agent: {
    glow: "from-violet-400/80 to-indigo-500/80",
    icon: "from-violet-500 to-indigo-600",
    card: "from-violet-600 via-indigo-700 to-indigo-900",
  },
  pulse: {
    glow: "from-fuchsia-400/70 to-violet-500/80",
    icon: "from-fuchsia-500 to-violet-600",
    card: "from-fuchsia-600 via-violet-700 to-indigo-900",
  },
  catalog: {
    glow: "from-indigo-400/70 to-violet-500/80",
    icon: "from-indigo-500 to-violet-600",
    card: "from-indigo-600 via-violet-700 to-indigo-950",
  },
  stores: {
    glow: "from-violet-500/70 to-indigo-600/80",
    icon: "from-violet-600 to-indigo-700",
    card: "from-violet-700 via-indigo-800 to-indigo-950",
  },
  auctions: {
    glow: "from-violet-500/70 to-fuchsia-500/70",
    icon: "from-violet-600 to-fuchsia-600",
    card: "from-violet-700 via-fuchsia-800 to-indigo-950",
  },
  luxe: {
    glow: "from-indigo-400/70 to-violet-600/80",
    icon: "from-indigo-500 to-violet-700",
    card: "from-indigo-700 via-violet-800 to-indigo-950",
  },
  support: {
    glow: "from-indigo-400/60 to-violet-500/70",
    icon: "from-indigo-500 to-violet-600",
    card: "from-indigo-600 via-violet-700 to-violet-950",
  },
  wishlist: {
    glow: "from-fuchsia-400/60 to-violet-500/70",
    icon: "from-fuchsia-500 to-violet-600",
    card: "from-fuchsia-600 via-violet-700 to-indigo-950",
  },
  bestSellers: {
    glow: "from-amber-400/70 to-fuchsia-500/75",
    icon: "from-amber-500 via-fuchsia-500 to-violet-600",
    card: "from-amber-600 via-fuchsia-700 to-indigo-950",
  },
} as const satisfies Record<string, BuyerTileAccent>
