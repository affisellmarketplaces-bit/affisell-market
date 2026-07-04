/** Brand Studio ops metadata in storefrontTheme JSON — client-safe (no Prisma). */

import {
  parseStorefrontPresetAb,
  type StorefrontPresetAb,
} from "@/lib/storefront-preset-ab-shared"

export type { StorefrontPresetAb } from "@/lib/storefront-preset-ab-shared"

export type StorefrontBrandOps = {
  /** ISO timestamp — idempotent Brand Pulse nudge email */
  brandPulseReminderSentAt?: string
  /** ISO timestamp — weekly digest cooldown */
  brandPulseWeeklyDigestSentAt?: string
  /** Last recorded Brand Pulse score (weekly digest snapshot) */
  brandPulseLastScore?: number
  /** Preset A/B experiment stats + config */
  presetAb?: StorefrontPresetAb
}

export function parseStorefrontBrandOps(raw: unknown): StorefrontBrandOps | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const ops: StorefrontBrandOps = {}

  if (typeof o.brandPulseReminderSentAt === "string" && o.brandPulseReminderSentAt.trim()) {
    ops.brandPulseReminderSentAt = o.brandPulseReminderSentAt.trim().slice(0, 40)
  }
  if (typeof o.brandPulseWeeklyDigestSentAt === "string" && o.brandPulseWeeklyDigestSentAt.trim()) {
    ops.brandPulseWeeklyDigestSentAt = o.brandPulseWeeklyDigestSentAt.trim().slice(0, 40)
  }
  if (typeof o.brandPulseLastScore === "number" && o.brandPulseLastScore >= 0 && o.brandPulseLastScore <= 100) {
    ops.brandPulseLastScore = Math.round(o.brandPulseLastScore)
  }
  const presetAb = parseStorefrontPresetAb(o.presetAb)
  if (presetAb) ops.presetAb = presetAb

  return Object.keys(ops).length > 0 ? ops : undefined
}

export function mergeStorefrontBrandOps(
  existing: StorefrontBrandOps | undefined,
  patch: Partial<StorefrontBrandOps>
): StorefrontBrandOps {
  return { ...existing, ...patch }
}
