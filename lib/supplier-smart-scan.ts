/**
 * Pure decision logic for the supplier "Scan intelligent" — the auto-draft step that fires once a
 * category is confirmed, filling description + category specs + a price suggestion from the product
 * photo(s). Kept side-effect free and framework-free so it is trivially unit-testable; the React hook
 * (`use-supplier-smart-scan.ts`) only handles timing/fetch/refs.
 *
 * Design constraint learned from the retired InstantScan wizard (commit a250033e3, Aug 2026): a scan
 * must NEVER be a gate. Every function here degrades to "do nothing, the manual form still works."
 */

export type SmartScanCharacteristic = {
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
}

export type SmartScanTriggerInput = {
  categoryId: string
  /** Current description field — a scan only fires while the supplier hasn't started writing. */
  description: string
  /** Form image list (https URLs and/or data: URLs from a fresh upload). */
  images: string[]
  /** Fingerprint of the last scan already run (or attempted) in this session, if any. */
  lastRunFingerprint: string | null
}

/** Below this, the description is considered "still empty" for auto-fill purposes. */
const UNTOUCHED_DESCRIPTION_MAX_LEN = 6

function isHttpsUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim())
}

function isDataImageUrl(s: string): boolean {
  return /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(s.trim())
}

/** Stable key so the same category+photo combination never re-triggers a scan on every re-render. */
export function smartScanFingerprint(categoryId: string, images: string[]): string {
  return `${categoryId.trim()}|${images[0]?.trim() ?? ""}`
}

export function shouldTriggerSmartScan(input: SmartScanTriggerInput): boolean {
  const categoryId = input.categoryId.trim()
  if (!categoryId) return false
  if (input.description.trim().length > UNTOUCHED_DESCRIPTION_MAX_LEN) return false
  const usableImages = input.images.filter((u) => isHttpsUrl(u) || isDataImageUrl(u))
  if (usableImages.length === 0) return false
  const fp = smartScanFingerprint(categoryId, input.images)
  return fp !== input.lastRunFingerprint
}

export function buildSmartScanRequestBody(args: {
  name: string
  description: string
  images: string[]
  categoryPathLabel: string
  characteristics: SmartScanCharacteristic[]
}): {
  name: string
  description: string
  imageUrls: string[]
  imageDataUrls: string[]
  categoryPath: string
  characteristics: SmartScanCharacteristic[]
} {
  const imageUrls = args.images.filter(isHttpsUrl).slice(0, 4)
  const imageDataUrls = args.images.filter(isDataImageUrl).slice(0, 4)
  return {
    name: args.name.trim(),
    description: args.description.trim(),
    imageUrls,
    imageDataUrls,
    categoryPath: args.categoryPathLabel.trim(),
    characteristics: args.characteristics,
  }
}

export type SmartScanResult = {
  description: string
  specs: Record<string, string>
  suggestedPriceEur: number | null
  duplicate: boolean
}

/**
 * Shared client/server validation for the model's price guess: a finite, plausible EUR amount, or
 * null. Used both by the API route (authoritative) and the client parse below (defense in depth).
 */
export function parseSuggestedPriceEur(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(",", ".")) : NaN
  return Number.isFinite(n) && n > 0 && n < 100_000 ? Math.round(n * 100) / 100 : null
}

/** Defensive parse — a malformed/partial API response degrades to "nothing usable", never throws. */
export function parseSmartScanResponse(json: unknown): SmartScanResult | null {
  if (!json || typeof json !== "object") return null
  const o = json as Record<string, unknown>
  const description = typeof o.description === "string" ? o.description.trim() : ""
  const specs: Record<string, string> = {}
  if (o.specs && typeof o.specs === "object" && !Array.isArray(o.specs)) {
    for (const [k, v] of Object.entries(o.specs as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) specs[k] = v.trim()
    }
  }
  const suggestedPriceEur = parseSuggestedPriceEur(o.suggestedPriceEur)
  const duplicate = o.duplicate === true

  if (!description && Object.keys(specs).length === 0 && suggestedPriceEur === null) return null
  return { description, specs, suggestedPriceEur, duplicate }
}

export type SmartScanPatch = {
  description?: string
  specValuesPatch: Record<string, string>
  price?: string
  duplicate: boolean
}

/**
 * Turns a raw result into what's actually safe to write into form state right now.
 * `currentDescription`/`currentPrice` are read at apply time (not trigger time) so a supplier who
 * started typing while the scan was in flight never gets overwritten.
 */
export function buildSmartScanPatch(
  result: SmartScanResult,
  current: { description: string; price: string }
): SmartScanPatch {
  const patch: SmartScanPatch = { specValuesPatch: result.specs, duplicate: result.duplicate }
  if (result.description && current.description.trim().length <= UNTOUCHED_DESCRIPTION_MAX_LEN) {
    patch.description = result.description
  }
  if (result.suggestedPriceEur !== null && !(Number(current.price) > 0)) {
    patch.price = String(result.suggestedPriceEur)
  }
  return patch
}
