import { hasAnalyticsConsent } from "@/lib/legal/cookie-consent-runtime"

type Props = Record<string, string | number | boolean | null | undefined>

/** Lightweight PostHog capture — no-ops when keys are unset. */
export function capturePosthog(event: string, properties?: Props, distinctId?: string) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
  if (!key || typeof window === "undefined") {
    if (process.env.NODE_ENV === "development" && !key) return
    if (typeof window !== "undefined") return
  }

  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      properties: { ...properties, $lib: "affisell-server" },
      distinct_id: distinctId ?? "anonymous",
    }),
    keepalive: true,
  }).catch(() => {})
}

export function capturePosthogClient(event: string, properties?: Props) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com"
  if (!key || typeof window === "undefined") return
  if (!hasAnalyticsConsent()) return
  void fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      properties,
      distinct_id: "browser",
    }),
    keepalive: true,
  }).catch(() => {})
}
