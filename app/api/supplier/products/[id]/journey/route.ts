import { auth } from "@/auth"
import { loadSupplierProductJourney } from "@/lib/supplier-journey/product-journey.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/** SUPPLIER, read-only: where its product stands, from the sheet to the first sales. */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 })
  if ((session.user as { role?: string }).role !== "SUPPLIER") return Response.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await ctx.params
  const journey = await loadSupplierProductJourney(id, session.user.id)
  if (!journey) return Response.json({ error: "Product not found" }, { status: 404 })
  return Response.json(journey)
}
