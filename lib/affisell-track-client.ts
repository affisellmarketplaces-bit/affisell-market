import { getOrCreateAgentSessionId } from "@/lib/agent-session"

type TrackType = "view" | "hover" | "add_to_cart"

export function trackAffisellEvent(
  type: TrackType,
  productId: string | undefined,
  options?: { durationMs?: number }
) {
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
