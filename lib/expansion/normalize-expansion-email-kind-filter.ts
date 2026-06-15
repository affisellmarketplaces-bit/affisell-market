const VALID_KINDS = new Set([
  "checkout-launch",
  "checkout-launch-followup",
  "checkout-graduated",
])

export function normalizeExpansionEmailKindFilter(raw: string | null | undefined): string | undefined {
  const kind = raw?.trim().toLowerCase()
  if (!kind || !VALID_KINDS.has(kind)) return undefined
  return kind
}

export function isValidExpansionEmailKindFilter(kind: string): boolean {
  return VALID_KINDS.has(kind)
}
