/** Errors that must not be retried — go straight to FAILED / DLQ. */
export class NonRetryablePlaceOrderError extends Error {
  readonly code = "NON_RETRYABLE"
  constructor(message: string) {
    super(message)
    this.name = "NonRetryablePlaceOrderError"
  }
}

const NON_RETRYABLE_PREFIXES = [
  "fulfillment_provider_not_found",
  "provider_inactive",
  "blind_rest_missing_credentials",
  "Margin below minimum",
  "MARGIN_TOO_LOW",
] as const

export function isNonRetryablePlaceOrderError(err: unknown): boolean {
  if (err instanceof NonRetryablePlaceOrderError) return true
  const msg = err instanceof Error ? err.message : String(err)
  return NON_RETRYABLE_PREFIXES.some((p) => msg.includes(p))
}
