import type { ResendWebhookEmailData } from "@/lib/resend-webhook/expansion-email-delivery"
import {
  EXPANSION_CHECKOUT_GRADUATED_TAG,
  EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG,
  EXPANSION_CHECKOUT_LAUNCH_TAG,
} from "@/lib/expansion/expansion-email-tags"

export type ExpansionEmailKind = "checkout-launch" | "checkout-launch-followup" | "checkout-graduated"

function readExpansionTagValue(tags: ResendWebhookEmailData["tags"]): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) {
    const expansion = tags.find((tag) => tag.name === "expansion")
    return expansion?.value ?? null
  }
  return typeof tags.expansion === "string" ? tags.expansion : null
}

export function resolveExpansionEmailKind(data: ResendWebhookEmailData): ExpansionEmailKind | null {
  const value = readExpansionTagValue(data.tags)
  if (value === EXPANSION_CHECKOUT_LAUNCH_TAG.value) return "checkout-launch"
  if (value === EXPANSION_CHECKOUT_LAUNCH_FOLLOWUP_TAG.value) return "checkout-launch-followup"
  if (value === EXPANSION_CHECKOUT_GRADUATED_TAG.value) return "checkout-graduated"
  return null
}
