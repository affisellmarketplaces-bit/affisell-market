import type {
  AccountDeletionConfirmPayload,
  AccountDeletionReasonCode,
  AccountDeletionSource,
} from "@/lib/account-deletion-shared"
import {
  accountDeletionReasonErrorCode,
  isAccountDeletionConfirmed,
  parseAccountDeletionReason,
} from "@/lib/account-deletion-shared"
import { recordAccountDeletionFeedback } from "@/lib/record-account-deletion-feedback.server"

export type ParsedAccountDeletionRequest =
  | {
      ok: true
      reasonCode: AccountDeletionReasonCode
      reasonDetail: string | null
      locale: string | null
      source: AccountDeletionSource
    }
  | {
      ok: false
      status: 400
      error: string
      code: string
    }

export function parseAccountDeletionRequest(
  body: AccountDeletionConfirmPayload,
  accountEmail: string,
  defaultSource: AccountDeletionSource
): ParsedAccountDeletionRequest {
  if (!isAccountDeletionConfirmed(body, accountEmail)) {
    return {
      ok: false,
      status: 400,
      error: "Type your account email to confirm permanent deletion.",
      code: "CONFIRM_REQUIRED",
    }
  }

  const reason = parseAccountDeletionReason(body)
  if (!reason.ok) {
    return {
      ok: false,
      status: 400,
      error: accountDeletionReasonErrorCode(reason.code),
      code: reason.code,
    }
  }

  return {
    ok: true,
    reasonCode: reason.reasonCode,
    reasonDetail: reason.reasonDetail,
    locale: body.locale?.trim() || null,
    source: body.source ?? defaultSource,
  }
}

export async function persistAccountDeletionFeedback(
  userId: string,
  role: string,
  parsed: Extract<ParsedAccountDeletionRequest, { ok: true }>
): Promise<void> {
  await recordAccountDeletionFeedback({
    userId,
    role,
    reasonCode: parsed.reasonCode,
    reasonDetail: parsed.reasonDetail,
    source: parsed.source,
    locale: parsed.locale,
  })
}
