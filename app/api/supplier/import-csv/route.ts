import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!session?.user?.id || role !== "SUPPLIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 })
  }

  /** Mock column mapping — replace with CSV parse + AI mapping */
  const products = [
    {
      title: "Product 1",
      price: 99.99,
      original_price: 99.99,
      currency: "EUR",
      images: [],
      image: "",
      description: "",
      variants: [],
      variants_count: 2,
      stock: 100,
      sku: "P1",
      source_url: "",
      category: "",
      suggested_price: 149.99,
      suggested_commission: 20,
      selected: true,
    },
    {
      title: "Product 2",
      price: 149.99,
      original_price: 149.99,
      currency: "EUR",
      images: [],
      image: "",
      description: "",
      variants: [],
      variants_count: 1,
      stock: 50,
      sku: "P2",
      source_url: "",
      category: "",
      suggested_price: 224.99,
      suggested_commission: 20,
      selected: true,
    },
  ]

  return NextResponse.json({ products, success: true })
}
