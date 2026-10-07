/**
 * Local draft of the guided "add a product" wizard — pure functions over a Storage-like object, no React.
 *
 * The wizard takes a few minutes (photos, title, price, GPSR data) and used to lose everything on a closed tab, a crash or a
 * lost connection. The work in progress is kept in localStorage and offered back next time. Everything read back is treated as
 * untrusted: it is re-validated field by field (types, lengths, https URLs only, whitelisted attribute keys), never restored
 * as stored. Photos are already uploaded (durable URLs), so a restored draft keeps them.
 *
 * Scoped to the supplier id (another account on the same browser never sees it), expires after a week, and is cleared on
 * publish or when the supplier chooses to start over.
 */
import { LISTING_COMPLIANCE_KEYS } from "@/lib/listing-compliance/keys"

export const GUIDED_DRAFT_VERSION = 1
export const GUIDED_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const GUIDED_MAX_PHOTOS = 8

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

/** The serialisable part of the wizard form (no blob previews, no UI state). */
export type GuidedDraftForm = {
  title: string
  category: string
  leafId: string
  leafBreadcrumb: string
  description: string
  descriptionBullets: string[]
  material: string
  color: string
  dimensions: string
  stock: string
  price: string
  /** Main photo (durable https URL) or "". */
  imageUrl: string
  extraImages: string[]
  compliance: Record<string, string>
}

export type StoredGuidedDraft = {
  v: typeof GUIDED_DRAFT_VERSION
  supplierId: string
  savedAt: number
  step: number
  form: GuidedDraftForm
}

export const guidedDraftKey = (supplierId: string) => `affisell:guided-add-draft:v${GUIDED_DRAFT_VERSION}:${supplierId.trim()}`

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "")
const isHttps = (u: string) => /^https:\/\/[^\s]+$/i.test(u) && u.length <= 2000

const COMPLIANCE_KEY_SET = new Set<string>(LISTING_COMPLIANCE_KEYS)

/** Returns a clean form, or null when `raw` is not an object. Unknown fields are dropped, bad values emptied. */
export function sanitizeGuidedDraftForm(raw: unknown, allowedCategories: readonly string[]): GuidedDraftForm | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>

  const category = str(r.category, 40)
  const imageUrl = isHttps(str(r.imageUrl, 2000)) ? str(r.imageUrl, 2000) : ""
  const extra = Array.isArray(r.extraImages) ? r.extraImages.filter((u): u is string => typeof u === "string" && isHttps(u)) : []
  const uniqueExtra = [...new Set(extra.filter((u) => u !== imageUrl))].slice(0, GUIDED_MAX_PHOTOS - 1)

  const compliance: Record<string, string> = {}
  if (r.compliance && typeof r.compliance === "object" && !Array.isArray(r.compliance)) {
    for (const [k, v] of Object.entries(r.compliance as Record<string, unknown>)) {
      if (COMPLIANCE_KEY_SET.has(k) && typeof v === "string" && v.trim()) compliance[k] = v.slice(0, 500)
    }
  }

  return {
    title: str(r.title, 120),
    category: allowedCategories.includes(category) ? category : "",
    leafId: str(r.leafId, 64),
    leafBreadcrumb: str(r.leafBreadcrumb, 300),
    description: str(r.description, 8000),
    descriptionBullets: Array.isArray(r.descriptionBullets)
      ? r.descriptionBullets.filter((b): b is string => typeof b === "string").map((b) => b.slice(0, 300)).slice(0, 10)
      : [],
    material: str(r.material, 200),
    color: str(r.color, 200),
    dimensions: str(r.dimensions, 200),
    stock: /^\d{1,7}$/.test(str(r.stock, 12)) ? str(r.stock, 12) : "",
    price: /^\d{1,7}([.,]\d{0,2})?$/.test(str(r.price, 14)) ? str(r.price, 14) : "",
    imageUrl,
    extraImages: uniqueExtra,
    compliance,
  }
}

/** Worth keeping: something the supplier would be sorry to lose. A blank wizard never overwrites a real draft. */
export function isMeaningfulGuidedForm(f: GuidedDraftForm): boolean {
  return Boolean(
    f.title.trim() || f.imageUrl || f.extraImages.length || f.description.trim() || f.price || Object.keys(f.compliance).length
  )
}

export function buildGuidedDraft(args: { supplierId: string; form: GuidedDraftForm; step: number; now: number }): StoredGuidedDraft {
  return {
    v: GUIDED_DRAFT_VERSION,
    supplierId: args.supplierId,
    savedAt: args.now,
    step: Math.min(3, Math.max(0, Math.round(args.step) || 0)),
    form: args.form,
  }
}

export function parseGuidedDraft(
  raw: string | null,
  supplierId: string,
  allowedCategories: readonly string[],
  now: number
): StoredGuidedDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<StoredGuidedDraft> | null
    if (!d || typeof d !== "object") return null
    if (d.v !== GUIDED_DRAFT_VERSION || d.supplierId !== supplierId) return null
    if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt)) return null
    if (now - d.savedAt > GUIDED_DRAFT_MAX_AGE_MS || d.savedAt > now + 60_000) return null
    const form = sanitizeGuidedDraftForm(d.form, allowedCategories)
    if (!form || !isMeaningfulGuidedForm(form)) return null
    return buildGuidedDraft({ supplierId, form, step: typeof d.step === "number" ? d.step : 0, now: d.savedAt })
  } catch {
    return null
  }
}

export function readGuidedDraft(
  storage: StorageLike | null,
  supplierId: string,
  allowedCategories: readonly string[],
  now = Date.now()
): StoredGuidedDraft | null {
  if (!storage || !supplierId) return null
  try {
    return parseGuidedDraft(storage.getItem(guidedDraftKey(supplierId)), supplierId, allowedCategories, now)
  } catch {
    return null
  }
}

export function writeGuidedDraft(storage: StorageLike | null, draft: StoredGuidedDraft): void {
  if (!storage) return
  try {
    storage.setItem(guidedDraftKey(draft.supplierId), JSON.stringify(draft))
  } catch {
    /* quota / private mode: the draft is a convenience, never an error */
  }
}

export function clearGuidedDraft(storage: StorageLike | null, supplierId: string): void {
  if (!storage || !supplierId) return
  try {
    storage.removeItem(guidedDraftKey(supplierId))
  } catch {
    /* ignore */
  }
}
