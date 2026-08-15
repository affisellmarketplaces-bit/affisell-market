import type {
  AccountDeletionReasonCode,
  AccountDeletionSource,
} from "@/lib/account-deletion-shared"
import { prisma } from "@/lib/prisma"

type RecordAccountDeletionFeedbackInput = {
  userId: string
  role: string
  reasonCode: AccountDeletionReasonCode
  reasonDetail: string | null
  source: AccountDeletionSource
  locale?: string | null
}

export async function recordAccountDeletionFeedback(
  input: RecordAccountDeletionFeedbackInput
): Promise<void> {
  await prisma.accountDeletionFeedback.create({
    data: {
      userId: input.userId,
      role: input.role,
      reasonCode: input.reasonCode,
      reasonDetail: input.reasonDetail,
      source: input.source,
      locale: input.locale?.trim() || null,
    },
  })

  console.log("[account-delete]", {
    userId: input.userId,
    role: input.role,
    result: "feedback_recorded",
    reasonCode: input.reasonCode,
    source: input.source,
  })
}
