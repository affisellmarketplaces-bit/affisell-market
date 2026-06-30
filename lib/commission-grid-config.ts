/**
 * Grille métier Affisell — 26 branches mappées sur taxonomie Google (slug EN) + extensions FR.
 * Phase 1 : affisellCommissionRateBps (fee plateforme sur ligne client HT).
 * Phase 2 : supplierCommissionRateBps (commission fournisseur → affilié sur wholesale).
 */

export type CommissionGridEntry = {
  label: string
  /** Google Product Taxonomy EN slug prefixes (taxonomy-en.txt). */
  googleSlugs: readonly string[]
  /** Affisell-only nodes (fullPath FR) — see prisma/taxonomy-affisell-extensions.txt */
  affisellFullPaths: readonly string[]
  affisellBps: number
  supplierBps: number
}

/** Ordre important : entrées spécifiques après les branches larges. */
export const COMMISSION_GRID_MAP: Record<string, CommissionGridEntry> = {
  mode: {
    label: "Mode & Vêtements",
    googleSlugs: [
      "apparel_accessories",
      "apparel_accessories > clothing",
      "apparel_accessories > shoes",
      "apparel_accessories > handbags_wallets_cases",
    ],
    affisellFullPaths: [],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  beaute: {
    label: "Beauté & Cosmétique",
    googleSlugs: [
      "health_beauty",
      "health_beauty > personal_care",
      "health_beauty > cosmetics",
    ],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  hygiene: {
    label: "Hygiène & Parapharmacie",
    googleSlugs: ["health_beauty > health_care"],
    affisellFullPaths: [],
    affisellBps: 800,
    supplierBps: 1000,
  },
  bijoux: {
    label: "Bijoux < 500€",
    googleSlugs: ["apparel_accessories > jewelry"],
    affisellFullPaths: [],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  bijoux_luxe: {
    label: "Bijoux > 500€ Luxe",
    googleSlugs: [],
    affisellFullPaths: ["Vêtements et accessoires > Bijoux > Joaillerie fine"],
    affisellBps: 1000,
    supplierBps: 1200,
  },
  electronique: {
    label: "Électronique grand public",
    googleSlugs: ["electronics"],
    affisellFullPaths: [],
    affisellBps: 800,
    supplierBps: 1000,
  },
  telephonie: {
    label: "Téléphonie & Ordi",
    googleSlugs: [
      "electronics > communications > telephony",
      "electronics > computers",
    ],
    affisellFullPaths: [],
    affisellBps: 500,
    supplierBps: 800,
  },
  accessoires_elec: {
    label: "Accessoires électronique",
    googleSlugs: ["electronics > electronics_accessories"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  maison: {
    label: "Maison & Déco",
    googleSlugs: ["home_garden", "home_garden > decor"],
    affisellFullPaths: [],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  mobilier: {
    label: "Mobilier & Literie",
    googleSlugs: ["furniture", "home_garden > furniture"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  bricolage: {
    label: "Bricolage & Outils",
    googleSlugs: ["hardware", "hardware > tools"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  jardin: {
    label: "Jardin & Extérieur",
    googleSlugs: ["home_garden > lawn_garden"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  jouets: {
    label: "Jouets & Jeux",
    googleSlugs: ["toys_games", "toys_games > toys"],
    affisellFullPaths: [],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  puericulture: {
    label: "Puériculture",
    googleSlugs: ["baby_toddler"],
    affisellFullPaths: [],
    affisellBps: 800,
    supplierBps: 1200,
  },
  alimentation: {
    label: "Alimentation épicerie",
    googleSlugs: ["food_beverages_tobacco", "food_beverages_tobacco > food_items"],
    affisellFullPaths: [],
    affisellBps: 1000,
    supplierBps: 1200,
  },
  vins: {
    label: "Vins & Spiritueux",
    googleSlugs: ["food_beverages_tobacco > beverages > alcoholic_beverages"],
    affisellFullPaths: [],
    affisellBps: 1000,
    supplierBps: 1200,
  },
  animalerie: {
    label: "Animalerie",
    googleSlugs: ["animals_pet_supplies"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  sport: {
    label: "Sport & Fitness",
    googleSlugs: ["sporting_goods"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  auto: {
    label: "Auto & Moto",
    googleSlugs: ["vehicles_parts", "vehicles_parts > vehicle_parts_accessories"],
    affisellFullPaths: [],
    affisellBps: 1200,
    supplierBps: 1500,
  },
  art: {
    label: "Art & Collection",
    googleSlugs: ["arts_entertainment > hobbies_creative_arts"],
    affisellFullPaths: [],
    affisellBps: 1000,
    supplierBps: 1200,
  },
  livres: {
    label: "Livres & Média physique",
    googleSlugs: ["media", "media > books"],
    affisellFullPaths: [],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  digital: {
    label: "Produits digitaux",
    googleSlugs: ["software"],
    affisellFullPaths: [],
    affisellBps: 2000,
    supplierBps: 2500,
  },
  services: {
    label: "Services & Rendez-vous",
    googleSlugs: ["business_industrial"],
    affisellFullPaths: [],
    affisellBps: 2000,
    supplierBps: 2500,
  },
  occasion: {
    label: "Occasion & Reconditionné",
    googleSlugs: [],
    affisellFullPaths: ["Occasion et reconditionné"],
    affisellBps: 1000,
    supplierBps: 1200,
  },
  autre: {
    label: "Autre / Non classé",
    googleSlugs: [],
    affisellFullPaths: ["Autre / Non classé"],
    affisellBps: 1500,
    supplierBps: 1500,
  },
  luxe: {
    label: "Luxe (mode premium)",
    googleSlugs: [
      "apparel_accessories > clothing > outerwear",
      "apparel_accessories > handbags_wallets_cases > handbags",
    ],
    affisellFullPaths: [],
    affisellBps: 2000,
    supplierBps: 2000,
  },
}

export const GRID_ENTRY_COUNT = Object.keys(COMMISSION_GRID_MAP).length

export const AFFISELL_TAXONOMY_EXTENSION_PATHS = [
  "Vêtements et accessoires > Bijoux > Joaillerie fine",
  "Occasion et reconditionné",
  "Autre / Non classé",
] as const

export function bpsToPercent(bps: number): number {
  return bps / 100
}

export function formatBpsPercent(bps: number): string {
  return `${bpsToPercent(bps).toFixed(1)} %`
}
