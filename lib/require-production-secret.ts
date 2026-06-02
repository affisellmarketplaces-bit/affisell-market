/** True when webhook/cron secrets must be configured (open endpoints rejected). */
export function mustEnforceProductionSecrets(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
}

/**
 * Webhook HMAC: reject when secret missing in production/Vercel.
 * @returns null when verification should proceed with `verifyFn`, or an error code.
 */
export function webhookSecretGate(
  secret: string | undefined | null
): "missing_prod" | "missing_sig" | null {
  const trimmed = secret?.trim() ?? ""
  if (trimmed) return null
  if (mustEnforceProductionSecrets()) return "missing_prod"
  return "missing_sig"
}
