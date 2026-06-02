type BusinessLogPayload = Record<string, unknown>

/** Structured business log for Metabase / Vercel log drains. */
export function logBusiness(module: string, payload: BusinessLogPayload): void {
  console.log(`[${module}]`, payload)
}
