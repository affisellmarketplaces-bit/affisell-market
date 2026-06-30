/** Public app origin (no server-only deps — safe for client bundles). */
export function appBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.AFFISELL_PLATFORM_ORIGIN?.trim() ||
    (process.env.VERCEL_ENV === "production" ? "https://affisell.com" : "") ||
    process.env.VERCEL_URL?.trim()
  if (!raw) return "http://localhost:3001"
  if (raw.startsWith("http")) return raw.replace(/\/$/, "")
  return `https://${raw.replace(/\/$/, "")}`
}
