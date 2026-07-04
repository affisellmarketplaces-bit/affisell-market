import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX,
  applyMarginAutoFixBatch,
} from "@/lib/affiliate-margin-auto-fix-apply.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "AFFILIATE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await applyMarginAutoFixBatch({
    affiliateId: session.user.id,
    limit: AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX,
  })

  return NextResponse.json({
    ...result,
    limit: AFFILIATE_MARGIN_AUTO_FIX_BATCH_MAX,
  })
}
