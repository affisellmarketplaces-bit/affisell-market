import { fulfillmentPrisma } from "@/lib/prisma"
import { sendIngManualNudgeEmail } from "@/lib/emails/send-ing-manual-nudge"
import {
  loadManualSupplierNudgeCandidates,
  manualNudgeSendDelay,
  MANUAL_NUDGE_SEND_DELAY_MS,
  recordIngNudgeLog,
  type ManualSupplierNudgeCandidate,
} from "@/lib/ing/manual-supplier-nudge"

export type RunIngManualNudgeCronResult = {
  dryRun: boolean
  groupsCount: number
  suppliers: ManualSupplierNudgeCandidate[] | number
  sent: number
  skipped: number
  resendConfigured: boolean
  errors: string[]
}

/**
 * Daily nudge: suppliers with manual fulfillment groups (7d window), max 1 email / 48h.
 * Uses fulfillmentPrisma (DATABASE_URL_UNPOOLED direct Neon).
 */
export async function runIngManualNudgeCron(options?: {
  dryRun?: boolean
}): Promise<RunIngManualNudgeCronResult> {
  const dryRun = options?.dryRun ?? false
  const resendConfigured = Boolean(process.env.RESEND_API_KEY?.trim())

  console.log("[cron:ing-manual-nudge]", { result: "start", dryRun, resendConfigured })

  const { groupsCount, candidates } = await loadManualSupplierNudgeCandidates(fulfillmentPrisma, {
    enforceCooldown: true,
  })

  console.log("[cron:ing-manual-nudge]", {
    result: "candidates_ready",
    groupsCount,
    suppliers: candidates.length,
    dryRun,
  })

  if (candidates.length === 0) {
    return {
      dryRun,
      groupsCount,
      suppliers: dryRun ? [] : 0,
      sent: 0,
      skipped: 0,
      resendConfigured,
      errors: [],
    }
  }

  if (dryRun) {
    return {
      dryRun: true,
      groupsCount,
      suppliers: candidates,
      sent: 0,
      skipped: 0,
      resendConfigured,
      errors: [],
    }
  }

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const candidate of candidates) {
    const sendResult = await sendIngManualNudgeEmail({
      email: candidate.email,
      name: candidate.name,
      manualGroups: candidate.manualGroups,
      totalItems: candidate.totalItems,
      isCron: true,
    })

    if (!sendResult.ok) {
      errors.push(`${candidate.supplierId}:${sendResult.error}`)
      skipped += 1
      console.error("[cron:ing-manual-nudge]", {
        result: "send_failed",
        supplierId: candidate.supplierId,
        email: candidate.email,
        error: sendResult.error,
      })
      continue
    }

    await recordIngNudgeLog(fulfillmentPrisma, {
      supplierId: candidate.supplierId,
      groupsCount: candidate.manualGroups,
      resendId: sendResult.resendId,
    })

    sent += 1
    console.log("[cron:ing-manual-nudge]", {
      result: "sent",
      supplierId: candidate.supplierId,
      email: candidate.email,
      manualGroups: candidate.manualGroups,
      resendId: sendResult.resendId,
    })

    await manualNudgeSendDelay(MANUAL_NUDGE_SEND_DELAY_MS)
  }

  console.log("[cron:ing-manual-nudge]", {
    result: "complete",
    groupsCount,
    suppliers: candidates.length,
    sent,
    skipped,
  })

  return {
    dryRun: false,
    groupsCount,
    suppliers: candidates.length,
    sent,
    skipped,
    resendConfigured,
    errors,
  }
}
