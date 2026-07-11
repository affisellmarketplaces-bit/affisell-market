import { capturePosthog, capturePosthogClient } from "@/lib/analytics/posthog"

export type InstantScanStage = "embed" | "mini" | "gpt4o" | "groq"

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
  capturePosthogClient("instantscan_trigger_attempt", props)
}

export function trackInstantScanApiCalled(props: {
  url: string
  status: number
  latency_ms: number
}) {
  capturePosthogClient("instantscan_api_called", props)
}

export function trackInstantScanError(props: { reason: string; status?: number }) {
  capturePosthogClient("instantscan_error", props)
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
  instantScanStage?: InstantScanStage | null
): InstantScanStage {
  if (instantScanStage) return instantScanStage
  if (visionVersion === "v2.2") return "embed"
  if (visionVersion === "v2") return "gpt4o"
  return "groq"
}
