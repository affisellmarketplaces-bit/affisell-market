import { capturePosthog, capturePosthogClient } from "@/lib/analytics/posthog"
import { normalizeInstantScanStage, type InstantScanStage } from "@/lib/instantscan/stages"

export type { InstantScanStage }

/**
 * NOTE (honesty): the `instant_scan_*` PostHog helpers below are DEFINED BUT NEVER CALLED anywhere in the app (the supplier
 * InstantScan UI is retired and the API route does not emit them). Do not read their absence in PostHog as "no usage" nor
 * their presence as a measurement: the source of truth is the usage journal (lib/ai/usage-log.ts), read by
 * /admin/instantscan-performance.
 */

export type InstantScanResultProps = {
  model: string | null
  confidence: number | null
  latency_ms: number
  stage: InstantScanStage
}

export type InstantScanGateProps = {
  reason: string
}

/** Client — wizard InstantScan analyze outcome (PostHog). */
export function trackInstantScanResult(props: InstantScanResultProps) {
  capturePosthogClient("instant_scan_result", props)
}

/** Client — confidence gate or manual fallback triggered. */
export function trackInstantScanGateTriggered(props: InstantScanGateProps) {
  capturePosthogClient("instant_scan_gate_triggered", props)
}

export function trackInstantScanTriggerAttempt(props: {
  url: string | null
  guided_step: number
  reason?: string
  client_enabled: boolean
  mounted: boolean
}) {
  capturePosthogClient("instant_scan_trigger_attempt", props)
}

export function trackInstantScanApiCalled(props: {
  url: string
  status: number
  latency_ms: number
}) {
  capturePosthogClient("instant_scan_api_called", props)
}

export function trackInstantScanError(props: { reason: string; status?: number }) {
  capturePosthogClient("instant_scan_error", props)
}

/** Server — API analyze-product outcome (no consent gate). */
export function trackInstantScanResultServer(props: InstantScanResultProps, distinctId?: string) {
  capturePosthog("instant_scan_result", props, distinctId)
}

export function trackInstantScanGateTriggeredServer(props: InstantScanGateProps, distinctId?: string) {
  capturePosthog("instant_scan_gate_triggered", props, distinctId)
}

export function instantScanStageFromVisionVersion(
  visionVersion?: string | null,
  instantScanStage?: InstantScanStage | "embed" | null
): InstantScanStage {
  const explicit = normalizeInstantScanStage(instantScanStage)
  if (explicit) return explicit
  if (visionVersion === "v2.2") return "catalog_match"
  if (visionVersion === "v2") return "gpt4o"
  return "groq"
}
