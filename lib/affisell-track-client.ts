import { getOrCreateAgentSessionId } from "@/lib/agent-session"
import { hasAnalyticsConsent } from "@/lib/legal/cookie-consent-runtime"

type TrackType = "view" | "hover" | "add_to_cart"

export function trackAffisellEvent(
  type: TrackType,
  productId: string | undefined,
  options?: { durationMs?: number }
) {
  // D1: nothing is sent (and no session id is created for it) without analytics consent; the server checks again.
  if (!hasAnalyticsConsent()) return
  const sessionId = getOrCreateAgentSessionId()
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      productId: productId ?? null,
      sessionId: sessionId || undefined,
      durationMs: options?.durationMs,
    }),
  }).catch(() => {})
}
