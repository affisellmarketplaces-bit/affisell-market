import { readTwilioDeliveryConfig, sendTwilioSms } from "@/lib/sms/twilio-delivery"
import { prisma } from "@/lib/prisma"

export type RunAgentMissionSmsRemindersResult = {
  processed: number
  sent: number
  skipped: number
  errors: string[]
}

const MS_24H = 24 * 60 * 60 * 1000

/**
 * J+1 SMS for ASSIGNED missions not started within 24h.
 * Idempotent via AgentMission.smsReminderAt.
 */
export async function runAgentMissionSmsRemindersCron(
  limit = 30
): Promise<RunAgentMissionSmsRemindersResult> {
  const config = readTwilioDeliveryConfig()
  if (!config) {
    console.log("[agent-sms-reminder]", { result: "twilio_not_configured" })
    return { processed: 0, sent: 0, skipped: 0, errors: ["twilio_not_configured"] }
  }

  const cutoff = new Date(Date.now() - MS_24H)
  const missions = await prisma.agentMission.findMany({
    where: {
      status: "ASSIGNED",
      assignedAt: { lte: cutoff },
      smsReminderAt: null,
      agentId: { not: null },
    },
    take: limit,
    orderBy: { assignedAt: "asc" },
    select: {
      id: true,
      type: true,
      agent: { select: { contactPhone: true, displayName: true } },
    },
  })

  let sent = 0
  let skipped = 0
  const errors: string[] = []

  for (const mission of missions) {
    const phone = mission.agent?.contactPhone?.trim()
    if (!phone) {
      skipped += 1
      await prisma.agentMission.update({
        where: { id: mission.id },
        data: { smsReminderAt: new Date() },
      })
      continue
    }

    const body = `Affisell Agent: mission ${mission.type} en attente depuis 24h — connectez-vous sur votre portail agent.`
    const sms = await sendTwilioSms({
      config,
      to: phone,
      body,
      context: "agent-sms-reminder",
    })

    if (sms.ok) {
      sent += 1
      await prisma.agentMission.update({
        where: { id: mission.id },
        data: { smsReminderAt: new Date() },
      })
      console.log("[agent-sms-reminder]", { missionId: mission.id, result: "sent" })
    } else {
      errors.push(`${mission.id}:${sms.error}`)
      console.log("[agent-sms-reminder]", {
        missionId: mission.id,
        result: "failed",
        error: sms.error,
      })
    }
  }

  return { processed: missions.length, sent, skipped, errors }
}
