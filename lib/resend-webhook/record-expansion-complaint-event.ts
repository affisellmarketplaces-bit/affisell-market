import { readExpansionCountryFromResendTags } from "@/lib/expansion/expansion-email-tags"
import { formatExpansionEmailEventError } from "@/lib/expansion/expansion-email-event-meta"
import { hashExpansionBuyerEmail } from "@/lib/expansion/hash-expansion-buyer-email"
import { resolveExpansionEmailKind } from "@/lib/expansion/resolve-expansion-email-kind"
import { MARKET_REGION } from "@/lib/market-config"
import { prisma } from "@/lib/prisma"
import type { ResendWebhookEmailData } from "@/lib/resend-webhook/expansion-email-delivery"
import { isExpansionBuyerResendEmail } from "@/lib/resend-webhook/expansion-email-delivery"

export async function recordExpansionComplaintEvent(
  eventType: string,
  data: ResendWebhookEmailData,
  emailId: string
): Promise<void> {
  if (eventType !== "email.complained" || !isExpansionBuyerResendEmail(data)) return

  const id = `expansion:complaint:${emailId}`
  const existing = await prisma.processedWebhook.findUnique({ where: { id } })
  if (existing) return

  const countryIso2 = readExpansionCountryFromResendTags(data.tags)
  const emailKind = resolveExpansionEmailKind(data) ?? "unknown"
  const buyerEmailHash = hashExpansionBuyerEmail(data.to?.[0] ?? "")

  await prisma.processedWebhook.create({
    data: {
      id,
      status: "expansion_complaint_kind",
      error: formatExpansionEmailEventError({
        countryIso2,
        emailKind,
        buyerEmailHash: buyerEmailHash || null,
      }),
    },
  })

  console.log("[expansion-rollout]", {
    result: "resend_complaint_recorded",
    marketRegion: MARKET_REGION,
    emailId,
    countryIso2,
    emailKind,
  })
}
