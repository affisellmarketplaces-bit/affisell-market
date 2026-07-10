import { capturePosthogClient } from "@/lib/analytics/posthog"
import type { WizardV2Mode } from "@/lib/product-wizard-v2/feature-flag"

export type WizardV2EntryPoint = "compose" | "hub" | "shopify_banner" | "direct"

export function trackWizardV2View(props: {
  mode: WizardV2Mode
  entry_point: WizardV2EntryPoint
}) {
  capturePosthogClient("wizard_v2_view", props)
}

export function trackWizardV2StepComplete(props: {
  step: string
  duration_ms: number
  method: WizardV2Mode
}) {
  capturePosthogClient("wizard_v2_step_complete", props)
}

export function trackWizardV2PublishSuccess(props: {
  duration_total_ms: number
  ai_used: boolean
  image_count: number
  mode: WizardV2Mode
}) {
  capturePosthogClient("wizard_v2_publish_success", props)
}

export function trackWizardV2PublishBlocked(props: {
  reason: string
  field?: string
  mode: WizardV2Mode
}) {
  capturePosthogClient("wizard_v2_publish_blocked", props)
}

export function trackWizardV2Abandon(props: {
  last_step: string
  duration_ms: number
  mode: WizardV2Mode
}) {
  capturePosthogClient("wizard_v2_abandon", props)
}
