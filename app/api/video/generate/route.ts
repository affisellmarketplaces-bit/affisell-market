import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { handleProductVideoGenerate, parseVideoGenerateBody } from "@/lib/video-generate-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/** predict + 90s poll + upload */
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = parseVideoGenerateBody(await req.json())
  if (!parsed) {
    return NextResponse.json({ error: "productId and prompt are required." }, { status: 400 })
  }

  return handleProductVideoGenerate({
    supplierId: session.user.id,
    productId: parsed.productId,
    prompt: parsed.prompt,
    format: parsed.format,
  })
}
