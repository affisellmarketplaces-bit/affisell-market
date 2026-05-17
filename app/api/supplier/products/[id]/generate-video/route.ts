import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import type { MetaVideoFormat } from "@/lib/meta-ai"
import { handleProductVideoGenerate } from "@/lib/video-generate-handler"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const FORMATS = new Set<MetaVideoFormat>(["9:16", "1:1", "16:9"])

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id: productId } = await context.params
  const body = (await req.json()) as { prompt?: string; format?: string }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : ""
  const formatRaw = typeof body.format === "string" ? body.format.trim() : "9:16"
  const format = FORMATS.has(formatRaw as MetaVideoFormat) ? (formatRaw as MetaVideoFormat) : "9:16"

  return handleProductVideoGenerate({
    supplierId: session.user.id,
    productId,
    prompt,
    format,
  })
}
