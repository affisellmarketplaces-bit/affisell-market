import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

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
  console.log("DEBUG session", session?.user)

  if (!session?.user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as any).role !== "SUPPLIER") {
    return Response.json(
      { error: "Forbidden - not supplier", role: (session.user as any).role },
      { status: 403 }
    )
  }

  const { name, basePriceCents, commissionRate, image, description } = await req.json()
  if (!name || !basePriceCents) {
    return Response.json({ error: "Missing name or price" }, { status: 400 })
  }

  const rate = Math.min(
    99,
    Math.max(1, Math.round(Number.isFinite(Number(commissionRate)) ? Number(commissionRate) : 20))
  )
  const cents = Math.round(Number(basePriceCents))
  const imageRaw = typeof image === "string" ? image.trim() : ""
  const desc = typeof description === "string" ? description.trim() : ""

  const product = await prisma.product.create({
    data: {
      supplierId: (session.user as { id: string }).id,
      name: String(name).trim(),
      description: desc,
      image: imageRaw || "https://placehold.co/600x600?text=Product",
      basePriceCents: Math.max(100, cents),
      commissionRate: rate,
      active: true,
    },
  })

  return Response.json(product, { status: 201 })
}
