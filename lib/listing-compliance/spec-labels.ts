/**
 * Buyer-facing labels for the spec rows of a product page.
 *
 * Rows are stored with a free `label` that the wizards wrote in French ("Matériau", "Fabricant"…), so an English or
 * German buyer saw French. The KEY is stable, so the label is translated from the key; the stored label stays the
 * fallback for every key we do not know (category-specific attributes keep their own labels).
 * Client-safe.
 */
import { GPSR_KEYS, IDENTITY_KEYS } from "@/lib/listing-compliance/keys"

/** Attribute key → id under `productSpecs.keys.*` in the message catalogues. */
export const SPEC_LABEL_IDS: Readonly<Record<string, string>> = {
  [IDENTITY_KEYS.brand]: "brand",
  [IDENTITY_KEYS.gtin]: "gtin",
  [IDENTITY_KEYS.mpn]: "mpn",
  [GPSR_KEYS.manufacturerName]: "manufacturerName",
  [GPSR_KEYS.manufacturerAddress]: "manufacturerAddress",
  [GPSR_KEYS.manufacturerEmail]: "manufacturerEmail",
  [GPSR_KEYS.manufacturerCountry]: "manufacturerCountry",
  [GPSR_KEYS.euRepName]: "euRepName",
  [GPSR_KEYS.euRepAddress]: "euRepAddress",
  [GPSR_KEYS.euRepEmail]: "euRepEmail",
  [GPSR_KEYS.safetyWarning]: "safetyWarning",
  [GPSR_KEYS.notice]: "notice",
  [GPSR_KEYS.traceability]: "traceability",
  // Written by the wizards / the core spec preset with French labels.
  material: "material",
  color: "color",
  size: "size",
  dimensions: "dimensions",
}

/** Internal flags: never shown to buyers. */
export const HIDDEN_SPEC_KEYS: ReadonlySet<string> = new Set([IDENTITY_KEYS.gtinExempt])

type Translator = { (key: string): string; has?: (key: string) => boolean }

export function localizeSpecLabel(key: string, storedLabel: string, t: Translator): string {
  const id = SPEC_LABEL_IDS[key]
  if (!id) return storedLabel
  const path = `keys.${id}`
  if (typeof t.has === "function" && !t.has(path)) return storedLabel
  return t(path)
}
