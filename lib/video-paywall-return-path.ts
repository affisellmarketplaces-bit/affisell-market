/** Safe relative return path after Stripe Pro checkout (supplier dashboard only). */
export function sanitizeVideoProReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith("/")) return null
  if (trimmed.startsWith("//")) return null
  if (!trimmed.startsWith("/dashboard/supplier")) return null
  if (trimmed.includes("://")) return null
  return trimmed.split("?")[0]?.split("#")[0] ?? null
}
