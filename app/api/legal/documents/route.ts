import { NextResponse } from "next/server"

import { listPublicLegalDocuments } from "@/lib/legal/public-documents-catalog"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
} as const

export async function GET(req: Request) {
  const locale = new URL(req.url).searchParams.get("locale") || "fr"

  try {
    const documents = await listPublicLegalDocuments(locale)

    console.log("[legal-api]", {
      route: "documents",
      count: documents.length,
      locale,
      result: "ok",
    })

    return NextResponse.json(documents, { headers: JSON_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.log("[legal-api]", {
      route: "documents",
      locale,
      result: "error",
      error: message,
    })

    return NextResponse.json(
      { error: "Failed to load legal documents" },
      { status: 500, headers: JSON_HEADERS }
    )
  }
}
