import { NextResponse } from "next/server"

import { listPublicLegalDocuments } from "@/lib/legal/public-documents-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("locale") || "fr"
  const documents = await listPublicLegalDocuments(locale)

  console.log("[legal-api]", {
    route: "documents",
    count: documents.length,
    locale,
    result: "ok",
  })

  return NextResponse.json(documents, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  })
}
