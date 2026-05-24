import { stripeConnectDashboardUrl } from "@/lib/admin/stripe-health/stripe-dashboard-url"

export type ParsedWebhookError = {
  errorCode: string | null
  accountId: string | null
  stripeDashboardUrl: string | null
}

const ONBOARDING_PREFIX = "AFFILIATE_ONBOARDING_REQUIRED:"
const ACCOUNT_ID_RE = /\b(acct_[a-zA-Z0-9]+)\b/

export function parseWebhookErrorMessage(error: string | null | undefined): ParsedWebhookError {
  if (!error?.trim()) {
    return { errorCode: null, accountId: null, stripeDashboardUrl: null }
  }

  const text = error.trim()
  let errorCode: string | null = null
  let accountId: string | null = null

  if (text.includes(ONBOARDING_PREFIX)) {
    errorCode = "affiliate_onboarding_required"
    accountId = text.split(ONBOARDING_PREFIX)[1]?.split(/[;\s]/)[0]?.trim() ?? null
  } else if (text.includes("insufficient_capabilities_for_transfer")) {
    errorCode = "insufficient_capabilities_for_transfer"
  } else {
    const roleMatch = text.match(/^(supplier|affiliate):([^;]+)/)
    if (roleMatch) {
      const fragment = roleMatch[2]?.trim() ?? ""
      if (fragment.startsWith(ONBOARDING_PREFIX)) {
        errorCode = "affiliate_onboarding_required"
        accountId = fragment.slice(ONBOARDING_PREFIX.length).trim() || null
      } else if (fragment.includes("insufficient_capabilities")) {
        errorCode = "insufficient_capabilities_for_transfer"
      }
    }
  }

  if (!accountId) {
    accountId = text.match(ACCOUNT_ID_RE)?.[1] ?? null
  }

  if (!errorCode) {
    const codeMatch = text.match(/\b([a-z_]+_required|[a-z_]+_for_transfer)\b/i)
    errorCode = codeMatch?.[1] ?? null
  }

  return {
    errorCode,
    accountId,
    stripeDashboardUrl: accountId ? stripeConnectDashboardUrl(accountId) : null,
  }
}
