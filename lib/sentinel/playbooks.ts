import { playbookHref } from "@/lib/sentinel/load-dashboard"
import type { SentinelPlaybook } from "@/lib/sentinel/types"

export function sentinelPlaybookUrl(
  playbook: string | null | undefined,
  entityId: string | null | undefined
): string | null {
  if (!playbook) return null
  return playbookHref(playbook, entityId ?? null)
}

export function sentinelPlaybookLabel(playbook: SentinelPlaybook | string | undefined): string {
  switch (playbook) {
    case "open-stripe-health":
      return "Stripe health"
    case "open-auto-fulfill":
      return "Auto-fulfill"
    case "open-order":
      return "Open order"
    case "open-providers":
      return "Providers"
    case "run-discovery-bootstrap":
      return "npm run discovery:bootstrap"
    default:
      return "View"
  }
}
