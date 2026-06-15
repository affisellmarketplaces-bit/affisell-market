import { sendMerchantKycPublishReminderEmail } from "@/lib/emails/send-merchant-kyc-reminder"
import { prisma } from "@/lib/prisma"

export type RunMerchantKycReminderCronResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

/** One-shot KYC reminder for suppliers with drafts blocked by verification (idempotent via profile timestamp). */
export async function runMerchantKycReminderCron(
  limit = 40
): Promise<RunMerchantKycReminderCronResult> {
  const rows = await prisma.user.findMany({
    where: {
      role: "SUPPLIER",
      products: { some: { isDraft: true, active: true } },
      merchantLegalProfile: {
        verificationStatus: { not: "APPROVED" },
        kycPublishReminderSentAt: null,
      },
    },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      merchantLegalProfile: { select: { id: true } },
      _count: { select: { products: { where: { isDraft: true, active: true } } } },
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const row of rows) {
    const draftCount = row._count.products
    if (draftCount < 1) {
      skipped += 1
      continue
    }

    const result = await sendMerchantKycPublishReminderEmail({
      email: row.email,
      name: row.name,
      draftCount,
    })

    if (!result.ok) {
      errors.push(`${row.id}:${result.error ?? "send_failed"}`)
      skipped += 1
      continue
    }

    if (row.merchantLegalProfile?.id) {
      await prisma.merchantLegalProfile.update({
        where: { id: row.merchantLegalProfile.id },
        data: { kycPublishReminderSentAt: new Date() },
      })
    }

    console.log("[merchant-kyc-reminder]", {
      userId: row.id,
      draftCount,
      result: "sent",
    })
    sent += 1
  }

  return { processed: rows.length, sent, skipped, errors }
}
