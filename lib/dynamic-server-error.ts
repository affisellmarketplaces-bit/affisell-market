/** Next.js throws when auth/cookies/headers run during a static prerender probe. */
export function isDynamicServerUsageError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const digest = "digest" in error ? String((error as { digest?: string }).digest) : ""
  if (digest === "DYNAMIC_SERVER_USAGE") return true
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes("DYNAMIC_SERVER_USAGE") ||
    message.includes("couldn't be rendered statically") ||
    message.includes("used `headers`") ||
    message.includes("used `cookies`")
  )
}
