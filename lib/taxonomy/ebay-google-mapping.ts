/**
 * eBay FR label → Google taxonomy target (import / listing sync).
 * Google remains source of truth — this table only maps external labels.
 */

import { normalizeTaxonomyLabel } from "@/lib/taxonomy/normalize-taxonomy-label"
import type { BrowseDepartmentTarget } from "@/lib/taxonomy/browse-departments-shared"

export type EbayGoogleMappingTarget = BrowseDepartmentTarget | { kind: "unmapped" }

/** Hand-curated overrides where eBay labels diverge from Google FR names. */
const EXPLICIT_EBAY_FR_TO_GOOGLE: Record<string, BrowseDepartmentTarget> = {
  "high-tech": { kind: "googleRoot", rootNameFr: "Appareils électroniques" },
  "informatique, reseaux": {
    kind: "googleFullPath",
    fullPathFr: "Appareils électroniques > Ordinateurs",
  },
  "telephonie, mobilite": {
    kind: "googleFullPath",
    fullPathFr: "Appareils électroniques > Communications > Téléphonie",
  },
  "jeux video, consoles": { kind: "googleFullPath", fullPathFr: "Logiciels > Jeux vidéo" },
  "image, son": {
    kind: "googleFullPath",
    fullPathFr: "Appareils électroniques > Audio",
  },
  "photo, camescopes": {
    kind: "googleRoot",
    rootNameFr: "Appareils photo, caméras et instruments d'optique",
  },
  "pieces et accessoires pour auto et moto": {
    kind: "googleRoot",
    rootNameFr: "Véhicules et accessoires",
  },
  "automobile : pieces et accessoires": {
    kind: "googleRoot",
    rootNameFr: "Véhicules et accessoires",
  },
  "jouets et jeux": { kind: "googleRoot", rootNameFr: "Jeux et jouets" },
  "articles de collection": {
    kind: "googleFullPath",
    fullPathFr: "Arts et loisirs > Loisirs et arts créatifs > Articles de collection",
  },
  "bijoux et montres": {
    kind: "googleFullPath",
    fullPathFr: "Vêtements et accessoires > Bijoux",
  },
  "art et antiquites": { kind: "googleRoot", rootNameFr: "Arts et loisirs" },
  monnaies: {
    kind: "googleFullPath",
    fullPathFr:
      "Arts et loisirs > Loisirs et arts créatifs > Articles de collection > Pièces de monnaie et devises à collectionner",
  },
  timbres: {
    kind: "googleFullPath",
    fullPathFr:
      "Arts et loisirs > Loisirs et arts créatifs > Articles de collection > Timbres-poste",
  },
  sport: { kind: "googleRoot", rootNameFr: "Équipements sportifs" },
  "maison, jardin, bricolage": { kind: "googleRoot", rootNameFr: "Maison et jardin" },
  "beaute, bien-etre, parfums": { kind: "googleRoot", rootNameFr: "Santé et beauté" },
  "livres, bandes dessinees, revues": { kind: "googleRoot", rootNameFr: "Médias" },
  "bebe : vetements, accessoires": { kind: "googleRoot", rootNameFr: "Bébés et tout-petits" },
  animaux: {
    kind: "googleRoot",
    rootNameFr: "Animaux et articles pour animaux de compagnie",
  },
  "alimentation, boissons": {
    kind: "googleRoot",
    rootNameFr: "Alimentation, boissons et tabac",
  },
  "bricolage, jardin, piscine": { kind: "googleRoot", rootNameFr: "Quincaillerie" },
  "vetements et accessoires": { kind: "googleRoot", rootNameFr: "Vêtements et accessoires" },
  "femme : vetements, accessoires": { kind: "googleRoot", rootNameFr: "Vêtements et accessoires" },
  "homme : vetements, accessoires": { kind: "googleRoot", rootNameFr: "Vêtements et accessoires" },
  "enfant : vetements, accessoires": { kind: "googleRoot", rootNameFr: "Vêtements et accessoires" },
  militaria: { kind: "search", queryFr: "militaria" },
  "cartes de collection": {
    kind: "googleFullPath",
    fullPathFr:
      "Arts et loisirs > Loisirs et arts créatifs > Articles de collection > Cartes à collectionner",
  },
  automobilia: { kind: "search", queryFr: "automobilia" },
  bistrot: { kind: "search", queryFr: "bistrot collection" },
}

/** Resolve an eBay FR category label to a Google taxonomy navigation target. */
export function resolveEbayLabelToGoogleTarget(label: string): EbayGoogleMappingTarget {
  const trimmed = label.trim()
  if (!trimmed) return { kind: "unmapped" }

  const norm = normalizeTaxonomyLabel(trimmed)
  const explicit = EXPLICIT_EBAY_FR_TO_GOOGLE[norm]
  if (explicit) return explicit

  return { kind: "googleRoot", rootNameFr: trimmed }
}

/** All explicit eBay → Google mappings (for docs / import tooling). */
export function listExplicitEbayGoogleMappings(): Array<{ ebayLabelNorm: string; target: BrowseDepartmentTarget }> {
  return Object.entries(EXPLICIT_EBAY_FR_TO_GOOGLE).map(([ebayLabelNorm, target]) => ({
    ebayLabelNorm,
    target,
  }))
}
