import { auth } from "@/auth"
import { getSupplierProductRemoveImpact } from "@/lib/supplier-product-remove.server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }
  if ((session.user as { role?: string }).role !== "SUPPLIER") {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const impact = await getSupplierProductRemoveImpact(session.user.id, id)
  if (!impact) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  return Response.json(impact)
}
