import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 })
  await prisma.affiliateProduct.updateMany({
    where: { id },
    data: { clicks: { increment: 1 } },
  })
  return Response.json({ ok: true })
}
