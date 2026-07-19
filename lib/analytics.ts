/**
 * Safe client analytics — never throws, never blocks UX.
 * Prefers window.posthog → gtag → Affisell capturePosthogClient fetch.
 */

type TrackProps = Record<string, unknown>

declare global {
  interface Window {
    posthog?: {
      capture: (event: string, props?: TrackProps) => void
    }
    gtag?: (...args: unknown[]) => void
  }
}

function isDev(): boolean {
  return process.env.NODE_ENV === "development"
}

/**
 * Fire-and-forget browser analytics.
 * Safe when PostHog/gtag are missing or blocked.
 */
export function track(event: string, props?: TrackProps): void {
  try {
    if (typeof window === "undefined") return

    if (window.posthog?.capture) {
      window.posthog.capture(event, props)
    }

    if (typeof window.gtag === "function") {
      window.gtag("event", event, props ?? {})
    }

    // Affisell built-in PostHog capture (consent-gated)
    void import("@/lib/analytics/posthog")
      .then(({ capturePosthogClient }) => {
        const flat: Record<string, string | number | boolean | null | undefined> = {}
        if (props) {
          for (const [k, v] of Object.entries(props)) {
            if (v === null || v === undefined) {
              flat[k] = v
            } else if (
              typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean"
            ) {
              flat[k] = v
            } else {
              try {
                flat[k] = JSON.stringify(v)
              } catch {
                flat[k] = String(v)
              }
            }
          }
        }
        capturePosthogClient(event, flat)
      })
      .catch(() => {})

    if (isDev()) {
      console.log("[analytics]", event, props ?? {})
    }
  } catch (err) {
    if (isDev()) {
      console.warn("[analytics]", {
        result: "track_failed",
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * Server-side capture (adblock-proof). Fire-and-forget via existing PostHog HTTP helper.
 */
export function trackServer(
  distinctId: string,
  event: string,
  props?: Record<string, string | number | boolean | null | undefined>
): void {
  try {
    void import("@/lib/analytics/posthog")
      .then(({ capturePosthog }) => {
        capturePosthog(event, props, distinctId)
      })
      .catch(() => {})
  } catch {
    /* never throw from analytics */
  }
}
