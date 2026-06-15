import { logBusiness } from "@/lib/business-log"
import { resolveExpansionEmailKind } from "@/lib/expansion/resolve-expansion-email-kind"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { reenqueueLaunchWaitlistOnHardBounce } from "@/lib/resend-webhook/reenqueue-launch-waitlist-on-bounce"

export type ResendWebhookEmailData = {
  email_id?: string
  from?: string
  to?: string[]
  subject?: string
  tags?: Record<string, string> | Array<{ name: string; value: string }>
  bounce?: { message?: string }
}

export type ResendWebhookEvent = {
  type: string
  created_at?: string
  data: ResendWebhookEmailData
}

function hasExpansionTag(tags: ResendWebhookEmailData["tags"]): boolean {
  if (!tags) return false
  if (Array.isArray(tags)) {
    return tags.some((tag) => tag.name === "expansion")
  }
  return typeof tags.expansion === "string" && tags.expansion.length > 0
}

function matchesExpansionSubject(subject: string | undefined): boolean {
  const normalized = subject?.toLowerCase() ?? ""
  return (
    normalized.includes("checkout is live") ||
    normalized.includes("checkout ouvert") ||
    normalized.includes("checkout affisell permanent") ||
    normalized.includes("reminder — checkout is live") ||
    normalized.includes("rappel — checkout ouvert")
  )
}

export function isExpansionBuyerResendEmail(data: ResendWebhookEmailData): boolean {
  return hasExpansionTag(data.tags) || matchesExpansionSubject(data.subject)
}

export type ProcessExpansionResendDeliveryResult = {
  handled: boolean
  alerted: boolean
  retryQueued: number
  webhookStatus: "expansion_bounce" | "expansion_complaint" | null
}

/** Ops alert on hard bounce / spam complaint for expansion buyer emails; re-queue launch waitlist once. */
export async function processExpansionResendDeliveryEvent(
  event: ResendWebhookEvent,
  webhookId: string
): Promise<ProcessExpansionResendDeliveryResult> {
  if (event.type !== "email.bounced" && event.type !== "email.complained") {
    return { handled: false, alerted: false, retryQueued: 0, webhookStatus: null }
  }

  if (!isExpansionBuyerResendEmail(event.data)) {
    return { handled: false, alerted: false, retryQueued: 0, webhookStatus: null }
  }

  const recipient = event.data.to?.[0] ?? "unknown"
  const subject = event.data.subject ?? "(no subject)"
  const bounceMessage = event.data.bounce?.message
  const kind = event.type === "email.bounced" ? "bounce" : "complaint"
  const emailKind = resolveExpansionEmailKind(event.data)

  let retryQueued = 0
  if (event.type === "email.bounced" && emailKind === "checkout-launch" && recipient !== "unknown") {
    retryQueued = await reenqueueLaunchWaitlistOnHardBounce(recipient)
  }

  const retryBit = retryQueued > 0 ? ` · ${retryQueued} waitlist row(s) re-queued` : ""
  const text = `⚠️ Expansion email ${kind}: \`${recipient}\` — ${subject}${
    bounceMessage ? ` — ${bounceMessage.slice(0, 200)}` : ""
  }${retryBit}`

  const { slack, discord } = await opsWebhookAlert(text)
  const alerted = slack || discord

  logBusiness("expansion-rollout", {
    result: `resend_${kind}`,
    webhookId,
    emailId: event.data.email_id ?? null,
    recipient,
    subject,
    emailKind,
    retryQueued,
    alerted,
  })

  return {
    handled: true,
    alerted,
    retryQueued,
    webhookStatus: event.type === "email.bounced" ? "expansion_bounce" : "expansion_complaint",
  }
}
