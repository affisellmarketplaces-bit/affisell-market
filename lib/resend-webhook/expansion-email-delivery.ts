import { logBusiness } from "@/lib/business-log"
import { opsWebhookAlert } from "@/lib/ops-webhook"

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
}

/** Ops alert on hard bounce / spam complaint for expansion buyer emails (idempotent via webhook id). */
export async function processExpansionResendDeliveryEvent(
  event: ResendWebhookEvent,
  webhookId: string
): Promise<ProcessExpansionResendDeliveryResult> {
  if (event.type !== "email.bounced" && event.type !== "email.complained") {
    return { handled: false, alerted: false }
  }

  if (!isExpansionBuyerResendEmail(event.data)) {
    return { handled: false, alerted: false }
  }

  const recipient = event.data.to?.[0] ?? "unknown"
  const subject = event.data.subject ?? "(no subject)"
  const bounceMessage = event.data.bounce?.message
  const kind = event.type === "email.bounced" ? "bounce" : "complaint"
  const text = `⚠️ Expansion email ${kind}: \`${recipient}\` — ${subject}${
    bounceMessage ? ` — ${bounceMessage.slice(0, 200)}` : ""
  }`

  const { slack, discord } = await opsWebhookAlert(text)
  const alerted = slack || discord

  logBusiness("expansion-rollout", {
    result: `resend_${kind}`,
    webhookId,
    emailId: event.data.email_id ?? null,
    recipient,
    subject,
    alerted,
  })

  return { handled: true, alerted }
}
