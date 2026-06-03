import type { LucideIcon } from "lucide-react"
import {
  Baby,
  BriefcaseBusiness,
  Building2,
  Camera,
  Car,
  Code2,
  Cpu,
  Dumbbell,
  Factory,
  Film,
  Flower2,
  Gamepad2,
  Hammer,
  Home,
  Leaf,
  Luggage,
  MonitorSmartphone,
  Package,
  Palette,
  PawPrint,
  PenLine,
  Shirt,
  Sofa,
  Sparkles,
  Trophy,
  UtensilsCrossed,
  Wine,
} from "lucide-react"

export type CategoryGlyphMeta = {
  icon: LucideIcon
  /** Tailwind gradient stops, e.g. `from-violet-500 to-fuchsia-600` */
  gradient: string
  /** Tailwind shadow color utility */
  glow: string
}

/** Exact L1 names (Google taxonomy EN + FR + Affisell curated). */
const ROOT_BY_NAME: Record<string, CategoryGlyphMeta> = {
  "Animals & Pet Supplies": {
    icon: PawPrint,
    gradient: "from-amber-400 to-orange-600",
    glow: "shadow-amber-500/35",
  },
  "Animaux et articles pour animaux de compagnie": {
    icon: PawPrint,
    gradient: "from-amber-400 to-orange-600",
    glow: "shadow-amber-500/35",
  },
  "Apparel & Accessories": {
    icon: Shirt,
    gradient: "from-rose-400 to-pink-600",
    glow: "shadow-rose-500/35",
  },
  "Vêtements et accessoires": {
    icon: Shirt,
    gradient: "from-rose-400 to-pink-600",
    glow: "shadow-rose-500/35",
  },
  "Arts & Entertainment": {
    icon: Palette,
    gradient: "from-fuchsia-500 to-violet-700",
    glow: "shadow-fuchsia-500/35",
  },
  "Arts et loisirs": {
    icon: Palette,
    gradient: "from-fuchsia-500 to-violet-700",
    glow: "shadow-fuchsia-500/35",
  },
  "Baby & Toddler": {
    icon: Baby,
    gradient: "from-sky-400 to-cyan-600",
    glow: "shadow-sky-500/35",
  },
  "Bébés et tout-petits": {
    icon: Baby,
    gradient: "from-sky-400 to-cyan-600",
    glow: "shadow-sky-500/35",
  },
  "Business & Industrial": {
    icon: Factory,
    gradient: "from-slate-500 to-zinc-800",
    glow: "shadow-slate-600/35",
  },
  "Entreprise et industrie": {
    icon: Factory,
    gradient: "from-slate-500 to-zinc-800",
    glow: "shadow-slate-600/35",
  },
  "Cameras & Optics": {
    icon: Camera,
    gradient: "from-indigo-400 to-blue-700",
    glow: "shadow-indigo-500/35",
  },
  "Appareils photo, caméras et instruments d'optique": {
    icon: Camera,
    gradient: "from-indigo-400 to-blue-700",
    glow: "shadow-indigo-500/35",
  },
  Electronics: {
    icon: Cpu,
    gradient: "from-violet-500 to-fuchsia-600",
    glow: "shadow-violet-500/40",
  },
  "Appareils électroniques": {
    icon: Cpu,
    gradient: "from-violet-500 to-fuchsia-600",
    glow: "shadow-violet-500/40",
  },
  "Food, Beverages & Tobacco": {
    icon: UtensilsCrossed,
    gradient: "from-lime-400 to-emerald-600",
    glow: "shadow-emerald-500/35",
  },
  "Alimentation, boissons et tabac": {
    icon: UtensilsCrossed,
    gradient: "from-lime-400 to-emerald-600",
    glow: "shadow-emerald-500/35",
  },
  Furniture: {
    icon: Sofa,
    gradient: "from-amber-500 to-orange-700",
    glow: "shadow-orange-500/35",
  },
  Meubles: {
    icon: Sofa,
    gradient: "from-amber-500 to-orange-700",
    glow: "shadow-orange-500/35",
  },
  Hardware: {
    icon: Hammer,
    gradient: "from-stone-500 to-neutral-700",
    glow: "shadow-stone-500/35",
  },
  Quincaillerie: {
    icon: Hammer,
    gradient: "from-stone-500 to-neutral-700",
    glow: "shadow-stone-500/35",
  },
  "Health & Beauty": {
    icon: Sparkles,
    gradient: "from-pink-400 to-rose-600",
    glow: "shadow-pink-500/40",
  },
  "Santé et beauté": {
    icon: Sparkles,
    gradient: "from-pink-400 to-rose-600",
    glow: "shadow-pink-500/40",
  },
  "Home & Garden": {
    icon: Leaf,
    gradient: "from-green-400 to-teal-600",
    glow: "shadow-green-500/35",
  },
  "Maison et jardin": {
    icon: Leaf,
    gradient: "from-green-400 to-teal-600",
    glow: "shadow-green-500/35",
  },
  "Home Supplies": {
    icon: Home,
    gradient: "from-teal-400 to-cyan-700",
    glow: "shadow-teal-500/35",
  },
  "Home & Kitchen": {
    icon: UtensilsCrossed,
    gradient: "from-orange-400 to-red-500",
    glow: "shadow-orange-500/35",
  },
  "Luggage & Bags": {
    icon: Luggage,
    gradient: "from-blue-400 to-indigo-600",
    glow: "shadow-blue-500/35",
  },
  "Bagages et maroquinerie": {
    icon: Luggage,
    gradient: "from-blue-400 to-indigo-600",
    glow: "shadow-blue-500/35",
  },
  Media: {
    icon: Film,
    gradient: "from-purple-500 to-indigo-800",
    glow: "shadow-purple-500/35",
  },
  Médias: {
    icon: Film,
    gradient: "from-purple-500 to-indigo-800",
    glow: "shadow-purple-500/35",
  },
  "Office Supplies": {
    icon: PenLine,
    gradient: "from-sky-500 to-indigo-600",
    glow: "shadow-sky-500/35",
  },
  "Fournitures de bureau": {
    icon: PenLine,
    gradient: "from-sky-500 to-indigo-600",
    glow: "shadow-sky-500/35",
  },
  Software: {
    icon: Code2,
    gradient: "from-cyan-400 to-violet-600",
    glow: "shadow-cyan-500/40",
  },
  Logiciels: {
    icon: Code2,
    gradient: "from-cyan-400 to-violet-600",
    glow: "shadow-cyan-500/40",
  },
  "Sporting Goods": {
    icon: Dumbbell,
    gradient: "from-emerald-400 to-green-700",
    glow: "shadow-emerald-500/35",
  },
  "Équipements sportifs": {
    icon: Dumbbell,
    gradient: "from-emerald-400 to-green-700",
    glow: "shadow-emerald-500/35",
  },
  "Toys & Games": {
    icon: Gamepad2,
    gradient: "from-violet-400 to-purple-700",
    glow: "shadow-violet-500/35",
  },
  "Jeux et jouets": {
    icon: Gamepad2,
    gradient: "from-violet-400 to-purple-700",
    glow: "shadow-violet-500/35",
  },
  "Vehicles & Parts": {
    icon: Car,
    gradient: "from-zinc-400 to-slate-700",
    glow: "shadow-zinc-500/35",
  },
  "Véhicules et accessoires": {
    icon: Car,
    gradient: "from-zinc-400 to-slate-700",
    glow: "shadow-zinc-500/35",
  },
  Automotive: {
    icon: Car,
    gradient: "from-zinc-400 to-slate-700",
    glow: "shadow-zinc-500/35",
  },
  Beauty: {
    icon: Sparkles,
    gradient: "from-pink-400 to-fuchsia-600",
    glow: "shadow-fuchsia-500/35",
  },
  Computers: {
    icon: MonitorSmartphone,
    gradient: "from-blue-500 to-violet-600",
    glow: "shadow-blue-500/35",
  },
  Garden: {
    icon: Flower2,
    gradient: "from-lime-500 to-green-600",
    glow: "shadow-lime-500/35",
  },
  Grocery: {
    icon: Wine,
    gradient: "from-yellow-400 to-amber-600",
    glow: "shadow-amber-500/35",
  },
  Industrial: {
    icon: Building2,
    gradient: "from-slate-600 to-gray-800",
    glow: "shadow-slate-600/35",
  },
  Sports: {
    icon: Trophy,
    gradient: "from-teal-400 to-emerald-700",
    glow: "shadow-teal-500/35",
  },
  Office: {
    icon: BriefcaseBusiness,
    gradient: "from-indigo-400 to-blue-600",
    glow: "shadow-indigo-500/35",
  },
}

