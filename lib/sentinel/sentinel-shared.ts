import type { SentinelDomain, SentinelPlaybook, SentinelPlaybookKind, SentinelSeverity } from "@/lib/sentinel/types"

export const SEVERITIES: SentinelSeverity[] = ["P0", "P1", "P2", "P3"]

export const DOMAINS: SentinelDomain[] = [
  "stripe",
  "fulfillment",
  "webhook",
  "catalog",
  "platform",
  "providers",
]

export const SENTINEL_DOMAIN_LABEL: Record<SentinelDomain, string> = {
  stripe: "Stripe",
  fulfillment: "Auto-fulfill",
  webhook: "Webhooks",
  catalog: "Catalogue",
  platform: "Platform",
  providers: "Providers",
}

export function sentinelPlaybookKind(
  playbook: SentinelPlaybook | string | null | undefined
): SentinelPlaybookKind | null {
  if (playbook === "retry-auto-buy") return "action"
  if (
    playbook === "open-stripe-health" ||
    playbook === "open-auto-fulfill" ||
    playbook === "open-order" ||
    playbook === "open-providers" ||
    playbook === "open-sentry"
  ) {
    return "link"
  }
  return null
}

export function playbookHref(playbook: string | null, entityId: string | null): string | null {
  switch (playbook) {
    case "open-stripe-health":
      return "/admin/stripe-health"
    case "open-auto-fulfill":
      return "/admin/auto-fulfill"
    case "open-order":
      return entityId ? `/admin/orders/${entityId}` : "/admin/orders"
    case "open-providers":
      return "/admin/providers"
    case "run-discovery-bootstrap":
      return null
    case "open-sentry":
      return entityId?.startsWith("http") ? entityId : null
    default:
      return null
  }
}

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
    case "retry-auto-buy":
      return "Retry auto-buy"
    case "open-sentry":
      return "Open in Sentry"
    default:
      return "View"
  }
}

export function sentinelPlaybookSecondaryUrl(
  playbook: SentinelPlaybook | string | undefined
): string | null {
  if (playbook === "retry-auto-buy") return "/admin/auto-fulfill"
  return null
}

export function isExternalPlaybookUrl(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://")
}
