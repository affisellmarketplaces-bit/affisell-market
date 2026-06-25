function asRec(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Unwrap `runParams.data`, nested `pageModule`, etc. */
export function normalizeAerRoot(payload: unknown): Record<string, unknown> | null {
  const aer = asRec(payload)
  if (!aer) return null

  const data = asRec(aer.data)
  if (data?.pageModule) return data
  if (aer.pageModule) return aer
  if (data) return data

  return aer
}
