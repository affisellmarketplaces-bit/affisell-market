import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    productId?: string
    productName?: string
    selectedColor?: string
    selectedSize?: string
  }
  const productId = typeof body.productId === "string" ? body.productId.trim() : ""
  const productName = typeof body.productName === "string" ? body.productName.trim() : "this item"
  const selectedColor = typeof body.selectedColor === "string" ? body.selectedColor.trim() : ""
  const selectedSize = typeof body.selectedSize === "string" ? body.selectedSize.trim() : ""
  if (!productId) {
    return NextResponse.json({ error: "Missing productId" }, { status: 400 })
  }

  return NextResponse.json({
    ideas: [
      `Business chic: Pair ${productName} ${
        selectedColor ? `in ${selectedColor}` : ""
      } with tailored trousers, loafers, and a structured tote.`,
      `Smart casual: Wear ${productName} ${
        selectedSize ? `(size ${selectedSize})` : ""
      } over a plain tee, straight jeans, and white sneakers.`,
      `Evening upgrade: Style ${productName} with dark pants, ankle boots, and minimalist jewelry.`,
    ],
  })
}
