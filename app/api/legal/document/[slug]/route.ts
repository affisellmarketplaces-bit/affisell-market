import { NextResponse } from "next/server"

import {
  cacheControlForLegalDocument,
  resolveLegalDocumentApi,
} from "@/lib/legal/lms-resolver"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = { params: Promise<{ slug: string }> }

export async function GET(req: Request, ctx: RouteContext) {
  const { slug } = await ctx.params
  const locale = new URL(req.url).searchParams.get("locale") || "fr"

  const payload = await resolveLegalDocumentApi(slug, locale)
  if (!payload) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": cacheControlForLegalDocument(payload.meta),
    },
  })
}
