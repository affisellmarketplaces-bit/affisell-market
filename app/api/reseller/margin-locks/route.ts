import { NextResponse } from "next/server"

import { requireAffiliateSession } from "@/lib/dashboard-session"
import {
  listActiveMarginLocksForReseller,
  toMarginLockDto,
} from "@/lib/margin/margin-lock-service"
import { getMarginLockStatus } from "@/lib/margin/margin-lock-types"

/** GET /api/reseller/margin-locks — active locks for signed-in affiliate. */
export async function GET() {
  const session = await requireAffiliateSession()
  const locks = await listActiveMarginLocksForReseller(session.user.id)

  return NextResponse.json({
    locks: locks.map((lock) => ({
      ...toMarginLockDto(lock),
      live: getMarginLockStatus(lock),
    })),
    count: locks.length,
  })
}
