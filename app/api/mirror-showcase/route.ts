import { NextResponse } from "next/server"

import { loadMirrorShowcaseProducts } from "@/lib/mirror-showcase-products.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
} as const

export async function GET() {
  try {
    const products = await loadMirrorShowcaseProducts(16)
    console.log("[mirror-showcase]", { route: "GET", count: products.length, result: "ok" })
    return NextResponse.json({ products }, { headers: JSON_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.log("[mirror-showcase]", { route: "GET", result: "error", error: message })
    return NextResponse.json({ products: [] }, { status: 500, headers: JSON_HEADERS })
  }
}
