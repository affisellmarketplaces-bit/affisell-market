import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runAgentMissionSmsRemindersCron } from "@/lib/cron/agent-mission-sms-reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** J+1 SMS when agent mission stays ASSIGNED > 24h. `Authorization: Bearer ${CRON_SECRET}` */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied

  const result = await runAgentMissionSmsRemindersCron(40)
  return NextResponse.json({ ok: true, ...result })
}
