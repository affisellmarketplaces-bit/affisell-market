import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let url = ""
  try {
    const body = (await req.json()) as { url?: string }
    url = typeof body.url === "string" ? body.url.trim() : ""
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 })
  }

  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  /** Mock AI extraction — replace with scraping / LLM pipeline */
  const products = [
    {
      title: "Robot Tondeuse Connecté Pro",
      price: "498.98",
      image: "https://m.media-amazon.com/images/I/61WXf9ZN5fL._AC_SL1500_.jpg",
      description: "AI extracted description placeholder.",
      variants: 3,
      stock: 50,
      sku: "ROB-PRO-001",
    },
  ]

  return NextResponse.json({ products })
}
