import { NextResponse } from "next/server"

import { authorizeCronRequest } from "@/lib/cron/authorize-cron-request"
import { runAutopilot } from "@/lib/copilot-autonomy.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Applies what resellers explicitly allowed (per action type, within their limits). Does nothing unless
 * COPILOT_AUTOPILOT=on. NOT scheduled by this change: scheduling it is the owner's decision (docs/RESELLER-COPILOT.md).
 */
export async function GET(req: Request) {
  const denied = authorizeCronRequest(req)
  if (denied) return denied
  return NextResponse.json(await runAutopilot())
}
