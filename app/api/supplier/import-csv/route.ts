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
      price: "99.99",
      image: "",
      variants: 2,
      stock: 100,
      sku: "P1",
    },
    {
      title: "Product 2",
      price: "149.99",
      image: "",
      variants: 1,
      stock: 50,
      sku: "P2",
    },
  ]

  return NextResponse.json({ products })
}
