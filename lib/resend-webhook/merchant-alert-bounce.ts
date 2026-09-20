import type { ResendWebhookEmailData } from "@/lib/resend-webhook/expansion-email-delivery"
import { prisma } from "@/lib/prisma"

function readTag(
  tags: ResendWebhookEmailData["tags"],
  name: string
): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) {
    const hit = tags.find((tag) => tag.name === name)
    return hit?.value?.trim() || null
  }
  const value = tags[name]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

/**
 * When Resend reports a hard bounce on a merchant new-order alert, clear the
 * idempotency flag so the heal cron can retry (or ops can force-resend).
 */
export async function clearMerchantAlertSentFlagOnBounce(
  eventType: string,
  data: ResendWebhookEmailData
): Promise<{ cleared: boolean; role: string | null; orderId: string | null }> {
  if (eventType !== "email.bounced") {
    return { cleared: false, role: null, orderId: null }
  }

  const role = readTag(data.tags, "merchant-alert")
  const orderId = readTag(data.tags, "order-id")
  if (!role || !orderId) {
    return { cleared: false, role: null, orderId: null }
  }

  if (role === "supplier") {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { merchantSupplierEmailSentAt: null },
    })
    console.log("[merchant-alert-bounce]", {
      orderId,
      role: "SUPPLIER",
      result: updated.count > 0 ? "flag_cleared" : "no_row",
      recipient: data.to?.[0] ?? null,
    })
    return { cleared: updated.count > 0, role, orderId }
  }

  if (role === "affiliate") {
    const updated = await prisma.order.updateMany({
      where: { id: orderId, status: "paid" },
      data: { merchantAffiliateEmailSentAt: null },
    })
    console.log("[merchant-alert-bounce]", {
      orderId,
      role: "AFFILIATE",
      result: updated.count > 0 ? "flag_cleared" : "no_row",
      recipient: data.to?.[0] ?? null,
    })
    return { cleared: updated.count > 0, role, orderId }
  }

  return { cleared: false, role, orderId }
}
