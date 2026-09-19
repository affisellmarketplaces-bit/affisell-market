import type { OptimizeVariantsInput } from "../../lib/supplier-optimize-variants"

/** One expectation per index: output name must match (accent/case-insensitive). */
export type Gold = { index: number; anyOf: RegExp[] }

export type EvalCase = {
  id: string
  tag: string
  input: OptimizeVariantsInput
  /** simple mode: expected color names. */
  gold?: Gold[]
  /** expected sizesText tokens (simple mode), order-insensitive. */
  goldSizes?: string[]
  /** output must contain NO digit (no invented specs). */
  noDigits?: boolean
  /** advanced mode: expected normalised sizes by index. */
  goldRowSizes?: Array<{ index: number; size: string | null }>
  skuPrefix?: string
}

const ctx = (title: string, categoryPath: string, description = "", bullets: string[] = []) => ({
  title,
  categoryPath,
  description,
  bullets,
})
const colors = (...names: string[]) => names.map((name, index) => ({ index, name }))
const g = (index: number, ...re: RegExp[]): Gold => ({ index, anyOf: re })

export const CASES: EvalCase[] = [
  {
    id: "fr-case-fix",
    tag: "normalisation FR",
    input: { mode: "simple", ...ctx("T-shirt coton homme", "Vêtements > Hauts > T-shirts"), simpleColors: colors("noir", "BLANC", "rouge vif", "Gris  anthracite"), sizesText: "" },
    gold: [g(0, /^noir$/i), g(1, /^blanc$/i), g(2, /^rouge vif$/i), g(3, /^gris anthracite$/i)],
  },
  {
    id: "fr-comma-plus",
    tag: "règles (virgule/+)",
    input: { mode: "simple", ...ctx("Coque téléphone silicone", "Accessoires > Coques"), simpleColors: colors("Noir, Rouge", "Bleu + Blanc", "Vert"), sizesText: "" },
    gold: [g(0, /noir.*rouge/i), g(1, /bleu.*blanc/i), g(2, /^vert$/i)],
  },
  {
    id: "fr-abbrev",
    tag: "abréviations",
    input: { mode: "simple", ...ctx("Sweat à capuche unisexe", "Vêtements > Sweats"), simpleColors: colors("BLK", "WHT", "NVY", "GRY"), sizesText: "" },
    gold: [g(0, /black|noir/i), g(1, /white|blanc/i), g(2, /navy|marine|bleu marine/i), g(3, /gr[ae]y|gris/i)],
  },
  {
    id: "fr-too-long",
    tag: "longueur > 48",
    input: { mode: "simple", ...ctx("Montre connectée sport", "Électronique > Montres"), simpleColors: colors("Noir mat édition limitée collection automne hiver avec finition brillante", "Argent"), sizesText: "" },
    gold: [g(0, /noir/i), g(1, /^argent$/i)],
  },
  {
    id: "fr-no-invention",
    tag: "ne pas inventer",
    input: { mode: "simple", ...ctx("Bougie parfumée", "Maison > Bougies"), simpleColors: colors("Rouge", "Bleu", "Vert"), sizesText: "" },
    gold: [g(0, /^rouge$/i), g(1, /^bleu$/i), g(2, /^vert$/i)],
    noDigits: true,
  },
  {
    id: "fr-sizes",
    tag: "tailles",
    input: { mode: "simple", ...ctx("Robe d'été", "Vêtements > Robes"), simpleColors: colors("Rose"), sizesText: "small, medium, LARGE, xl" },
    gold: [g(0, /^rose$/i)],
    goldSizes: ["S", "M", "L", "XL"],
  },
  {
    id: "scooter-specs",
    tag: "specs conservées",
    input: { mode: "simple", ...ctx("Trottinette électrique tout-terrain", "Sports > Trottinettes", "Modèles X1 (7.8Ah, 25 km) et ES80 (10.5Ah)."), simpleColors: colors("X1 7.8Ah 25KM", "ES80 10.5Ah"), sizesText: "" },
    gold: [g(0, /x1.*7\.8\s?ah.*25\s?km/i), g(1, /es80.*10\.5\s?ah/i)],
  },
  { id: "de-keep", tag: "langue DE", input: { mode: "simple", ...ctx("Herren Lederjacke", "Bekleidung > Jacken", "Klassische Lederjacke für Herren."), simpleColors: colors("schwarz", "braun", "dunkelblau"), sizesText: "" }, gold: [g(0, /^schwarz$/i), g(1, /^braun$/i), g(2, /^dunkelblau$/i)] },
  { id: "es-keep", tag: "langue ES", input: { mode: "simple", ...ctx("Zapatillas deportivas mujer", "Calzado > Deportivas", "Zapatillas ligeras para correr."), simpleColors: colors("negro", "blanco", "rosa"), sizesText: "" }, gold: [g(0, /^negro$/i), g(1, /^blanco$/i), g(2, /^rosa$/i)] },
  { id: "it-keep", tag: "langue IT", input: { mode: "simple", ...ctx("Borsa in pelle donna", "Accessori > Borse", "Borsa elegante in pelle."), simpleColors: colors("nero", "rosso", "beige"), sizesText: "" }, gold: [g(0, /^nero$/i), g(1, /^rosso$/i), g(2, /^beige$/i)] },
  { id: "nl-keep", tag: "langue NL", input: { mode: "simple", ...ctx("Dames rugzak waterdicht", "Tassen > Rugzakken", "Waterdichte rugzak."), simpleColors: colors("zwart", "grijs", "groen"), sizesText: "" }, gold: [g(0, /^zwart$/i), g(1, /^grijs$/i), g(2, /^groen$/i)] },
  { id: "pl-keep", tag: "langue PL", input: { mode: "simple", ...ctx("Kurtka zimowa męska", "Odzież > Kurtki", "Ciepła kurtka zimowa."), simpleColors: colors("czarny", "granatowy", "szary"), sizesText: "" }, gold: [g(0, /^czarny$/i), g(1, /^granatowy$/i), g(2, /^szary$/i)] },
  { id: "en-mixed", tag: "EN/FR mélangé", input: { mode: "simple", ...ctx("Casque audio bluetooth", "Électronique > Audio"), simpleColors: colors("Black", "blanc", "Rose gold"), sizesText: "" }, gold: [g(0, /^black$|^noir$/i), g(1, /^white$|^blanc$/i), g(2, /rose gold|or rose/i)] },
  { id: "fr-duplicates", tag: "doublons/espaces", input: { mode: "simple", ...ctx("Écharpe laine", "Accessoires > Écharpes"), simpleColors: colors("  Beige ", "beige", "Beige clair"), sizesText: "" }, gold: [g(0, /^beige$/i), g(1, /^beige$/i), g(2, /^beige clair$/i)] },
  { id: "fr-special-chars", tag: "caractères interdits", input: { mode: "simple", ...ctx("Tapis salon", "Maison > Tapis"), simpleColors: colors("Gris*clair!", "Bleu@nuit", "Vert_sapin"), sizesText: "" }, gold: [g(0, /gris.*clair/i), g(1, /bleu.*nuit/i), g(2, /vert.*sapin/i)] },
  {
    id: "adv-basic",
    tag: "SKU tableau",
    skuPrefix: "PRD",
    input: { mode: "advanced", ...ctx("T-shirt coton homme", "Vêtements > T-shirts"), skuPrefix: "PRD", rows: [{ index: 0, color: "noir", size: "small", sku: null }, { index: 1, color: "noir", size: "medium", sku: null }, { index: 2, color: "BLANC", size: "large", sku: "" }] },
    gold: [g(0, /^noir$/i), g(1, /^noir$/i), g(2, /^blanc$/i)],
    goldRowSizes: [{ index: 0, size: "S" }, { index: 1, size: "M" }, { index: 2, size: "L" }],
  },
  {
    id: "adv-no-size",
    tag: "SKU sans taille",
    skuPrefix: "MUG",
    input: { mode: "advanced", ...ctx("Mug céramique", "Maison > Mugs"), skuPrefix: "MUG", rows: [{ index: 0, color: "blanc", size: null, sku: "" }, { index: 1, color: "noir mat", size: null, sku: "" }] },
    gold: [g(0, /^blanc$/i), g(1, /^noir mat$/i)],
    goldRowSizes: [{ index: 0, size: null }, { index: 1, size: null }],
  },
  {
    id: "adv-eu-sizes",
    tag: "tailles chaussures",
    skuPrefix: "SNK",
    input: { mode: "advanced", ...ctx("Baskets running homme", "Chaussures > Baskets"), skuPrefix: "SNK", rows: [{ index: 0, color: "Noir", size: "42", sku: "" }, { index: 1, color: "Noir", size: "43", sku: "" }, { index: 2, color: "Blanc", size: "44", sku: "" }] },
    gold: [g(0, /^noir$/i), g(1, /^noir$/i), g(2, /^blanc$/i)],
    goldRowSizes: [{ index: 0, size: "42" }, { index: 1, size: "43" }, { index: 2, size: "44" }],
  },
  {
    id: "adv-de",
    tag: "SKU tableau DE",
    skuPrefix: "JKT",
    input: { mode: "advanced", ...ctx("Herren Winterjacke", "Bekleidung > Jacken", "Warme Winterjacke."), skuPrefix: "JKT", rows: [{ index: 0, color: "schwarz", size: "xl", sku: "" }, { index: 1, color: "grau", size: "XXL", sku: "" }] },
    gold: [g(0, /^schwarz$/i), g(1, /^grau$/i)],
    goldRowSizes: [{ index: 0, size: "XL" }, { index: 1, size: "XXL" }],
  },
  {
    id: "adv-messy-sku",
    tag: "SKU existant sale",
    skuPrefix: "LMP",
    input: { mode: "advanced", ...ctx("Lampe de bureau LED", "Maison > Éclairage"), skuPrefix: "LMP", rows: [{ index: 0, color: "blanc chaud", size: null, sku: "lampe led blanc chaud !!" }, { index: 1, color: "blanc froid", size: null, sku: "lmp 2" }] },
    gold: [g(0, /^blanc chaud$/i), g(1, /^blanc froid$/i)],
    goldRowSizes: [{ index: 0, size: null }, { index: 1, size: null }],
  },
]
