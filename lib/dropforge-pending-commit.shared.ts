/** DropForge guest → supplier onboarding — client-safe sessionStorage bridge. */

export const DROPFORGE_PENDING_URL_KEY = "affisell_dropforge_pending_url"
export const DROPFORGE_PENDING_COMMIT_KEY = "affisell_dropforge_pending_commit"

export type DropForgePendingCommit = {
  v: 1
  sourceUrl: string
  preview: Record<string, unknown>
  wholesalePriceEur: number
  publishLive: boolean
  savedAt: number
}

export type DropForgeCommitIntent = "draft" | "live"

function parseWholesale(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function saveDropForgePendingCommit(args: {
  sourceUrl: string
  preview: Record<string, unknown>
  wholesalePrice: string
  publishLive: boolean
}): void {
  if (typeof window === "undefined") return
  const wholesale =
    parseWholesale(args.wholesalePrice) ??
    (typeof args.preview.costPrice === "number" && args.preview.costPrice > 0
      ? Math.max(args.preview.costPrice + 0.5, Number((args.preview.costPrice * 1.25).toFixed(2)))
      : 0)
  const payload: DropForgePendingCommit = {
    v: 1,
    sourceUrl: args.sourceUrl.trim(),
    preview: args.preview,
    wholesalePriceEur: wholesale,
    publishLive: args.publishLive,
    savedAt: Date.now(),
  }
  try {
    window.sessionStorage.setItem(DROPFORGE_PENDING_URL_KEY, payload.sourceUrl)
    window.sessionStorage.setItem(DROPFORGE_PENDING_COMMIT_KEY, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function loadDropForgePendingCommit(
  maxAgeMs = 7 * 24 * 60 * 60 * 1000
): DropForgePendingCommit | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(DROPFORGE_PENDING_COMMIT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DropForgePendingCommit
    if (parsed.v !== 1 || !parsed.sourceUrl || !parsed.preview) return null
    if (Date.now() - (parsed.savedAt ?? 0) > maxAgeMs) return null
    return parsed
  } catch {
    return null
  }
}

export function clearDropForgePendingCommit(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(DROPFORGE_PENDING_COMMIT_KEY)
    window.sessionStorage.removeItem(DROPFORGE_PENDING_URL_KEY)
  } catch {
    /* ignore */
  }
}

export function parseDropForgeCommitIntent(raw: string | null): DropForgeCommitIntent | null {
  if (raw === "draft" || raw === "live") return raw
  return null
}