const KEYWORD_RULES: { pattern: RegExp; meta: CategoryGlyphMeta }[] = [
  { pattern: /electron|électron|phone|computer|tech|smart/i, meta: ROOT_BY_NAME.Electronics! },
  { pattern: /office|bureau|stationery/i, meta: ROOT_BY_NAME["Office Supplies"]! },
  { pattern: /business|industrial|entreprise|industrie|factory/i, meta: ROOT_BY_NAME["Business & Industrial"]! },
  { pattern: /camera|optic|photo|caméra/i, meta: ROOT_BY_NAME["Cameras & Optics"]! },
  { pattern: /apparel|cloth|vêtement|fashion|shoe|jewel/i, meta: ROOT_BY_NAME["Apparel & Accessories"]! },
  { pattern: /furniture|meuble|sofa|bed/i, meta: ROOT_BY_NAME.Furniture! },
  { pattern: /health|beauty|santé|beauté|cosmetic|skin/i, meta: ROOT_BY_NAME["Health & Beauty"]! },
  { pattern: /vehicle|véhicule|automotive|car|auto/i, meta: ROOT_BY_NAME["Vehicles & Parts"]! },
  { pattern: /sport|fitness|gym|outdoor/i, meta: ROOT_BY_NAME["Sporting Goods"]! },
  { pattern: /pet|animal|dog|cat|bird/i, meta: ROOT_BY_NAME["Animals & Pet Supplies"]! },
  { pattern: /art|entertain|music|film|media|média/i, meta: ROOT_BY_NAME["Arts & Entertainment"]! },
  { pattern: /food|beverage|grocery|aliment|boisson|wine|coffee/i, meta: ROOT_BY_NAME["Food, Beverages & Tobacco"]! },
  { pattern: /baby|bébé|toddler|nursery/i, meta: ROOT_BY_NAME["Baby & Toddler"]! },
  { pattern: /toy|game|jeux|jouet/i, meta: ROOT_BY_NAME["Toys & Games"]! },
  { pattern: /home|garden|maison|jardin|kitchen|cook|décor/i, meta: ROOT_BY_NAME["Home & Garden"]! },
  { pattern: /hardware|tool|quincaillerie|bricolage/i, meta: ROOT_BY_NAME.Hardware! },
  { pattern: /luggage|bag|travel|bagage/i, meta: ROOT_BY_NAME["Luggage & Bags"]! },
  { pattern: /software|logiciel|app|digital/i, meta: ROOT_BY_NAME.Software! },
]

const DEFAULT_META: CategoryGlyphMeta = {
  icon: Package,
  gradient: "from-violet-500 to-indigo-600",
  glow: "shadow-violet-500/30",
}

function rootLabel(name: string, fullPath?: string): string {
  const fromPath = fullPath?.split(" > ").map((s) => s.trim())[0]
  return fromPath?.length ? fromPath : name.trim()
}

/** Resolve icon + gradient for a category row (ignores legacy emoji `icon` field). */
export function resolveCategoryGlyphMeta(input: {
  name: string
  slug?: string
  fullPath?: string
}): CategoryGlyphMeta {
  const root = rootLabel(input.name, input.fullPath)
  const exact = ROOT_BY_NAME[root]
  if (exact) return exact

  const haystack = `${root} ${input.name} ${input.slug ?? ""} ${input.fullPath ?? ""}`
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(haystack)) return rule.meta
  }

  return DEFAULT_META
}
