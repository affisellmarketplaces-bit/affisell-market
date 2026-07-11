import type { WizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"

export type InstantScanUiState = "idle" | "loading" | "done" | "gate" | "error"

export const INSTANTSCAN_CDN_RECHECK_MS = 500

export type InstantScanTriggerInput = {
  mode: WizardV2Mode
  guidedStep: number
  primaryImageUrl: string | null | undefined
  analyzeState: InstantScanUiState
  attemptedUrl: string | null
  mounted: boolean
  analyzed: boolean
}

export type InstantScanTriggerDecision =
  | { action: "skip"; reason: string }
  | { action: "wait_cdn" }
  | { action: "advance_step" }
  | { action: "analyze"; url: string }

export function isInstantScanHttpsUrl(url: string | null | undefined): url is string {
  const trimmed = url?.trim()
  return Boolean(trimmed && /^https:\/\//i.test(trimmed))
}

export function isInstantScanPendingCdnUrl(url: string | null | undefined): boolean {
  const trimmed = url?.trim()
  if (!trimmed) return true
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:")
}

export function resolveInstantScanTrigger(input: InstantScanTriggerInput): InstantScanTriggerDecision {
  if (!input.mounted) {
    return { action: "skip", reason: "router_not_mounted" }
  }
  if (input.mode !== "guided") {
    return { action: "skip", reason: "mode_not_guided" }
  }
  if (isInstantScanPendingCdnUrl(input.primaryImageUrl)) {
    return { action: "wait_cdn" }
  }
  if (!isInstantScanHttpsUrl(input.primaryImageUrl)) {
    return { action: "skip", reason: "image_not_cdn_ready" }
  }
  if (input.analyzeState === "loading") {
    return { action: "skip", reason: "already_loading" }
  }
  if (input.analyzed || (input.attemptedUrl === input.primaryImageUrl && input.analyzeState !== "idle")) {
    return { action: "skip", reason: "already_attempted" }
  }
  if (input.guidedStep === 0) {
    return { action: "advance_step" }
  }
  if (input.guidedStep !== 1) {
    return { action: "skip", reason: "past_analyze_step" }
  }

  return { action: "analyze", url: input.primaryImageUrl.trim() }
}

/** @deprecated use isInstantScanHttpsUrl */
export const isInstantScanReadyUrl = isInstantScanHttpsUrl
