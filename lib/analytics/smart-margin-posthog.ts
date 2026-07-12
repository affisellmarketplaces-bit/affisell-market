import { capturePosthogClient } from "@/lib/analytics/posthog"

export function trackSmartMarginShown(props: {
  suggested: number
  current: number
  delta_conversion: number
  score: number
  category_id?: string | null
}): void {
  capturePosthogClient("smart_margin_shown", props)
}

export function trackSmartMarginApplied(props: {
  accepted: boolean
  suggested: number
  current: number
  applied_margin?: number
}): void {
  capturePosthogClient("smart_margin_applied", props)
}

export function trackSuccessProbabilityShown(props: {
  score: number
  top_reason: string
  risk_count: number
}): void {
  capturePosthogClient("success_probability_shown", props)
}
