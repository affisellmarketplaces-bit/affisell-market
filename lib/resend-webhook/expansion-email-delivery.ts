import { logBusiness } from "@/lib/business-log"
import { resolveExpansionEmailKind } from "@/lib/expansion/resolve-expansion-email-kind"
import { opsWebhookAlert } from "@/lib/ops-webhook"
import { reenqueueLaunchWaitlistOnHardBounce } from "@/lib/resend-webhook/reenqueue-launch-waitlist-on-bounce"
import { suppressLaunchWaitlistOnComplaint } from "@/lib/resend-webhook/suppress-launch-waitlist-on-complaint"

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
  suppressed: number
  complaintSuppressed: number
  webhookStatus: "expansion_bounce" | "expansion_complaint" | null
}

/** Ops alert on hard bounce / spam complaint for expansion buyer emails; re-queue launch waitlist once. */
export async function processExpansionResendDeliveryEvent(
  event: ResendWebhookEvent,
  webhookId: string
): Promise<ProcessExpansionResendDeliveryResult> {
  if (event.type !== "email.bounced" && event.type !== "email.complained") {
    return { handled: false, alerted: false, retryQueued: 0, suppressed: 0, complaintSuppressed: 0, webhookStatus: null }
  }

  if (!isExpansionBuyerResendEmail(event.data)) {
    return { handled: false, alerted: false, retryQueued: 0, suppressed: 0, complaintSuppressed: 0, webhookStatus: null }
  }

  const recipient = event.data.to?.[0] ?? "unknown"
  const subject = event.data.subject ?? "(no subject)"
  const bounceMessage = event.data.bounce?.message
  const kind = event.type === "email.bounced" ? "bounce" : "complaint"
  const emailKind = resolveExpansionEmailKind(event.data)

  let retryQueued = 0
  let suppressed = 0
  let complaintSuppressed = 0
  if (event.type === "email.bounced" && emailKind === "checkout-launch" && recipient !== "unknown") {
    const bounceResult = await reenqueueLaunchWaitlistOnHardBounce(recipient)
    retryQueued = bounceResult.requeued
    suppressed = bounceResult.suppressed
  }
  if (event.type === "email.complained" && recipient !== "unknown") {
    const complaintResult = await suppressLaunchWaitlistOnComplaint(recipient)
    complaintSuppressed = complaintResult.suppressed
  }

  const actionBit =
    retryQueued > 0
      ? ` · ${retryQueued} waitlist row(s) re-queued`
      : suppressed > 0
        ? ` · ${suppressed} waitlist row(s) suppressed (bounce)`
        : complaintSuppressed > 0
          ? ` · ${complaintSuppressed} waitlist row(s) suppressed (complaint)`
          : ""
  const text = `⚠️ Expansion email ${kind}: \`${recipient}\` — ${subject}${
    bounceMessage ? ` — ${bounceMessage.slice(0, 200)}` : ""
  }${actionBit}`

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
    suppressed,
    complaintSuppressed,
    alerted,
  })

  return {
    handled: true,
    alerted,
    retryQueued,
    suppressed,
    complaintSuppressed,
    webhookStatus: event.type === "email.bounced" ? "expansion_bounce" : "expansion_complaint",
  }
}
