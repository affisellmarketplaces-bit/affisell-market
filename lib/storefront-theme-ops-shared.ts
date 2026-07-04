/** Brand Studio ops metadata in storefrontTheme JSON — client-safe. */

export type StorefrontBrandOps = {
  /** ISO timestamp — idempotent Brand Pulse nudge email */
  brandPulseReminderSentAt?: string
}

export function parseStorefrontBrandOps(raw: unknown): StorefrontBrandOps | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const sentAt = o.brandPulseReminderSentAt
  if (typeof sentAt !== "string" || !sentAt.trim()) return undefined
  return { brandPulseReminderSentAt: sentAt.trim().slice(0, 40) }
}

export function mergeStorefrontBrandOps(
  existing: StorefrontBrandOps | undefined,
  patch: Partial<StorefrontBrandOps>
): StorefrontBrandOps {
  return { ...existing, ...patch }
}
