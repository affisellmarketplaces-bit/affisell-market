import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { loadPulseFeedItems } from "@/lib/pulse-feed-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const items = await loadPulseFeedItems({
    userId: session?.user?.id ?? null,
    limit: 40,
  })
  return NextResponse.json({ items })
}
