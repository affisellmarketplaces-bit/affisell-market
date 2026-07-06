/** Flash sale vitrine — client-safe (no Prisma). */

import type { HomepageSectionContent } from "@/lib/storefront-sections-shared"

export const FLASH_SALE_MAX_LISTINGS = 8

export const FLASH_SALE_DURATION_PRESET_HOURS = [6, 24, 48, 72] as const

export type FlashSaleConfig = {
  endsAt: string
  listingIds: string[]
  eyebrow?: string
  title?: string
}

export function parseFlashSaleListingIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw
          .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
          .map((id) => id.trim())
      ),
    ].slice(0, FLASH_SALE_MAX_LISTINGS)
  }
  if (typeof raw === "string" && raw.trim()) {
    return [
      ...new Set(
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      ),
    ].slice(0, FLASH_SALE_MAX_LISTINGS)
  }
  return []
}

export function parseFlashSaleEndsAt(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null
  const d = new Date(raw.trim())
  return Number.isFinite(d.getTime()) ? d.toISOString() : null
}

export function isFlashSaleActive(endsAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!endsAt) return false
  const end = new Date(endsAt).getTime()
  return Number.isFinite(end) && end > nowMs
}

export function flashSaleRemainingMs(endsAt: string, nowMs = Date.now()): number {
  const end = new Date(endsAt).getTime()
  if (!Number.isFinite(end)) return 0
  return Math.max(0, end - nowMs)
}

export function formatFlashSaleCountdownParts(ms: number): {
  days: number
  hours: number
  minutes: number
  seconds: number
} {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds }
}

export function endsAtFromPresetHours(hours: number, from = new Date()): string {
  const safe = Math.min(168, Math.max(1, Math.round(hours)))
  const d = new Date(from.getTime())
  d.setHours(d.getHours() + safe)
  return d.toISOString()
}

export function pickFlashSaleProducts<T extends { listingId: string }>(
  products: T[],
  listingIds: string[]
): T[] {
  if (listingIds.length === 0) return []
  const byId = new Map(products.map((p) => [p.listingId, p]))
  return listingIds.map((id) => byId.get(id)).filter((p): p is T => Boolean(p))
}

export function flashSaleFromSectionContent(
  content: HomepageSectionContent | undefined
): FlashSaleConfig | null {
  const endsAt = parseFlashSaleEndsAt(content?.endsAt)
  const listingIds = parseFlashSaleListingIds(content?.listingIds)
  if (!endsAt || listingIds.length === 0) return null

  const eyebrow =
    typeof content?.eyebrow === "string" && content.eyebrow.trim()
      ? content.eyebrow.trim()
      : undefined
  const title =
    typeof content?.title === "string" && content.title.trim() ? content.title.trim() : undefined

  return { endsAt, listingIds, eyebrow, title }
}
