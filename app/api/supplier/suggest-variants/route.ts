import { type NextRequest, NextResponse } from "next/server"

import { auth } from "@/auth"
import { newVariantRowId, type ProductVariantLine } from "@/lib/product-variants"

export const runtime = "nodejs"

type SuggestionSeed = {
  name: string
  price: string
  stock: string
  sku: string
}

function parseBasePrice(body: Record<string, unknown>): number {
  const raw = body.basePrice ?? body.basePriceEur
  if (typeof raw === "number" && Number.isFinite(raw)) return raw
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parseCommission(body: Record<string, unknown>): number {
  const raw = body.commission
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.min(50, Math.max(1, Math.round(raw)))
  if (typeof raw === "string") {
    const n = Number.parseFloat(raw)
    return Number.isFinite(n) ? Math.min(50, Math.max(1, Math.round(n))) : 20
  }
  return 20
}

function seedsToRows(seeds: SuggestionSeed[], commission: number): ProductVariantLine[] {
  return seeds.map((s) => {
    const priceNum = Number.parseFloat(String(s.price))
    const priceCents = Number.isFinite(priceNum) ? Math.max(0, Math.round(priceNum * 100)) : 0
    const stockNum = Number.parseInt(String(s.stock), 10)
    const stock = Number.isFinite(stockNum) ? Math.max(0, stockNum) : 0
    return {
      id: newVariantRowId(),
      name: s.name.slice(0, 160),
      sku: (s.sku ?? "").slice(0, 80),
      priceCents,
      stock,
      commission,
      sales: 0,
    }
  })
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    const role = (session?.user as { role?: string } | undefined)?.role
    if (!session?.user?.id || role !== "SUPPLIER") {
      return NextResponse.json({ error: "Forbidden", variants: [] }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ variants: [] }, { status: 400 })
    }

    const productNameRaw = body.productName
    const productName =
      typeof productNameRaw === "string" ? productNameRaw : String(productNameRaw ?? "")
    const basePrice = parseBasePrice(body)
    const commission = parseCommission(body)

    const suggestions: SuggestionSeed[] = []
    const name = productName.toLowerCase()

    if (name.includes("tondeuse") || name.includes("mower") || name.includes("robot")) {
      const base = basePrice || 498.98
      suggestions.push(
        { name: "Standard", price: String(basePrice || 498.98), stock: "15", sku: "" },
        { name: "Pro Max", price: String(base * 1.3), stock: "8", sku: "" },
        { name: "Compact", price: String(base * 0.8), stock: "20", sku: "" }
      )
    } else if (name.includes("phone") || name.includes("iphone") || name.includes("samsung")) {
      const base = basePrice || 0
      suggestions.push(
        { name: "128GB Black", price: String(basePrice || 0), stock: "10", sku: "" },
        { name: "256GB Black", price: String(base + 100), stock: "10", sku: "" },
        { name: "128GB White", price: String(basePrice || 0), stock: "8", sku: "" }
      )
    } else {
      const base = basePrice || 0
      suggestions.push(
        { name: "Black", price: String(basePrice || 0), stock: "10", sku: "" },
        { name: "White", price: String(basePrice || 0), stock: "10", sku: "" },
        { name: "Premium", price: String(base * 1.2), stock: "5", sku: "" }
      )
    }

    const variants = seedsToRows(suggestions, commission)
    return NextResponse.json({ variants })
  } catch {
    return NextResponse.json({ variants: [] }, { status: 200 })
  }
}
