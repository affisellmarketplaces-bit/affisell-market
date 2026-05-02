import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { parseProductAttributesBody } from "@/lib/supplier-product-attributes"
import { parseSupplierProductImages } from "@/lib/supplier-product-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }
  const products = await prisma.product.findMany({
    where: { supplierId: session.user.id },
    orderBy: { name: "asc" },
  })
  return Response.json(products)
}

export async function POST(req: Request) {
  const session = await auth()

  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden - not supplier" }, { status: 403 })
  }

  const body = await req.json()
  const {
    name,
    basePriceCents: basePriceCentsRaw,
    commissionRate,
    commission,
    description,
    price,
    stock,
  } = body as Record<string, unknown>

  const nameStr = typeof name === "string" ? name.trim() : ""
  if (!nameStr) {
    return Response.json({ error: "Missing name" }, { status: 400 })
  }

  let cents: number
  if (Number.isFinite(Number(price))) {
    cents = Math.round(Number(price) * 100)
  } else if (basePriceCentsRaw != null) {
    cents = Math.round(Number(basePriceCentsRaw))
  } else {
    return Response.json({ error: "Missing price" }, { status: 400 })
  }

  const commRaw = commission ?? commissionRate
  const rate = Math.min(
    99,
    Math.max(1, Math.round(Number.isFinite(Number(commRaw)) ? Number(commRaw) : 20))
  )
  const images = parseSupplierProductImages(body as Record<string, unknown>)
  const attr = parseProductAttributesBody(body as Record<string, unknown>)
  const desc = typeof description === "string" ? description.trim() : ""
  const stockN = Math.max(0, Math.round(Number.isFinite(Number(stock)) ? Number(stock) : 0))

  const product = await prisma.product.create({
    data: {
      supplierId: (session.user as { id: string }).id,
      name: nameStr,
      description: desc,
      images,
      categories: attr.categories,
      colors: attr.colors,
      tags: attr.tags,
      variants: attr.variants === null ? null : attr.variants,
      basePriceCents: Math.max(100, cents),
      commissionRate: rate,
      stock: stockN,
      active: true,
    },
  })

  return Response.json(product, { status: 201 })
}
