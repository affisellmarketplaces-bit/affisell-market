import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getAccountDeletionPreview } from "@/lib/account-deletion-eligibility.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const preview = await getAccountDeletionPreview(userId)
  if (!preview) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(preview)
}
