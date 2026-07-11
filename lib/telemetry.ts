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
