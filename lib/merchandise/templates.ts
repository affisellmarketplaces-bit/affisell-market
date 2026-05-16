import { AFFISELL_CATEGORY_TAXONOMY } from "@/lib/ai/categories"

export const MERCH_SHAPES = ["diagonal", "circle", "wave", "blob", "stripe"] as const
export type MerchShape = (typeof MERCH_SHAPES)[number]

export type MerchCategoryTemplate = {
  bg: string
  shape: MerchShape
  textColor: string
}

const PRESET: Record<string, MerchCategoryTemplate> = {
  "Sports & Outdoors": { bg: "#FFD400", shape: "diagonal", textColor: "#000" },
  "Beauty & Personal Care": { bg: "#FFD4E5", shape: "circle", textColor: "#000" },
  Electronics: { bg: "#D4F1FF", shape: "wave", textColor: "#000" },
  "Home & Kitchen": { bg: "#E8F5E8", shape: "blob", textColor: "#000" },
  "Men's Fashion": { bg: "#F0E6FF", shape: "stripe", textColor: "#000" },
  "Women's Fashion": { bg: "#F0E6FF", shape: "stripe", textColor: "#000" },
}

const ROTATE_BGS = ["#FFF4E5", "#F3E8FF", "#E7F4FF", "#E6FAF0", "#FFF0F3", "#F5F5F5", "#EDE7F6", "#E0F2F1"] as const

function rotateForIndex(i: number): MerchCategoryTemplate {
  return {
    bg: ROTATE_BGS[i % ROTATE_BGS.length],
    shape: MERCH_SHAPES[i % MERCH_SHAPES.length],
    textColor: "#000",
  }
}

function buildDepartmentTemplates(): Record<string, MerchCategoryTemplate> {
  const out: Record<string, MerchCategoryTemplate> = {}
  let i = 0
  for (const d of AFFISELL_CATEGORY_TAXONOMY) {
    out[d.name] = PRESET[d.name] ?? rotateForIndex(i)
    i += 1
  }
  return out
}

const DEPARTMENTS = buildDepartmentTemplates()

/**
 * After `prisma/seed.ts` imports Google Product Taxonomy (fr-FR), Prisma root `Category.name`
 * values match the top-level lines in `prisma/taxonomy-fr.txt`. Map Affisell merchandising
 * departments (English) to those DB root labels so `/api/merchandise/generate` keeps working.
 */
const SEEDED_GOOGLE_FR_ROOT_BY_AFFISELL_DEPT: Record<string, string> = {
  Electronics: "Appareils électroniques",
  "Home & Kitchen": "Maison et jardin",
  "Beauty & Personal Care": "Santé et beauté",
  "Men's Fashion": "Vêtements et accessoires",
  "Women's Fashion": "Vêtements et accessoires",
  "Sports & Outdoors": "Équipements sportifs",
  "Toys & Games": "Jeux et jouets",
  Books: "Médias",
  Automotive: "Véhicules et accessoires",
  "Pet Supplies": "Animaux et articles pour animaux de compagnie",
  "Office Products": "Fournitures de bureau",
  "Health & Household": "Santé et beauté",
  "Baby Products": "Bébés et tout-petits",
  "Tools & Home Improvement": "Quincaillerie",
  "Industrial & Scientific": "Entreprise et industrie",
  "Arts, Crafts & Sewing": "Arts et loisirs",
  "Music, Movies & TV": "Médias",
  "Collectibles & Fine Art": "Arts et loisirs",
  "Grocery & Gourmet Food": "Alimentation, boissons et tabac",
  "Handmade Products": "Arts et loisirs",
  "Digital Content & Services": "Logiciels",
  "Travel & Luggage": "Bagages et maroquinerie",
  "Party & Costumes": "Jeux et jouets",
  "Major Appliances": "Appareils électroniques",
  "Cycling & Scooters": "Équipements sportifs",
  "Boating & Marine": "Véhicules et accessoires",
  "School & Education": "Fournitures de bureau",
  "Equestrian & Farm": "Animaux et articles pour animaux de compagnie",
  "Software & Apps": "Logiciels",
  "B2B & Professional Supply": "Entreprise et industrie",
  "Sustainable Living": "Maison et jardin",
  "Senior & Adaptive Aids": "Santé et beauté",
  "Pop Culture & Anime Merch": "Jeux et jouets",
}

function prismaRootNameForMerch(deptEnglish: string): string {
  return SEEDED_GOOGLE_FR_ROOT_BY_AFFISELL_DEPT[deptEnglish] ?? deptEnglish
}

/** Visual presets keyed by Affisell department name + common FR/EN shortcuts. */
export const CATEGORY_TEMPLATES: Record<string, MerchCategoryTemplate> = {
  ...DEPARTMENTS,
  Sport: DEPARTMENTS["Sports & Outdoors"]!,
  Sports: DEPARTMENTS["Sports & Outdoors"]!,
  Beauté: DEPARTMENTS["Beauty & Personal Care"]!,
  Beaute: DEPARTMENTS["Beauty & Personal Care"]!,
  Tech: DEPARTMENTS.Electronics!,
  Maison: DEPARTMENTS["Home & Kitchen"]!,
  Mode: DEPARTMENTS["Women's Fashion"]!,
}

const SLUG_TO_DEPT = Object.fromEntries(
  AFFISELL_CATEGORY_TAXONOMY.map((d) => [d.slug.toLowerCase(), d.name] as const)
) as Record<string, string>

const LOWER_NAME_TO_DEPT = Object.fromEntries(
  AFFISELL_CATEGORY_TAXONOMY.map((d) => [d.name.toLowerCase(), d.name] as const)
) as Record<string, string>

const TEMPLATE_KEY_TO_DEPT: Record<string, string> = {
  sport: "Sports & Outdoors",
  sports: "Sports & Outdoors",
  beauté: "Beauty & Personal Care",
  beaute: "Beauty & Personal Care",
  tech: "Electronics",
  maison: "Home & Kitchen",
  mode: "Women's Fashion",
}

/**
 * Resolves `?category=` to a seeded root `Category.name` in Prisma (Google taxonomy fr-FR root
 * label after `prisma/seed.ts`) and a template row.
 */
export function resolveMerchandisingDepartment(raw: string): {
  dbRootName: string
  template: MerchCategoryTemplate
} | null {
  const q = raw.trim()
  if (!q) return null

  const lower = q.toLowerCase().replace(/\+/g, " ").replace(/\s+/g, " ")
  const hyphenSlug = lower.replace(/\s+/g, "-")

  const fromSlug = SLUG_TO_DEPT[hyphenSlug]
  if (fromSlug && DEPARTMENTS[fromSlug]) {
    return { dbRootName: prismaRootNameForMerch(fromSlug), template: DEPARTMENTS[fromSlug] }
  }

  const fromAlias = TEMPLATE_KEY_TO_DEPT[lower]
  if (fromAlias && DEPARTMENTS[fromAlias]) {
    return { dbRootName: prismaRootNameForMerch(fromAlias), template: DEPARTMENTS[fromAlias] }
  }

  const fromDept = LOWER_NAME_TO_DEPT[lower]
  if (fromDept && DEPARTMENTS[fromDept]) {
    return { dbRootName: prismaRootNameForMerch(fromDept), template: DEPARTMENTS[fromDept] }
  }

  if (DEPARTMENTS[q]) {
    return { dbRootName: prismaRootNameForMerch(q), template: DEPARTMENTS[q] }
  }

  return null
}
