import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { productId?: string; productName?: string }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  const productName = typeof body.productName === "string" ? body.productName.trim() : "this item"
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  return NextResponse.json({
    ideas: [
      `Business chic: Pair ${productName} with tailored trousers, loafers, and a structured tote.`,
      `Smart casual: Wear ${productName} over a plain tee, straight jeans, and white sneakers.`,
      `Evening upgrade: Style ${productName} with dark pants, ankle boots, and minimalist jewelry.`,
    ],
  })
}
