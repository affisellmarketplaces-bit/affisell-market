/** Store name display styles — safe for `"use client"` (no Prisma). */

export const STORE_NAME_BADGE_STYLES = [
  "parallelogram",
  "neon-slab",
  "holo-ribbon",
  "quantum-fold",
  "orbit-ring",
  "chrome-beam",
] as const

export type StoreNameBadgeStyle = (typeof STORE_NAME_BADGE_STYLES)[number] | "classic"

export const DEFAULT_STORE_NAME_BADGE: StoreNameBadgeStyle = "parallelogram"

export function parseStoreNameBadgeStyle(raw: unknown): StoreNameBadgeStyle {
  if (typeof raw !== "string") return DEFAULT_STORE_NAME_BADGE
  const v = raw.trim().toLowerCase()
  if (v === "classic") return "classic"
  if ((STORE_NAME_BADGE_STYLES as readonly string[]).includes(v)) {
    return v as StoreNameBadgeStyle
  }
  return DEFAULT_STORE_NAME_BADGE
}

export type StoreNameBadgeStyleMeta = {
  id: StoreNameBadgeStyle
  /** i18n key under `storefront.brandStudio.nameBadges.{id}` */
  labelKey: string
  descriptionKey: string
}

export const STORE_NAME_BADGE_CATALOG: StoreNameBadgeStyleMeta[] = [
  {
    id: "parallelogram",
    labelKey: "parallelogram",
    descriptionKey: "parallelogramDesc",
  },
  {
    id: "neon-slab",
    labelKey: "neonSlab",
    descriptionKey: "neonSlabDesc",
  },
  {
    id: "holo-ribbon",
    labelKey: "holoRibbon",
    descriptionKey: "holoRibbonDesc",
  },
  {
    id: "quantum-fold",
    labelKey: "quantumFold",
    descriptionKey: "quantumFoldDesc",
  },
  {
    id: "orbit-ring",
    labelKey: "orbitRing",
    descriptionKey: "orbitRingDesc",
  },
  {
    id: "chrome-beam",
    labelKey: "chromeBeam",
    descriptionKey: "chromeBeamDesc",
  },
  {
    id: "classic",
    labelKey: "classic",
    descriptionKey: "classicDesc",
  },
]
