/**
 * Local draft recovery for the Brand Studio — pure functions over a Storage-like object, no React.
 *
 * A merchant can spend a long session in the studio; closing the tab, a crash or a lost connection used to lose it all.
 * The unsaved design is kept in localStorage and offered back next time — but only when it is still safe to restore:
 *   • it was started from the version that is currently saved (`baseKey`) — otherwise the store changed elsewhere (another
 *     device, an AI theme saved from a panel) and restoring would silently overwrite newer work;
 *   • it actually differs from what is saved;
 *   • it is not older than a week.
 * A restored draft is re-validated by `snapshotFromStore` → `parseStorefrontTheme`, never trusted as stored.
 */
import {
  snapshotFromStore,
  snapshotToStoreRow,
  snapshotsEqual,
  type BrandStudioSnapshot,
  type BrandStudioStoreRow,
} from "@/lib/storefront/brand-studio-snapshot"

export const DRAFT_VERSION = 1
export const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">

export type StoredDraft = {
  v: typeof DRAFT_VERSION
  slug: string
  savedAt: number
  /** Fingerprint of the saved design this draft was started from. */
  baseKey: string
  row: BrandStudioStoreRow
}

export function draftStorageKey(slug: string): string {
  return `affisell:brand-studio-draft:v${DRAFT_VERSION}:${slug.trim().toLowerCase()}`
}

/** JSON with sorted keys, so two equal designs always fingerprint the same regardless of key order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(",")}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`
}

export function snapshotFingerprint(snapshot: BrandStudioSnapshot): string {
  return stableStringify(snapshotToStoreRow(snapshot, ""))
}

export function buildDraft(args: {
  slug: string
  snapshot: BrandStudioSnapshot
  base: BrandStudioSnapshot
  now: number
}): StoredDraft {
  return {
    v: DRAFT_VERSION,
    slug: args.slug,
    savedAt: args.now,
    baseKey: snapshotFingerprint(args.base),
    row: snapshotToStoreRow(args.snapshot, args.slug),
  }
}

export function parseDraft(raw: string | null, slug: string): StoredDraft | null {
  if (!raw) return null
  try {
    const d = JSON.parse(raw) as Partial<StoredDraft> | null
    if (!d || typeof d !== "object") return null
    if (d.v !== DRAFT_VERSION || d.slug !== slug) return null
    if (typeof d.savedAt !== "number" || !Number.isFinite(d.savedAt)) return null
    if (typeof d.baseKey !== "string") return null
    const row = d.row
    if (!row || typeof row !== "object" || typeof row.name !== "string") return null
    return { v: DRAFT_VERSION, slug, savedAt: d.savedAt, baseKey: d.baseKey, row: row as BrandStudioStoreRow }
  } catch {
    return null
  }
}

export type DraftVerdict =
  | { action: "restore"; snapshot: BrandStudioSnapshot; savedAt: number }
  | { action: "discard"; reason: "stale" | "expired" | "identical" }

/** Decides whether a stored draft should be offered back, against the design that is saved right now. */
export function evaluateDraft(draft: StoredDraft, saved: BrandStudioSnapshot, now: number): DraftVerdict {
  if (now - draft.savedAt > DRAFT_MAX_AGE_MS) return { action: "discard", reason: "expired" }
  if (draft.baseKey !== snapshotFingerprint(saved)) return { action: "discard", reason: "stale" }
  const snapshot = snapshotFromStore(draft.row)
  if (snapshotsEqual(snapshot, saved)) return { action: "discard", reason: "identical" }
  return { action: "restore", snapshot, savedAt: draft.savedAt }
}

export function readDraft(storage: StorageLike | null, slug: string): StoredDraft | null {
  if (!storage || !slug) return null
  try {
    return parseDraft(storage.getItem(draftStorageKey(slug)), slug)
  } catch {
    return null
  }
}

export function writeDraft(storage: StorageLike | null, draft: StoredDraft): void {
  if (!storage) return
  try {
    storage.setItem(draftStorageKey(draft.slug), JSON.stringify(draft))
  } catch {
    /* quota / private mode: the draft is a convenience, never an error */
  }
}

export function clearDraft(storage: StorageLike | null, slug: string): void {
  if (!storage || !slug) return
  try {
    storage.removeItem(draftStorageKey(slug))
  } catch {
    /* ignore */
  }
}
